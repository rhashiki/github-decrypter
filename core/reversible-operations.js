import { assertSafeRepoPath, isSensitivePath, isTextPath } from './utils.js';
import { renderPatchPreview, sha256Text } from './patch-engine.js';

export const REVERSIBLE_OPERATIONS_SCHEMA = 'ld-reversible-operation/1';
export const REVERSAL_STRATEGIES = Object.freeze(['preserve', 'replace-target', 'cascade']);

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const safePath = value => assertSafeRepoPath(String(value || '').replace(/\\/g, '/').replace(/^\/+/, ''));
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => String(value || '').trim()).filter(Boolean))];

export function normalizeReversalDirection(value = 'undo') {
  return String(value || '').toLowerCase() === 'redo' ? 'redo' : 'undo';
}

export function normalizeReversalStrategy(value = 'preserve') {
  const strategy = String(value || '').toLowerCase();
  return REVERSAL_STRATEGIES.includes(strategy) ? strategy : 'preserve';
}

function splitLines(value = '') { return String(value ?? '').split('\n'); }
function linesEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}
function sliceEqual(source, start, expected) {
  if (start < 0 || start + expected.length > source.length) return false;
  for (let i = 0; i < expected.length; i += 1) if (source[start + i] !== expected[i]) return false;
  return true;
}

export function deriveThreeWayHunk(fromText = '', toText = '', anchorLines = 3) {
  const from = splitLines(fromText);
  const to = splitLines(toText);
  let prefix = 0;
  while (prefix < from.length && prefix < to.length && from[prefix] === to[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < from.length - prefix && suffix < to.length - prefix && from[from.length - 1 - suffix] === to[to.length - 1 - suffix]) suffix += 1;
  const anchors = Math.max(1, Math.min(8, Number(anchorLines || 3)));
  return Object.freeze({
    prefixLines: prefix,
    suffixLines: suffix,
    fromSegment: from.slice(prefix, from.length - suffix),
    toSegment: to.slice(prefix, to.length - suffix),
    prefixAnchor: from.slice(Math.max(0, prefix - anchors), prefix),
    suffixAnchor: from.slice(from.length - suffix, Math.min(from.length, from.length - suffix + anchors))
  });
}

function sequenceMatches(lines, sequence) {
  const matches = [];
  if (!sequence.length) return matches;
  for (let i = 0; i <= lines.length - sequence.length; i += 1) {
    if (sliceEqual(lines, i, sequence)) matches.push(i);
  }
  return matches;
}

function boundaryMatches(lines, index, prefixAnchor, suffixAnchor) {
  if (prefixAnchor.length && !sliceEqual(lines, index - prefixAnchor.length, prefixAnchor)) return false;
  if (suffixAnchor.length && !sliceEqual(lines, index, suffixAnchor)) return false;
  return true;
}

export function applyThreeWayHunk(currentText = '', hunk = {}) {
  const current = splitLines(currentText);
  const fromSegment = Array.isArray(hunk.fromSegment) ? hunk.fromSegment : [];
  const toSegment = Array.isArray(hunk.toSegment) ? hunk.toSegment : [];
  const prefixAnchor = Array.isArray(hunk.prefixAnchor) ? hunk.prefixAnchor : [];
  const suffixAnchor = Array.isArray(hunk.suffixAnchor) ? hunk.suffixAnchor : [];

  let candidates = [];
  if (fromSegment.length) {
    candidates = sequenceMatches(current, fromSegment).filter(index => {
      const beforeOk = !prefixAnchor.length || sliceEqual(current, index - prefixAnchor.length, prefixAnchor);
      const afterIndex = index + fromSegment.length;
      const afterOk = !suffixAnchor.length || sliceEqual(current, afterIndex, suffixAnchor);
      return beforeOk && afterOk;
    });
    if (!candidates.length) candidates = sequenceMatches(current, fromSegment);
  } else {
    for (let i = 0; i <= current.length; i += 1) {
      if (boundaryMatches(current, i, prefixAnchor, suffixAnchor)) candidates.push(i);
    }
  }

  if (candidates.length !== 1) {
    return Object.freeze({
      ok: false,
      code: candidates.length ? 'REVERSAL_HUNK_AMBIGUOUS' : 'REVERSAL_HUNK_CONFLICT',
      candidates: candidates.length,
      content: String(currentText ?? '')
    });
  }

  const index = candidates[0];
  const next = [...current];
  next.splice(index, fromSegment.length, ...toSegment);
  return Object.freeze({ ok: true, code: 'OK', content: next.join('\n'), index });
}

function compactLaterHumanEdits(rows = [], path = '') {
  return (Array.isArray(rows) ? rows : [])
    .filter(item => item?.origin === 'user' && Array.isArray(item?.paths) && item.paths.includes(path))
    .slice(0, 12)
    .map(item => ({ id: text(item.id, 160), observedAt: text(item.observedAt, 80), evidence: unique(item.evidence).slice(0, 8) }));
}

function desiredStates(frame = {}, direction = 'undo') {
  const base = frame?.base || { exists: false, content: '', blobSha: '' };
  const applied = frame?.applied || { exists: false, content: '', blobSha: '' };
  return direction === 'redo' ? { from: base, to: applied } : { from: applied, to: base };
}

function stateEqual(a = {}, b = {}) {
  return Boolean(a?.exists) === Boolean(b?.exists) && (!a?.exists || String(a?.content ?? '') === String(b?.content ?? ''));
}

export async function planFileReversal(frame = {}, options = {}) {
  const path = safePath(frame?.path || '');
  const direction = normalizeReversalDirection(options.direction);
  const strategy = normalizeReversalStrategy(options.strategy);
  const current = frame?.current || { exists: false, content: '', blobSha: '' };
  const { from, to } = desiredStates(frame, direction);
  const laterHumanEdits = compactLaterHumanEdits(options.laterHumanEdits, path);
  const humanAfterTarget = laterHumanEdits.length > 0;
  const result = {
    path,
    direction,
    strategy,
    status: 'ready',
    action: '',
    destructive: false,
    conflict: null,
    laterHumanEdits,
    baseBlobSha: text(frame?.base?.blobSha, 128),
    appliedBlobSha: text(frame?.applied?.blobSha, 128),
    currentBlobSha: text(current?.blobSha, 128),
    proposedContent: '',
    preview: '',
    beforeHash: current?.exists ? await sha256Text(current.content || '') : '',
    afterHash: ''
  };

  if (isSensitivePath(path)) {
    result.status = 'blocked';
    result.conflict = { code: 'REVERSAL_SENSITIVE_PATH_BLOCKED', message: `Caminho sensível não pode ser revertido automaticamente: ${path}` };
    return Object.freeze(result);
  }
  if (strategy !== 'replace-target' && (!isTextPath(path) && (from?.exists || to?.exists))) {
    result.status = 'blocked';
    result.conflict = { code: 'REVERSAL_NON_TEXT_REQUIRES_DESTRUCTIVE_STRATEGY', message: `Arquivo não textual exige estratégia destrutiva explícita: ${path}` };
    return Object.freeze(result);
  }

  if (stateEqual(current, to)) {
    result.status = 'noop';
    result.action = 'none';
    result.proposedContent = current?.content || '';
    result.afterHash = result.beforeHash;
    return Object.freeze(result);
  }

  if (strategy === 'replace-target') {
    result.destructive = !stateEqual(current, from);
    if (!to?.exists) {
      result.action = 'delete';
      result.afterHash = '';
      result.preview = current?.exists ? renderPatchPreview(current.content || '', '') : '';
    } else {
      result.action = current?.exists ? 'update' : 'create';
      result.proposedContent = String(to.content ?? '');
      result.afterHash = await sha256Text(result.proposedContent);
      result.preview = renderPatchPreview(current?.exists ? current.content || '' : '', result.proposedContent);
    }
    return Object.freeze(result);
  }

  // Preserve/manual-intent strategy.
  if (from?.exists && to?.exists) {
    if (!current?.exists) {
      result.status = 'conflict';
      result.conflict = { code: 'REVERSAL_CURRENT_FILE_MISSING', message: `Arquivo atual ausente: ${path}` };
      return Object.freeze(result);
    }
    if (String(current.content ?? '') === String(from.content ?? '')) {
      if (humanAfterTarget) {
        result.status = 'conflict';
        result.conflict = { code: 'REVERSAL_HUMAN_EDIT_NOT_REFLECTED_IN_GIT', message: `Há edição humana posterior em ${path}, mas ela não está refletida no Git atual.` };
        return Object.freeze(result);
      }
      result.action = 'update';
      result.proposedContent = String(to.content ?? '');
    } else {
      const hunk = deriveThreeWayHunk(String(from.content ?? ''), String(to.content ?? ''));
      const merged = applyThreeWayHunk(String(current.content ?? ''), hunk);
      if (!merged.ok) {
        result.status = 'conflict';
        result.conflict = { code: merged.code, message: `Conflito de 3-way merge em ${path}.`, candidates: merged.candidates };
        return Object.freeze(result);
      }
      result.action = 'update';
      result.proposedContent = merged.content;
    }
  } else if (from?.exists && !to?.exists) {
    if (!current?.exists) {
      result.status = 'noop';
      result.action = 'none';
      result.afterHash = result.beforeHash;
      return Object.freeze(result);
    }
    if (String(current.content ?? '') !== String(from.content ?? '') || humanAfterTarget) {
      result.status = 'conflict';
      result.conflict = {
        code: humanAfterTarget ? 'REVERSAL_DELETE_WOULD_DISCARD_HUMAN_EDIT' : 'REVERSAL_DELETE_CONFLICT',
        message: `Remover ${path} descartaria alterações posteriores.`
      };
      return Object.freeze(result);
    }
    result.action = 'delete';
  } else if (!from?.exists && to?.exists) {
    if (current?.exists) {
      result.status = 'conflict';
      result.conflict = { code: 'REVERSAL_CREATE_CONFLICT', message: `Não é seguro recriar ${path}; o caminho existe atualmente.` };
      return Object.freeze(result);
    }
    if (humanAfterTarget) {
      result.status = 'conflict';
      result.conflict = { code: 'REVERSAL_HUMAN_EDIT_NOT_REFLECTED_IN_GIT', message: `Há edição humana posterior em ${path} não refletida no Git atual.` };
      return Object.freeze(result);
    }
    result.action = 'create';
    result.proposedContent = String(to.content ?? '');
  } else {
    result.status = 'noop';
    result.action = 'none';
    return Object.freeze(result);
  }

  if (result.action !== 'delete' && result.action !== 'none') result.afterHash = await sha256Text(result.proposedContent);
  result.preview = result.action === 'delete'
    ? renderPatchPreview(current?.content || '', '')
    : result.action === 'none' ? '' : renderPatchPreview(current?.exists ? current.content || '' : '', result.proposedContent);
  return Object.freeze(result);
}

export async function buildReversalPlan({ operation = {}, frames = [], direction = 'undo', strategy = 'preserve', laterHumanEdits = [], dependentOperations = [] } = {}) {
  const normalizedDirection = normalizeReversalDirection(direction);
  const normalizedStrategy = normalizeReversalStrategy(strategy);
  const files = [];
  for (const frame of Array.isArray(frames) ? frames : []) {
    files.push(await planFileReversal(frame, { direction: normalizedDirection, strategy: normalizedStrategy, laterHumanEdits }));
  }
  const conflicts = files.filter(file => ['conflict', 'blocked'].includes(file.status));
  const changes = files.filter(file => file.status === 'ready' && file.action !== 'none');
  const noops = files.filter(file => file.status === 'noop');
  const destructive = normalizedStrategy !== 'preserve' || changes.some(file => file.destructive);
  return Object.freeze({
    schema: REVERSIBLE_OPERATIONS_SCHEMA,
    operationId: text(operation?.id, 160),
    sourceCommitSha: text(operation?.result?.commitSha, 128),
    direction: normalizedDirection,
    strategy: normalizedStrategy,
    allowed: conflicts.length === 0 && changes.length > 0,
    destructive,
    files,
    conflicts: conflicts.map(file => ({ path: file.path, ...file.conflict })),
    changes: changes.map(file => ({ path: file.path, action: file.action, destructive: file.destructive })),
    noops: noops.map(file => file.path),
    dependentOperations: (Array.isArray(dependentOperations) ? dependentOperations : []).slice(0, 50).map(item => ({
      id: text(item?.id, 160), tool: text(item?.tool, 160), origin: text(item?.origin, 40), finishedAt: text(item?.finishedAt, 80), paths: unique(item?.paths).slice(0, 40)
    })),
    humanIntentPreservedByDefault: normalizedStrategy === 'preserve',
    conflictingManualChangesSilentlyDiscarded: false
  });
}

export function reversibleFingerprint(plan = {}) {
  return Object.freeze({
    schema: REVERSIBLE_OPERATIONS_SCHEMA,
    operationId: text(plan?.operationId, 160),
    sourceCommitSha: text(plan?.sourceCommitSha, 128),
    direction: normalizeReversalDirection(plan?.direction),
    strategy: normalizeReversalStrategy(plan?.strategy),
    destructive: plan?.destructive === true,
    changes: (Array.isArray(plan?.changes) ? plan.changes : []).map(item => ({ path: safePath(item.path), action: String(item.action || ''), destructive: item.destructive === true })).sort((a,b)=>a.path.localeCompare(b.path)),
    conflicts: (Array.isArray(plan?.conflicts) ? plan.conflicts : []).map(item => ({ path: safePath(item.path), code: String(item.code || '') })).sort((a,b)=>a.path.localeCompare(b.path))
  });
}
