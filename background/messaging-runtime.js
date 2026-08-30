import { VERSION, DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';

const TYPES = new Set(['LD2_MESSAGE_RESOLVE', 'LD2_MESSAGE_NORMALIZE', 'LD2_MESSAGE_HEALTH']);
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();

function result(ok, data = null, error = null) { return { ok, data, error }; }
function baseUrl(settings) { return String(settings?.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, ''); }

async function requestBackend(action, payload = {}, { cacheKey = '' } = {}) {
  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;
  }
  const settings = await getSettings();
  const licenseKey = String(settings?.auth?.licenseKey || '').trim();
  if (!licenseKey) throw new Error('LICENSE_REQUIRED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${baseUrl(settings)}/ld-messaging`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': licenseKey,
        ...(settings?.auth?.deviceId ? { 'x-device-id': String(settings.auth.deviceId) } : {}),
        'x-decrypter-client-version': VERSION
      },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok || !body?.data) throw new Error(body?.code || `MESSAGING_HTTP_${response.status}`);
    if (cacheKey) cache.set(cacheKey, { at: Date.now(), data: body.data });
    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

async function health() {
  const settings = await getSettings();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`${baseUrl(settings)}/ld-messaging?health=1`, { cache: 'no-store', signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) throw new Error(body?.code || `MESSAGING_HEALTH_HTTP_${response.status}`);
    return body;
  } finally { clearTimeout(timer); }
}

export function installMessagingRuntime() {
  if (globalThis.__LD55_MESSAGING_RUNTIME__) return;
  globalThis.__LD55_MESSAGING_RUNTIME__ = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!TYPES.has(String(message?.type || ''))) return;
    (async () => {
      try {
        if (message.type === 'LD2_MESSAGE_HEALTH') return sendResponse(result(true, await health()));
        if (message.type === 'LD2_MESSAGE_RESOLVE') {
          const key = String(message?.key || '').trim();
          if (!key) throw new Error('MESSAGE_KEY_REQUIRED');
          const params = message?.params && typeof message.params === 'object' ? message.params : {};
          const cacheable = Object.keys(params).length === 0;
          const data = await requestBackend('resolve', { key, params }, { cacheKey: cacheable ? `key:${key}` : '' });
          return sendResponse(result(true, data));
        }
        const text = String(message?.text || '').trim().slice(0, 4000);
        if (!text) throw new Error('MESSAGE_EMPTY');
        const data = await requestBackend('normalize', {
          text,
          tone: String(message?.tone || 'info'),
          error: message?.error === true
        });
        return sendResponse(result(true, data));
      } catch (error) {
        return sendResponse(result(false, null, error?.message || String(error)));
      }
    })();
    return true;
  });
}

export const MessagingRuntime = Object.freeze({
  build: 55,
  schema: 'ld-messaging-runtime/2',
  backendAuthority: true,
  localCatalog: false,
  naturalVoiceProfile: true
});
