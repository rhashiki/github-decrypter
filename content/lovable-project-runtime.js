(() => {
  'use strict';
  if (window.__LD2_LOVABLE_PROJECT_RUNTIME__) return;
  window.__LD2_LOVABLE_PROJECT_RUNTIME__ = true;

  const API_BASE = 'https://api.lovable.dev';
  const REFRESH_MS = 30000;
  const REQUEST_TIMEOUT_MS = 9000;
  let context = null;
  let refreshPromise = null;

  const text = value => String(value ?? '').trim();
  const first = (...values) => values.map(text).find(Boolean) || '';

  function projectIdFromLocation() {
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
      if (typeof indexedDB?.databases !== 'function') return '';
      const databases = await indexedDB.databases();
      if (!databases.some(db => db?.name === 'firebaseLocalStorageDb')) return '';
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
          } catch (_) { resolve(''); }
        };
      });
    } catch (_) {
      return '';
    }
  }

  async function lovableToken() {
    return tokenFromLocalStorage() || await tokenFromIndexedDb();
  }

  async function api(path, token) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const body = await response.text();
      return body ? JSON.parse(body) : {};
    } finally {
      clearTimeout(timer);
    }
  }

  async function probe(paths, token) {
    for (const path of paths) {
      try { return { ok: true, path, data: await api(path, token) }; }
      catch (_) {}
    }
    return { ok: false, path: '', data: null };
  }

  function unwrap(value) {
    if (!value || typeof value !== 'object') return {};
    if (value.project && typeof value.project === 'object') return value.project;
    if (value.data && typeof value.data === 'object' && !Array.isArray(value.data)) return value.data;
    return value;
  }

  function parsePackage(raw) {
    const source = unwrap(raw);
    let body = source?.content ?? source?.text ?? source?.file?.content ?? raw?.content ?? '';
    if (source?.encoding === 'base64' && typeof body === 'string') {
      try { body = decodeURIComponent(escape(atob(body.replace(/\s/g, '')))); } catch (_) {}
    }
    if (typeof body !== 'string') return null;
    try { return JSON.parse(body); } catch (_) { return null; }
  }

  function frameworkFrom(project, pkg) {
    const declared = first(project.framework, project.template, project.stack, project.project_type);
    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
    if (deps['@tanstack/react-start'] || deps['@tanstack/start']) return 'TanStack Start';
    if (deps.next) return 'Next.js';
    if (deps.vite && deps.react) return 'React + Vite';
    if (deps.vite) return 'Vite';
    return declared || 'Desconhecido';
  }

  function gitSyncFrom(raw) {
    const root = unwrap(raw);
    const candidate = root.git_sync || root.gitsync || root.repository || root.repo || root;
    const owner = first(candidate.owner_name, candidate.owner?.login, candidate.owner, root.owner_name);
    const repo = first(candidate.repo_name, candidate.repository_name, candidate.name, candidate.repo, root.repo_name);
    const branch = first(candidate.branch, candidate.default_branch, root.branch, root.default_branch) || 'main';
    return {
      connected: !!(owner && repo),
      owner,
      repo,
      branch,
      fullName: owner && repo ? `${owner}/${repo}` : ''
    };
  }

  function backendFrom(cloudRaw, configRaw) {
    const cloud = unwrap(cloudRaw);
    const config = unwrap(configRaw);
    const supabase = cloud.supabase || config.supabase || {};
    const ref = first(
      cloud.supabase_project_ref,
      cloud.supabase_project_id,
      supabase.project_ref,
      supabase.project_id,
      config.supabase_project_ref,
      config.supabase_project_id
    );
    const url = first(cloud.supabase_url, supabase.url, config.supabase_url);
    const managedValue = cloud.is_managed_by_lovable ?? cloud.managed_by_lovable ?? supabase.is_managed_by_lovable ?? config.is_managed_by_lovable;
    const managed = typeof managedValue === 'boolean' ? managedValue : null;
    const provider = first(cloud.provider, config.backend_provider, config.provider).toLowerCase();
    let type = 'unknown';
    if (managed === true || /lovable.*cloud|cloud/.test(provider)) type = 'lovable_cloud';
    else if ((managed === false && (ref || url)) || /supabase/.test(provider)) type = 'supabase';
    else if (!ref && !url && provider === 'none') type = 'none';
    return { type, managedByLovable: managed, supabaseRef: ref, supabaseUrl: url };
  }

  function previewFrom(project) {
    const apiUrl = first(project.preview_url, project.previewUrl, project.deployment_url, project.deploymentUrl);
    const iframe = document.querySelector('[data-testid*="preview" i] iframe, iframe[data-testid*="preview" i], iframe[src*="lovable.app"], iframe[src*="preview"]');
    const domUrl = iframe?.getAttribute('src') || '';
    const url = apiUrl || domUrl;
    return {
      state: url ? 'ready' : (iframe ? 'loading' : 'unknown'),
      available: !!url,
      url
    };
  }

  function workspaceFrom(project) {
    const workspace = project.workspace && typeof project.workspace === 'object' ? project.workspace : {};
    return {
      id: first(project.workspace_id, project.workspaceId, workspace.id),
      name: first(project.workspace_name, project.workspaceName, workspace.name)
    };
  }

  function sanitizedSnapshot(snapshot) {
    return JSON.parse(JSON.stringify(snapshot, (key, value) => /token|secret|password|service_role|db_url/i.test(key) ? undefined : value));
  }

  function portCall(action, payload = {}) {
    return new Promise(resolve => {
      let settled = false;
      const port = chrome.runtime.connect({ name: 'ld2-project-runtime' });
      const id = crypto.randomUUID();
      const done = value => {
        if (settled) return;
        settled = true;
        try { port.disconnect(); } catch (_) {}
        resolve(value);
      };
      const timer = setTimeout(() => done(null), 5000);
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        clearTimeout(timer);
        done(message?.ok ? message.data : null);
      });
      port.onDisconnect.addListener(() => {
        if (!settled) { clearTimeout(timer); done(null); }
      });
      port.postMessage({ id, action, payload });
    });
  }

  async function collect() {
    const projectId = projectIdFromLocation();
    if (!projectId) {
      return {
        detected: false,
        projectId: '',
        url: location.href,
        collectedAt: new Date().toISOString(),
        auth: { sessionAvailable: false },
        gitSync: { connected: false, owner: '', repo: '', branch: '', fullName: '' },
        backend: { type: 'none', managedByLovable: null, supabaseRef: '', supabaseUrl: '' },
        preview: previewFrom({})
      };
    }

    const token = await lovableToken();
    if (!token) {
      return {
        detected: true,
        projectId,
        url: location.href,
        collectedAt: new Date().toISOString(),
        auth: { sessionAvailable: false },
        project: { name: '', framework: 'Desconhecido' },
        workspace: { id: '', name: '' },
        gitSync: { connected: false, owner: '', repo: '', branch: '', fullName: '' },
        backend: { type: 'unknown', managedByLovable: null, supabaseRef: '', supabaseUrl: '' },
        preview: previewFrom({}),
        diagnostics: { partial: true, reason: 'lovable_session_unavailable' }
      };
    }

    const encoded = encodeURIComponent(projectId);
    const [detailsProbe, configProbe, cloudProbe, gitProbe, packageProbe] = await Promise.all([
      probe([`/projects/${encoded}/details`, `/projects/${encoded}`], token),
      probe([`/projects/${encoded}/config`], token),
      probe([`/projects/${encoded}/cloud/config`], token),
      probe([`/projects/${encoded}/gitsync`, `/projects/${encoded}/git-sync`], token),
      probe([`/projects/${encoded}/git/file?path=${encodeURIComponent('package.json')}`], token)
    ]);

    const project = unwrap(detailsProbe.data);
    const pkg = parsePackage(packageProbe.data);
    const workspace = workspaceFrom(project);
    const gitSync = gitSyncFrom(gitProbe.data);
    const backend = backendFrom(cloudProbe.data, configProbe.data);
    const successfulProbes = [detailsProbe, configProbe, cloudProbe, gitProbe, packageProbe].filter(item => item.ok).length;

    return sanitizedSnapshot({
      detected: true,
      projectId,
      url: location.href,
      collectedAt: new Date().toISOString(),
      auth: { sessionAvailable: true },
      project: {
        name: first(project.name, project.title, project.project_name),
        framework: frameworkFrom(project, pkg)
      },
      workspace,
      gitSync,
      backend,
      preview: previewFrom(project),
      diagnostics: {
        partial: successfulProbes < 3,
        successfulProbes,
        probes: {
          details: detailsProbe.ok,
          config: configProbe.ok,
          cloud: cloudProbe.ok,
          gitSync: gitProbe.ok,
          packageJson: packageProbe.ok
        }
      }
    });
  }

  async function refresh(force = false) {
    if (refreshPromise && !force) return refreshPromise;
    refreshPromise = (async () => {
      const next = await collect();
      context = next;
      await portCall('update', { context: next });
      window.dispatchEvent(new CustomEvent('ld2:project-context', { detail: next }));
      return next;
    })().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  window.LovableDecrypterProjectRuntime = {
    refresh,
    getContext: () => context ? structuredClone(context) : null
  };

  addEventListener('ld2:project', () => refresh(true).catch(() => {}));
  addEventListener('hashchange', () => refresh(true).catch(() => {}));
  addEventListener('popstate', () => refresh(true).catch(() => {}));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh(true).catch(() => {});
  });
  setTimeout(() => refresh(true).catch(() => {}), 0);
  setInterval(() => {
    if (document.visibilityState === 'visible' && projectIdFromLocation()) refresh(false).catch(() => {});
  }, REFRESH_MS);
})();
