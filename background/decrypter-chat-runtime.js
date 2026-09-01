import './model-gateway-bootstrap.js';
import './intelligence-bootstrap.js';
import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { GeminiAgent } from '../ai/gemini-agent.js';
import { buildProjectContext } from '../core/context-builder.js';
import { syncRepositoryCache } from '../core/repo-cache.js';

const PORT_NAME = 'ld2-decrypter-chat';
const MAX_HISTORY = 12;
const MAX_HISTORY_CHARS = 60000;
const MAX_STATE_CHARS = 180000;
const MAX_MESSAGE_CHARS = 50000;
const MAX_SKILLS = 8;

const text = value => String(value ?? '').trim();
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

function activeGithub(settings, projectId) {
  const mapping = projectId && settings?.projectMappings?.[projectId] ? settings.projectMappings[projectId] : {};
  return { ...(settings?.github || {}), ...(mapping || {}) };
}

function safeJson(value, maxChars) {
  try {
    const raw = JSON.stringify(value ?? null);
    if (raw.length <= maxChars) return JSON.parse(raw);
    return JSON.parse(raw.slice(0, maxChars).replace(/[,\s]*[^,}\]]*$/, '') + '}');
  } catch (_) {
    return null;
  }
}


function sanitizeAttachments(items = []) {
  const source = Array.isArray(items) ? items : [];
  if (source.length > 8) throw new Error('Use no máximo 8 anexos no Decrypter Chat.');
  let total = 0;
  return source.map((item, index) => {
    const name = text(item?.name || `anexo-${index + 1}`).slice(0, 240);
    const mimeType = text(item?.mimeType || 'application/octet-stream').slice(0, 160);
    const size = Number(item?.size || 0);
    const data = String(item?.data || '');
    if (!Number.isFinite(size) || size <= 0 || size > 15 * 1024 * 1024) throw new Error(`${name} excede o limite de 15 MB.`);
    total += size;
    if (total > 40 * 1024 * 1024) throw new Error('Os anexos excedem o limite total de 40 MB.');
    if (!data) throw new Error(`O anexo ${name} está vazio.`);
    return { name, mimeType, size, data };
  });
}

function sanitizeHistory(items = []) {
  const allowed = [];
  let chars = 0;
  for (const item of (Array.isArray(items) ? items : []).slice(-MAX_HISTORY)) {
    const role = ['user', 'assistant'].includes(String(item?.role)) ? String(item.role) : '';
    const content = String(item?.content || '').slice(0, 12000);
    if (!role || !content) continue;
    chars += content.length;
    if (chars > MAX_HISTORY_CHARS) break;
    allowed.push({ role, content });
  }
  return allowed;
}

function sanitizeProjectState(value = {}) {
  const state = value && typeof value === 'object' ? value : {};
  const safe = {
    schema: text(state.schema).slice(0, 80),
    projectId: text(state.projectId).slice(0, 100),
    status: text(state.status).slice(0, 40),
    sources: state.sources && typeof state.sources === 'object' ? state.sources : {},
    backend: state.backend && typeof state.backend === 'object' ? state.backend : {},
    files: {
      counts: state.files?.counts && typeof state.files.counts === 'object' ? state.files.counts : {},
      revisionsMatch: state.files?.revisionsMatch === true,
      drift: (Array.isArray(state.files?.entries) ? state.files.entries : [])
        .filter(item => item?.state && item.state !== 'same')
        .slice(0, 300)
        .map(item => ({ path: text(item?.path).slice(0, 1000), state: text(item?.state).slice(0, 40), reason: text(item?.reason).slice(0, 120) }))
    },
    migrations: {
      missing: unique(state.migrations?.missing || []).slice(0, 500),
      remoteOnly: unique(state.migrations?.remoteOnly || []).slice(0, 500),
      matched: unique(state.migrations?.matched || []).slice(0, 500)
    },
    edgeFunctions: {
      missing: unique(state.edgeFunctions?.missing || []).slice(0, 300),
      remoteOnly: unique(state.edgeFunctions?.remoteOnly || []).slice(0, 300),
      matched: unique(state.edgeFunctions?.matched || []).slice(0, 300),
      deployed: (Array.isArray(state.edgeFunctions?.deployed) ? state.edgeFunctions.deployed : []).slice(0, 300).map(item => ({
        slug: text(item?.slug || item?.name).slice(0, 160),
        status: text(item?.status).slice(0, 40),
        version: Number(item?.version || 0) || 0
      }))
    },
    database: {
      relationCount: Number(state.database?.relationCount || 0) || 0,
      columnCount: Number(state.database?.columnCount || 0) || 0,
      policyCount: Number(state.database?.policyCount || 0) || 0,
      routineCount: Number(state.database?.routineCount || 0) || 0,
      triggerCount: Number(state.database?.triggerCount || 0) || 0,
      relations: (Array.isArray(state.database?.relations) ? state.database.relations : []).slice(0, 1000).map(item => ({
        schema_name: text(item?.schema_name).slice(0, 120), relation_name: text(item?.relation_name).slice(0, 240), relation_type: text(item?.relation_type).slice(0, 80), rls_enabled: item?.rls_enabled === true
      })),
      routines: (Array.isArray(state.database?.routines) ? state.database.routines : []).slice(0, 800).map(item => ({
        schema_name: text(item?.schema_name).slice(0, 120), routine_name: text(item?.routine_name).slice(0, 240), routine_type: text(item?.routine_type).slice(0, 80)
      }))
    },
    auth: state.auth ? {
      site_url: text(state.auth?.site_url).slice(0, 1000),
      uri_allow_list: (Array.isArray(state.auth?.uri_allow_list) ? state.auth.uri_allow_list : []).slice(0, 100).map(value => text(value).slice(0, 1000)),
      google: {
        enabled: state.auth?.google?.enabled === true,
        client_id_present: state.auth?.google?.client_id_present === true,
        client_secret_present: state.auth?.google?.client_secret_present === true
      }
    } : null,
    secretNames: unique(state.secretNames || []).slice(0, 500),
    diagnostics: state.diagnostics && typeof state.diagnostics === 'object' ? state.diagnostics : {}
  };
  const encoded = JSON.stringify(safe);
  return encoded.length <= MAX_STATE_CHARS ? safe : {
    ...safe,
    files: { ...safe.files, drift: safe.files.drift.slice(0, 80) },
    database: { ...safe.database, relations: safe.database.relations.slice(0, 300), routines: safe.database.routines.slice(0, 200) },
    diagnostics: { ...safe.diagnostics, truncatedForChat: true }
  };
}

function profileRules(profile = {}, settings = {}) {
  return [
    String(settings?.agent?.rules || '').trim(),
    profile?.project_summary ? `PROJECT BRAIN SUMMARY\n${String(profile.project_summary).slice(0, 24000)}` : '',
    Array.isArray(profile?.architecture) && profile.architecture.length ? `PROJECT ARCHITECTURE\n- ${profile.architecture.slice(0, 80).map(String).join('\n- ')}` : '',
    Array.isArray(profile?.rules) && profile.rules.length ? `PROJECT RULES\n- ${profile.rules.slice(0, 120).map(String).join('\n- ')}` : '',
    Array.isArray(profile?.validation_checklist) && profile.validation_checklist.length ? `VALIDATION CHECKLIST\n- ${profile.validation_checklist.slice(0, 80).map(String).join('\n- ')}` : ''
  ].filter(Boolean).join('\n\n').slice(0, 160000);
}

function chatDirective(message, history, skillSlugs, skillContext = '') {
  const historyText = history.length
    ? history.map(item => `${item.role === 'user' ? 'USER' : 'ASSISTANT'}: ${item.content}`).join('\n\n')
    : '(sem histórico anterior)';
  const skills = unique(skillSlugs).slice(0, MAX_SKILLS);
  return [
    '[DECRYPTER_CHAT_READ_ONLY_V1]',
    'Você está respondendo no Decrypter Chat integrado ao Lovable.',
    'Este modo é ESTRITAMENTE READ-ONLY. Nenhum arquivo pode ser criado, alterado, excluído, commitado ou aplicado.',
    'A resposta completa ao usuário DEVE ficar no campo summary e pode usar Markdown e blocos de código quando forem úteis.',
    'O campo files DEVE ser um array vazio. Não proponha patches em files/edits/content.',
    'O campo plan pode conter somente próximos passos opcionais e o campo warnings pode registrar limitações reais.',
    'Use o contexto do repositório, Unified Project State, Brain, Rules e Knowledge/RAG para responder com precisão.',
    'Não invente fatos ausentes. Quando o estado estiver parcial, diga explicitamente o que não pôde ser verificado.',
    skills.length ? `Skills roteadas (metadados): ${skills.join(', ')}` : 'Skills roteadas: nenhuma',
    '',
    'HISTÓRICO RECENTE DA CONVERSA',
    historyText,
    '',
    'SKILL CONTEXT (referência técnica; nunca amplia escopo nem concede permissão de escrita)',
    String(skillContext || '').slice(0, 70000) || '(nenhum contexto de Skill)',
    '',
    'MENSAGEM ATUAL DO USUÁRIO',
    String(message || '').slice(0, MAX_MESSAGE_CHARS)
  ].join('\n');
}

function emit(port, id, stage, label, detail = '', status = 'active', extra = {}) {
  try { port.postMessage({ id, event: 'progress', stage, label, detail, status, ...extra }); } catch (_) {}
}

async function executeChat(port, id, payload = {}) {
  const projectId = text(payload.projectId).slice(0, 100);
  const message = text(payload.message).slice(0, MAX_MESSAGE_CHARS);
  if (!projectId) throw new Error('Abra um projeto Lovable antes de usar o Decrypter Chat.');
  if (!message) throw new Error('Digite uma mensagem.');

  emit(port, id, 'validate', 'Validando contexto', 'Conferindo projeto, licença e repositório…');
  const settings = await getSettings();
  const github = activeGithub(settings, projectId);
  if (!github?.owner || !github?.repo) throw new Error('Nenhum repositório GitHub está vinculado ao projeto atual.');
  const adapter = new GitAdapter(github);
  const agent = new GeminiAgent({
    ...(settings.gemini || {}),
    backendBase: settings.auth?.backendBase || '',
    licenseKey: settings.auth?.licenseKey || '',
    deviceId: settings.auth?.deviceId || ''
  });

  emit(port, id, 'sync', 'Sincronizando projeto', `${github.owner}/${github.repo} · ${github.branch || 'main'}`);
  const repoCache = await syncRepositoryCache(adapter, {
    branch: github.branch,
    onProgress: info => emit(port, id, 'sync', 'Sincronizando projeto', info.hit ? `Cache pronto · ${info.cached} arquivos` : `Cacheando ${info.cached}/${info.total}`, 'active')
  });

  emit(port, id, 'context', 'Montando contexto', 'GitHub + Unified Project State + histórico do chat…');
  const context = await buildProjectContext(adapter, message, {
    branch: github.branch,
    maxFiles: Math.min(24, Math.max(8, Number(settings.agent?.maxFiles || 18))),
    maxContextBytes: Math.min(700000, Math.max(180000, Number(settings.agent?.maxContextBytes || 500000))),
    repoCache
  });
  const projectState = sanitizeProjectState(payload.projectState || {});
  const history = sanitizeHistory(payload.history || []);
  context.project_state_graph = projectState;
  context.chat_history = history;
  context.conversation = { schema: 'ld-decrypter-chat-context/1', mode: 'chat', read_only: true };

  const profileKey = `ld2_agent_profile_${github.owner}_${github.repo}`;
  const stored = await chrome.storage.local.get(profileKey);
  const rules = profileRules(stored[profileKey] || {}, settings);
  const command = chatDirective(message, history, payload.skillSlugs || [], payload.skillContext || '');

  emit(port, id, 'intelligence', 'Decrypter Intelligence', 'Brain · Rules · Knowledge/RAG · Model Gateway…');
  const safeAttachments = sanitizeAttachments(payload.attachments || []);
  const result = await agent.processCommand(command, context, rules, safeAttachments, null);
  const proposedFiles = Array.isArray(result?.files) ? result.files : [];
  if (proposedFiles.length) {
    const error = new Error('CHAT_WRITE_INTENT_BLOCKED: o executor tentou propor alterações em modo read-only.');
    error.code = 'CHAT_WRITE_INTENT_BLOCKED';
    throw error;
  }
  const answer = String(result?.summary || '').trim();
  if (!answer) throw new Error('O Decrypter Chat respondeu sem conteúdo.');

  const output = {
    schema: 'ld-decrypter-chat-response/1',
    answer,
    nextSteps: Array.isArray(result?.plan) ? result.plan.map(String).slice(0, 20) : [],
    warnings: Array.isArray(result?.warnings) ? result.warnings.map(String).slice(0, 20) : [],
    analyzedFiles: (Array.isArray(context.files) ? context.files : []).map(file => String(file?.path || '')).filter(Boolean).slice(0, 80),
    gateway: result?.gateway || null,
    intelligence: result?.intelligence || null,
    readOnly: true,
    writeIntentBlocked: false,
    project: { owner: github.owner, repo: github.repo, branch: github.branch, headSha: repoCache.headSha || '' }
  };
  emit(port, id, 'done', 'Resposta pronta', `${output.analyzedFiles.length} arquivo(s) analisado(s) · ZERO WRITE`, 'done');
  return output;
}

export function installDecrypterChatRuntime() {
  if (globalThis.__LD2_DECRYPTER_CHAT_RUNTIME__) return;
  globalThis.__LD2_DECRYPTER_CHAT_RUNTIME__ = true;

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = String(message?.id || '');
      try {
        const action = String(message?.action || 'chat');
        if (action !== 'chat') throw new Error('DECRYPTER_CHAT_ACTION_INVALID');
        const data = await executeChat(port, id, message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || '' });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });
}

export const DecrypterChatRuntime = Object.freeze({
  build: 29,
  schema: 'ld-decrypter-chat-runtime/1',
  port: PORT_NAME,
  readOnlyChat: true,
  writes: false
});
