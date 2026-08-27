import { VERSION, HISTORY_KEY, DEFAULT_BACKEND_BASE, DEFAULT_VAULT_API_BASE } from '../settings/config.js';
import { getSettings, saveSettings, updateSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { GeminiAgent } from '../ai/gemini-agent.js';
import { buildProjectContext } from '../core/context-builder.js';
import { parseCommand } from '../core/command-parser.js';
import { parseRepoInput, nowIso, assertSafeRepoPath, isTextPath } from '../core/utils.js';
import { testSupabase, runSupabaseSql } from '../tools/supabase-tools.js';
import { syncRepositoryCache, getCachedFile, getCachedText } from '../core/repo-cache.js';
import { verifyLicenseKey } from '../security/license.js';
import { backupSettingsRemote, restoreSettingsRemote } from '../security/vault.js';
import { checkUpdates, downloadUpdate } from '../updates/update-manager.js';
import { assertScopeLock } from '../core/scope-lock.js';

const pending = new Map();

const UPDATE_RELOAD_KEY = 'ld2_post_update_reload';
const UPDATE_REQUEST_KEY = 'ld2_auto_update_request';
const CACHE_PREFIXES = ['ld2_repo_cache_index_v1_', 'ld2_repo_blob_v1_'];

async function clearExtensionCaches() {
  const all = await chrome.storage.local.get(null);
  const removable = Object.keys(all).filter(key => CACHE_PREFIXES.some(prefix => key.startsWith(prefix)) || key === 'ld2_update_status');
  if (removable.length) await chrome.storage.local.remove(removable);
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    }
  } catch (_) {}
  pending.clear();
  return { removedKeys: removable.length };
}

async function stageAutomaticUpdate(tabId = null) {
  const settings = await getSettings();
  if (settings.auth?.licenseKey && settings.auth?.vaultApiBase) {
    try { await backupSettingsRemote({ settings, licenseKey: settings.auth.licenseKey, vaultApiBase: settings.auth.vaultApiBase }); } catch (_) {}
  }
  const cache = await clearExtensionCaches();
  await chrome.storage.local.set({
    [UPDATE_RELOAD_KEY]: { tabId: Number.isInteger(tabId) ? tabId : null, at: new Date().toISOString() }
  });
  return cache;
}

chrome.runtime.onUpdateAvailable.addListener(async details => {
  const req = (await chrome.storage.local.get(UPDATE_REQUEST_KEY))[UPDATE_REQUEST_KEY];
  if (!req?.autoApply) return;
  try {
    await stageAutomaticUpdate(req.tabId);
    await chrome.storage.local.remove(UPDATE_REQUEST_KEY);
    setTimeout(() => chrome.runtime.reload(), 350);
  } catch (_) {}
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') await saveSettings(await getSettings());
  chrome.alarms.create('ld2_update_check', { periodInMinutes: 360 });
  if (reason === 'update') {
    const staged = (await chrome.storage.local.get(UPDATE_RELOAD_KEY))[UPDATE_RELOAD_KEY];
    await chrome.storage.local.remove([UPDATE_RELOAD_KEY, UPDATE_REQUEST_KEY, 'ld2_update_status']);
    if (Number.isInteger(staged?.tabId)) {
      setTimeout(() => chrome.tabs.reload(staged.tabId, { bypassCache: true }).catch(() => {}), 600);
    }
  }
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'ld2_update_check') return;
  try {
    const settings = await getSettings();
    const status = await checkUpdates({ currentVersion: VERSION, updateFeedUrl: settings.auth?.updateFeedUrl || '' });
    await chrome.storage.local.set({ ld2_update_status: status });
  } catch (e) {
    await chrome.storage.local.set({ ld2_update_status: { error: e?.message || String(e), checkedAt: new Date().toISOString() } });
  }
});

function response(ok, data = null, error = null) { return { ok, data, error }; }

function makeAgent(settings) {
  return new GeminiAgent({
    ...(settings.gemini || {}),
    backendBase: settings.auth?.backendBase || DEFAULT_BACKEND_BASE,
    licenseKey: settings.auth?.licenseKey || '',
    deviceId: settings.auth?.deviceId || ''
  });
}

async function validateLicenseRemote({ licenseKey, deviceId = '', deviceLabel = '', backendBase = DEFAULT_BACKEND_BASE }) {
  const base = String(backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const res = await fetch(`${base}/ld-license-validate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-license-key': String(licenseKey || ''),
      ...(deviceId ? { 'x-device-id': String(deviceId) } : {}),
      ...(deviceLabel ? { 'x-device-label': String(deviceLabel).slice(0, 120) } : {})
    },
    body: JSON.stringify({})
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.valid) {
    const code = body?.code || `HTTP_${res.status}`;
    throw new Error(`Licença recusada pelo servidor: ${code}`);
  }
  return body;
}

async function deviceLabel() {
  try {
    const info = await chrome.runtime.getPlatformInfo();
    return `Chrome ${info?.os || ''} ${info?.arch || ''}`.trim();
  } catch (_) {
    return 'Chrome';
  }
}

async function getActiveConfig(projectId = '') {
  const settings = await getSettings();
  const mapping = projectId && settings.projectMappings?.[projectId];
  const github = { ...settings.github, ...(mapping || {}) };
  return { settings, github };
}

async function historyPush(entry) {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  const list = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
  list.unshift({ id: crypto.randomUUID(), at: nowIso(), ...entry });
  await chrome.storage.local.set({ [HISTORY_KEY]: list.slice(0, 100) });
}

function sendProgress(sender, requestId, payload) {
  if (!requestId || !sender?.tab?.id) return;
  chrome.tabs.sendMessage(sender.tab.id, { type: 'LD2_PROGRESS', requestId, ...payload }).catch(() => {});
}


const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_ATTACHMENTS_TOTAL_BYTES = 40 * 1024 * 1024;
const SUPPORTED_ATTACHMENT_MIME = /^(image\/|audio\/|video\/|text\/|application\/(pdf|json|rtf|msword|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|vnd\.oasis\.opendocument\.(text|spreadsheet|presentation)))/i;

function normalizeAttachments(raw = []) {
  if (!Array.isArray(raw) || !raw.length) return [];
  if (raw.length > MAX_ATTACHMENTS) throw new Error(`Use no máximo ${MAX_ATTACHMENTS} anexos por comando.`);
  let total = 0;
  return raw.map((item, index) => {
    const name = String(item?.name || `anexo-${index + 1}`).slice(0, 240);
    const mimeType = String(item?.mimeType || 'application/octet-stream').toLowerCase();
    const size = Number(item?.size || 0);
    const data = String(item?.data || '');
    if (!SUPPORTED_ATTACHMENT_MIME.test(mimeType)) throw new Error(`Formato de anexo não suportado: ${name} (${mimeType}).`);
    if (!data) throw new Error(`O anexo ${name} está vazio.`);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) throw new Error(`${name} excede o limite de 15 MB por arquivo.`);
    total += size;
    if (total > MAX_ATTACHMENTS_TOTAL_BYTES) throw new Error('Os anexos excedem o limite total de 40 MB por comando.');
    return { name, mimeType, size, data };
  });
}

function occurrenceCount(haystack, needle) {
  if (!needle) return 0;
  let count = 0, from = 0;
  while ((from = haystack.indexOf(needle, from)) !== -1) { count++; from += needle.length; }
  return count;
}

function applyMinimalEdits(before, edits, path) {
  if (!Array.isArray(edits) || !edits.length) throw new Error(`O agente não retornou patches mínimos para ${path}.`);
  let content = String(before ?? '');
  const originalLines = Math.max(1, content.split('\n').length);
  for (const [index, edit] of edits.entries()) {
    const search = String(edit?.search ?? '');
    const replace = String(edit?.replace ?? '');
    if (!search) throw new Error(`Patch ${index + 1} de ${path} não possui trecho de busca.`);
    const matches = occurrenceCount(content, search);
    if (matches !== 1) throw new Error(`Patch ${index + 1} de ${path} não é seguro: o trecho precisa existir exatamente uma vez (encontrado ${matches}).`);
    const searchLines = Math.max(1, search.split('\n').length);
    if (originalLines >= 30 && (searchLines / originalLines) > 0.65) {
      throw new Error(`Patch recusado em ${path}: o agente tentou substituir uma parte excessiva do arquivo (${searchLines}/${originalLines} linhas).`);
    }
    if (search.length > 24000) throw new Error(`Patch recusado em ${path}: trecho de substituição grande demais.`);
    content = content.replace(search, replace);
  }
  if (content === before) throw new Error(`Os patches de ${path} não produziram nenhuma alteração.`);
  return content;
}

function hasExplicitDeleteIntent(command = '') {
  return /\b(remov(?:a|er)|exclu(?:a|ir)|apag(?:ue|ar)|delet(?:e|ar)|delete|remove)\b/i.test(String(command));
}

async function preparePlan({ command, projectId = '', preset = '', attachments = [] }, progress = () => {}, options = {}) {
  const startedAt = options.startedAt || Date.now();
  const emit = (stage, label, detail = '', status = 'active', extra = {}) => progress({ stage, label, detail, status, elapsedMs: Date.now() - startedAt, ...extra });
  emit('prompt', 'Lendo prompt', 'Interpretando solicitação…');
  const cleanCommand = String(command || preset || '').trim();
  if (!cleanCommand) throw new Error('Digite um comando.');
  const safeAttachments = normalizeAttachments(attachments);
  if (safeAttachments.length) emit('prompt', 'Lendo prompt', `${safeAttachments.length} anexo(s) recebido(s) como referência…`);
  const { settings, github } = await getActiveConfig(projectId);
  const adapter = new GitAdapter(github);
  const agent = makeAgent(settings);
  const parsed = parseCommand(cleanCommand);
  emit('prompt', 'Lendo prompt', parsed?.action ? `Ação identificada: ${parsed.action}` : 'Solicitação interpretada', 'done');

  emit('cache', 'Sincronizando projeto', 'Verificando cache local do repositório…');
  const repoCache = await syncRepositoryCache(adapter, {
    branch: github.branch,
    onProgress: info => emit('cache', 'Sincronizando projeto', info.hit ? `Cache atualizado · ${info.cached} arquivos` : `Cacheando arquivos · ${info.cached}/${info.total}`, 'active', { current: info.cached, total: info.total })
  });
  emit('cache', 'Sincronizando projeto', repoCache.cacheHit ? `Cache pronto · commit ${String(repoCache.headSha).slice(0, 8)}` : `${repoCache.cachedTextFiles} arquivos em cache`, 'done');

  emit('context', 'Analisando arquivos', 'Localizando arquivos relevantes para o comando…');
  const context = await buildProjectContext(adapter, cleanCommand, {
    branch: github.branch,
    maxFiles: settings.agent.maxFiles,
    maxContextBytes: settings.agent.maxContextBytes,
    repoCache
  });
  emit('context', 'Analisando arquivos', `${context.files.length} relevantes encontrados · ${context.totalFiles} no projeto`, 'done', { found: context.files.length, totalFiles: context.totalFiles });
  const agentRulesKey = `ld2_agent_profile_${github.owner}_${github.repo}`;
  const agentData = await chrome.storage.local.get(agentRulesKey);
  const profile = agentData[agentRulesKey];
  const generatedRules = profile ? [
    profile.project_summary || '',
    ...(profile.architecture || []),
    ...(profile.rules || []),
    ...(profile.validation_checklist || [])
  ].join('\n- ') : '';
  const rules = [settings.agent.rules || '', generatedRules].filter(Boolean).join('\n\n');
  emit('ai', 'Editando', `Gemini ${settings.gemini.model || ''} processando alterações…`);
  const plan = await agent.processCommand(cleanCommand, context, rules, safeAttachments, options.approvedPlan || null);
  emit('ai', 'Editando', `${plan.files?.length || 0} arquivo(s) proposto(s)`, 'done');
  if (!plan.files?.length) throw new Error('A IA não propôs alterações de arquivo. Refine o comando.');
  if (plan.files.length > 30) throw new Error('A IA propôs arquivos demais de uma só vez. Divida o comando.');

  emit('diff', 'Preparando revisão', 'Comparando estado atual e alterações propostas…');
  const beforeByPath = new Map(context.files.map(f => [f.path, f.content]));
  for (const file of plan.files) {
    file.path = assertSafeRepoPath(file.path);
    if (!beforeByPath.has(file.path) && file.action !== 'create') {
      try {
        const cached = await getCachedFile(repoCache, file.path);
        if (cached) beforeByPath.set(file.path, cached.content);
        else {
          const current = await adapter.getFileByPath(file.path, github.branch);
          beforeByPath.set(file.path, current.text);
        }
      } catch (_) { beforeByPath.set(file.path, ''); }
    }
    file.before = beforeByPath.get(file.path) || '';
    if (file.action === 'update') {
      if (!file.before) throw new Error(`Não foi possível obter o conteúdo atual de ${file.path} para aplicar um patch mínimo.`);
      file.content = applyMinimalEdits(file.before, file.edits, file.path);
    } else if (file.action === 'create') {
      if (file.edits?.length) throw new Error(`Arquivo novo ${file.path} não deve conter patches de update.`);
      if (!file.content) throw new Error(`O agente não forneceu conteúdo para o novo arquivo ${file.path}.`);
    } else if (file.action === 'delete') {
      if (!hasExplicitDeleteIntent(cleanCommand)) throw new Error(`Exclusão recusada em ${file.path}: o comando não pediu explicitamente para excluir/remover.`);
      file.content = '';
    } else {
      throw new Error(`Ação não suportada em ${file.path}: ${file.action}`);
    }
  }

  const id = crypto.randomUUID();
  const bundle = {
    id,
    createdAt: nowIso(),
    command: cleanCommand,
    parsed,
    github: { owner: github.owner, repo: github.repo, branch: github.branch },
    baseHeadSha: repoCache.headSha || '',
    settings: { createBranch: false, createPr: false },
    attachments: safeAttachments.map(({ name, mimeType, size }) => ({ name, mimeType, size })),
    plan
  };
  bundle.scopeLock = assertScopeLock(bundle);
  emit('diff', 'Preparando revisão', `${plan.files.length} arquivo(s) pronto(s) para revisar`, 'done');
  if (options.finish !== false) emit('done', 'Concluído', plan.summary || 'Revisão pronta', 'done');
  pending.set(id, bundle);
  await chrome.storage.local.set({ [`ld2_pending_${id}`]: bundle });
  await historyPush({ type: 'plan', command: cleanCommand, repo: `${github.owner}/${github.repo}`, summary: plan.summary });
  return bundle;
}


async function getAgentRules(settings, github) {
  const agentRulesKey = `ld2_agent_profile_${github.owner}_${github.repo}`;
  const agentData = await chrome.storage.local.get(agentRulesKey);
  const profile = agentData[agentRulesKey];
  const generatedRules = profile ? [
    profile.project_summary || '',
    ...(profile.architecture || []),
    ...(profile.rules || []),
    ...(profile.validation_checklist || [])
  ].join('\n- ') : '';
  return [settings.agent.rules || '', generatedRules].filter(Boolean).join('\n\n');
}

async function preparePlanning({ command, projectId = '', preset = '', attachments = [] }, progress = () => {}) {
  const startedAt = Date.now();
  const emit = (stage, label, detail = '', status = 'active', extra = {}) => progress({ stage, label, detail, status, elapsedMs: Date.now() - startedAt, ...extra });
  emit('prompt', 'Lendo prompt', 'Interpretando solicitação…');
  const cleanCommand = String(command || preset || '').trim();
  if (!cleanCommand) throw new Error('Digite um comando.');
  const safeAttachments = normalizeAttachments(attachments);
  if (safeAttachments.length) emit('prompt', 'Lendo prompt', `${safeAttachments.length} anexo(s) recebido(s) como referência…`);
  const { settings, github } = await getActiveConfig(projectId);
  const adapter = new GitAdapter(github);
  const agent = makeAgent(settings);
  const parsed = parseCommand(cleanCommand);
  emit('prompt', 'Lendo prompt', parsed?.action ? `Ação identificada: ${parsed.action}` : 'Solicitação interpretada', 'done');

  emit('cache', 'Sincronizando projeto', 'Verificando cache local do repositório…');
  const repoCache = await syncRepositoryCache(adapter, {
    branch: github.branch,
    onProgress: info => emit('cache', 'Sincronizando projeto', info.hit ? `Cache pronto · ${info.cached} arquivos` : `Cacheando arquivos · ${info.cached}/${info.total}`, 'active')
  });
  emit('cache', 'Sincronizando projeto', repoCache.cacheHit ? `Cache pronto · commit ${String(repoCache.headSha).slice(0, 8)}` : `${repoCache.cachedTextFiles} arquivos em cache`, 'done');

  emit('context', 'Analisando arquivos', 'Localizando arquivos relevantes para o plano…');
  const context = await buildProjectContext(adapter, cleanCommand, {
    branch: github.branch,
    maxFiles: settings.agent.maxFiles,
    maxContextBytes: settings.agent.maxContextBytes,
    repoCache
  });
  emit('context', 'Analisando arquivos', `${context.files.length} relevantes encontrados · ${context.totalFiles} no projeto`, 'done');
  const rules = await getAgentRules(settings, github);
  emit('ai', 'Planejando', `Gemini ${settings.gemini.model || ''} elaborando o plano…`);
  const plan = await agent.planCommand(cleanCommand, context, rules, safeAttachments);
  emit('ai', 'Planejando', `${plan.plan.length} etapa(s) definidas`, 'done');
  emit('done', 'Concluído', plan.summary || 'Plano pronto', 'done');
  await historyPush({ type: 'plan', command: cleanCommand, repo: `${github.owner}/${github.repo}`, summary: plan.summary });
  return {
    mode: 'plan',
    command: cleanCommand,
    github: { owner: github.owner, repo: github.repo, branch: github.branch },
    attachments: safeAttachments.map(({ name, mimeType, size }) => ({ name, mimeType, size })),
    plan
  };
}

async function buildAndApply(msg, progress = () => {}) {
  const startedAt = Date.now();
  const passthrough = payload => progress({ ...payload, elapsedMs: Date.now() - startedAt });
  const bundle = await preparePlan(msg, passthrough, { finish: false, startedAt });
  passthrough({ stage: 'commit', label: 'Aplicando alterações', detail: `Commitando ${bundle.plan.files.length} arquivo(s) na branch ${bundle.github.branch}…`, status: 'active' });
  const result = await applyPlan({ id: bundle.id });
  passthrough({ stage: 'commit', label: 'Aplicando alterações', detail: `Commit ${String(result.commitSha || '').slice(0, 8)} criado em ${result.branch}`, status: 'done' });
  passthrough({ stage: 'sync', label: 'Sincronizando preview', detail: 'GitHub atualizado · aguardando o GitSync do Lovable refletir a alteração…', status: 'active' });
  // O Lovable controla a latência do GitSync. Não usamos APIs internas nem interceptação.
  passthrough({ stage: 'sync', label: 'Sincronizando preview', detail: 'Commit publicado na branch vinculada; o GitSync do Lovable assume a atualização visual.', status: 'done' });
  passthrough({ stage: 'done', label: 'Concluído', detail: `Commit ${String(result.commitSha || '').slice(0, 8)} · o preview real do Lovable deve atualizar pelo GitSync`, status: 'done' });
  return { mode: 'build', bundle, result };
}

async function approvePlanning(msg, progress = () => {}) {
  const startedAt = Date.now();
  const passthrough = payload => progress({ ...payload, elapsedMs: Date.now() - startedAt });
  const approvedPlan = msg?.approvedPlan;
  if (!approvedPlan || !Array.isArray(approvedPlan.plan)) throw new Error('Plano aprovado inválido. Gere o plano novamente.');
  passthrough({ stage: 'prompt', label: 'Plano aprovado', detail: 'Preparando execução exatamente conforme a proposta aprovada…', status: 'active' });
  const bundle = await preparePlan(msg, passthrough, { finish: false, startedAt, approvedPlan });
  passthrough({ stage: 'commit', label: 'Aplicando plano aprovado', detail: `Commitando ${bundle.plan.files.length} arquivo(s) na branch ${bundle.github.branch}…`, status: 'active' });
  const result = await applyPlan({ id: bundle.id });
  passthrough({ stage: 'commit', label: 'Aplicando plano aprovado', detail: `Commit ${String(result.commitSha || '').slice(0, 8)} criado em ${result.branch}`, status: 'done' });
  passthrough({ stage: 'sync', label: 'Sincronizando preview', detail: 'GitHub atualizado · o GitSync do Lovable assumiu a atualização visual.', status: 'done' });
  passthrough({ stage: 'done', label: 'Concluído', detail: `Plano aprovado aplicado · commit ${String(result.commitSha || '').slice(0, 8)}`, status: 'done' });
  return { mode: 'build', approved: true, bundle, result };
}

async function getPending(id) {
  if (pending.has(id)) return pending.get(id);
  const data = await chrome.storage.local.get(`ld2_pending_${id}`);
  const bundle = data[`ld2_pending_${id}`];
  if (!bundle) throw new Error('Preview expirado. Gere o plano novamente.');
  pending.set(id, bundle);
  return bundle;
}


async function applyPlan({ id, keepBundle = false }) {
  const bundle = await getPending(id);
  bundle.scopeLock = assertScopeLock(bundle);
  const { github } = await getActiveConfig('');
  const cfg = { ...github, ...bundle.github };
  const adapter = new GitAdapter(cfg);
  const currentRef = await adapter.getRef(bundle.github.branch);
  const currentHead = currentRef?.object?.sha || '';
  if (bundle.baseHeadSha && currentHead && currentHead !== bundle.baseHeadSha) {
    throw new Error(`A branch ${bundle.github.branch} mudou desde a geração do preview. Gere o plano novamente para não sobrescrever alterações recentes.`);
  }
  const result = await adapter.atomicCommit({
    files: bundle.plan.files.map(({ path, action, content }) => ({ path, action, content })),
    message: bundle.plan.commit_message || `feat: ${bundle.plan.summary || 'Lovable Decrypter changes'}`,
    baseBranch: bundle.github.branch,
    createBranch: false,
    createPr: false
  });
  if (!keepBundle) {
    pending.delete(id);
    await chrome.storage.local.remove(`ld2_pending_${id}`);
  }
  syncRepositoryCache(adapter, { branch: bundle.github.branch }).catch(() => null);
  await historyPush({ type: 'apply', command: bundle.command, repo: `${bundle.github.owner}/${bundle.github.repo}`, result });
  return result;
}

async function trainAgent({ projectId = '' }) {
  const { settings, github } = await getActiveConfig(projectId);
  const adapter = new GitAdapter(github);
  const agent = makeAgent(settings);
  const context = await buildProjectContext(adapter, 'Analise arquitetura, padrões e regras do projeto inteiro', {
    branch: github.branch,
    maxFiles: Math.min(30, settings.agent.maxFiles + 8),
    maxContextBytes: Math.min(900000, settings.agent.maxContextBytes + 300000)
  });
  const profile = await agent.trainAgent(context);
  const key = `ld2_agent_profile_${github.owner}_${github.repo}`;
  await chrome.storage.local.set({ [key]: profile });
  return { key, profile };
}

async function getAgentProfile({ projectId = '' }) {
  const { github } = await getActiveConfig(projectId);
  const key = `ld2_agent_profile_${github.owner}_${github.repo}`;
  const data = await chrome.storage.local.get(key);
  return data[key] || null;
}

async function migrationSql({ projectId = '' }) {
  const { github } = await getActiveConfig(projectId);
  const adapter = new GitAdapter(github);
  const tree = await adapter.getTree(github.branch, true);
  const migrations = (tree.tree || [])
    .filter(x => x.type === 'blob' && /^supabase\/migrations\/.*\.sql$/i.test(x.path))
    .sort((a, b) => a.path.localeCompare(b.path));
  if (!migrations.length) throw new Error('Nenhuma migration em supabase/migrations/*.sql foi encontrada.');
  const parts = [];
  for (const item of migrations) {
    const sql = await adapter.getBlob(item.sha);
    parts.push(`-- FILE: ${item.path}\n${sql}`);
  }
  return { paths: migrations.map(x => x.path), sql: parts.join('\n\n-- ========================================\n\n') };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      const type = msg?.type;
      const publicTypes = new Set(['LD2_VERSION','LD2_LICENSE_STATUS','LD2_LICENSE_LOGIN','LD2_LICENSE_LOGOUT','LD2_PROJECT_SEEN']);
      if (!publicTypes.has(type)) {
        const authSettings = await getSettings();
        if (!authSettings.auth?.licenseKey) throw new Error('Faça login com uma KEY válida para usar o Lovable Decrypter.');
        await verifyLicenseKey(authSettings.auth.licenseKey);
        if (!authSettings.auth?.deviceId) throw new Error('Dispositivo não vinculado à licença. Faça login novamente.');
        await validateLicenseRemote({
          licenseKey: authSettings.auth.licenseKey,
          deviceId: authSettings.auth.deviceId,
          backendBase: authSettings.auth?.backendBase || DEFAULT_BACKEND_BASE
        });
      }
      switch (type) {
        case 'LD2_LICENSE_STATUS': {
          const settings = await getSettings();
          if (!settings.auth?.licenseKey) return response(true, { valid: false, status: 'signed-out' });
          try {
            const lic = await verifyLicenseKey(settings.auth.licenseKey);
            const remote = await validateLicenseRemote({
              licenseKey: lic.licenseKey,
              deviceId: settings.auth?.deviceId || '',
              backendBase: settings.auth?.backendBase || DEFAULT_BACKEND_BASE
            });
            return response(true, { valid: true, status: 'active', licenseId: lic.licenseId, subject: lic.subject, expiresAt: remote?.license?.entitlement?.expires_at || null, entitlement: remote?.license?.entitlement || null, accessMode: remote?.license?.access_mode || null, vaultConfigured: !!settings.auth?.vaultApiBase, deviceBound: !!remote?.device_bound });
          } catch (e) {
            return response(true, { valid: false, status: 'invalid', error: e?.message || String(e) });
          }
        }
        case 'LD2_LICENSE_LOGIN': {
          const lic = await verifyLicenseKey(msg.licenseKey || '');
          let settings = await getSettings();
          const backendBase = settings.auth?.backendBase || DEFAULT_BACKEND_BASE;
          await validateLicenseRemote({ licenseKey: lic.licenseKey, backendBase });

          const vaultApiBase = lic.payload?.vault_api_base || settings.auth?.vaultApiBase || DEFAULT_VAULT_API_BASE;
          let restored = null;
          if (vaultApiBase) {
            restored = await restoreSettingsRemote({ licenseKey: lic.licenseKey, vaultApiBase });
          }

          const remoteSettings = restored?.restored && restored.settings ? restored.settings : {};
          const restoredAuth = remoteSettings.auth || {};
          const deviceId = restoredAuth.deviceId || settings.auth?.deviceId || crypto.randomUUID();
          const boundRemote = await validateLicenseRemote({
            licenseKey: lic.licenseKey,
            deviceId,
            deviceLabel: await deviceLabel(),
            backendBase
          });

          settings = {
            ...settings,
            ...remoteSettings,
            auth: {
              ...settings.auth,
              ...restoredAuth,
              licenseKey: lic.licenseKey,
              licenseStatus: 'active',
              licenseId: lic.licenseId,
              licenseSubject: lic.subject,
              licenseExpiresAt: boundRemote?.license?.entitlement?.expires_at || null,
              backendBase,
              deviceId,
              vaultApiBase,
              updateFeedUrl: lic.payload?.update_feed_url || restoredAuth.updateFeedUrl || settings.auth?.updateFeedUrl || ''
            }
          };
          settings = await saveSettings(settings);
          if (vaultApiBase) {
            try {
              const sync = await backupSettingsRemote({ settings, licenseKey: lic.licenseKey, vaultApiBase });
              if (sync?.synced) settings = await updateSettings({ auth: { ...settings.auth, lastVaultSyncAt: sync.at } });
            } catch (_) {}
          }
          return response(true, { valid: true, licenseId: lic.licenseId, subject: lic.subject, expiresAt: boundRemote?.license?.entitlement?.expires_at || null, entitlement: boundRemote?.license?.entitlement || null, accessMode: boundRemote?.license?.access_mode || null, restored: !!restored?.restored, deviceId });
        }
        case 'LD2_LICENSE_LOGOUT': {
          const settings = await getSettings();
          settings.auth = { ...settings.auth, licenseKey: '', licenseStatus: 'signed-out', licenseId: '', licenseSubject: '', licenseExpiresAt: null };
          await saveSettings(settings);
          return response(true, { ok: true });
        }
        case 'LD2_VAULT_BACKUP': {
          const settings = await getSettings();
          if (!settings.auth?.licenseKey) throw new Error('Faça login com sua KEY antes do backup.');
          const result = await backupSettingsRemote({ settings, licenseKey: settings.auth.licenseKey, vaultApiBase: settings.auth.vaultApiBase });
          if (result.synced) await updateSettings({ auth: { ...settings.auth, lastVaultSyncAt: result.at } });
          return response(true, result);
        }
        case 'LD2_VAULT_RESTORE': {
          const settings = await getSettings();
          if (!settings.auth?.licenseKey) throw new Error('Faça login com sua KEY antes de restaurar.');
          const result = await restoreSettingsRemote({ licenseKey: settings.auth.licenseKey, vaultApiBase: settings.auth.vaultApiBase });
          if (result.restored && result.settings) {
            result.settings.auth = { ...settings.auth, ...(result.settings.auth || {}), licenseKey: settings.auth.licenseKey, licenseStatus: 'active', licenseId: settings.auth.licenseId, licenseSubject: settings.auth.licenseSubject, licenseExpiresAt: settings.auth.licenseExpiresAt, vaultApiBase: settings.auth.vaultApiBase };
            await saveSettings(result.settings);
          }
          return response(true, result);
        }
        case 'LD2_UPDATE_CHECK': {
          const settings = await getSettings();
          const status = await checkUpdates({ currentVersion: VERSION, updateFeedUrl: settings.auth?.updateFeedUrl || '' });
          await chrome.storage.local.set({ ld2_update_status: status });
          return response(true, status);
        }
        case 'LD2_UPDATE_DOWNLOAD': return response(true, await downloadUpdate(msg.release));
        case 'LD2_UPDATE_APPLY': {
          const settings = await getSettings();
          const tabId = sender?.tab?.id ?? null;
          await chrome.storage.local.set({ [UPDATE_REQUEST_KEY]: { autoApply: true, tabId, requestedAt: new Date().toISOString() } });
          const status = await checkUpdates({ currentVersion: VERSION, updateFeedUrl: settings.auth?.updateFeedUrl || '' });
          await chrome.storage.local.set({ ld2_update_status: status });
          if (status.browser?.status === 'update_available') {
            return response(true, { mode: 'browser-update', version: status.browser?.version || status.release?.version || null });
          }
          if (status.release && status.available) {
            const dl = await downloadUpdate(status.release);
            await chrome.storage.local.remove(UPDATE_REQUEST_KEY);
            return response(true, { mode: 'manual-download', version: status.release.version, downloadId: dl.downloadId });
          }
          await chrome.storage.local.remove(UPDATE_REQUEST_KEY);
          return response(true, { mode: 'up-to-date', version: VERSION, feedError: status.feedError || null });
        }
        case 'LD2_CACHE_CLEAR': return response(true, await clearExtensionCaches());
        case 'LD2_VERSION': return response(true, { version: VERSION });
        case 'LD2_SETTINGS_GET': return response(true, await getSettings());
        case 'LD2_SETTINGS_SAVE': { const saved = await saveSettings(msg.settings || {}); if (saved.auth?.licenseKey && saved.auth?.vaultApiBase) backupSettingsRemote({ settings: saved, licenseKey: saved.auth.licenseKey, vaultApiBase: saved.auth.vaultApiBase }).catch(()=>{}); return response(true, saved); }
        case 'LD2_SETTINGS_PATCH': { const saved = await updateSettings(msg.patch || {}); if (saved.auth?.licenseKey && saved.auth?.vaultApiBase) backupSettingsRemote({ settings: saved, licenseKey: saved.auth.licenseKey, vaultApiBase: saved.auth.vaultApiBase }).catch(()=>{}); return response(true, saved); }
        case 'LD2_PROJECT_SEEN': {
          await chrome.storage.local.set({ ld2_last_project: { projectId: msg.projectId || '', url: msg.url || '', at: nowIso() } });
          return response(true, { ok: true });
        }
        case 'LD2_GITHUB_TEST': {
          const projectId = msg.projectId || '';
          const { github } = await getActiveConfig(projectId);
          const cfg = { ...github, ...(msg.config || {}) };
          const repo = parseRepoInput(msg.config?.repoInput || '');
          if (repo) Object.assign(cfg, repo);
          const info = await new GitAdapter(cfg).test();
          return response(true, { name: info.full_name, defaultBranch: info.default_branch, private: info.private, url: info.html_url });
        }
        case 'LD2_GEMINI_TEST': {
          const settings = await getSettings();
          const cfg = { ...settings.gemini, ...(msg.config || {}) };
          return response(true, { text: await new GeminiAgent(cfg).test() });
        }
        case 'LD2_GEMINI_MODELS': {
          const settings = await getSettings();
          const cfg = { ...settings.gemini, ...(msg.config || {}) };
          const agent = new GeminiAgent(cfg);
          const models = await agent.listModels();
          return response(true, {
            models,
            zeroCost: cfg.zeroCost !== false,
            compatibleCount: models.filter(m => m.compatible).length,
            freeCount: models.filter(m => m.compatible && m.freeTierVerified).length
          });
        }
        case 'LD2_REPO_SCAN': {
          const { github } = await getActiveConfig(msg.projectId || '');
          const adapter = new GitAdapter(github);
          const [repo, tree] = await Promise.all([adapter.getRepo(), adapter.getTree(github.branch, true)]);
          return response(true, { repo: repo.full_name, branch: github.branch, files: (tree.tree || []).filter(x => x.type === 'blob').length, truncated: !!tree.truncated });
        }
        case 'LD2_REPO_CACHE_WARM': {
          const { github } = await getActiveConfig(msg.projectId || '');
          const cache = await syncRepositoryCache(new GitAdapter(github), { branch: github.branch });
          return response(true, { repo: `${github.owner}/${github.repo}`, branch: github.branch, headSha: cache.headSha, cachedTextFiles: cache.cachedTextFiles, totalFiles: cache.totalFiles, cacheHit: cache.cacheHit });
        }
        case 'LD2_PLAN_ONLY': return response(true, await preparePlanning(msg, payload => sendProgress(sender, msg.requestId, payload)));
        case 'LD2_BUILD_EXECUTE': return response(true, await buildAndApply(msg, payload => sendProgress(sender, msg.requestId, payload)));
        case 'LD2_PLAN_APPROVE': return response(true, await approvePlanning(msg, payload => sendProgress(sender, msg.requestId, payload)));
        case 'LD2_PLAN_PREPARE': return response(true, await preparePlan(msg, payload => sendProgress(sender, msg.requestId, payload)));
        case 'LD2_PLAN_GET': return response(true, await getPending(msg.id));
        case 'LD2_PLAN_APPLY': return response(true, await applyPlan(msg));
        case 'LD2_AGENT_TRAIN': return response(true, await trainAgent(msg));
        case 'LD2_AGENT_GET': return response(true, await getAgentProfile(msg));
        case 'LD2_HISTORY_GET': {
          const data = await chrome.storage.local.get(HISTORY_KEY);
          return response(true, data[HISTORY_KEY] || []);
        }
        case 'LD2_GITHUB_ZIP_BYTES': {
          const { github } = await getActiveConfig(msg.projectId || '');
          return response(true, { bytes: await new GitAdapter(github).fetchZipBytes(github.branch), repo: github.repo, branch: github.branch });
        }
        case 'LD2_SUPABASE_TEST': {
          return response(true, await testSupabase({
            projectId: msg.projectId || '',
            projectRef: msg.projectRef || msg.config?.projectRef || ''
          }));
        }
        case 'LD2_MIGRATION_SQL': return response(true, await migrationSql(msg));
        case 'LD2_SUPABASE_SQL': {
          return response(true, await runSupabaseSql({
            projectId: msg.projectId || '',
            projectRef: msg.projectRef || '',
            sql: msg.sql || ''
          }));
        }
        default: throw new Error(`Mensagem desconhecida: ${type}`);
      }
    } catch (error) {
      return response(false, null, error?.message || String(error));
    }
  })().then(sendResponse);
  return true;
});
