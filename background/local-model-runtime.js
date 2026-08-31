import { getSettings } from '../storage/settings-store.js';
import { routeLocalModel, localRouterPublicStatus } from '../core/local-model-router.js';

const PORT_NAME = 'ld2-local-model-runtime';
const SESSION_TOKEN_KEY = 'ld68_local_runtime_token_v1';
const MAX_MESSAGES = 96;

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function endpointOriginPattern(endpoint) {
  const url = new URL(endpoint);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw Object.assign(new Error('LOCAL_RUNTIME_LOOPBACK_REQUIRED'), { code: 'LOCAL_RUNTIME_LOOPBACK_REQUIRED' });
  }
  if (url.username || url.password || url.search || url.hash) {
    throw Object.assign(new Error('LOCAL_RUNTIME_ENDPOINT_INVALID'), { code: 'LOCAL_RUNTIME_ENDPOINT_INVALID' });
  }
  if (host === 'localhost') return 'http://localhost/*';
  if (host === '::1') return 'http://[::1]/*';
  return 'http://127.0.0.1/*';
}

async function runtimeConfig() {
  const settings = await getSettings();
  const local = settings?.localAI || {};
  return {
    endpoint: text(local.endpoint || 'http://127.0.0.1:8000', 1000).replace(/\/+$/, ''),
    tiers: {
      large: text(local.largeModel || 'qwen3-coder:30b', 240),
      medium: text(local.mediumModel || 'qwen2.5-coder:14b', 240),
      small: text(local.smallModel || 'qwen2.5-coder:7b', 240)
    },
    maxOutputTokens: Math.max(1024, Math.min(32768, Number(local.maxOutputTokens || 16384))),
    maxIterations: Math.max(1, Math.min(12, Number(local.maxIterations || 8))),
    enabled: local.enabled !== false,
    localOnly: true,
    paidFallbackAllowed: false,
    remoteFallbackAllowed: false
  };
}

async function token() {
  const stored = await chrome.storage.session.get(SESSION_TOKEN_KEY);
  return text(stored[SESSION_TOKEN_KEY], 20000);
}

async function setToken(value = '') {
  const next = text(value, 20000);
  if (!next) throw Object.assign(new Error('LOCAL_RUNTIME_TOKEN_REQUIRED'), { code: 'LOCAL_RUNTIME_TOKEN_REQUIRED' });
  await chrome.storage.session.set({ [SESSION_TOKEN_KEY]: next });
  return { configured: true, persistent: false };
}

async function clearToken() {
  await chrome.storage.session.remove(SESSION_TOKEN_KEY);
  return { configured: false, persistent: false };
}

async function permissionStatus(endpoint) {
  const origin = endpointOriginPattern(endpoint);
  const granted = await chrome.permissions.contains({ origins: [origin] });
  return { origin, granted };
}

async function requestPermission(endpoint) {
  const origin = endpointOriginPattern(endpoint);
  const granted = await chrome.permissions.request({ origins: [origin] });
  return { origin, granted };
}

async function assertPermission(endpoint) {
  const status = await permissionStatus(endpoint);
  if (!status.granted) throw Object.assign(new Error('LOCAL_RUNTIME_HOST_PERMISSION_REQUIRED'), { code: 'LOCAL_RUNTIME_HOST_PERMISSION_REQUIRED', origin: status.origin });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(240000, Number(timeoutMs || 8000))));
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' });
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('LOCAL_RUNTIME_TIMEOUT'), { code: 'LOCAL_RUNTIME_TIMEOUT' });
    throw error;
  } finally { clearTimeout(timer); }
}

function parseMetrics(raw = '') {
  const out = {};
  for (const line of String(raw || '').split(/\r?\n/)) {
    const match = line.trim().match(/^([a-zA-Z0-9_:]+)\s+([-+0-9.eE]+)$/);
    if (!match) continue;
    const value = Number(match[2]);
    if (!Number.isFinite(value)) continue;
    if (match[1] === 'decrypter_requests_inflight') out.inflight = value;
    if (match[1] === 'decrypter_requests_total') out.requests_total = value;
    if (match[1] === 'decrypter_errors_total') out.errors_total = value;
    if (match[1] === 'decrypter_last_latency_ms') out.last_latency_ms = value;
  }
  return out;
}

export async function localRuntimeHealth({ includeMetrics = true } = {}) {
  const config = await runtimeConfig();
  if (!config.enabled) return { ok: false, code: 'LOCAL_RUNTIME_DISABLED', config };
  await assertPermission(config.endpoint);
  let health = {};
  try {
    const response = await fetchWithTimeout(`${config.endpoint}/health`, {}, 7000);
    health = await response.json().catch(() => ({}));
    if (!response.ok || health?.ok === false) return { ok: false, code: health?.error || `LOCAL_HEALTH_HTTP_${response.status}`, health, config };
  } catch (error) {
    return { ok: false, code: error?.code || 'LOCAL_RUNTIME_UNREACHABLE', error: error?.message || String(error), config };
  }

  const runtimeToken = await token();
  let models = [];
  let metrics = {};
  if (runtimeToken) {
    try {
      const modelsResponse = await fetchWithTimeout(`${config.endpoint}/v1/models`, { headers: { authorization: `Bearer ${runtimeToken}` } }, 7000);
      const body = await modelsResponse.json().catch(() => ({}));
      if (modelsResponse.ok) models = (Array.isArray(body?.data) ? body.data : []).map(item => text(item?.id, 240)).filter(id => id && id !== 'decrypter-local');
    } catch (_) {}
    if (includeMetrics) {
      try {
        const metricsResponse = await fetchWithTimeout(`${config.endpoint}/metrics`, { headers: { authorization: `Bearer ${runtimeToken}` } }, 7000);
        if (metricsResponse.ok) metrics = parseMetrics(await metricsResponse.text());
      } catch (_) {}
    }
  }
  if (!models.length) models = Array.isArray(health?.models_loaded) ? health.models_loaded.map(item => text(item, 240)).filter(Boolean) : [];
  return {
    ok: true,
    provider: 'decrypter-local',
    localOnly: true,
    health,
    models,
    metrics,
    tokenConfigured: Boolean(runtimeToken),
    paidFallbackAllowed: false,
    remoteFallbackAllowed: false,
    config: { endpoint: config.endpoint, tiers: config.tiers, maxOutputTokens: config.maxOutputTokens, maxIterations: config.maxIterations }
  };
}

export async function routeLocalInference(payload = {}) {
  const status = await localRuntimeHealth({ includeMetrics: true });
  if (!status.ok) return { ...status, route: null };
  const route = routeLocalModel({
    command: payload?.command || '',
    role: payload?.role || '',
    iteration: payload?.iteration || 0,
    failures: payload?.failures || 0,
    diagnosticsFailures: payload?.diagnosticsFailures || 0,
    contextFileCount: payload?.contextFileCount || 0,
    desiredTier: payload?.desiredTier || '',
    tiers: status.config.tiers,
    loadedModels: status.models,
    health: status.health,
    metrics: status.metrics
  });
  return { ...status, route };
}

function sanitizeMessages(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  if (!list.length || list.length > MAX_MESSAGES) throw Object.assign(new Error('LOCAL_MESSAGES_INVALID'), { code: 'LOCAL_MESSAGES_INVALID' });
  return list.map(item => {
    const role = ['system','user','assistant'].includes(String(item?.role || '')) ? String(item.role) : 'user';
    const content = String(item?.content ?? '');
    if (!content) throw Object.assign(new Error('LOCAL_MESSAGE_CONTENT_REQUIRED'), { code: 'LOCAL_MESSAGE_CONTENT_REQUIRED' });
    return { role, content };
  });
}

export async function executeLocalChat(payload = {}) {
  const status = await routeLocalInference(payload);
  if (!status.ok) throw Object.assign(new Error(status.code || 'LOCAL_RUNTIME_UNAVAILABLE'), { code: status.code || 'LOCAL_RUNTIME_UNAVAILABLE', details: status });
  if (!status.route?.ok) throw Object.assign(new Error(status.route?.code || 'LOCAL_MODEL_UNAVAILABLE'), { code: status.route?.code || 'LOCAL_MODEL_UNAVAILABLE', details: status.route });
  const runtimeToken = await token();
  if (!runtimeToken) throw Object.assign(new Error('LOCAL_RUNTIME_TOKEN_REQUIRED'), { code: 'LOCAL_RUNTIME_TOKEN_REQUIRED' });
  const config = await runtimeConfig();
  const messages = sanitizeMessages(payload?.messages || []);
  const response = await fetchWithTimeout(`${config.endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${runtimeToken}` },
    body: JSON.stringify({
      model: status.route.model,
      messages,
      stream: false,
      temperature: Math.max(0, Math.min(0.4, Number(payload?.temperature ?? 0.1))),
      max_tokens: Math.max(512, Math.min(config.maxOutputTokens, Number(payload?.maxOutputTokens || config.maxOutputTokens)))
    })
  }, payload?.timeoutMs || 210000);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || `LOCAL_MODEL_HTTP_${response.status}`), { code: body?.error?.type || `LOCAL_MODEL_HTTP_${response.status}` });
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw Object.assign(new Error('LOCAL_MODEL_EMPTY_RESPONSE'), { code: 'LOCAL_MODEL_EMPTY_RESPONSE' });
  return {
    ok: true,
    provider: 'decrypter-local',
    localOnly: true,
    route: status.route,
    content,
    usage: body?.usage || null,
    runtime: body?.decrypter_runtime || { provider: 'ollama', runtime_model: status.route.model, local_only: true },
    paidFallbackUsed: false,
    remoteFallbackUsed: false
  };
}

async function handle(action, payload = {}) {
  const op = text(action, 80).toLowerCase();
  const config = await runtimeConfig();
  if (op === 'status') {
    const permission = await permissionStatus(config.endpoint).catch(() => ({ origin: '', granted: false }));
    const runtimeToken = await token();
    return {
      schema: 'ld-local-model-runtime/1',
      build: 68,
      provider: 'decrypter-local',
      localOnly: true,
      endpoint: config.endpoint,
      permission,
      tokenConfigured: Boolean(runtimeToken),
      router: localRouterPublicStatus(config.tiers),
      paidFallbackAllowed: false,
      remoteFallbackAllowed: false,
      rawPromptPersistence: false,
      rawResponsePersistence: false
    };
  }
  if (op === 'set_token') return setToken(payload?.token || '');
  if (op === 'clear_token') return clearToken();
  if (op === 'permission_status') return permissionStatus(config.endpoint);
  if (op === 'request_permission') return requestPermission(config.endpoint);
  if (op === 'health') return localRuntimeHealth({ includeMetrics: payload?.includeMetrics !== false });
  if (op === 'route') return routeLocalInference(payload || {});
  if (op === 'chat') return executeLocalChat(payload || {});
  throw Object.assign(new Error('LOCAL_MODEL_RUNTIME_ACTION_INVALID'), { code: 'LOCAL_MODEL_RUNTIME_ACTION_INVALID' });
}

export function installLocalModelRuntime() {
  if (globalThis.__LD68_LOCAL_MODEL_RUNTIME__) return;
  globalThis.__LD68_LOCAL_MODEL_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 160);
      try { port.postMessage({ id, ok: true, data: await handle(message?.action || 'status', message?.payload || {}) }); }
      catch (error) { try { port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || 'LOCAL_MODEL_RUNTIME_FAILED', details: error?.details || null }); } catch (_) {} }
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterLocalModelRuntime = Object.freeze({
    build: 68,
    schema: 'ld-local-model-runtime/1',
    port: PORT_NAME,
    directLoopbackInference: true,
    modelRouter: 'large->medium->small',
    tokenStorage: 'session-only',
    paidFallbackAllowed: false,
    remoteFallbackAllowed: false,
    rawPromptPersistence: false,
    rawResponsePersistence: false
  });
}
