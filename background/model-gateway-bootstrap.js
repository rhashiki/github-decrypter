import { GeminiAgent } from '../ai/gemini-agent.js';
import { assertGatewayDecision, publicGatewaySummary } from '../core/model-gateway.js';

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
    build: 17,
    schema: 'ld-model-gateway/1',
    active: true,
    authority: 'server',
    crossProviderFallback: false
  });
}
