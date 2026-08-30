import { DEFAULT_BACKEND_BASE, TRUST_PROTOCOL_VERSION } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';
import { ensureTrustSession } from '../security/trust.js';

const PORT_NAME = 'ld2-tool-runtime';
const ACTIONS = new Set(['status', 'invoke']);
const TOOLS = new Set(['workspace.list','workspace.read','workspace.grep','lsp.diagnostics','lsp.definition','lsp.references']);

export async function requestToolRuntime(action, payload = {}) {
  const op = String(action || 'status').toLowerCase();
  if (!ACTIONS.has(op)) throw new Error('Ação do Tool Runtime inválida.');
  if (op === 'invoke' && !TOOLS.has(String(payload?.tool || ''))) throw new Error('Ferramenta não permitida pelo Tool Runtime.');

  const settings = await getSettings();
  const licenseKey = String(settings.auth?.licenseKey || '').trim();
  const deviceId = String(settings.auth?.deviceId || '').trim();
  if (!licenseKey) throw new Error('Faça login com sua KEY antes de usar as ferramentas do Decrypter AI.');
  if (!deviceId) throw new Error('Dispositivo não vinculado. Faça login novamente.');

  const trust = await ensureTrustSession(settings);
  const base = String(settings.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), op === 'invoke' ? 45000 : 10000);
  try {
    const response = await fetch(`${base}/ld-tool-runtime`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': deviceId,
        'x-decrypter-trust': trust.token,
        'x-decrypter-client-version': TRUST_PROTOCOL_VERSION
      },
      body: JSON.stringify({ action: op, ...payload })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      const code = String(body?.code || `HTTP_${response.status}`);
      const error = new Error(`Decrypter Tools: ${code}`);
      error.code = code;
      error.details = body || null;
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('O Tool Runtime excedeu o tempo limite.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function installToolRuntimeClient() {
  if (globalThis.__LD61_TOOL_RUNTIME_CLIENT__) return;
  globalThis.__LD61_TOOL_RUNTIME_CLIENT__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = String(message?.id || '');
      try {
        const data = await requestToolRuntime(message?.action || 'status', message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try { port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || '', details: error?.details || null }); } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });
  globalThis.LovableDecrypterToolRuntime = Object.freeze({
    build: 61,
    schema: 'ld-tool-runtime/1',
    authority: 'server',
    explicitInvocationOnly: true,
    readOnly: true,
    writeTools: false,
    arbitraryShell: false,
    tools: Object.freeze([...TOOLS]),
    request: requestToolRuntime
  });
}
