import { DEFAULT_BACKEND_BASE, TRUST_PROTOCOL_VERSION } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';
import { ensureTrustSession } from '../security/trust.js';

const PORT_NAME = 'ld2-agent-runtime';
const ACTIONS = new Set(['status', 'start', 'get', 'step', 'complete', 'cancel']);

export async function requestAgentRuntime(action, payload = {}) {
  const op = String(action || 'status').toLowerCase();
  if (!ACTIONS.has(op)) throw new Error('Ação do Agent Runtime inválida.');
  const settings = await getSettings();
  const licenseKey = String(settings.auth?.licenseKey || '').trim();
  const deviceId = String(settings.auth?.deviceId || '').trim();
  if (!licenseKey) throw new Error('Faça login com sua KEY antes de usar o Decrypter AI.');
  if (!deviceId) throw new Error('Dispositivo não vinculado. Faça login novamente.');

  const trust = await ensureTrustSession(settings);
  const base = String(settings.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = op === 'step' ? 120000 : 30000;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = {
      'content-type': 'application/json',
      'x-license-key': licenseKey,
      'x-device-id': deviceId,
      'x-decrypter-trust': trust.token,
      'x-decrypter-client-version': TRUST_PROTOCOL_VERSION
    };
    const geminiKey = String(settings.gemini?.apiKey || '').trim();
    if (geminiKey) headers['x-gemini-key'] = geminiKey;
    const response = await fetch(`${base}/ld-agent-runtime`, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        action: op,
        ...payload,
        gemini_billing_mode: 'free',
        gateway_mode: payload.gateway_mode || settings.gateway?.mode || 'auto',
        preferred_fast_model: payload.preferred_fast_model || settings.gemini?.model || '',
        preferred_deep_model: payload.preferred_deep_model || settings.gemini?.advancedModel || '',
        max_output_tokens: payload.max_output_tokens || settings.gemini?.maxOutputTokens || 32768
      })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      const code = String(body?.code || `HTTP_${response.status}`);
      const error = new Error(`Decrypter AI: ${code}`);
      error.code = code;
      error.details = body || null;
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('O Decrypter AI excedeu o tempo limite desta etapa.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function installAgentRuntimeClient() {
  if (globalThis.__LD58_AGENT_RUNTIME_CLIENT__) return;
  globalThis.__LD58_AGENT_RUNTIME_CLIENT__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = String(message?.id || '');
      try {
        const data = await requestAgentRuntime(message?.action || 'status', message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || '', details: error?.details || null });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });
  globalThis.LovableDecrypterAgentRuntime = Object.freeze({
    build: 58,
    schema: 'ld-agent-runtime/1',
    authority: 'server',
    automaticLoop: false,
    toolExecution: false,
    rawContentPersistence: false,
    oneInferencePerStep: true,
    request: requestAgentRuntime
  });
}
