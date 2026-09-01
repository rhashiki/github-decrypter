(() => {
  'use strict';
  if (window.__LD2_LOVABLE_WORKSPACE_DEEP_READ__) return;
  window.__LD2_LOVABLE_WORKSPACE_DEEP_READ__ = true;

  const API_BASE = 'https://api.lovable.dev';
  const SNAPSHOT_SCHEMA = 'ld-workspace-snapshot/1';
  const CACHE_TTL_MS = 20000;
  const REQUEST_TIMEOUT_MS = 20000;
  const ZIP_MAX_FILES = 60000;
  const ZIP_MAX_SOURCE_BYTES = 512 * 1024 * 1024;
  const FETCH_CONCURRENCY = 6;
  const UTF8_FLAG = 0x0800;
  const ZIP_STORE_METHOD = 0;
  const SENSITIVE_PATH = /(^|\/)(\.env(?:\..*)?|.*(?:secret|credential|private[-_.]?key).*)(\/|$)|\.(?:pem|p12|pfx|key)$/i;

  let fileCache = null;
  let snapshotCache = null;
  let downloadBusy = false;

  const text = value => String(value ?? '').trim();
  const unique = values => [...new Set(values.filter(Boolean))];

  function projectIdFromLocation() {
    const fromRuntime = text(window.LovableDecrypterV2?.getProjectId?.());
    if (fromRuntime) return fromRuntime;
    const raw = `${location.pathname}${location.hash}`;
    const uuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    return uuid?.[0] || raw.match(/\/projects?\/([^/?#]+)/i)?.[1] || '';
  }

  function tokenFromObject(value, depth = 0) {
    if (!value || depth > 6) return '';
    if (Array.isArray(value)) {
      for (const item of value) {
        const token = tokenFromObject(item, depth + 1);
        if (token) return token;
      }
      return '';
    }
    if (typeof value !== 'object') return '';
    const direct = value?.stsTokenManager?.accessToken || value?.stsTokenManager?.access_token;
    if (typeof direct === 'string' && direct.split('.').length === 3) return direct;
    for (const [key, item] of Object.entries(value)) {
      if (/^(accessToken|access_token)$/i.test(key) && typeof item === 'string' && item.split('.').length === 3) return item;
    }
    for (const item of Object.values(value)) {
      const token = tokenFromObject(item, depth + 1);
      if (token) return token;
    }
    return '';
  }

  function tokenFromLocalStorage() {
    try {
      for (const key of Object.keys(localStorage)) {
        if (!/firebase:authUser:|firebaseLocalStorage/i.test(key)) continue;
        try {
          const token = tokenFromObject(JSON.parse(localStorage.getItem(key) || 'null'));
          if (token) return token;
        } catch (_) {}
      }
    } catch (_) {}
    return '';
  }

  async function tokenFromIndexedDb() {
    try {
      const databases = typeof indexedDB?.databases === 'function' ? await indexedDB.databases() : [];
      if (databases.length && !databases.some(db => db?.name === 'firebaseLocalStorageDb')) return '';
      return await new Promise(resolve => {
        const request = indexedDB.open('firebaseLocalStorageDb');
        request.onerror = () => resolve('');
        request.onsuccess = () => {
          try {
            const db = request.result;
            if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
              db.close();
              resolve('');
              return;
            }
            const tx = db.transaction('firebaseLocalStorage', 'readonly');
            const getAll = tx.objectStore('firebaseLocalStorage').getAll();
            getAll.onerror = () => { db.close(); resolve(''); };
            getAll.onsuccess = () => {
              const token = tokenFromObject(getAll.result || []);
              db.close();
              resolve(token || '');
            };
          } catch (_) {
            resolve('');
          }
        };
      });
    } catch (_) {
      return '';
    }
  }

  async function lovableToken() {
    return tokenFromLocalStorage() || await tokenFromIndexedDb();
  }

  function requestHeaders(token, accept = '*/*') {
    return {
      Accept: accept,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  async function lovableFetch(path, { token = '', accept = '*/*' } = {}) {
    const auth = token || await lovableToken();
    if (!auth) throw new Error('LOVABLE_SESSION_UNAVAILABLE');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'GET',
        credentials: 'include',
        headers: requestHeaders(auth, accept),
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error(`LOVABLE_HTTP_${response.status}`);
        error.status = response.status;
        throw error;
      }
      return { response, token: auth };
    } finally {
      clearTimeout(timer);
    }
  }

  function safeWorkspacePath(value) {
    const path = text(value).replace(/\\/g, '/');
    if (!path || path.length > 1200 || path.startsWith('/') || path.includes('\0')) throw new Error('WORKSPACE_PATH_INVALID');
    const parts = path.split('/');
    if (parts.some(part => !part || part === '.' || part === '..')) throw new Error('WORKSPACE_PATH_INVALID');
    return path;
  }

  function normalizeFileRows(payload) {
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.files) ? payload.files : [];
    const files = [];
    const seen = new Set();
    for (const row of rows) {
      const rawPath = typeof row === 'string' ? row : row?.path ?? row?.name;
      let path;
      try { path = safeWorkspacePath(rawPath); } catch (_) { continue; }
      if (seen.has(path)) continue;
      const type = text(row?.type).toLowerCase();
      if (type === 'tree' || type === 'directory' || row?.directory === true) continue;
      seen.add(path);
      const size = Number(row?.size);
      files.push({
        path,
        size: Number.isFinite(size) && size >= 0 ? size : null,
        binary: row?.binary === true || row?.is_binary === true,
        sensitive: SENSITIVE_PATH.test(path)
      });
    }
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  function currentProjectContext() {
    return window.LovableDecrypterProjectRuntime?.getContext?.() || null;
  }

  function refCandidates(requested = '') {
    const ctx = currentProjectContext();
    return unique([
      text(requested),
      'HEAD',
      text(ctx?.gitSync?.branch),
      'main'
    ]);
  }

  function extractRevision(payload, ref) {
    const value = payload && typeof payload === 'object' ? payload : {};
    return text(
      value.head_sha ||
      value.headSha ||
      value.commit_sha ||
      value.commitSha ||
      value.sha ||
      value.revision
    ) || `ref:${ref}`;
  }

  async function listFiles({ force = false, ref = '' } = {}) {
    const projectId = projectIdFromLocation();
    if (!projectId) throw new Error('LOVABLE_PROJECT_UNAVAILABLE');
    const cacheKey = `${projectId}:${text(ref) || 'auto'}`;
    if (!force && fileCache?.key === cacheKey && Date.now() - fileCache.at < CACHE_TTL_MS) {
      return structuredClone(fileCache.value);
    }

    const token = await lovableToken();
    if (!token) throw new Error('LOVABLE_SESSION_UNAVAILABLE');
    let lastError = null;
    for (const candidate of refCandidates(ref)) {
      try {
        const query = new URLSearchParams({ ref: candidate });
        const { response } = await lovableFetch(
          `/projects/${encodeURIComponent(projectId)}/git/files?${query}`,
          { token, accept: 'application/json' }
        );
        const payload = await response.json();
        const files = normalizeFileRows(payload);
        if (!files.length) throw new Error('LOVABLE_WORKSPACE_EMPTY');
        const value = {
          projectId,
          ref: candidate,
          revision: extractRevision(payload, candidate),
          complete: payload?.truncated !== true && payload?.complete !== false,
          files
        };
        fileCache = { key: cacheKey, at: Date.now(), value };
        return structuredClone(value);
      } catch (error) {
        lastError = error;
        if (error?.status === 401 || error?.status === 403) break;
      }
    }
    throw lastError || new Error('LOVABLE_FILE_LIST_UNAVAILABLE');
  }

  async function readFile(path, {
    ref = '',
    allowSensitive = false,
    asBytes = false,
    token = ''
  } = {}) {
    const projectId = projectIdFromLocation();
    if (!projectId) throw new Error('LOVABLE_PROJECT_UNAVAILABLE');
    const cleanPath = safeWorkspacePath(path);
    const sensitive = SENSITIVE_PATH.test(cleanPath);
    if (sensitive && !allowSensitive) {
      return {
        path: cleanPath,
        sensitive: true,
        redacted: true,
        bytes: null,
        text: null,
        contentType: ''
      };
    }

    const candidate = text(ref) || 'HEAD';
    const params = new URLSearchParams({
      path: cleanPath,
      git_ref: candidate,
      ref: candidate
    });
    const { response } = await lovableFetch(
      `/projects/${encodeURIComponent(projectId)}/git/file?${params}`,
      { token, accept: '*/*' }
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = text(response.headers?.get?.('content-type'));
    return {
      path: cleanPath,
      sensitive,
      redacted: false,
      bytes: asBytes ? bytes : null,
      text: asBytes ? null : new TextDecoder().decode(bytes),
      contentType
    };
  }

  function categoryForPath(path) {
    if (/^supabase\/migrations\/.*\.sql$/i.test(path)) return 'migrations';
    if (/^supabase\/functions\/[^/]+\//i.test(path)) return 'edgeFunctions';
    if (/^supabase\//i.test(path)) return 'supabase';
    if (/(^|\/)(api|server|backend|functions)\//i.test(path)) return 'backend';
    if (/^(src|app|pages|components|routes|public)\//i.test(path)) return 'frontend';
    if (/(^|\/)(package\.json|vite\.config\.|tsconfig|config\.|\.config\.|toml$|ya?ml$|json$)/i.test(path)) return 'config';
    return 'other';
  }

  async function sha256Hex(value) {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function getSnapshot({ force = false, ref = '' } = {}) {
    const listed = await listFiles({ force, ref });
    const cacheKey = `${listed.projectId}:${listed.ref}:${listed.revision}:${listed.files.length}`;
    if (!force && snapshotCache?.key === cacheKey && Date.now() - snapshotCache.at < CACHE_TTL_MS) {
      return structuredClone(snapshotCache.value);
    }

    const counts = {
      frontend: 0,
      backend: 0,
      supabase: 0,
      migrations: 0,
      edgeFunctions: 0,
      config: 0,
      other: 0
    };
    let totalBytes = 0;
    let knownBytes = 0;
    let binaryFiles = 0;
    let sensitiveFiles = 0;
    for (const file of listed.files) {
      counts[categoryForPath(file.path)]++;
      if (Number.isFinite(file.size)) {
        totalBytes += file.size;
        knownBytes++;
      }
      if (file.binary) binaryFiles++;
      if (file.sensitive) sensitiveFiles++;
    }

    const metadataDigestInput = listed.files
      .map(file => `${file.path}\0${file.size ?? ''}\0${file.binary ? 1 : 0}`)
      .join('\n');
    const ctx = currentProjectContext();
    const snapshot = {
      schema: SNAPSHOT_SCHEMA,
      source: 'lovable_workspace',
      projectId: listed.projectId,
      workspaceId: text(ctx?.workspace?.id),
      collectedAt: new Date().toISOString(),
      ref: listed.ref,
      revision: listed.revision,
      hash: await sha256Hex(metadataDigestInput),
      complete: !!listed.complete,
      files: listed.files,
      stats: {
        fileCount: listed.files.length,
        totalBytes: knownBytes === listed.files.length ? totalBytes : null,
        binaryFiles,
        sensitiveFiles,
        categories: counts
      },
      capabilities: {
        listFiles: true,
        readFile: true,
        rawBytes: true,
        downloadZip: true,
        writeFiles: false
      }
    };

    snapshotCache = { key: cacheKey, at: Date.now(), value: snapshot };
    window.dispatchEvent(new CustomEvent('ld2:workspace-snapshot', {
      detail: structuredClone(snapshot)
    }));
    return structuredClone(snapshot);
  }

  function crcTable() {
    if (crcTable.value) return crcTable.value;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    crcTable.value = table;
    return table;
  }

  function crc32(bytes) {
    const table = crcTable();
    let crc = 0xffffffff;
    for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f),
      date: (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f)
    };
  }

  function localHeader(nameBytes, bytes, crc, stamp) {
    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, UTF8_FLAG, true);
    view.setUint16(8, ZIP_STORE_METHOD, true);
    view.setUint16(10, stamp.time, true);
    view.setUint16(12, stamp.date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, bytes.length, true);
    view.setUint32(22, bytes.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    return header;
  }

  function centralHeader(nameBytes, bytes, crc, stamp, offset) {
    const header = new Uint8Array(46);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, UTF8_FLAG, true);
    view.setUint16(10, ZIP_STORE_METHOD, true);
    view.setUint16(12, stamp.time, true);
    view.setUint16(14, stamp.date, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, bytes.length, true);
    view.setUint32(24, bytes.length, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, offset, true);
    return header;
  }

  function endOfCentralDirectory(count, centralSize, centralOffset) {
    const eocd = new Uint8Array(22);
    const view = new DataView(eocd.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, count, true);
    view.setUint16(10, count, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    view.setUint16(20, 0, true);
    return eocd;
  }

  async function mapConcurrent(items, limit, worker) {
    const out = new Array(items.length);
    let next = 0;
    async function run() {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        out[index] = await worker(items[index], index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return out;
  }

  function emitZipProgress(detail) {
    window.dispatchEvent(new CustomEvent('ld2:workspace-zip-progress', { detail }));
  }

  function safeDownloadName(value) {
    return text(value).replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 90) || 'lovable-project';
  }

  async function downloadWorkspaceZip({
    force = true,
    autoDownload = true,
    onProgress = null
  } = {}) {
    if (downloadBusy) throw new Error('WORKSPACE_ZIP_BUSY');
    downloadBusy = true;
    try {
      const snapshot = await getSnapshot({ force });
      if (!snapshot.complete) throw new Error('LOVABLE_WORKSPACE_INCOMPLETE');
      if (snapshot.files.length > ZIP_MAX_FILES) throw new Error('LOVABLE_WORKSPACE_TOO_MANY_FILES');
      if (Number.isFinite(snapshot.stats.totalBytes) && snapshot.stats.totalBytes > ZIP_MAX_SOURCE_BYTES) {
        throw new Error('LOVABLE_WORKSPACE_ZIP_TOO_LARGE');
      }

      const token = await lovableToken();
      if (!token) throw new Error('LOVABLE_SESSION_UNAVAILABLE');
      const notify = detail => {
        emitZipProgress(detail);
        try { onProgress?.(detail); } catch (_) {}
      };
      notify({ stage: 'fetch', current: 0, total: snapshot.files.length, source: 'lovable_workspace' });

      let completed = 0;
      let actualBytes = 0;
      const fetched = await mapConcurrent(snapshot.files, FETCH_CONCURRENCY, async file => {
        const result = await readFile(file.path, {
          ref: snapshot.ref,
          allowSensitive: true,
          asBytes: true,
          token
        });
        actualBytes += result.bytes.length;
        if (actualBytes > ZIP_MAX_SOURCE_BYTES) throw new Error('LOVABLE_WORKSPACE_ZIP_TOO_LARGE');
        completed++;
        notify({ stage: 'fetch', current: completed, total: snapshot.files.length, path: file.path, source: 'lovable_workspace' });
        return { file, bytes: result.bytes };
      });

      const encoder = new TextEncoder();
      const stamp = dosDateTime();
      const localParts = [];
      const centralParts = [];
      let localOffset = 0;
      let centralSize = 0;

      for (const entry of fetched) {
        const nameBytes = encoder.encode(entry.file.path);
        if (nameBytes.length > 0xffff) throw new Error('WORKSPACE_PATH_TOO_LONG_FOR_ZIP');
        const crc = crc32(entry.bytes);
        const local = localHeader(nameBytes, entry.bytes, crc, stamp);
        localParts.push(local, nameBytes, entry.bytes);
        const central = centralHeader(nameBytes, entry.bytes, crc, stamp, localOffset);
        centralParts.push(central, nameBytes);
        localOffset += local.length + nameBytes.length + entry.bytes.length;
        centralSize += central.length + nameBytes.length;
      }

      const eocd = endOfCentralDirectory(fetched.length, centralSize, localOffset);
      const blob = new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
      const ctx = currentProjectContext();
      const baseName = safeDownloadName(ctx?.project?.name || snapshot.projectId);
      const refName = safeDownloadName(snapshot.ref === 'HEAD' ? 'workspace' : snapshot.ref);
      const filename = `${baseName}-${refName}.zip`;

      if (autoDownload) {
        const url = URL.createObjectURL(blob);
        try {
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          anchor.style.display = 'none';
          document.documentElement.appendChild(anchor);
          anchor.click();
          anchor.remove();
        } finally {
          setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
      }

      notify({ stage: 'done', current: fetched.length, total: fetched.length, source: 'lovable_workspace', filename });
      return {
        source: 'lovable_workspace',
        filename,
        fileCount: fetched.length,
        totalBytes: actualBytes,
        snapshot,
        blob: autoDownload ? null : blob
      };
    } finally {
      downloadBusy = false;
    }
  }

  function rootToast(message, error = false) {
    const root = document.getElementById('ld2-root');
    const wrap = root?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  async function githubFallbackDownload() {
    const runtime = window.LovableDecrypterV2?.runtime;
    if (!runtime) throw new Error('GITHUB_FALLBACK_UNAVAILABLE');
    const projectId = projectIdFromLocation();
    const result = await runtime({ type: 'LD2_GITHUB_ZIP_BYTES', projectId });
    const blob = new Blob([new Uint8Array(result.bytes)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeDownloadName(result.repo || 'lovable-project')}-${safeDownloadName(result.branch || 'main')}.zip`;
      anchor.style.display = 'none';
      document.documentElement.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    return { source: 'github_fallback', repo: result.repo, branch: result.branch };
  }

  async function handleZipButton() {
    if (downloadBusy) {
      rootToast('O ZIP do Workspace Lovable já está sendo preparado.');
      return;
    }
    try {
      rootToast('Preparando ZIP · Fonte: Lovable Workspace…');
      const result = await downloadWorkspaceZip();
      rootToast(`Download iniciado · Lovable Workspace · ${result.fileCount} arquivo(s).`);
    } catch (workspaceError) {
      rootToast('Workspace Lovable indisponível ou incompleto. Usando GitHub fallback…');
      try {
        await githubFallbackDownload();
        rootToast('Download iniciado · Fonte: GitHub fallback.');
      } catch (githubError) {
        const detail = text(workspaceError?.message || workspaceError);
        const fallback = text(githubError?.message || githubError);
        rootToast(`Não foi possível gerar o ZIP. Lovable: ${detail}. GitHub: ${fallback}.`, true);
      }
    }
  }

  function interceptZipButtons(event) {
    const target = event.target?.closest?.(
      '#ld2-root [data-action="zip"], #ld2-root [data-cc-action="zip"], #ld2-root [data-ul-action="zip"]'
    );
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleZipButton().catch(error => rootToast(error?.message || String(error), true));
  }

  function clearCaches() {
    fileCache = null;
    snapshotCache = null;
  }

  window.LovableDecrypterWorkspaceDeepRead = Object.freeze({
    schema: SNAPSHOT_SCHEMA,
    listFiles,
    readFile,
    getSnapshot,
    downloadWorkspaceZip,
    invalidate: clearCaches,
    get capabilities() {
      return Object.freeze({
        source: 'lovable_workspace',
        listFiles: true,
        readFile: true,
        rawBytes: true,
        downloadZip: true,
        writeFiles: false
      });
    }
  });

  document.addEventListener('click', interceptZipButtons, true);
  addEventListener('ld2:project', clearCaches);
  addEventListener('hashchange', clearCaches);
  addEventListener('popstate', clearCaches);
})();
