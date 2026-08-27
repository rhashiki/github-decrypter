(() => {
  'use strict';
  if (window.__LD2_LOVABLE_PROJECT_CREATOR__) return;
  window.__LD2_LOVABLE_PROJECT_CREATOR__ = true;

  const API_BASE = 'https://api.lovable.dev';
  const REQUEST_TIMEOUT_MS = 12000;
  const MAX_NAME = 80;

  const text = value => String(value ?? '').trim();
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function tokenFromObject(value, depth = 0) {
    if (!value || depth > 6) return '';
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = tokenFromObject(item, depth + 1);
        if (found) return found;
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
      const found = tokenFromObject(item, depth + 1);
      if (found) return found;
    }
    return '';
  }

  function tokenFromLocalStorage() {
    try {
      for (const key of Object.keys(localStorage)) {
        if (!/firebase:authUser:|firebaseLocalStorage/i.test(key)) continue;
        try {
          const found = tokenFromObject(JSON.parse(localStorage.getItem(key) || 'null'));
          if (found) return found;
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
          const db = request.result;
          try {
            if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
              db.close();
              resolve('');
              return;
            }
            const tx = db.transaction('firebaseLocalStorage', 'readonly');
            const getAll = tx.objectStore('firebaseLocalStorage').getAll();
            getAll.onerror = () => { db.close(); resolve(''); };
            getAll.onsuccess = () => {
              const found = tokenFromObject(getAll.result || []);
              db.close();
              resolve(found || '');
            };
          } catch (_) {
            try { db.close(); } catch (_) {}
            resolve('');
          }
        };
      });
    } catch (_) {
      return '';
    }
  }

  async function sessionToken() {
    return tokenFromLocalStorage() || await tokenFromIndexedDb();
  }

  async function request(path, token, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: options.method || 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      });
      const raw = await response.text();
      let body = null;
      try { body = raw ? JSON.parse(raw) : null; } catch (_) { body = null; }
      if (!response.ok) {
        const detail = text(body?.detail || body?.message || body?.error || raw).slice(0, 240);
        if (response.status === 401) throw new Error('Sessão Lovable expirada. Entre novamente no Lovable e tente de novo.');
        if (response.status === 402) throw new Error('O workspace não está elegível para criar projeto neste momento. Verifique os limites/créditos no Lovable.');
        if (response.status === 403 && /castle/i.test(detail)) throw new Error('O Lovable bloqueou a criação por proteção da plataforma. Tente novamente diretamente no Dashboard do Lovable.');
        throw new Error(`Lovable respondeu HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
      }
      return body ?? {};
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('O Lovable não respondeu dentro do tempo limite.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function normalizeWorkspace(raw = {}, balance = {}) {
    return {
      id: text(raw.id),
      name: text(raw.name) || 'Workspace',
      plan: text(raw.plan),
      totalRemaining: finite(balance.total_remaining),
      dailyRemaining: finite(balance.daily_remaining),
      outOfBuildCredits: balance.out_of_build_credits === true
    };
  }

  async function listWorkspaces() {
    const token = await sessionToken();
    if (!token) throw new Error('Sessão Lovable não encontrada. Entre no Lovable e tente novamente.');
    const raw = await request('/user/workspaces', token);
    const source = Array.isArray(raw) ? raw : Array.isArray(raw?.workspaces) ? raw.workspaces : Array.isArray(raw?.data) ? raw.data : [];
    const workspaces = [];
    for (const item of source.filter(item => item?.id)) {
      let balance = {};
      try { balance = await request(`/workspaces/${encodeURIComponent(item.id)}/credit-balance`, token); } catch (_) {}
      workspaces.push(normalizeWorkspace(item, balance));
    }
    workspaces.sort((a, b) => b.totalRemaining - a.totalRemaining || b.dailyRemaining - a.dailyRemaining || a.name.localeCompare(b.name));
    return { workspaces };
  }

  function cleanName(value) {
    const name = text(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name) throw new Error('Digite um nome para o projeto.');
    if (name.length > MAX_NAME) throw new Error(`Use no máximo ${MAX_NAME} caracteres no nome.`);
    return name;
  }

  async function createProject({ workspaceId, name } = {}) {
    const id = text(workspaceId);
    if (!id) throw new Error('Selecione um workspace Lovable.');
    const description = cleanName(name);
    const token = await sessionToken();
    if (!token) throw new Error('Sessão Lovable não encontrada. Entre novamente no Lovable.');

    const result = await request(`/v1/workspaces/${encodeURIComponent(id)}/projects`, token, {
      method: 'POST',
      body: {
        description,
        tech_stack: 'modern',
        visibility: 'private'
      }
    });
    const project = result?.project && typeof result.project === 'object' ? result.project : result;
    const projectId = text(project?.id || project?.project_id);
    if (!projectId) throw new Error('O Lovable criou uma resposta sem ID de projeto. Nada será aberto automaticamente.');
    return {
      id: projectId,
      url: `https://lovable.dev/projects/${encodeURIComponent(projectId)}`,
      workspaceId: id,
      name: description
    };
  }

  window.LovableDecrypterProjectCreator = {
    listWorkspaces,
    createProject
  };
})();
