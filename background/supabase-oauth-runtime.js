import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';

const PORT_NAME = 'ld2-supabase-oauth';
const REQUEST_TIMEOUT_MS = 50000;
const OAUTH_ACTIONS = new Set(['status', 'connect', 'disconnect']);
const MANAGER_ACTIONS = new Set([
  'manager_status',
  'bootstrap_start',
  'organizations',
  'regions',
  'create_project',
  'project_status',
  'project_test'
]);

async function requestBackend(action, payload = {}) {
  const settings = await getSettings();
  const licenseKey = String(settings.auth?.licenseKey || '').trim();
  const deviceId = String(settings.auth?.deviceId || '').trim();
  if (!licenseKey) throw new Error('Faça login com sua KEY antes de conectar o Supabase.');
  if (!deviceId) throw new Error('Dispositivo não vinculado. Faça login novamente.');

  let endpoint = '';
  let backendAction = action;
  if (OAUTH_ACTIONS.has(action)) {
    endpoint = 'ld-supabase-oauth';
  } else if (MANAGER_ACTIONS.has(action)) {
    endpoint = 'ld-supabase-manager';
    if (action === 'manager_status') backendAction = 'status';
  } else {
    throw new Error('Ação Supabase inválida.');
  }

  const base = String(settings.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/${endpoint}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': deviceId
      },
      body: JSON.stringify({ action: backendAction, ...payload })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      const code = body?.code || `HTTP_${response.status}`;
      const error = new Error(`Supabase: ${code}`);
      error.code = code;
      error.details = body || null;
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('O backend do Supabase não respondeu dentro do tempo limite.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function installSupabaseOAuthRuntime() {
  if (globalThis.__LD2_SUPABASE_OAUTH_RUNTIME__) return;
  globalThis.__LD2_SUPABASE_OAUTH_RUNTIME__ = true;

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;

    const handler = async message => {
      const id = String(message?.id || '');
      const action = String(message?.action || 'manager_status');
      try {
        const data = await requestBackend(action, message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || '',
            details: error?.details || null
          });
        } catch (_) {}
      }
    };

    port.onMessage.addListener(handler);
  });
}
