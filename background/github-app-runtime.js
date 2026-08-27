import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';

const PORT_NAME = 'ld2-github-app';
const REQUEST_TIMEOUT_MS = 30000;

async function requestBackend(action, payload = {}) {
  const settings = await getSettings();
  const licenseKey = String(settings.auth?.licenseKey || '').trim();
  const deviceId = String(settings.auth?.deviceId || '').trim();
  if (!licenseKey) throw new Error('Faça login com sua KEY antes de conectar o GitHub.');
  if (!deviceId) throw new Error('Dispositivo não vinculado. Faça login novamente.');

  const base = String(settings.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/ld-github-app`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': deviceId
      },
      body: JSON.stringify({ action, ...payload })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      const code = body?.code || `HTTP_${response.status}`;
      throw new Error(`GitHub App: ${code}`);
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('O backend do GitHub não respondeu dentro do tempo limite.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function installGithubAppRuntime() {
  if (globalThis.__LD2_GITHUB_APP_RUNTIME__) return;
  globalThis.__LD2_GITHUB_APP_RUNTIME__ = true;

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;

    const handler = async message => {
      const id = String(message?.id || '');
      const action = String(message?.action || 'status');
      try {
        if (!['status', 'connect', 'disconnect'].includes(action)) throw new Error('Ação GitHub inválida.');
        const data = await requestBackend(action, message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try { port.postMessage({ id, ok: false, error: error?.message || String(error) }); } catch (_) {}
      }
    };

    port.onMessage.addListener(handler);
  });
}
