import { getSettings } from '../storage/settings-store.js';
import { localRuntimeHealth } from './local-model-runtime.js';
import {
  AGENT_RUNTIME_REGISTRY_SCHEMA,
  getAgentRuntimeDefinition,
  listAgentRuntimeDefinitions,
  runtimePublicDefinition,
  evaluateRuntimeCompatibility,
  normalizeRuntimeEvent,
  planPromptTransport,
  createRuntimeWatchdog,
  assertExternalRuntimeNotWriteAuthority
} from '../core/agent-runtime-registry.js';

const PORT_NAME = 'ld2-agent-runtime-registry';
const SESSION_AUTH_KEY = 'ld71_agent_runtime_auth_v1';
const SESSION_ENDPOINT_KEY = 'ld71_agent_runtime_endpoints_v1';
const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function endpointOriginPattern(endpoint) {
  const url = new URL(endpoint);
  const host = url.hostname.toLowerCase();
  const loopback = ['127.0.0.1','localhost','::1'].includes(host);
  if (!((url.protocol === 'http:' && loopback) || url.protocol === 'https:')) {
    throw Object.assign(new Error('AGENT_RUNTIME_ENDPOINT_NOT_ALLOWED'), { code:'AGENT_RUNTIME_ENDPOINT_NOT_ALLOWED' });
  }
  if (url.username || url.password || url.search || url.hash) {
    throw Object.assign(new Error('AGENT_RUNTIME_ENDPOINT_INVALID'), { code:'AGENT_RUNTIME_ENDPOINT_INVALID' });
  }
  if (url.protocol === 'https:') return `${url.protocol}//${url.host}/*`;
  if (host === 'localhost') return 'http://localhost/*';
  if (host === '::1') return 'http://[::1]/*';
  return 'http://127.0.0.1/*';
}

async function readSessionMap(key) {
  const stored = await chrome.storage.session.get(key);
  const value = stored?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function sessionAuth(runtimeId) {
  const map = await readSessionMap(SESSION_AUTH_KEY);
  const raw = map[runtimeId];
  if (!raw || typeof raw !== 'object') return null;
  const mode = ['bearer','basic'].includes(String(raw.mode || '')) ? String(raw.mode) : '';
  if (!mode) return null;
  return {
    mode,
    token:mode === 'bearer' ? text(raw.token, 20000) : '',
    username:mode === 'basic' ? text(raw.username || 'opencode', 240) : '',
    password:mode === 'basic' ? text(raw.password, 20000) : ''
  };
}

async function setSessionAuth(runtimeId, input = {}) {
  getAgentRuntimeDefinition(runtimeId);
  const mode = String(input.mode || '').toLowerCase();
  if (!['bearer','basic'].includes(mode)) throw Object.assign(new Error('AGENT_RUNTIME_AUTH_MODE_INVALID'), { code:'AGENT_RUNTIME_AUTH_MODE_INVALID' });
  const next = await readSessionMap(SESSION_AUTH_KEY);
  next[runtimeId] = mode === 'bearer'
    ? { mode, token:text(input.token,20000) }
    : { mode, username:text(input.username || 'opencode',240), password:text(input.password,20000) };
  if ((mode === 'bearer' && !next[runtimeId].token) || (mode === 'basic' && !next[runtimeId].password)) {
    throw Object.assign(new Error('AGENT_RUNTIME_AUTH_REQUIRED'), { code:'AGENT_RUNTIME_AUTH_REQUIRED' });
  }
  await chrome.storage.session.set({ [SESSION_AUTH_KEY]:next });
  return { runtimeId, configured:true, persistent:false, storage:'chrome.storage.session' };
}

async function clearSessionAuth(runtimeId) {
  const next = await readSessionMap(SESSION_AUTH_KEY);
  delete next[runtimeId];
  await chrome.storage.session.set({ [SESSION_AUTH_KEY]:next });
  return { runtimeId, configured:false, persistent:false };
}

async function endpointFor(runtimeId, explicit = '') {
  const def = getAgentRuntimeDefinition(runtimeId);
  const supplied = text(explicit, 1200);
  if (supplied) return supplied.replace(/\/+$/,'');
  const endpoints = await readSessionMap(SESSION_ENDPOINT_KEY);
  const saved = text(endpoints[runtimeId], 1200);
  if (saved) return saved.replace(/\/+$/,'');
  if (runtimeId === 'decrypter-local') {
    const settings = await getSettings();
    return text(settings?.localAI?.endpoint || def.defaultEndpoint,1200).replace(/\/+$/,'');
  }
  return text(def.defaultEndpoint,1200).replace(/\/+$/,'');
}

async function setSessionEndpoint(runtimeId, endpoint = '') {
  const def = getAgentRuntimeDefinition(runtimeId);
  const value = text(endpoint,1200).replace(/\/+$/,'');
  if (!value) throw Object.assign(new Error('AGENT_RUNTIME_ENDPOINT_REQUIRED'), { code:'AGENT_RUNTIME_ENDPOINT_REQUIRED' });
  if (!def.transports.some(item => item.id === 'http' || item.id === 'websocket')) {
    throw Object.assign(new Error('AGENT_RUNTIME_ENDPOINT_UNSUPPORTED'), { code:'AGENT_RUNTIME_ENDPOINT_UNSUPPORTED' });
  }
  endpointOriginPattern(value);
  const next = await readSessionMap(SESSION_ENDPOINT_KEY);
  next[runtimeId] = value;
  await chrome.storage.session.set({ [SESSION_ENDPOINT_KEY]:next });
  return { runtimeId, endpoint:value, persistent:false, storage:'chrome.storage.session' };
}

function authHeaders(auth) {
  if (!auth) return {};
  if (auth.mode === 'bearer' && auth.token) return { authorization:`Bearer ${auth.token}` };
  if (auth.mode === 'basic' && auth.password) {
    const encoded = btoa(`${auth.username || 'opencode'}:${auth.password}`);
    return { authorization:`Basic ${encoded}` };
  }
  return {};
}

async function permissionStatus(endpoint) {
  const origin = endpointOriginPattern(endpoint);
  const granted = await chrome.permissions.contains({ origins:[origin] });
  return { origin, granted };
}

async function requestPermission(endpoint) {
  const origin = endpointOriginPattern(endpoint);
  const granted = await chrome.permissions.request({ origins:[origin] });
  return { origin, granted };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(30000, Number(timeoutMs || 10000))));
  try {
    return await fetch(url, { ...options, signal:controller.signal, cache:'no-store', credentials:'omit', redirect:'error' });
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('AGENT_RUNTIME_PROBE_TIMEOUT'), { code:'AGENT_RUNTIME_PROBE_TIMEOUT' });
    throw error;
  } finally { clearTimeout(timer); }
}

async function probeHttp(runtimeId, endpoint) {
  const def = getAgentRuntimeDefinition(runtimeId);
  const permission = await permissionStatus(endpoint);
  if (!permission.granted) return { ok:false, available:false, code:'AGENT_RUNTIME_HOST_PERMISSION_REQUIRED', permission, endpoint, runtime:runtimePublicDefinition(def) };
  const auth = await sessionAuth(runtimeId);
  const headers = { accept:'application/json', ...authHeaders(auth) };
  const started = Date.now();
  let response;
  let body = null;
  if (def.probeKind === 'openhands-server-info') {
    response = await fetchWithTimeout(`${endpoint}/server_info`, { headers }, 10000);
    body = await response.json().catch(() => ({}));
  } else if (def.probeKind === 'opencode-openapi') {
    response = await fetchWithTimeout(`${endpoint}/doc`, { headers }, 10000);
    const type = String(response.headers.get('content-type') || '');
    body = type.includes('json') ? await response.json().catch(() => ({})) : { contentType:type };
  } else {
    throw Object.assign(new Error('AGENT_RUNTIME_PROBE_KIND_INVALID'), { code:'AGENT_RUNTIME_PROBE_KIND_INVALID' });
  }
  const version = text(body?.version || body?.info?.version || '', 160) || null;
  const compatibility = evaluateRuntimeCompatibility(runtimeId, version || '');
  return {
    ok:response.ok && compatibility.compatible,
    available:response.ok && compatibility.compatible,
    code:response.ok ? (compatibility.compatible ? null : 'AGENT_RUNTIME_VERSION_INCOMPATIBLE') : `AGENT_RUNTIME_HTTP_${response.status}`,
    runtime:runtimePublicDefinition(def),
    endpoint,
    permission,
    authConfigured:Boolean(auth),
    status:response.status,
    version,
    compatibility,
    latencyMs:Date.now()-started,
    models:[],
    writeAuthority:false
  };
}

export async function probeAgentRuntime(runtimeId, options = {}) {
  const def = getAgentRuntimeDefinition(runtimeId);
  assertExternalRuntimeNotWriteAuthority(def.id);
  if (def.id === 'decrypter-local') {
    const health = await localRuntimeHealth({ includeMetrics:false });
    return {
      ok:health.ok === true,
      available:health.ok === true,
      code:health.ok ? null : (health.code || 'AGENT_RUNTIME_UNAVAILABLE'),
      runtime:runtimePublicDefinition(def),
      endpoint:health?.config?.endpoint || await endpointFor(def.id, options.endpoint),
      version:text(health?.health?.version || health?.health?.gateway_version || '',160) || null,
      compatibility:evaluateRuntimeCompatibility(def.id, text(health?.health?.version || '',160)),
      models:Array.isArray(health.models) ? health.models.slice(0,200) : [],
      tokenConfigured:health.tokenConfigured === true,
      localOnly:true,
      paidFallbackAllowed:false,
      remoteFallbackAllowed:false,
      writeAuthority:false
    };
  }
  if (def.probeKind === 'bridge-cli') {
    return {
      ok:false,
      available:false,
      code:'AGENT_RUNTIME_BRIDGE_REQUIRED',
      runtime:runtimePublicDefinition(def),
      bridgeRequired:true,
      writeAuthority:false
    };
  }
  const endpoint = await endpointFor(def.id, options.endpoint);
  if (!endpoint) return { ok:false, available:false, code:'AGENT_RUNTIME_ENDPOINT_REQUIRED', runtime:runtimePublicDefinition(def), writeAuthority:false };
  try { return await probeHttp(def.id, endpoint); }
  catch (error) { return { ok:false, available:false, code:error?.code || 'AGENT_RUNTIME_UNREACHABLE', error:text(error?.message || error,600), runtime:runtimePublicDefinition(def), endpoint, writeAuthority:false }; }
}

async function status() {
  const auth = await readSessionMap(SESSION_AUTH_KEY);
  const endpoints = await readSessionMap(SESSION_ENDPOINT_KEY);
  return {
    schema:AGENT_RUNTIME_REGISTRY_SCHEMA,
    build:71,
    registryAuthority:'decrypter',
    runtimeCount:listAgentRuntimeDefinitions().length,
    runtimes:listAgentRuntimeDefinitions().map(item => ({
      ...item,
      sessionAuthConfigured:Boolean(auth[item.id]),
      sessionEndpoint:text(endpoints[item.id],1200) || item.defaultEndpoint || null
    })),
    externalWriteAuthority:false,
    credentialsDurable:false,
    promptCredentialsAllowed:false,
    cliSpawnInExtension:false,
    bridgeRequiredForProcessTransports:true
  };
}

async function handle(action, payload = {}) {
  const op = text(action,80).toLowerCase();
  const runtimeId = text(payload.runtimeId || payload.runtime_id,120).toLowerCase();
  if (op === 'status' || op === 'list') return status();
  if (op === 'get') return runtimePublicDefinition(getAgentRuntimeDefinition(runtimeId));
  if (op === 'probe') return probeAgentRuntime(runtimeId, payload || {});
  if (op === 'probe_all') {
    const results = [];
    for (const def of listAgentRuntimeDefinitions()) results.push(await probeAgentRuntime(def.id, {}));
    return { schema:AGENT_RUNTIME_REGISTRY_SCHEMA, results };
  }
  if (op === 'permission_status') return permissionStatus(await endpointFor(runtimeId, payload.endpoint));
  if (op === 'request_permission') return requestPermission(await endpointFor(runtimeId, payload.endpoint));
  if (op === 'set_session_endpoint') return setSessionEndpoint(runtimeId, payload.endpoint);
  if (op === 'set_session_auth') return setSessionAuth(runtimeId, payload.auth || payload);
  if (op === 'clear_session_auth') return clearSessionAuth(runtimeId);
  if (op === 'normalize_event') return normalizeRuntimeEvent(runtimeId, payload.event || {});
  if (op === 'prompt_transport') return planPromptTransport({ runtimeId, ...(payload.options || payload) });
  if (op === 'watchdog_policy') return { ...createRuntimeWatchdog(payload || {}).policy, runtimeId:runtimeId || null };
  throw Object.assign(new Error('AGENT_RUNTIME_REGISTRY_ACTION_INVALID'), { code:'AGENT_RUNTIME_REGISTRY_ACTION_INVALID' });
}

export function installAgentRuntimeRegistryRuntime() {
  if (globalThis.__LD71_AGENT_RUNTIME_REGISTRY__) return;
  globalThis.__LD71_AGENT_RUNTIME_REGISTRY__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id,160);
      try { port.postMessage({ id, ok:true, data:await handle(message?.action || 'status', message?.payload || {}) }); }
      catch (error) { try { port.postMessage({ id, ok:false, error:error?.message || String(error), code:error?.code || 'AGENT_RUNTIME_REGISTRY_FAILED' }); } catch (_) {} }
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterAgentRuntimeRegistry = Object.freeze({
    build:71,
    schema:AGENT_RUNTIME_REGISTRY_SCHEMA,
    port:PORT_NAME,
    adapters:['decrypter-local','openhands-agent-server','codex-cli','opencode','aider'],
    externalWriteAuthority:false,
    cliSpawnInExtension:false,
    credentialsStorage:'session-only',
    rawCredentialPersistence:false,
    promptCredentialsAllowed:false
  });
}
