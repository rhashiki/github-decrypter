import './model-gateway-bootstrap.js';
import './intelligence-bootstrap.js';
import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { GeminiAgent } from '../ai/gemini-agent.js';
import { buildProjectContext } from '../core/context-builder.js';
import { loadRecentUserEdits } from '../core/context-engine-v2.js';
import { syncRepositoryCache, getCachedFile } from '../core/repo-cache.js';
import { parseCommand } from '../core/command-parser.js';
import { assertSafeRepoPath, nowIso } from '../core/utils.js';
import { assertScopeLock } from '../core/scope-lock.js';
import { assertScopeIntelligence, scopeIntelligenceFingerprint } from '../core/scope-intelligence-v2.js';
import { HISTORY_KEY } from '../settings/config.js';
import {
  APPROVAL_SCHEMA,
  APPROVAL_TTL_MS,
  normalizeApprovalPlan,
  approvalFileWhitelist,
  canonicalApprovalPayload,
  validatePreparedFiles,
  assertRevision,
  assertHead,
  publicApproval
} from '../core/approval-transaction.js';

const PORT_NAME = 'ld2-approval-transaction';
const TX_PREFIX = 'ld2_approval_tx_v1_';
const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

const text = value => String(value ?? '').trim();
const txKey = id => `${TX_PREFIX}${text(id).replace(/[^a-z0-9-]/gi, '').slice(0, 100)}`;

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function activeGithub(settings, projectId) {
  const mapping = projectId && settings?.projectMappings?.[projectId] ? settings.projectMappings[projectId] : {};
  return { ...(settings?.github || {}), ...(mapping || {}) };
}

async function currentHead(adapter, branch) {
  const ref = await adapter.getRef(branch || 'main');
  return text(ref?.object?.sha || ref?.sha).toLowerCase();
}

function normalizeAttachments(raw = []) {
  const source = Array.isArray(raw) ? raw : [];
  if (source.length > MAX_ATTACHMENTS) throw new Error('APPROVAL_TOO_MANY_ATTACHMENTS');
  let total = 0;
  return source.map((item, index) => {
    const name = text(item?.name || `anexo-${index + 1}`).slice(0, 240);
    const mimeType = text(item?.mimeType || 'application/octet-stream').slice(0, 160);
    const size = Number(item?.size || 0);
    const data = String(item?.data || '');
    if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) throw new Error(`APPROVAL_ATTACHMENT_INVALID:${name}`);
    total += size;
    if (total > MAX_TOTAL_BYTES) throw new Error('APPROVAL_ATTACHMENTS_TOO_LARGE');
    if (!data) throw new Error(`APPROVAL_ATTACHMENT_EMPTY:${name}`);
    return { name, mimeType, size, data };
  });
}

function countOccurrences(haystack, needle) {
  let count = 0, from = 0;
  if (!needle) return 0;
  while ((from = haystack.indexOf(needle, from)) !== -1) { count++; from += needle.length; }
  return count;
}

function applyMinimalEdits(before, edits, path) {
  if (!Array.isArray(edits) || !edits.length) throw new Error(`APPROVAL_PATCH_REQUIRED:${path}`);
  let content = String(before ?? '');
  const originalLines = Math.max(1, content.split('\n').length);
  for (const edit of edits) {
    const search = String(edit?.search ?? '');
    const replace = String(edit?.replace ?? '');
    if (!search) throw new Error(`APPROVAL_PATCH_SEARCH_EMPTY:${path}`);
    if (countOccurrences(content, search) !== 1) throw new Error(`APPROVAL_PATCH_NOT_UNIQUE:${path}`);
    const searchLines = Math.max(1, search.split('\n').length);
    if (originalLines >= 30 && searchLines / originalLines > 0.65) throw new Error(`APPROVAL_PATCH_TOO_LARGE:${path}`);
    if (search.length > 24000) throw new Error(`APPROVAL_PATCH_TOO_LARGE:${path}`);
    content = content.replace(search, replace);
  }
  if (content === before) throw new Error(`APPROVAL_PATCH_NO_CHANGE:${path}`);
  return content;
}

function explicitDelete(command = '') {
  return /\b(remov(?:a|er)|exclu(?:a|ir)|apag(?:ue|ar)|delet(?:e|ar)|delete|remove)\b/i.test(String(command));
}

async function getTransaction(id) {
  const key = txKey(id);
  const stored = await chrome.storage.session.get(key);
  const tx = stored[key];
  if (!tx || tx.schema !== APPROVAL_SCHEMA) throw new Error('APPROVAL_TRANSACTION_NOT_FOUND');
  if (Date.parse(tx.expiresAt || '') <= Date.now()) {
    await chrome.storage.session.remove(key);
    throw new Error('APPROVAL_TRANSACTION_EXPIRED');
  }
  return tx;
}

async function saveTransaction(tx) {
  await chrome.storage.session.set({ [txKey(tx.id)]: tx });
  return tx;
}

function emit(port, id, stage, detail = '', status = 'active', extra = {}) {
  try { port.postMessage({ id, event: 'progress', stage, label: stage, detail, status, ...extra }); } catch (_) {}
}

async function freezeTransaction(payload = {}) {
  const projectId = text(payload.projectId).slice(0, 120);
  const command = text(payload.command).slice(0, 50000);
  const plan = normalizeApprovalPlan(payload.plan || {});
  const authorizedFiles = approvalFileWhitelist(plan).map(assertSafeRepoPath);
  const authorizedSet = new Set(authorizedFiles);
  const humanIntentOverrides = [...new Set((Array.isArray(payload.humanIntentOverrides) ? payload.humanIntentOverrides : [])
    .map(value => assertSafeRepoPath(value))
    .filter(path => authorizedSet.has(path)))].slice(0, 30);
  const stateRevision = text(payload.stateRevision).slice(0, 160);
  if (!projectId || !command) throw new Error('APPROVAL_CONTEXT_REQUIRED');
  if (!stateRevision) throw new Error('APPROVAL_STATE_REVISION_REQUIRED');
  if (!authorizedFiles.length) throw new Error('APPROVAL_PLAN_HAS_NO_FILES');
  const settings = await getSettings();
  const github = activeGithub(settings, projectId);
  if (!github?.owner || !github?.repo) throw new Error('APPROVAL_GITHUB_MAPPING_REQUIRED');
  const adapter = new GitAdapter(github);
  const head = await currentHead(adapter, github.branch);
  if (!head) throw new Error('APPROVAL_HEAD_UNAVAILABLE');
  const id = crypto.randomUUID();
  const decision = payload.decision === 'skip' ? 'skip' : 'approve';
  const canonical = canonicalApprovalPayload({
    projectId,
    command,
    plan,
    baseHeadSha: head,
    stateRevision,
    decision,
    source: payload.source || 'decrypter-chat',
    humanIntentOverrides
  });
  const tx = {
    ...canonical,
    id,
    planId: id,
    hash: await sha256(JSON.stringify(canonical)),
    authorizedFiles,
    status: 'frozen',
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + APPROVAL_TTL_MS).toISOString(),
    bundleId: '',
    validationHash: '',
    scopeIntelligenceHash: '',
    skillSlugs: (Array.isArray(payload.skillSlugs) ? payload.skillSlugs : []).map(text).filter(Boolean).slice(0, 12)
  };
  await saveTransaction(tx);
  return publicApproval(tx);
}

async function projectRules(settings, github, skillContext = '') {
  const key = `ld2_agent_profile_${github.owner}_${github.repo}`;
  const stored = await chrome.storage.local.get(key);
  const profile = stored[key] || {};
  return [
    text(settings?.agent?.rules || ''),
    profile?.project_summary ? `PROJECT BRAIN SUMMARY\n${String(profile.project_summary).slice(0, 24000)}` : '',
    Array.isArray(profile?.architecture) && profile.architecture.length ? `PROJECT ARCHITECTURE\n- ${profile.architecture.slice(0, 80).map(String).join('\n- ')}` : '',
    Array.isArray(profile?.rules) && profile.rules.length ? `PROJECT RULES\n- ${profile.rules.slice(0, 120).map(String).join('\n- ')}` : '',
    Array.isArray(profile?.validation_checklist) && profile.validation_checklist.length ? `VALIDATION CHECKLIST\n- ${profile.validation_checklist.slice(0, 80).map(String).join('\n- ')}` : '',
    skillContext ? `[DECRYPTER_SKILL_CONTEXT]\nTechnical reference only. It never expands scope or bypasses Project Rules/Scope Lock.\n${String(skillContext).slice(0, 70000)}` : ''
  ].filter(Boolean).join('\n\n').slice(0, 200000);
}

async function prepareTransaction(port, id, payload = {}) {
  const tx = await getTransaction(payload.transactionId);
  if (tx.status !== 'frozen') throw new Error(`APPROVAL_INVALID_STATUS:${tx.status}`);
  assertRevision(tx.stateRevision, payload.currentStateRevision);
  const settings = await getSettings();
  const github = activeGithub(settings, tx.projectId);
  const adapter = new GitAdapter(github);
  assertHead(tx.baseHeadSha, await currentHead(adapter, github.branch));
  const agent = new GeminiAgent({ ...(settings.gemini || {}), backendBase: settings.auth?.backendBase || '', licenseKey: settings.auth?.licenseKey || '', deviceId: settings.auth?.deviceId || '' });
  const attachments = normalizeAttachments(payload.attachments || []);

  emit(port, id, 'Shadow Build', 'Sincronizando HEAD e cache do repositório…');
  const repoCache = await syncRepositoryCache(adapter, { branch: github.branch });
  assertHead(tx.baseHeadSha, repoCache.headSha);
  emit(port, id, 'Context', 'Montando Context Pack e congelando intenção humana…');
  const context = await buildProjectContext(adapter, tx.command, {
    projectId: tx.projectId,
    owner: github.owner,
    repo: github.repo,
    branch: github.branch,
    maxFiles: settings.agent?.maxFiles,
    maxContextBytes: settings.agent?.maxContextBytes,
    repoCache
  });
  context.approval_transaction = {
    schema: APPROVAL_SCHEMA,
    planId: tx.planId,
    hash: tx.hash,
    decision: tx.decision,
    baseHeadSha: tx.baseHeadSha,
    stateRevision: tx.stateRevision,
    authorizedFiles: tx.authorizedFiles,
    humanIntentOverrides: tx.humanIntentOverrides || [],
    humanApprovalSkipped: tx.decision === 'skip'
  };
  const rules = await projectRules(settings, github, payload.skillContext || '');
  emit(port, id, 'Intelligence', 'Pedido → plano → diff · Human Intent Locks · Scope Lock…');
  const result = await agent.processCommand(tx.command, context, rules, attachments, tx.plan);
  const preparedCheck = validatePreparedFiles(result?.files || [], tx.authorizedFiles);
  if (!preparedCheck.ok) throw new Error(`APPROVAL_SCOPE_VIOLATION:${preparedCheck.violations.join('|')}`);

  const beforeByPath = new Map((context.files || []).map(file => [file.path, file.content]));
  for (const file of result.files) {
    file.path = assertSafeRepoPath(file.path);
    if (!beforeByPath.has(file.path) && file.action !== 'create') {
      try {
        const cached = await getCachedFile(repoCache, file.path);
        if (cached) beforeByPath.set(file.path, cached.content);
        else beforeByPath.set(file.path, (await adapter.getFileByPath(file.path, github.branch)).text);
      } catch (_) { beforeByPath.set(file.path, ''); }
    }
    file.before = beforeByPath.get(file.path) || '';
    if (file.action === 'update') {
      if (!file.before) throw new Error(`APPROVAL_CURRENT_FILE_UNAVAILABLE:${file.path}`);
      file.content = applyMinimalEdits(file.before, file.edits, file.path);
    } else if (file.action === 'create') {
      if (!String(file.content || '')) throw new Error(`APPROVAL_CREATE_EMPTY:${file.path}`);
      if (Array.isArray(file.edits) && file.edits.length) throw new Error(`APPROVAL_CREATE_EDITS_FORBIDDEN:${file.path}`);
    } else if (file.action === 'delete') {
      if (!explicitDelete(tx.command)) throw new Error(`APPROVAL_DELETE_NOT_EXPLICIT:${file.path}`);
      file.content = '';
    } else throw new Error(`APPROVAL_ACTION_INVALID:${file.path}`);
  }

  assertRevision(tx.stateRevision, payload.currentStateRevision);
  assertHead(tx.baseHeadSha, await currentHead(adapter, github.branch));
  const recentUserEdits = Array.isArray(context.recentUserEdits) ? context.recentUserEdits : await loadRecentUserEdits(tx.projectId, 80);
  const scopeIntelligence = assertScopeIntelligence({
    command: tx.command,
    approvedPlan: tx.plan,
    files: result.files,
    recentUserEdits,
    humanIntentOverrides: tx.humanIntentOverrides || [],
    decision: tx.decision
  });
  const scopeIntelligenceHash = await sha256(JSON.stringify(scopeIntelligenceFingerprint(scopeIntelligence)));
  const bundle = {
    id: crypto.randomUUID(),
    createdAt: nowIso(),
    command: tx.command,
    parsed: parseCommand(tx.command),
    github: { owner: github.owner, repo: github.repo, branch: github.branch },
    baseHeadSha: tx.baseHeadSha,
    settings: { createBranch: false, createPr: false },
    attachments: attachments.map(({ name, mimeType, size }) => ({ name, mimeType, size })),
    approval: publicApproval({ ...tx, scopeIntelligenceHash }),
    plan: result,
    scopeIntelligence
  };
  bundle.scopeLock = assertScopeLock(bundle);
  const validationHash = await sha256(JSON.stringify({
    tx: tx.hash,
    base: bundle.baseHeadSha,
    files: preparedCheck.files,
    scopeIntelligenceHash
  }));
  tx.status = 'validated';
  tx.bundleId = bundle.id;
  tx.validationHash = validationHash;
  tx.scopeIntelligenceHash = scopeIntelligenceHash;
  tx.scopeValidatedAt = nowIso();
  await Promise.all([
    saveTransaction(tx),
    chrome.storage.local.set({ [`ld2_pending_${bundle.id}`]: bundle })
  ]);
  emit(port, id, 'Validation Gate', `${result.files.length} arquivo(s) · Scope Intelligence v2 OK · Human Intent preservado`, 'done');
  return {
    transaction: publicApproval(tx),
    scopeIntelligence,
    bundle: {
      id: bundle.id,
      baseHeadSha: bundle.baseHeadSha,
      summary: String(result.summary || ''),
      files: result.files.map(file => ({ path: file.path, action: file.action, before: file.before, content: file.content, explanation: file.explanation || '' })),
      warnings: [...(result.warnings || []), ...(scopeIntelligence.warnings || []).map(item => item.message || item.code)]
    }
  };
}

async function pushHistory(entry) {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const list = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
  list.unshift({ id: crypto.randomUUID(), at: nowIso(), ...entry });
  await chrome.storage.local.set({ [HISTORY_KEY]: list.slice(0, 100) });
}

async function applyTransaction(port, id, payload = {}) {
  const tx = await getTransaction(payload.transactionId);
  if (tx.status === 'applied') throw new Error('APPROVAL_ALREADY_APPLIED');
  if (tx.status !== 'validated' || !tx.bundleId || !tx.validationHash || !tx.scopeIntelligenceHash) throw new Error('APPROVAL_NOT_VALIDATED');
  assertRevision(tx.stateRevision, payload.currentStateRevision);
  const pendingKey = `ld2_pending_${tx.bundleId}`;
  const stored = await chrome.storage.local.get(pendingKey);
  const bundle = stored[pendingKey];
  if (!bundle) throw new Error('APPROVAL_SHADOW_BUNDLE_EXPIRED');
  if (bundle?.approval?.hash && bundle.approval.hash !== tx.hash) throw new Error('APPROVAL_BUNDLE_HASH_MISMATCH');
  bundle.scopeLock = assertScopeLock(bundle);
  const settings = await getSettings();
  const github = activeGithub(settings, tx.projectId);
  const adapter = new GitAdapter({ ...github, ...bundle.github });
  assertHead(tx.baseHeadSha, await currentHead(adapter, bundle.github.branch));
  const check = validatePreparedFiles(bundle.plan?.files || [], tx.authorizedFiles);
  if (!check.ok) throw new Error(`APPROVAL_SCOPE_VIOLATION:${check.violations.join('|')}`);

  emit(port, id, 'Scope Intelligence', 'Revalidando intenção humana imediatamente antes do write…');
  const currentUserEdits = await loadRecentUserEdits(tx.projectId, 80);
  const scopeIntelligence = assertScopeIntelligence({
    command: tx.command,
    approvedPlan: tx.plan,
    files: bundle.plan?.files || [],
    recentUserEdits: currentUserEdits,
    humanIntentOverrides: tx.humanIntentOverrides || [],
    decision: tx.decision
  });
  const scopeIntelligenceHash = await sha256(JSON.stringify(scopeIntelligenceFingerprint(scopeIntelligence)));
  if (scopeIntelligenceHash !== tx.scopeIntelligenceHash) {
    const error = new Error('SCOPE_INTELLIGENCE_CHANGED_AFTER_VALIDATION');
    error.code = 'SCOPE_INTELLIGENCE_CHANGED_AFTER_VALIDATION';
    error.scopeIntelligence = scopeIntelligence;
    throw error;
  }
  const validationHash = await sha256(JSON.stringify({
    tx: tx.hash,
    base: bundle.baseHeadSha,
    files: check.files,
    scopeIntelligenceHash
  }));
  if (validationHash !== tx.validationHash) throw new Error('APPROVAL_VALIDATION_HASH_CHANGED');
  bundle.scopeIntelligence = scopeIntelligence;

  emit(port, id, 'Guarded Commit', tx.decision === 'skip' ? 'Pular aprovação humana · Scope Intelligence continua obrigatório…' : 'Plano aprovado · escopo e intenção humana revalidados…');
  const result = await adapter.atomicCommit({
    files: bundle.plan.files.map(({ path, action, content }) => ({ path, action, content })),
    message: bundle.plan.commit_message || `fix: ${bundle.plan.summary || 'Lovable Decrypter approved changes'}`,
    baseBranch: bundle.github.branch,
    createBranch: false,
    createPr: false
  });
  if (!text(result?.commitSha)) throw new Error('APPROVAL_COMMIT_SHA_MISSING');
  tx.status = 'applied';
  tx.appliedAt = nowIso();
  tx.commitSha = text(result.commitSha);
  await Promise.all([
    saveTransaction(tx),
    chrome.storage.local.remove(pendingKey),
    pushHistory({
      type: 'approval-auto-repair',
      decision: tx.decision,
      command: tx.command,
      repo: `${bundle.github.owner}/${bundle.github.repo}`,
      transactionId: tx.id,
      planHash: tx.hash,
      scopeIntelligenceHash,
      humanIntentOverrides: tx.humanIntentOverrides || [],
      result
    })
  ]);
  syncRepositoryCache(adapter, { branch: bundle.github.branch }).catch(() => null);
  emit(port, id, 'Concluído', `Commit ${tx.commitSha.slice(0, 8)} · escopo + Human Intent preservados`, 'done');
  return { transaction: publicApproval(tx), scopeIntelligence, result };
}

async function cancelTransaction(payload = {}) {
  const tx = await getTransaction(payload.transactionId);
  if (tx.status === 'applied') throw new Error('APPROVAL_ALREADY_APPLIED');
  if (tx.bundleId) await chrome.storage.local.remove(`ld2_pending_${tx.bundleId}`);
  tx.status = 'cancelled';
  tx.cancelledAt = nowIso();
  await saveTransaction(tx);
  return publicApproval(tx);
}

export function installApprovalRuntime() {
  if (globalThis.__LD2_APPROVAL_RUNTIME__) return;
  globalThis.__LD2_APPROVAL_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = text(message?.id);
      try {
        const action = text(message?.action);
        let data;
        if (action === 'freeze') data = await freezeTransaction(message.payload || {});
        else if (action === 'prepare') data = await prepareTransaction(port, id, message.payload || {});
        else if (action === 'apply') data = await applyTransaction(port, id, message.payload || {});
        else if (action === 'status') data = publicApproval(await getTransaction(message?.payload?.transactionId));
        else if (action === 'cancel') data = await cancelTransaction(message.payload || {});
        else throw new Error('APPROVAL_ACTION_INVALID');
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || '',
            scopeIntelligence: error?.scopeIntelligence || null
          });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });
}

export const ApprovalRuntime = Object.freeze({
  build: 30,
  scopeIntelligenceBuild: 65,
  schema: APPROVAL_SCHEMA,
  port: PORT_NAME,
  humanApprovalCanBeSkipped: true,
  protectionsCanBeSkipped: false,
  scopeIntelligenceCanBeSkipped: false,
  genericPlanApprovalOverridesHumanIntent: false,
  directLovableSend: false,
  arbitraryAssetFetch: false,
  secretRecovery: false
});
