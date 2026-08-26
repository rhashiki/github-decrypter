(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_PROJECT_RULES_CACHE__) return;
  window.__LOVABLE_DECRYPTER_PROJECT_RULES_CACHE__ = true;

  const api = window.LovableDecrypterV2;
  if (!api?.runtime) return;

  const previousRuntime = api.runtime.bind(api);
  const nativeFetch = window.fetch.bind(window);
  const EXECUTION_TYPES = new Set(['LD2_PLAN_ONLY', 'LD2_BUILD_EXECUTE', 'LD2_PLAN_APPROVE', 'LD2_PLAN_PREPARE']);
  const SNAPSHOT_PREFIX = 'ld2_project_rules_snapshot_';
  let inflight = null;

  const unique = values => [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
  const cacheKey = github => `ld2_agent_profile_${github.owner}_${github.repo}`;
  const snapshotKey = github => `${SNAPSHOT_PREFIX}${github.owner}_${github.repo}`;

  async function settings() {
    return previousRuntime({ type: 'LD2_SETTINGS_GET' });
  }

  async function context() {
    const cfg = await settings();
    const projectId = String(api.getProjectId?.() || '');
    const mapping = cfg?.projectMappings?.[projectId] || {};
    const github = { ...(cfg?.github || {}), ...mapping };
    return { cfg, projectId, github };
  }

  async function cloud(cfg, projectId, action) {
    const base = String(cfg?.auth?.backendBase || '').replace(/\/+$/, '');
    const key = String(cfg?.auth?.licenseKey || '');
    const device = String(cfg?.auth?.deviceId || '');
    if (!base || !key || !device || !projectId) return null;
    const res = await nativeFetch(`${base}/ld-project-intelligence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-license-key': key, 'x-device-id': device },
      body: JSON.stringify({ action, project_id: projectId })
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
    return out;
  }

  async function hydrate() {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const { cfg, projectId, github } = await context();
        if (!projectId || !github?.owner || !github?.repo) return null;

        const [brainOut, rulesOut, local] = await Promise.all([
          cloud(cfg, projectId, 'get_brain').catch(() => ({ brain: null })),
          cloud(cfg, projectId, 'list_rules').catch(() => ({ rules: [] })),
          chrome.storage.local.get([cacheKey(github), snapshotKey(github)])
        ]);

        const brain = brainOut?.brain || null;
        const activeRules = unique((Array.isArray(rulesOut?.rules) ? rulesOut.rules : [])
          .filter(rule => rule?.enabled !== false)
          .map(rule => rule?.rule_text));
        const previousSnapshot = Array.isArray(local[snapshotKey(github)]) ? local[snapshotKey(github)] : [];
        const existing = local[cacheKey(github)] && typeof local[cacheKey(github)] === 'object' ? local[cacheKey(github)] : {};

        const baseRules = brain
          ? (Array.isArray(brain.rules) ? brain.rules : [])
          : (Array.isArray(existing.rules) ? existing.rules.filter(rule => !previousSnapshot.includes(String(rule))) : []);

        const profile = {
          project_summary: brain?.project_summary || existing.project_summary || '',
          architecture: brain ? (Array.isArray(brain.architecture) ? brain.architecture : []) : (Array.isArray(existing.architecture) ? existing.architecture : []),
          rules: unique([...baseRules, ...activeRules]),
          important_paths: brain ? (Array.isArray(brain.important_paths) ? brain.important_paths : []) : (Array.isArray(existing.important_paths) ? existing.important_paths : []),
          validation_checklist: brain ? (Array.isArray(brain.validation_checklist) ? brain.validation_checklist : []) : (Array.isArray(existing.validation_checklist) ? existing.validation_checklist : [])
        };

        await chrome.storage.local.set({
          [cacheKey(github)]: profile,
          [snapshotKey(github)]: activeRules
        });
        window.dispatchEvent(new CustomEvent('ld2:project-rules-synced', { detail: { projectId, count: activeRules.length } }));
        return { projectId, count: activeRules.length, profile };
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  api.runtime = async message => {
    if (EXECUTION_TYPES.has(String(message?.type || ''))) await hydrate();
    return previousRuntime(message);
  };

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => hydrate().catch(() => {}), 250);
  }

  window.addEventListener('ld2:project', schedule);
  window.addEventListener('ld2:dom-reconcile', schedule);
  new MutationObserver(mutations => {
    if (mutations.some(m => m.target?.closest?.('[data-rules-body]') || [...(m.addedNodes || [])].some(n => n?.nodeType === 1 && (n.matches?.('[data-rules-body]') || n.querySelector?.('[data-rules-body]'))))) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.LovableDecrypterProjectRulesCache = { refresh: hydrate };
  schedule();
})();
