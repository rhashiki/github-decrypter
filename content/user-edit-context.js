(() => {
  'use strict';
  if (window.__LD64_USER_EDIT_CONTEXT__) return;
  window.__LD64_USER_EDIT_CONTEXT__ = true;

  const STORE_PREFIX = 'ld2_user_edit_context_v1_';
  const SNAPSHOT_PREFIX = 'ld64_workspace_baseline_v1_';
  const MAX_EVENTS = 80;
  const EDIT_IDLE_MS = 1800;
  const USER_EVIDENCE_WINDOW_MS = 120000;
  const MIN_SNAPSHOT_INTERVAL_MS = 3000;

  let lastEditorInputAt = 0;
  let snapshotTimer = 0;
  let lastSnapshotRequestAt = 0;
  let pendingInputEvidence = false;

  const text = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
  const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => text(value)).filter(Boolean))];

  function projectId() {
    const direct = text(window.LovableDecrypterV2?.getProjectId?.(), 180);
    if (direct) return direct;
    const raw = `${location.pathname}${location.hash}`;
    return raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] || '';
  }

  function codeEditorTarget(target) {
    if (!target?.closest) return false;
    return Boolean(target.closest('.monaco-editor, .cm-editor, .CodeMirror, [data-testid*="code-editor" i], [data-testid*="editor" i][role="code"]'));
  }

  function possibleActivePath(target) {
    const roots = [target?.closest?.('.monaco-editor, .cm-editor, .CodeMirror'), target?.closest?.('[data-file-path], [data-path]')].filter(Boolean);
    for (const root of roots) {
      const values = [root?.dataset?.filePath, root?.dataset?.path, root?.getAttribute?.('data-file-path'), root?.getAttribute?.('data-path')];
      for (const value of values) {
        const candidate = text(value);
        if (candidate && !candidate.startsWith('/') && candidate.includes('.') && !candidate.includes('..')) return candidate.replace(/\\/g, '/');
      }
    }
    return '';
  }

  function fileMap(snapshot = {}) {
    const map = new Map();
    for (const file of Array.isArray(snapshot?.files) ? snapshot.files : []) {
      const path = text(file?.path);
      if (!path) continue;
      map.set(path, `${Number.isFinite(Number(file?.size)) ? Number(file.size) : ''}:${file?.binary === true ? 1 : 0}:${file?.sensitive === true ? 1 : 0}`);
    }
    return map;
  }

  function changedMetadataPaths(before = {}, after = {}) {
    const a = fileMap(before);
    const b = fileMap(after);
    const paths = new Set();
    for (const [path, signature] of a) if (!b.has(path) || b.get(path) !== signature) paths.add(path);
    for (const [path, signature] of b) if (!a.has(path) || a.get(path) !== signature) paths.add(path);
    return [...paths].slice(0, 80);
  }

  function snapshotSummary(snapshot = {}) {
    return {
      revision: text(snapshot?.revision, 240),
      hash: text(snapshot?.hash, 128),
      collectedAt: text(snapshot?.collectedAt, 80),
      files: (Array.isArray(snapshot?.files) ? snapshot.files : []).slice(0, 60000).map(file => ({
        path: text(file?.path),
        size: Number.isFinite(Number(file?.size)) ? Number(file.size) : null,
        binary: file?.binary === true,
        sensitive: file?.sensitive === true
      }))
    };
  }

  async function persistEvent(id, event) {
    if (!id) return;
    const key = `${STORE_PREFIX}${id}`;
    const stored = await chrome.storage.local.get(key);
    const list = Array.isArray(stored[key]) ? stored[key] : [];
    const next = [event, ...list.filter(item => item?.id !== event.id)].slice(0, MAX_EVENTS);
    await chrome.storage.local.set({ [key]: next });
    window.dispatchEvent(new CustomEvent('ld64:user-edit-committed', { detail: { ...event, contentPersisted: false } }));
  }

  async function observeSnapshot(snapshot) {
    const id = projectId();
    if (!id || !snapshot || typeof snapshot !== 'object') return;
    const key = `${SNAPSHOT_PREFIX}${id}`;
    const stored = await chrome.storage.session.get(key);
    const previous = stored[key];
    const next = snapshotSummary(snapshot);
    await chrome.storage.session.set({ [key]: next });
    if (!previous?.revision && !previous?.hash) return;
    const changedRevision = Boolean(next.revision && previous.revision && next.revision !== previous.revision);
    const changedHash = Boolean(next.hash && previous.hash && next.hash !== previous.hash);
    if (!changedRevision && !changedHash) return;

    const metadataPaths = changedMetadataPaths(previous, next);
    const activePath = text(window.__LD64_LAST_EDITOR_PATH__ || '');
    const paths = unique([...metadataPaths, activePath]).slice(0, 80);
    const recentHumanEditorInput = pendingInputEvidence && Date.now() - lastEditorInputAt <= USER_EVIDENCE_WINDOW_MS;
    const origin = recentHumanEditorInput ? 'user' : 'external';
    const evidence = [
      changedRevision ? 'workspace-revision-changed' : '',
      changedHash ? 'workspace-metadata-hash-changed' : '',
      recentHumanEditorInput ? 'recent-code-editor-input' : '',
      metadataPaths.length ? 'file-metadata-diff' : '',
      activePath ? 'active-editor-path-hint' : ''
    ].filter(Boolean);
    const event = {
      id: crypto.randomUUID(),
      schema: 'ld-user-edit-context/1',
      type: origin === 'user' ? 'USER_EDIT_COMMITTED' : 'WORKSPACE_CHANGE_OBSERVED',
      projectId: id,
      origin,
      observedAt: new Date().toISOString(),
      beforeRevision: text(previous.revision, 240),
      afterRevision: text(next.revision, 240),
      paths,
      pathResolution: paths.length ? 'resolved' : 'partial',
      evidence,
      contentPersisted: false,
      rawKeystrokesPersisted: false
    };
    await persistEvent(id, event);
    pendingInputEvidence = false;
  }

  async function requestSnapshot() {
    const api = window.LovableDecrypterWorkspaceDeepRead;
    if (!api?.getSnapshot) return;
    if (Date.now() - lastSnapshotRequestAt < MIN_SNAPSHOT_INTERVAL_MS) return;
    lastSnapshotRequestAt = Date.now();
    try { await api.getSnapshot({ force: true }); } catch (_) {}
  }

  function scheduleSnapshot() {
    clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => requestSnapshot(), EDIT_IDLE_MS);
  }

  document.addEventListener('input', event => {
    if (!codeEditorTarget(event.target)) return;
    lastEditorInputAt = Date.now();
    pendingInputEvidence = true;
    const path = possibleActivePath(event.target);
    if (path) window.__LD64_LAST_EDITOR_PATH__ = path;
    scheduleSnapshot();
  }, true);

  window.addEventListener('ld2:workspace-snapshot', event => {
    observeSnapshot(event.detail).catch(() => {});
  });

  window.addEventListener('ld2:project', () => {
    pendingInputEvidence = false;
    lastEditorInputAt = 0;
    window.__LD64_LAST_EDITOR_PATH__ = '';
    clearTimeout(snapshotTimer);
    queueMicrotask(() => requestSnapshot());
  });

  window.LovableDecrypterUserEditContext = Object.freeze({
    schema: 'ld-user-edit-context/1',
    async list(limit = 24) {
      const id = projectId();
      if (!id) return [];
      const key = `${STORE_PREFIX}${id}`;
      const stored = await chrome.storage.local.get(key);
      return (Array.isArray(stored[key]) ? stored[key] : []).slice(0, Math.max(1, Math.min(80, Number(limit || 24))));
    },
    async refresh() { return requestSnapshot(); },
    get rawKeystrokesPersisted() { return false; },
    get contentPersisted() { return false; }
  });

  queueMicrotask(() => requestSnapshot());
})();
