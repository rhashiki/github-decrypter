import { GeminiAgent } from '../ai/gemini-agent.js';
import { getSettings } from '../storage/settings-store.js';
import { getModelGatewayStatus } from './model-gateway-client.js';
import { assertGatewayDecision, publicGatewaySummary } from '../core/model-gateway.js';
import { TRUST_PROTOCOL_VERSION } from '../settings/config.js';
import { ensureTrustSession, trustPublicSummary } from '../security/trust.js';

const LAST_KEY = 'ld2_gateway_last_v1';
const HISTORY_KEY = 'ld2_gateway_history_v1';
const MAX_HISTORY = 80;

if (!globalThis.__LOVABLE_DECRYPTER_MODEL_GATEWAY_BOOTSTRAP__) {
  globalThis.__LOVABLE_DECRYPTER_MODEL_GATEWAY_BOOTSTRAP__ = true;

  const originalPlan = GeminiAgent.prototype.planCommand;
  const originalBuild = GeminiAgent.prototype.processCommand;

  async function persist(route, status = 'resolved', error = '') {
    const summary = publicGatewaySummary(route || {});
    const item = { ...summary, status, error: String(error || '').slice(0, 800), at: new Date().toISOString() };
    try {
      const stored = await chrome.storage.local.get(HISTORY_KEY);
      const history = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
      history.unshift(item);
      await chrome.storage.local.set({ [LAST_KEY]: item, [HISTORY_KEY]: history.slice(0, MAX_HISTORY) });
    } catch (_) {}
    return item;
  }

  function attachGateway(result, route) {
    if (!result || typeof result !== 'object') return result;
    try {
      Object.defineProperty(result, 'gateway', { value: route, enumerable: true, configurable: true, writable: false });
    } catch (_) {
      result.gateway = route;
    }
    return result;
  }

  GeminiAgent.prototype.backendCommand = async function gatewayBackendCommand(mode, command, context, agentRules = '', attachments = [], approvedPlan = null) {
    if (!this.backendBase) throw new Error('Model Gateway do Lovable Decrypter não configurado.');
    if (!this.licenseKey) throw new Error('Faça login com uma KEY válida.');
    if (!this.deviceId) throw new Error('Dispositivo ainda não foi vinculado à licença.');

    const settings = await getSettings();
    const trust = await ensureTrustSession(settings);
    const gatewayMode = ['auto', 'fast', 'deep'].includes(String(settings?.gateway?.mode || '').toLowerCase())
      ? String(settings.gateway.mode).toLowerCase()
      : 'auto';
    const headers = {
      'content-type': 'application/json',
      'x-license-key': this.licenseKey,
      'x-device-id': this.deviceId,
      'x-decrypter-trust': trust.token,
      'x-decrypter-client-version': TRUST_PROTOCOL_VERSION
    };
    if (this.apiKey) headers['x-gemini-key'] = this.apiKey;
    const res = await fetch(`${String(this.backendBase).replace(/\/+$/, '')}/ld-model-gateway`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'execute',
        mode,
        gateway_mode: gatewayMode,
        preferred_fast_model: this.model,
        preferred_deep_model: this.advancedModel,
        max_output_tokens: this.maxOutputTokens,
        gemini_billing_mode: this.billingMode,
        command_id: crypto.randomUUID(),
        command,
        project_context: context,
        agent_rules: agentRules || '',
        approved_plan: approvedPlan || null,
        attachments: (attachments || []).map(a => ({
          name: a.name || 'anexo',
          mime_type: a.mimeType || 'application/octet-stream',
          size: Number(a.size || 0),
          data: a.data || ''
        }))
      })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      const detail = body?.error || body?.message || body?.code || `HTTP ${res.status}`;
      throw new Error(`Model Gateway: ${detail}`);
    }
    assertGatewayDecision(body.gateway);
    if (!body.result || typeof body.result !== 'object') throw new Error('Model Gateway retornou resultado inválido.');
    return attachGateway(body.result, body.gateway);
  };

  async function inspect(result) {
    const route = result?.gateway || null;
    try {
      assertGatewayDecision(route);
      await persist(route, 'resolved');
      return result;
    } catch (error) {
      await persist(route || {}, 'failed', error?.message || String(error));
      throw error;
    }
  }

  GeminiAgent.prototype.planCommand = async function gatewayPlan(...args) {
    return inspect(await originalPlan.apply(this, args));
  };

  GeminiAgent.prototype.processCommand = async function gatewayBuild(...args) {
    return inspect(await originalBuild.apply(this, args));
  };

  globalThis.LovableDecrypterModelGatewayRuntime = Object.freeze({
    build: 24,
    schema: 'ld-model-gateway/1',
    active: true,
    authority: 'server',
    endpoint: 'ld-model-gateway',
    localProvider: 'health-gated',
    crossProviderFallback: false,
    trustRequired: true,
    async trust() { return trustPublicSummary(await getSettings()); },
    async status() { return getModelGatewayStatus(await getSettings()); }
  });
}
