import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';

const PORT_NAME = 'ld2-project-state';
const REQUEST_TIMEOUT_MS = 60000;

async function inspectProjectState(payload = {}) {
  const settings = await getSettings();
  const licenseKey = String(settings.auth?.licenseKey || '').trim();
  const deviceId = String(settings.auth?.deviceId || '').trim();
  const projectRef = String(payload.project_ref || '').trim();

  if (!licenseKey) throw new Error('Faça login com sua KEY antes de inspecionar o projeto.');
  if (!deviceId) throw new Error('Dispositivo não vinculado. Faça login novamente.');
  if (!/^[a-z0-9]{8,32}$/i.test(projectRef)) throw new Error('PROJECT_REF_INVALID');

  const base = String(settings.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/ld-project-state`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': deviceId
      },
      body: JSON.stringify({ action: 'inspect', project_ref: projectRef })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      const code = body?.code || `HTTP_${response.status}`;
      const error = new Error(`Project State: ${code}`);
      error.code = code;
      throw error;
    }
    return body.state || body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A inspeção do estado do projeto excedeu o tempo limite.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function installProjectStateRuntime() {
  if (globalThis.__LD2_PROJECT_STATE_RUNTIME__) return;
  globalThis.__LD2_PROJECT_STATE_RUNTIME__ = true;

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = String(message?.id || '');
      try {
        const action = String(message?.action || '');
        if (action !== 'inspect') throw new Error('PROJECT_STATE_ACTION_INVALID');
        const data = await inspectProjectState(message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || ''
          });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });
}
