import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';

const PORT_NAME = 'ld2-cloud-migration';
const REQUEST_TIMEOUT_MS = 70000;

async function backend(action, payload = {}) {
  const settings = await getSettings();
  const licenseKey = String(settings.auth?.licenseKey || '').trim();
  const deviceId = String(settings.auth?.deviceId || '').trim();
  if (!licenseKey) throw new Error('Faça login com sua KEY antes de migrar o Lovable Cloud.');
  if (!deviceId) throw new Error('Dispositivo não vinculado. Faça login novamente.');
  const base = String(settings.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/ld-cloud-migrator-broker`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-license-key': licenseKey, 'x-device-id': deviceId },
      body: JSON.stringify({ action, ...payload })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new Error(`Cloud Migrator: ${body?.code || `HTTP_${res.status}`}`);
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('O broker de migração não respondeu dentro do tempo limite.');
    throw error;
  } finally { clearTimeout(timer); }
}

export function installCloudMigrationRuntime() {
  if (globalThis.__LD2_CLOUD_MIGRATION_RUNTIME__) return;
  globalThis.__LD2_CLOUD_MIGRATION_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = String(message?.id || '');
      const action = String(message?.action || 'status');
      try {
        if (!['prepare','active','status','inspect','run_next','cancel'].includes(action)) throw new Error('Ação de migração inválida.');
        const data = await backend(action, message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try { port.postMessage({ id, ok: false, error: error?.message || String(error) }); } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });
}
