(() => {
  'use strict';
  if (window.__LD2_LOVABLE_SYNC_VERIFIER__) return;
  window.__LD2_LOVABLE_SYNC_VERIFIER__ = true;

  const API_BASE = 'https://api.lovable.dev';
  const REQUEST_TIMEOUT_MS = 7000;
  const VERIFY_ATTEMPTS = 4;
  const VERIFY_DELAY_MS = 1800;

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
      return await response.json().catch(() => ({}));
    } finally {
      clearTimeout(timer);
    }
  }

  async function gitSync(projectId, token) {
    const encoded = encodeURIComponent(projectId);
    for (const path of [`/projects/${encoded}/gitsync`, `/projects/${encoded}/git-sync`]) {
      try { return { ok: true, path, data: await api(path, token) }; } catch (_) {}
    }
    return { ok: false, path: '', data: null };
  }

  function collectCommitShas(value, path = '', out = new Set(), depth = 0) {
    if (value == null || depth > 8) return out;
    if (Array.isArray(value)) {
      value.forEach((item, index) => collectCommitShas(item, `${path}[${index}]`, out, depth + 1));
      return out;
    }
    if (typeof value !== 'object') return out;
    for (const [key, item] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (typeof item === 'string' && /(commit|sha|head|synced|revision)/i.test(key) && /^[0-9a-f]{7,64}$/i.test(item.trim())) {
        out.add(item.trim().toLowerCase());
      } else if (typeof item === 'object' && item) {
        collectCommitShas(item, nextPath, out, depth + 1);
      }
    }
    return out;
  }

  function matchesExpected(observed, expected) {
    const target = String(expected || '').trim().toLowerCase();
    if (!target) return false;
    return [...observed].some(value => value === target || value.startsWith(target) || target.startsWith(value));
  }

  async function verify({ projectId, commitSha }) {
    const pid = String(projectId || '').trim();
    const expected = String(commitSha || '').trim().toLowerCase();
    if (!pid || !/^[0-9a-f]{7,64}$/i.test(expected)) {
      return { verified: false, observable: false, reason: 'invalid_input', observedShas: [] };
    }

    const token = await lovableToken();
    if (!token) return { verified: false, observable: false, reason: 'lovable_session_unavailable', observedShas: [] };

    let sawEndpoint = false;
    let sawShaField = false;
    let lastObserved = [];
    for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
      const probe = await gitSync(pid, token);
      if (probe.ok) {
        sawEndpoint = true;
        const observed = collectCommitShas(probe.data);
        lastObserved = [...observed];
        if (observed.size) sawShaField = true;
        if (matchesExpected(observed, expected)) {
          return {
            verified: true,
            observable: true,
            reason: 'commit_confirmed',
            attempt,
            observedShas: lastObserved.slice(0, 12)
          };
        }
        if (attempt >= 2 && !sawShaField) {
          return {
            verified: false,
            observable: false,
            reason: 'gitsync_sha_not_exposed',
            attempt,
            observedShas: []
          };
        }
      }
      if (attempt < VERIFY_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, VERIFY_DELAY_MS));
    }

    return {
      verified: false,
      observable: sawEndpoint && sawShaField,
      reason: sawEndpoint ? (sawShaField ? 'commit_not_observed_yet' : 'gitsync_sha_not_exposed') : 'gitsync_unavailable',
      observedShas: lastObserved.slice(0, 12)
    };
  }

  window.LovableDecrypterSyncVerifier = { verify };
})();
