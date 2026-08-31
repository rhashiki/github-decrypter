import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { isSensitivePath, isTextPath } from '../core/utils.js';
import { loadRecentUserEdits } from '../core/context-engine-v2.js';
import {
  beginOperation,
  finishOperation,
  getOperationJournalEntry,
  listOperationJournal
} from '../core/operation-journal.js';
import {
  REVERSIBLE_OPERATIONS_SCHEMA,
  normalizeReversalDirection,
  normalizeReversalStrategy,
  buildReversalPlan,
  reversibleFingerprint
} from '../core/reversible-operations.js';

const PORT_NAME = 'ld2-reversible-operations';
const TICKET_PREFIX = 'ld66_reversal_ticket_v1_';
const STATE_KEY = 'ld66_reversal_state_v1';
const TICKET_TTL_MS = 10 * 60 * 1000;
const MAX_REVERSIBLE_FILES = 80;
const MAX_CASCADE_FILES = 300;

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => text(value, 1200)).filter(Boolean))];
const ticketKey = id => `${TICKET_PREFIX}${text(id, 160).replace(/[^a-z0-9-]/gi, '')}`;

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function activeGithub(settings, projectId = '') {
  const mapping = projectId && settings?.projectMappings?.[projectId] ? settings.projectMappings[projectId] : {};
  return { ...(settings?.github || {}), ...(mapping || {}) };
}

async function headSha(adapter, branch) {
  const ref = await adapter.getRef(branch || adapter.branch || 'main');
  const sha = text(ref?.object?.sha || ref?.sha, 128).toLowerCase();
  if (!sha) throw Object.assign(new Error('REVERSAL_HEAD_UNAVAILABLE'), { code: 'REVERSAL_HEAD_UNAVAILABLE' });
  return sha;
}

async function treeMap(adapter, ref) {
  const tree = await adapter.getTree(ref, true);
  if (tree?.truncated) throw Object.assign(new Error(`REVERSAL_TREE_TRUNCATED:${ref}`), { code: 'REVERSAL_TREE_TRUNCATED' });
  const map = new Map();
  for (const entry of Array.isArray(tree?.tree) ? tree.tree : []) {
    if (entry?.type === 'blob' && entry?.path) map.set(String(entry.path), { path: String(entry.path), sha: text(entry.sha, 128), size: Number(entry.size || 0) || 0, mode: text(entry.mode, 20) });
  }
  return { map, treeSha: text(tree?.sha, 128) };
}

async function fileState(adapter, map, path) {
  const entry = map.get(path);
  if (!entry) return { exists: false, content: '', blobSha: '', size: 0 };
  if (!isTextPath(path)) return { exists: true, content: '', blobSha: entry.sha, size: entry.size, binary: true };
  const content = await adapter.getBlob(entry.sha);
  return { exists: true, content: String(content ?? ''), blobSha: entry.sha, size: entry.size, binary: false };
}

function operationPaths(operation = {}, compare = null) {
  const fromJournal = unique((Array.isArray(operation?.changes) ? operation.changes : []).map(change => change?.path));
  if (fromJournal.length) return fromJournal;
  return unique((Array.isArray(compare?.files) ? compare.files : []).map(file => file?.filename));
}

async function sourceOperation(operationId) {
  const operation = await getOperationJournalEntry(operationId);
  if (!operation) throw Object.assign(new Error('REVERSAL_OPERATION_NOT_FOUND'), { code: 'REVERSAL_OPERATION_NOT_FOUND' });
  if (operation.status !== 'ok' || operation.mode !== 'write' || !text(operation?.result?.commitSha)) {
    throw Object.assign(new Error('REVERSAL_OPERATION_NOT_REVERSIBLE'), { code: 'REVERSAL_OPERATION_NOT_REVERSIBLE' });
  }
  if (['undo', 'redo'].includes(operation.origin) || /^reversible\./.test(String(operation.tool || ''))) {
    throw Object.assign(new Error('REVERSAL_SELECT_ORIGINAL_OPERATION'), { code: 'REVERSAL_SELECT_ORIGINAL_OPERATION' });
  }
  return operation;
}

async function loadStates() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  return stored[STATE_KEY] && typeof stored[STATE_KEY] === 'object' ? stored[STATE_KEY] : {};
}

async function saveState(operationId, patch) {
  const states = await loadStates();
  states[operationId] = { ...(states[operationId] || {}), ...patch };
  await chrome.storage.local.set({ [STATE_KEY]: states });
  return states[operationId];
}

function assertDirectionState(direction, state = {}, strategy = 'preserve') {
  if (direction === 'undo' && state?.lastDirection === 'undo') {
    throw Object.assign(new Error('REVERSAL_ALREADY_UNDONE'), { code: 'REVERSAL_ALREADY_UNDONE' });
  }
  if (direction === 'redo' && state?.lastDirection !== 'undo') {
    throw Object.assign(new Error('REVERSAL_REDO_REQUIRES_PRIOR_UNDO'), { code: 'REVERSAL_REDO_REQUIRES_PRIOR_UNDO' });
  }
  if (direction === 'redo' && strategy === 'cascade' && state?.lastStrategy !== 'cascade') {
    throw Object.assign(new Error('REVERSAL_CASCADE_REDO_REQUIRES_CASCADE_UNDO'), { code: 'REVERSAL_CASCADE_REDO_REQUIRES_CASCADE_UNDO' });
  }
}

function journalPaths(entry = {}) {
  return unique([
    ...(Array.isArray(entry?.changes) ? entry.changes.map(change => change?.path) : []),
    ...(Array.isArray(entry?.input?.paths) ? entry.input.paths : [])
  ]);
}

async function dependentOperations(operation, targetPaths) {
  const finishedAt = Date.parse(operation?.finishedAt || operation?.startedAt || '') || 0;
  const all = await listOperationJournal({ status: 'ok', mode: 'write', projectId: operation?.context?.projectId || '', limit: 500 });
  const target = new Set(targetPaths);
  return all.filter(entry => {
    if (entry.id === operation.id) return false;
    const at = Date.parse(entry?.finishedAt || entry?.startedAt || '') || 0;
    if (at <= finishedAt) return false;
    return journalPaths(entry).some(path => target.has(path));
  }).map(entry => ({
    id: entry.id,
    tool: entry.tool,
    origin: entry.origin,
    finishedAt: entry.finishedAt,
    paths: journalPaths(entry).filter(path => target.has(path))
  }));
}

function laterHumanEdits(rows, sinceIso, targetPaths) {
  const since = Date.parse(sinceIso || '') || 0;
  const target = new Set(targetPaths);
  return (Array.isArray(rows) ? rows : []).filter(event => {
    if (event?.origin !== 'user') return false;
    const at = Date.parse(event?.observedAt || '') || 0;
    if (at <= since) return false;
    return (Array.isArray(event?.paths) ? event.paths : []).some(path => target.has(path));
  });
}

async function ensureSourceAncestor(adapter, sourceCommitSha, currentHead) {
  if (sourceCommitSha === currentHead) return;
  const compare = await adapter.compareCommits(sourceCommitSha, currentHead);
  const status = String(compare?.status || '').toLowerCase();
  if (!['ahead', 'identical'].includes(status)) {
    throw Object.assign(new Error(`REVERSAL_SOURCE_NOT_ANCESTOR:${status || 'unknown'}`), { code: 'REVERSAL_SOURCE_NOT_ANCESTOR', compareStatus: status });
  }
}

async function cascadePlan({ adapter, operation, direction, state, currentHead, parentSha, dependent }) {
  const destinationRef = direction === 'undo' ? parentSha : text(state?.preCascadeHeadSha, 128);
  if (!destinationRef) throw Object.assign(new Error('REVERSAL_CASCADE_DESTINATION_MISSING'), { code: 'REVERSAL_CASCADE_DESTINATION_MISSING' });
  const [currentTree, destinationTree] = await Promise.all([treeMap(adapter, currentHead), treeMap(adapter, destinationRef)]);
  const paths = new Set([...currentTree.map.keys(), ...destinationTree.map.keys()]);
  const changedPaths = [...paths].filter(path => currentTree.map.get(path)?.sha !== destinationTree.map.get(path)?.sha).sort();
  if (!changedPaths.length) throw Object.assign(new Error('REVERSAL_CASCADE_NO_CHANGES'), { code: 'REVERSAL_CASCADE_NO_CHANGES' });
  if (changedPaths.length > MAX_CASCADE_FILES) throw Object.assign(new Error(`REVERSAL_CASCADE_TOO_LARGE:${changedPaths.length}`), { code: 'REVERSAL_CASCADE_TOO_LARGE' });
  const sensitive = changedPaths.filter(isSensitivePath);
  const conflicts = sensitive.map(path => ({ path, code: 'REVERSAL_SENSITIVE_PATH_BLOCKED', message: `Cascade atingiria caminho sensível: ${path}` }));
  return {
    schema: REVERSIBLE_OPERATIONS_SCHEMA,
    operationId: operation.id,
    sourceCommitSha: operation.result.commitSha,
    direction,
    strategy: 'cascade',
    allowed: conflicts.length === 0,
    destructive: true,
    files: [],
    conflicts,
    changes: changedPaths.map(path => ({ path, action: destinationTree.map.has(path) ? (currentTree.map.has(path) ? 'update' : 'create') : 'delete', destructive: true })),
    noops: [],
    dependentOperations: dependent,
    humanIntentPreservedByDefault: false,
    conflictingManualChangesSilentlyDiscarded: false,
    cascade: {
      destinationRef,
      destinationTreeSha: destinationTree.treeSha,
      changedPaths,
      restoresEntireBranchSnapshot: true
    }
  };
}

async function computePreview({ projectId, operationId, direction, strategy }) {
  const normalizedDirection = normalizeReversalDirection(direction);
  const normalizedStrategy = normalizeReversalStrategy(strategy);
  const operation = await sourceOperation(operationId);
  if (projectId && operation?.context?.projectId && projectId !== operation.context.projectId) {
    throw Object.assign(new Error('REVERSAL_PROJECT_MISMATCH'), { code: 'REVERSAL_PROJECT_MISMATCH' });
  }
  const settings = await getSettings();
  const effectiveProjectId = projectId || operation?.context?.projectId || '';
  const github = activeGithub(settings, effectiveProjectId);
  if (!github?.owner || !github?.repo) throw Object.assign(new Error('REVERSAL_GITHUB_MAPPING_REQUIRED'), { code: 'REVERSAL_GITHUB_MAPPING_REQUIRED' });
  const branch = operation?.context?.branch || github.branch || 'main';
  const adapter = new GitAdapter({ ...github, branch });
  const currentHead = await headSha(adapter, branch);
  const sourceCommitSha = text(operation?.result?.commitSha, 128);
  await ensureSourceAncestor(adapter, sourceCommitSha, currentHead);
  const commit = await adapter.getCommit(sourceCommitSha);
  const parentSha = text(commit?.parents?.[0]?.sha, 128);
  if (!parentSha) throw Object.assign(new Error('REVERSAL_SOURCE_PARENT_MISSING'), { code: 'REVERSAL_SOURCE_PARENT_MISSING' });
  const states = await loadStates();
  const state = states[operation.id] || {};
  assertDirectionState(normalizedDirection, state, normalizedStrategy);

  const compare = await adapter.compareCommits(parentSha, sourceCommitSha);
  const paths = operationPaths(operation, compare);
  if (!paths.length || paths.length > MAX_REVERSIBLE_FILES) {
    throw Object.assign(new Error(`REVERSAL_PATH_COUNT_INVALID:${paths.length}`), { code: 'REVERSAL_PATH_COUNT_INVALID' });
  }
  const dependent = await dependentOperations(operation, paths);

  if (normalizedStrategy === 'cascade') {
    const plan = await cascadePlan({ adapter, operation, direction: normalizedDirection, state, currentHead, parentSha, dependent });
    return { plan, operation, adapter, branch, currentHead, parentSha, state, projectId: effectiveProjectId };
  }

  const [baseTree, appliedTree, currentTree] = await Promise.all([
    treeMap(adapter, parentSha),
    treeMap(adapter, sourceCommitSha),
    treeMap(adapter, currentHead)
  ]);
  const frames = [];
  for (const path of paths) {
    if (isSensitivePath(path)) {
      frames.push({ path, base: { exists: baseTree.map.has(path) }, applied: { exists: appliedTree.map.has(path) }, current: { exists: currentTree.map.has(path) } });
      continue;
    }
    if (!isTextPath(path)) {
      frames.push({ path,
        base: await fileState(adapter, baseTree.map, path),
        applied: await fileState(adapter, appliedTree.map, path),
        current: await fileState(adapter, currentTree.map, path)
      });
      continue;
    }
    frames.push({ path,
      base: await fileState(adapter, baseTree.map, path),
      applied: await fileState(adapter, appliedTree.map, path),
      current: await fileState(adapter, currentTree.map, path)
    });
  }
  const userRows = await loadRecentUserEdits(effectiveProjectId, 80);
  const since = state?.updatedAt || operation?.finishedAt || operation?.startedAt || '';
  const human = laterHumanEdits(userRows, since, paths);
  const plan = await buildReversalPlan({
    operation,
    frames,
    direction: normalizedDirection,
    strategy: normalizedStrategy,
    laterHumanEdits: human,
    dependentOperations: dependent
  });
  return { plan, operation, adapter, branch, currentHead, parentSha, state, projectId: effectiveProjectId };
}

async function issuePreview(payload = {}) {
  const computed = await computePreview({
    projectId: text(payload?.projectId, 160),
    operationId: text(payload?.operationId, 160),
    direction: payload?.direction,
    strategy: payload?.strategy
  });
  const plan = computed.plan;
  const id = crypto.randomUUID();
  const fingerprint = await sha256(JSON.stringify(reversibleFingerprint(plan)));
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS).toISOString();
  await chrome.storage.session.set({
    [ticketKey(id)]: {
      schema: 'ld-reversal-preview-ticket/1',
      id,
      operationId: plan.operationId,
      projectId: computed.projectId,
      direction: plan.direction,
      strategy: plan.strategy,
      headSha: computed.currentHead,
      fingerprint,
      destructive: plan.destructive === true,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt
    }
  });
  return {
    previewId: id,
    expiresAt,
    headSha: computed.currentHead,
    plan: {
      ...plan,
      files: (plan.files || []).map(file => ({
        path: file.path,
        status: file.status,
        action: file.action,
        destructive: file.destructive,
        conflict: file.conflict,
        laterHumanEdits: file.laterHumanEdits,
        beforeHash: file.beforeHash,
        afterHash: file.afterHash,
        preview: file.preview
      }))
    }
  };
}

async function getTicket(previewId) {
  const key = ticketKey(previewId);
  const stored = await chrome.storage.session.get(key);
  const ticket = stored[key];
  if (!ticket || ticket.id !== previewId) throw Object.assign(new Error('REVERSAL_PREVIEW_NOT_FOUND'), { code: 'REVERSAL_PREVIEW_NOT_FOUND' });
  if (ticket.used === true) throw Object.assign(new Error('REVERSAL_PREVIEW_ALREADY_USED'), { code: 'REVERSAL_PREVIEW_ALREADY_USED' });
  if (Date.parse(ticket.expiresAt || '') <= Date.now()) {
    await chrome.storage.session.remove(key);
    throw Object.assign(new Error('REVERSAL_PREVIEW_EXPIRED'), { code: 'REVERSAL_PREVIEW_EXPIRED' });
  }
  return { key, ticket };
}

async function markTicketUsed(key, ticket) {
  await chrome.storage.session.set({ [key]: { ...ticket, used: true, usedAt: new Date().toISOString() } });
}

async function applyCascade(computed, previewId) {
  const plan = computed.plan;
  const currentCommit = await computed.adapter.getCommit(computed.currentHead);
  const currentTreeSha = text(currentCommit?.tree?.sha, 128);
  if (!currentTreeSha) throw Object.assign(new Error('REVERSAL_CURRENT_TREE_MISSING'), { code: 'REVERSAL_CURRENT_TREE_MISSING' });
  const destinationTreeSha = text(plan?.cascade?.destinationTreeSha, 128);
  if (!destinationTreeSha) throw Object.assign(new Error('REVERSAL_DESTINATION_TREE_MISSING'), { code: 'REVERSAL_DESTINATION_TREE_MISSING' });
  const commit = await computed.adapter.createCommit(
    `${plan.direction}: operation ${plan.operationId.slice(0, 8)} (cascade snapshot)`,
    destinationTreeSha,
    computed.currentHead
  );
  if (!commit?.sha) throw Object.assign(new Error('REVERSAL_COMMIT_FAILED'), { code: 'REVERSAL_COMMIT_FAILED' });
  const verified = await computed.adapter.getCommit(commit.sha);
  if (text(verified?.parents?.[0]?.sha, 128) !== computed.currentHead || text(verified?.tree?.sha, 128) !== destinationTreeSha) {
    throw Object.assign(new Error('REVERSAL_COMMIT_INTEGRITY_MISMATCH'), { code: 'REVERSAL_COMMIT_INTEGRITY_MISMATCH' });
  }
  await computed.adapter.updateBranch(computed.branch, commit.sha);
  return { branch: computed.branch, commitSha: commit.sha, commitUrl: `https://github.com/${computed.adapter.owner}/${computed.adapter.repo}/commit/${commit.sha}`, previewId };
}

async function applyFilePlan(computed, previewId) {
  const files = computed.plan.files.filter(file => file.status === 'ready' && file.action !== 'none').map(file => ({
    path: file.path,
    action: file.action,
    content: file.action === 'delete' ? '' : file.proposedContent
  }));
  if (!files.length) throw Object.assign(new Error('REVERSAL_NO_CHANGES'), { code: 'REVERSAL_NO_CHANGES' });
  const result = await computed.adapter.atomicCommit({
    files,
    message: `${computed.plan.direction}: operation ${computed.plan.operationId.slice(0, 8)} (${computed.plan.strategy})`,
    baseBranch: computed.branch,
    createBranch: false,
    createPr: false
  });
  return { ...result, previewId };
}

async function applyPreview(payload = {}) {
  if (payload?.humanDecision !== true) throw Object.assign(new Error('REVERSAL_HUMAN_CONFIRMATION_REQUIRED'), { code: 'REVERSAL_HUMAN_CONFIRMATION_REQUIRED' });
  const previewId = text(payload?.previewId, 160);
  const { key, ticket } = await getTicket(previewId);
  if (ticket.destructive && payload?.confirmDestructive !== true) {
    throw Object.assign(new Error('REVERSAL_DESTRUCTIVE_CONFIRMATION_REQUIRED'), { code: 'REVERSAL_DESTRUCTIVE_CONFIRMATION_REQUIRED' });
  }
  const computed = await computePreview({
    projectId: ticket.projectId,
    operationId: ticket.operationId,
    direction: ticket.direction,
    strategy: ticket.strategy
  });
  if (computed.currentHead !== ticket.headSha) throw Object.assign(new Error('REVERSAL_HEAD_CHANGED'), { code: 'REVERSAL_HEAD_CHANGED' });
  const currentFingerprint = await sha256(JSON.stringify(reversibleFingerprint(computed.plan)));
  if (currentFingerprint !== ticket.fingerprint) throw Object.assign(new Error('REVERSAL_PREVIEW_STALE'), { code: 'REVERSAL_PREVIEW_STALE' });
  if (!computed.plan.allowed) {
    const error = new Error(`REVERSAL_CONFLICT:${computed.plan.conflicts.map(item => `${item.path}:${item.code}`).join('|')}`);
    error.code = 'REVERSAL_CONFLICT';
    error.plan = computed.plan;
    throw error;
  }

  await markTicketUsed(key, ticket);
  const journal = await beginOperation({
    tool: `reversible.${computed.plan.direction}`,
    mode: 'write',
    origin: computed.plan.direction,
    input: { direction: computed.plan.direction, strategy: computed.plan.strategy, paths: computed.plan.changes.map(change => change.path) },
    context: {
      projectId: computed.projectId,
      owner: computed.adapter.owner,
      repo: computed.adapter.repo,
      branch: computed.branch,
      parentOperationId: computed.operation.id
    }
  });

  try {
    const result = computed.plan.strategy === 'cascade'
      ? await applyCascade(computed, previewId)
      : await applyFilePlan(computed, previewId);
    const afterTree = await treeMap(computed.adapter, result.commitSha);
    const changes = [];
    for (const file of computed.plan.changes) {
      const planned = (computed.plan.files || []).find(item => item.path === file.path);
      changes.push({
        path: file.path,
        action: file.action,
        origin: computed.plan.direction,
        beforeHash: planned?.beforeHash || '',
        afterHash: planned?.afterHash || '',
        beforeBlobSha: planned?.currentBlobSha || '',
        afterBlobSha: afterTree.map.get(file.path)?.sha || ''
      });
    }
    await finishOperation(journal, {
      status: 'ok',
      changes,
      result: {
        code: 'OK',
        branch: result.branch,
        commitSha: result.commitSha,
        fileCount: computed.plan.changes.length,
        reversalOf: computed.operation.id,
        direction: computed.plan.direction,
        strategy: computed.plan.strategy,
        previewId
      }
    });
    await saveState(computed.operation.id, {
      lastDirection: computed.plan.direction,
      lastStrategy: computed.plan.strategy,
      lastCommitSha: result.commitSha,
      updatedAt: new Date().toISOString(),
      preCascadeHeadSha: computed.plan.direction === 'undo' && computed.plan.strategy === 'cascade'
        ? computed.currentHead
        : (computed.state?.preCascadeHeadSha || '')
    });
    return {
      schema: REVERSIBLE_OPERATIONS_SCHEMA,
      operationId: computed.operation.id,
      direction: computed.plan.direction,
      strategy: computed.plan.strategy,
      result,
      journalOperationId: journal.id,
      humanIntentPreserved: computed.plan.strategy === 'preserve',
      conflictingManualChangesSilentlyDiscarded: false
    };
  } catch (error) {
    await finishOperation(journal, { status: 'failed', error }).catch(() => null);
    throw error;
  }
}

async function listReversible(payload = {}) {
  const projectId = text(payload?.projectId, 160);
  const limit = Math.max(1, Math.min(100, Number(payload?.limit || 30)));
  const [entries, states] = await Promise.all([
    listOperationJournal({ status: 'ok', mode: 'write', projectId, limit: 300 }),
    loadStates()
  ]);
  return entries
    .filter(entry => text(entry?.result?.commitSha) && !['undo', 'redo'].includes(entry.origin) && !/^reversible\./.test(String(entry.tool || '')))
    .slice(0, limit)
    .map(entry => ({
      id: entry.id,
      tool: entry.tool,
      origin: entry.origin,
      finishedAt: entry.finishedAt,
      commitSha: entry.result.commitSha,
      paths: journalPaths(entry),
      state: states[entry.id] || null,
      canUndo: states[entry.id]?.lastDirection !== 'undo',
      canRedo: states[entry.id]?.lastDirection === 'undo'
    }));
}

async function handle(action, payload = {}) {
  const op = text(action || 'status', 80).toLowerCase();
  if (op === 'status') return {
    schema: REVERSIBLE_OPERATIONS_SCHEMA,
    build: 66,
    operationBased: true,
    snapshotUndoPrimary: false,
    defaultStrategy: 'preserve',
    threeWayMerge: true,
    conflictingManualChangesSilentlyDiscarded: false,
    destructiveStrategies: ['replace-target', 'cascade'],
    cascadeMeaning: 'restore-entire-branch-tree-to-before-target-operation',
    previewRequired: true,
    oneShotHumanConfirmation: true,
    headLock: true,
    rawFileContentPersistedInJournal: false
  };
  if (op === 'list') return { schema: REVERSIBLE_OPERATIONS_SCHEMA, operations: await listReversible(payload) };
  if (op === 'preview') return issuePreview(payload);
  if (op === 'apply') return applyPreview(payload);
  throw Object.assign(new Error('REVERSAL_ACTION_INVALID'), { code: 'REVERSAL_ACTION_INVALID' });
}

export function installReversibleOperationsRuntime() {
  if (globalThis.__LD66_REVERSIBLE_OPERATIONS_RUNTIME__) return;
  globalThis.__LD66_REVERSIBLE_OPERATIONS_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 160);
      try {
        const data = await handle(message?.action || 'status', message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || 'REVERSAL_FAILED',
            plan: error?.plan || null
          });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterReversibleOperationsRuntime = Object.freeze({
    build: 66,
    schema: REVERSIBLE_OPERATIONS_SCHEMA,
    port: PORT_NAME,
    defaultStrategy: 'preserve',
    failClosed: true,
    humanIntentPreserving: true,
    operationJournalAuthoritative: true
  });
}
