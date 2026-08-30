import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { syncRepositoryCache } from '../core/repo-cache.js';
import { buildContextPack, loadRecentUserEdits, CONTEXT_ENGINE_SCHEMA } from '../core/context-engine-v2.js';
import { searchKnowledge } from './knowledge-client.js';

const PORT_NAME = 'ld2-context-engine';
const BUILD = 64;

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function activeGithub(settings, projectId = '') {
  const mapping = projectId && settings?.projectMappings?.[projectId] ? settings.projectMappings[projectId] : {};
  return { ...(settings?.github || {}), ...(mapping || {}) };
}

function sanitizeSkills(items = []) {
  return (Array.isArray(items) ? items : []).slice(0, 12).map(item => ({
    slug: text(item?.slug || item, 180),
    display_name: text(item?.display_name || item?.displayName, 240),
    official: item?.official !== false
  })).filter(item => item.slug);
}

async function loadProfile(github) {
  if (!github?.owner || !github?.repo) return {};
  const key = `ld2_agent_profile_${github.owner}_${github.repo}`;
  const stored = await chrome.storage.local.get(key);
  return stored[key] && typeof stored[key] === 'object' ? stored[key] : {};
}

async function loadImpactSignals(settings, projectId) {
  const base = text(settings?.auth?.backendBase, 2000).replace(/\/+$/, '');
  const license = text(settings?.auth?.licenseKey, 20000);
  const device = text(settings?.auth?.deviceId, 1000);
  if (!base || !license || !device || !projectId) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(`${base}/ld-project-intelligence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-license-key': license, 'x-device-id': device },
      body: JSON.stringify({ action: 'list_impacts', project_id: projectId, limit: 10 }),
      signal: controller.signal,
      cache: 'no-store'
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) return [];
    return Array.isArray(body?.items) ? body.items.slice(0, 10) : [];
  } catch (_) { return []; }
  finally { clearTimeout(timer); }
}

async function build(payload = {}, emit = null) {
  const task = text(payload?.task || payload?.command || payload?.message, 60000);
  const projectId = text(payload?.projectId, 180);
  if (!task) throw Object.assign(new Error('CONTEXT_TASK_REQUIRED'), { code: 'CONTEXT_TASK_REQUIRED' });
  if (!projectId) throw Object.assign(new Error('CONTEXT_PROJECT_REQUIRED'), { code: 'CONTEXT_PROJECT_REQUIRED' });
  const settings = await getSettings();
  const github = activeGithub(settings, projectId);
  if (!github?.owner || !github?.repo) throw Object.assign(new Error('CONTEXT_GITHUB_MAPPING_REQUIRED'), { code: 'CONTEXT_GITHUB_MAPPING_REQUIRED' });
  const adapter = new GitAdapter(github);
  emit?.('sync', 'Sincronizando índice do repositório');
  const repoCache = await syncRepositoryCache(adapter, { branch: github.branch || 'main' });
  emit?.('signals', 'Carregando Brain, Journal, edições humanas e sinais recentes');
  const [profile, userEdits, impacts, knowledge] = await Promise.all([
    loadProfile(github),
    loadRecentUserEdits(projectId),
    loadImpactSignals(settings, projectId),
    payload?.includeKnowledge === false ? Promise.resolve(null) : searchKnowledge({
      backendBase: settings?.auth?.backendBase || '',
      licenseKey: settings?.auth?.licenseKey || '',
      deviceId: settings?.auth?.deviceId || ''
    }, task)
  ]);
  emit?.('pack', 'Selecionando o menor Context Pack útil');
  return buildContextPack(adapter, task, {
    projectId,
    owner: github.owner,
    repo: github.repo,
    branch: github.branch || 'main',
    repoCache,
    profile,
    userEdits,
    impacts,
    knowledge,
    skills: sanitizeSkills(payload?.skills || []),
    explicitPaths: Array.isArray(payload?.explicitPaths) ? payload.explicitPaths : [],
    projectState: payload?.projectState && typeof payload.projectState === 'object' ? payload.projectState : {},
    diagnostics: payload?.diagnostics && typeof payload.diagnostics === 'object' ? payload.diagnostics : {},
    maxFiles: Math.min(24, Math.max(6, Number(payload?.maxFiles || settings?.agent?.maxFiles || 16))),
    maxContextBytes: Math.min(700000, Math.max(80000, Number(payload?.maxContextBytes || 220000))),
    maxCodeBytes: Math.min(480000, Math.max(50000, Number(payload?.maxCodeBytes || 150000)))
  });
}

async function handle(action, payload = {}, emit = null) {
  const op = text(action, 80).toLowerCase();
  if (op === 'status') return {
    schema: CONTEXT_ENGINE_SCHEMA,
    build: BUILD,
    engine: 'context-engine-v2',
    selection: 'budgeted-multi-source-ranking',
    rawPromptPersistence: false,
    rawKeystrokePersistence: false,
    userEditCapture: 'editor-activity+workspace-revision',
    humanIntentEnforcement: 'build65',
    sources: ['repository', 'git-history', 'project-brain', 'project-rules', 'skills', 'impact-maps', 'operation-journal', 'recent-user-edits', 'project-state', 'diagnostics', 'knowledge']
  };
  if (op === 'user_edits') return { schema: 'ld-user-edit-context/1', edits: await loadRecentUserEdits(payload?.projectId || '', payload?.limit || 24) };
  if (op === 'build') return { pack: await build(payload, emit) };
  throw Object.assign(new Error(`CONTEXT_ENGINE_ACTION_INVALID: ${op}`), { code: 'CONTEXT_ENGINE_ACTION_INVALID' });
}

export function installContextEngineRuntime() {
  if (globalThis.__LD64_CONTEXT_ENGINE_RUNTIME__) return;
  globalThis.__LD64_CONTEXT_ENGINE_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 160);
      const emit = (stage, detail) => {
        try { port.postMessage({ id, event: 'progress', stage, detail }); } catch (_) {}
      };
      try {
        const data = await handle(message?.action || 'status', message?.payload || {}, emit);
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try { port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || '' }); } catch (_) {}
      }
    };
    port.onMessage.addListener(listener);
  });

  globalThis.LovableDecrypterContextEngine = Object.freeze({
    build: BUILD,
    schema: CONTEXT_ENGINE_SCHEMA,
    port: PORT_NAME,
    authorityAware: true,
    budgeted: true,
    userEditAware: true,
    rawPromptPersistence: false,
    rawKeystrokePersistence: false
  });
}
