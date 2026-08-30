const OPERATION_JOURNAL_KEY = 'ld2_operation_journal_v1';
const MAX_OPERATION_ENTRIES = 500;
const ORIGINS = new Set(['ai', 'user', 'undo', 'redo', 'tool', 'formatter', 'lsp', 'git', 'external']);

let writeQueue = Promise.resolve();

function nowIso() { return new Date().toISOString(); }
function text(value, max = 500) { return String(value ?? '').slice(0, max); }
function compactPaths(value) {
  const items = Array.isArray(value) ? value : (value ? [value] : []);
  return [...new Set(items.map(item => text(item, 1000).trim()).filter(Boolean))].slice(0, 80);
}

function normalizedOrigin(value = 'tool') {
  const origin = String(value || 'tool').toLowerCase();
  return ORIGINS.has(origin) ? origin : 'tool';
}

async function loadJournal() {
  const data = await chrome.storage.local.get(OPERATION_JOURNAL_KEY);
  return Array.isArray(data[OPERATION_JOURNAL_KEY]) ? data[OPERATION_JOURNAL_KEY] : [];
}

async function saveJournal(list) {
  await chrome.storage.local.set({
    [OPERATION_JOURNAL_KEY]: (Array.isArray(list) ? list : []).slice(0, MAX_OPERATION_ENTRIES)
  });
}

function enqueueMutation(mutator) {
  const run = async () => {
    const list = await loadJournal();
    const next = await mutator(list);
    await saveJournal(next || list);
    return next || list;
  };
  const pending = writeQueue.then(run, run);
  writeQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

export function summarizeToolInput(tool = '', input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const summary = {
    branch: text(source.branch || source.ref || source.baseBranch || '', 240),
    paths: compactPaths([
      source.path,
      ...(Array.isArray(source.paths) ? source.paths : []),
      ...(Array.isArray(source.files) ? source.files.map(file => file?.path || file) : []),
      ...(Array.isArray(source.patches) ? source.patches.map(file => file?.path) : [])
    ]),
    query: text(source.query || source.symbol || '', 500),
    glob: text(source.glob || source.pattern || '', 500),
    action: text(source.action || '', 80)
  };

  // Never persist file contents, prompts, replacement text, secrets or tokens.
  if (tool === 'repo.patch_apply' || tool === 'repo.patch_preview') {
    summary.patchCount = Array.isArray(source.patches) ? source.patches.length : 0;
    summary.editCount = (Array.isArray(source.patches) ? source.patches : [])
      .reduce((total, patch) => total + (Array.isArray(patch?.edits) ? patch.edits.length : 0), 0);
  }
  if (tool === 'repo.write_file') summary.action = text(source.action || 'update', 80);
  return summary;
}

export async function beginOperation({ tool, mode = 'read', origin = 'tool', input = {}, context = {} } = {}) {
  const entry = {
    id: crypto.randomUUID(),
    schema: 'ld-operation-journal/1',
    tool: text(tool, 160),
    mode: mode === 'write' ? 'write' : 'read',
    origin: normalizedOrigin(origin),
    status: 'running',
    startedAt: nowIso(),
    finishedAt: '',
    durationMs: 0,
    input: summarizeToolInput(tool, input),
    context: {
      projectId: text(context?.projectId, 120),
      owner: text(context?.owner, 180),
      repo: text(context?.repo, 240),
      branch: text(context?.branch, 240),
      taskId: text(context?.taskId, 160),
      parentOperationId: text(context?.parentOperationId, 160)
    },
    changes: [],
    result: {},
    error: null
  };

  await enqueueMutation(list => [entry, ...list.filter(item => item?.id !== entry.id)]);
  return entry;
}

export async function finishOperation(operation, { status = 'ok', changes = [], result = {}, error = null } = {}) {
  if (!operation?.id) return null;
  let updated = null;
  await enqueueMutation(list => {
    const index = list.findIndex(item => item?.id === operation.id);
    if (index < 0) return list;
    const current = list[index];
    const started = Date.parse(current.startedAt || '') || Date.now();
    updated = {
      ...current,
      status: status === 'ok' ? 'ok' : 'failed',
      finishedAt: nowIso(),
      durationMs: Math.max(0, Date.now() - started),
      changes: (Array.isArray(changes) ? changes : []).slice(0, 100).map(change => ({
        path: text(change?.path, 1000),
        action: text(change?.action, 40),
        origin: normalizedOrigin(change?.origin || current.origin),
        beforeHash: text(change?.beforeHash, 128),
        afterHash: text(change?.afterHash, 128),
        beforeBlobSha: text(change?.beforeBlobSha, 128),
        afterBlobSha: text(change?.afterBlobSha, 128)
      })),
      result: {
        code: text(result?.code, 120),
        branch: text(result?.branch, 240),
        commitSha: text(result?.commitSha, 128),
        matchCount: Number(result?.matchCount || 0) || 0,
        fileCount: Number(result?.fileCount || 0) || 0
      },
      error: error ? {
        code: text(error?.code, 120),
        message: text(error?.message || error, 1200)
      } : null
    };
    list[index] = updated;
    return list;
  });
  return updated;
}

export async function listOperationJournal({ tool = '', status = '', origin = '', limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
  const entries = await loadJournal();
  return entries.filter(entry => {
    if (tool && entry?.tool !== tool) return false;
    if (status && entry?.status !== status) return false;
    if (origin && entry?.origin !== normalizedOrigin(origin)) return false;
    return true;
  }).slice(0, safeLimit);
}

export { OPERATION_JOURNAL_KEY, MAX_OPERATION_ENTRIES, ORIGINS };
