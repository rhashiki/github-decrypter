import { evaluateScopeLock } from './scope-lock.js';

export const SCOPE_INTELLIGENCE_SCHEMA = 'ld-scope-intelligence/2';
export const HUMAN_INTENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const BROAD_SCOPE = /\b(projeto inteiro|aplica(?:r)? em tudo|todos os arquivos|refatora(?:r)? (?:o )?projeto|migra(?:r|ção) completa|reestrutura(?:r)? (?:o )?projeto|whole project|entire project|all files)\b/i;
const CREATE_INTENT = /\b(cria(?:r|e)|adiciona(?:r|e)|novo arquivo|new file|create|add)\b/i;
const DELETE_INTENT = /\b(apaga(?:r)?|exclu(?:ir|a)|remove(?:r)?|deleta(?:r)?|delete|remove)\b/i;

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => text(value, 1200)).filter(Boolean))];
const safePath = value => text(value, 1200).replace(/\\/g, '/').replace(/^\/+/, '');

function normalizedPlan(plan = {}) {
  return {
    summary: text(plan?.summary, 12000),
    steps: (Array.isArray(plan?.plan) ? plan.plan : []).map(value => text(value, 4000)).filter(Boolean).slice(0, 40),
    files: (Array.isArray(plan?.files) ? plan.files : []).map(file => ({
      path: safePath(file?.path || file),
      reason: text(file?.reason || file?.explanation, 2400),
      action: ['create', 'update', 'delete'].includes(String(file?.action || '').toLowerCase()) ? String(file.action).toLowerCase() : ''
    })).filter(file => file.path).slice(0, 40)
  };
}

function recentTimestamp(value, nowMs) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) && parsed > 0 && nowMs - parsed <= HUMAN_INTENT_WINDOW_MS;
}

export function deriveHumanIntentLocks(userEdits = [], { now = Date.now() } = {}) {
  const byPath = new Map();
  for (const event of Array.isArray(userEdits) ? userEdits : []) {
    if (String(event?.origin || '') !== 'user' || !recentTimestamp(event?.observedAt, now)) continue;
    for (const rawPath of Array.isArray(event?.paths) ? event.paths : []) {
      const path = safePath(rawPath);
      if (!path) continue;
      const current = byPath.get(path) || { path, count: 0, eventIds: [], evidence: [], lastObservedAt: '' };
      current.count += 1;
      if (event?.id) current.eventIds.push(text(event.id, 160));
      current.evidence.push(...unique(event?.evidence).slice(0, 8));
      if (!current.lastObservedAt || Date.parse(event.observedAt || '') > Date.parse(current.lastObservedAt || '')) current.lastObservedAt = text(event.observedAt, 80);
      byPath.set(path, current);
    }
  }
  return [...byPath.values()].map(lock => Object.freeze({
    path: lock.path,
    level: lock.count >= 2 ? 'strong' : 'soft',
    count: lock.count,
    eventIds: unique(lock.eventIds).slice(0, 12),
    evidence: unique(lock.evidence).slice(0, 12),
    lastObservedAt: lock.lastObservedAt,
    policy: lock.count >= 2 ? 'explicit-path-override-required' : 'preserve-unless-current-request-explicitly-targets-path'
  })).sort((a, b) => a.path.localeCompare(b.path));
}

function requestExplicitlyTargetsPath(command = '', path = '') {
  const raw = normalize(command);
  const cleanPath = normalize(safePath(path));
  if (!raw || !cleanPath) return false;
  if (raw.includes(cleanPath)) return true;
  const base = cleanPath.split('/').pop() || '';
  return base.length >= 5 && raw.includes(base);
}

function lineDelta(before = '', after = '') {
  const left = String(before ?? '').split('\n');
  const right = String(after ?? '').split('\n');
  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < left.length - prefix && suffix < right.length - prefix && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix += 1;
  const removed = Math.max(0, left.length - prefix - suffix);
  const added = Math.max(0, right.length - prefix - suffix);
  const touched = Math.max(removed, added);
  const baseLines = Math.max(1, left.length);
  return {
    beforeLines: left.length,
    afterLines: right.length,
    addedLines: added,
    removedLines: removed,
    touchedLines: touched,
    touchedRatio: Number((touched / baseLines).toFixed(4)),
    commonPrefixLines: prefix,
    commonSuffixLines: suffix
  };
}

function planReasonFor(path, plan) {
  return plan.files.find(file => file.path === path)?.reason || '';
}

function actionIntentSupported(action, command, reason) {
  const combined = `${command}\n${reason}`;
  if (action === 'create') return CREATE_INTENT.test(normalize(combined));
  if (action === 'delete') return DELETE_INTENT.test(normalize(combined));
  return true;
}

function compactExternalSignals(userEdits = [], touchedPaths = new Set(), now = Date.now()) {
  const signals = [];
  for (const event of Array.isArray(userEdits) ? userEdits : []) {
    if (String(event?.origin || '') !== 'external' || !recentTimestamp(event?.observedAt, now)) continue;
    const paths = unique(event?.paths).map(safePath).filter(path => touchedPaths.has(path));
    if (!paths.length) continue;
    signals.push({ id: text(event?.id, 160), observedAt: text(event?.observedAt, 80), paths, evidence: unique(event?.evidence).slice(0, 8) });
  }
  return signals.slice(0, 20);
}

function canonicalFileAudit(file = {}, plan = {}) {
  const path = safePath(file?.path);
  const action = String(file?.action || '').toLowerCase();
  const before = typeof file?.before === 'string' ? file.before : '';
  const after = typeof file?.content === 'string' ? file.content : '';
  const delta = action === 'update' ? lineDelta(before, after) : {
    beforeLines: before ? before.split('\n').length : 0,
    afterLines: after ? after.split('\n').length : 0,
    addedLines: action === 'create' ? Math.max(1, after.split('\n').length) : 0,
    removedLines: action === 'delete' ? Math.max(1, before.split('\n').length) : 0,
    touchedLines: action === 'create' ? Math.max(1, after.split('\n').length) : action === 'delete' ? Math.max(1, before.split('\n').length) : 0,
    touchedRatio: action === 'update' ? 0 : 1,
    commonPrefixLines: 0,
    commonSuffixLines: 0
  };
  return {
    path,
    action,
    inApprovedPlan: plan.files.some(item => item.path === path),
    approvedReason: planReasonFor(path, plan),
    delta
  };
}

export function evaluateScopeIntelligence({
  command = '',
  approvedPlan = {},
  files = [],
  recentUserEdits = [],
  humanIntentOverrides = [],
  decision = 'approve',
  now = Date.now()
} = {}) {
  const request = text(command, 50000);
  const plan = normalizedPlan(approvedPlan);
  const overrideSet = new Set(unique(humanIntentOverrides).map(safePath));
  const audits = (Array.isArray(files) ? files : []).map(file => canonicalFileAudit(file, plan));
  const touchedPaths = new Set(audits.map(item => item.path).filter(Boolean));
  const approvedPaths = new Set(plan.files.map(item => item.path));
  const violations = [];
  const warnings = [];
  const reasons = [];

  if (!request) violations.push({ code: 'request-missing', message: 'Pedido original ausente.' });
  if (!plan.files.length) violations.push({ code: 'approved-plan-empty', message: 'Plano aprovado não contém arquivos.' });
  if (!audits.length) violations.push({ code: 'diff-empty', message: 'Nenhuma alteração preparada para comparar.' });

  const seen = new Set();
  for (const audit of audits) {
    if (!audit.path) { violations.push({ code: 'diff-path-missing', message: 'Alteração preparada sem path.' }); continue; }
    if (seen.has(audit.path)) violations.push({ code: 'duplicate-diff-path', path: audit.path, message: `Path duplicado no diff: ${audit.path}` });
    seen.add(audit.path);
    if (!approvedPaths.has(audit.path)) violations.push({ code: 'outside-approved-plan', path: audit.path, message: `Arquivo fora do plano aprovado: ${audit.path}` });
    if (!['create', 'update', 'delete'].includes(audit.action)) violations.push({ code: 'invalid-action', path: audit.path, message: `Ação inválida: ${audit.path}` });
    if (!actionIntentSupported(audit.action, request, audit.approvedReason)) {
      const code = audit.action === 'delete' ? 'delete-intent-missing' : 'create-intent-weak';
      const item = { code, path: audit.path, message: `${audit.action === 'delete' ? 'Exclusão' : 'Criação'} sem intenção explícita suficiente: ${audit.path}` };
      if (audit.action === 'delete') violations.push(item); else warnings.push(item);
    }
    if (audit.action === 'update') {
      if (audit.delta.beforeLines >= 30 && audit.delta.touchedRatio > 0.55 && !BROAD_SCOPE.test(normalize(request))) {
        violations.push({ code: 'broad-rewrite', path: audit.path, ratio: audit.delta.touchedRatio, message: `Reescrita ampla não autorizada em ${audit.path} (${Math.round(audit.delta.touchedRatio * 100)}% das linhas).` });
      } else if (audit.delta.beforeLines >= 30 && audit.delta.touchedRatio > 0.35) {
        warnings.push({ code: 'large-diff', path: audit.path, ratio: audit.delta.touchedRatio, message: `Diff amplo em ${audit.path} (${Math.round(audit.delta.touchedRatio * 100)}% das linhas).` });
      }
    }
  }

  const scopeLock = evaluateScopeLock({ command: request, plan: { files: audits } });
  for (const message of scopeLock.violations || []) violations.push({ code: 'scope-lock', message });
  for (const message of scopeLock.warnings || []) warnings.push({ code: 'scope-lock-warning', message });

  const allLocks = deriveHumanIntentLocks(recentUserEdits, { now });
  const touchedLocks = allLocks.filter(lock => touchedPaths.has(lock.path));
  const overridesRequired = [];
  const overridesUsed = [];
  for (const lock of touchedLocks) {
    if (overrideSet.has(lock.path)) {
      overridesUsed.push(lock.path);
      warnings.push({ code: 'human-intent-explicit-override', path: lock.path, level: lock.level, message: `Sobreposição humana autorizada explicitamente: ${lock.path}.` });
      continue;
    }
    const explicitTarget = requestExplicitlyTargetsPath(request, lock.path);
    if (lock.level === 'soft' && explicitTarget) {
      warnings.push({ code: 'human-intent-soft-lock-explicit-target', path: lock.path, level: lock.level, message: `Pedido atual cita explicitamente ${lock.path}; soft lock preservado como aviso.` });
      continue;
    }
    overridesRequired.push(lock.path);
    violations.push({
      code: 'human-intent-override-required',
      path: lock.path,
      level: lock.level,
      message: `${lock.level === 'strong' ? 'Strong' : 'Soft'} User Intent Lock em ${lock.path}; é necessária autorização específica para sobrepor a alteração manual.`
    });
  }

  const externalSignals = compactExternalSignals(recentUserEdits, touchedPaths, now);
  for (const signal of externalSignals) {
    for (const path of signal.paths) warnings.push({ code: 'external-change-signal', path, message: `Mudança externa recente observada em ${path}; validar estado atual antes do write.` });
  }

  const outOfPlan = audits.filter(item => !item.inApprovedPlan).map(item => item.path);
  const allowed = violations.length === 0;
  if (allowed) reasons.push('request-plan-diff-consistent');
  if (touchedLocks.length && !overridesRequired.length) reasons.push('human-intent-accounted-for');
  if (!touchedLocks.length) reasons.push('no-human-intent-overlap');

  return Object.freeze({
    schema: SCOPE_INTELLIGENCE_SCHEMA,
    allowed,
    enforcement: 'fail-closed-before-write',
    decision: decision === 'skip' ? 'skip' : 'approve',
    requestToPlan: {
      approvedPaths: [...approvedPaths],
      plannedFileCount: approvedPaths.size,
      preparedFileCount: audits.length
    },
    planToDiff: {
      audits,
      outOfPlan,
      changedPaths: [...touchedPaths]
    },
    humanIntent: {
      policy: 'USER_EDIT > AI_EDIT',
      locks: touchedLocks,
      overridesRequired: unique(overridesRequired),
      overridesUsed: unique(overridesUsed),
      explicitOverrideOnlyForStrongLocks: true,
      externalSignals
    },
    legacyScopeLock: scopeLock,
    reasons,
    warnings,
    violations
  });
}

export function scopeIntelligenceFingerprint(report = {}) {
  return {
    schema: SCOPE_INTELLIGENCE_SCHEMA,
    allowed: report?.allowed === true,
    decision: String(report?.decision || ''),
    changedPaths: unique(report?.planToDiff?.changedPaths).sort(),
    audits: (Array.isArray(report?.planToDiff?.audits) ? report.planToDiff.audits : []).map(item => ({
      path: safePath(item?.path),
      action: String(item?.action || ''),
      inApprovedPlan: item?.inApprovedPlan === true,
      touchedLines: Number(item?.delta?.touchedLines || 0),
      touchedRatio: Number(item?.delta?.touchedRatio || 0)
    })).sort((a, b) => a.path.localeCompare(b.path)),
    humanLocks: (Array.isArray(report?.humanIntent?.locks) ? report.humanIntent.locks : []).map(lock => ({
      path: safePath(lock?.path), level: String(lock?.level || ''), count: Number(lock?.count || 0), eventIds: unique(lock?.eventIds).sort()
    })).sort((a, b) => a.path.localeCompare(b.path)),
    overridesUsed: unique(report?.humanIntent?.overridesUsed).sort(),
    overridesRequired: unique(report?.humanIntent?.overridesRequired).sort(),
    violationCodes: (Array.isArray(report?.violations) ? report.violations : []).map(item => `${String(item?.code || '')}:${safePath(item?.path || '')}`).sort()
  };
}

export function assertScopeIntelligence(input = {}) {
  const report = evaluateScopeIntelligence(input);
  if (!report.allowed) {
    const details = report.violations.slice(0, 8).map(item => item.message || item.code).join(' | ');
    const error = new Error(`SCOPE_INTELLIGENCE_BLOCKED: ${details}`);
    error.code = 'SCOPE_INTELLIGENCE_BLOCKED';
    error.scopeIntelligence = report;
    throw error;
  }
  return report;
}
