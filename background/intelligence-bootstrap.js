import { GeminiAgent } from '../ai/gemini-agent.js';
import {
  createExecutionBrief,
  serializeExecutionBrief,
  assertProviderResult,
  publicIntelligenceSummary
} from '../core/decrypter-intelligence.js';

const LAST_KEY = 'ld2_intelligence_last_v1';
const HISTORY_KEY = 'ld2_intelligence_history_v1';
const MAX_HISTORY = 60;

if (!globalThis.__LOVABLE_DECRYPTER_INTELLIGENCE_BOOTSTRAP__) {
  globalThis.__LOVABLE_DECRYPTER_INTELLIGENCE_BOOTSTRAP__ = true;

  const originalPlan = GeminiAgent.prototype.planCommand;
  const originalBuild = GeminiAgent.prototype.processCommand;

  async function persist(summary, status = 'validated', error = '') {
    try {
      const item = {
        ...summary,
        status,
        error: String(error || '').slice(0, 1200),
        at: new Date().toISOString()
      };
      const stored = await chrome.storage.local.get(HISTORY_KEY);
      const history = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
      history.unshift(item);
      await chrome.storage.local.set({
        [LAST_KEY]: item,
        [HISTORY_KEY]: history.slice(0, MAX_HISTORY)
      });
    } catch (_) {}
  }

  function decorateResult(result, summary) {
    if (!result || typeof result !== 'object') return result;
    try {
      Object.defineProperty(result, 'intelligence', {
        value: summary,
        enumerable: true,
        configurable: true,
        writable: false
      });
    } catch (_) {
      result.intelligence = summary;
    }
    return result;
  }

  GeminiAgent.prototype.planCommand = async function decrypterPlan(command, context, agentRules = '', attachments = []) {
    const brief = createExecutionBrief({
      mode: 'plan',
      command,
      context,
      agentRules,
      attachments,
      approvedPlan: null
    });
    const directive = serializeExecutionBrief(brief);
    let result;
    try {
      result = await originalPlan.call(this, command, context, directive, attachments);
      const validation = assertProviderResult(result, brief);
      const summary = publicIntelligenceSummary(brief, validation);
      await persist(summary, 'validated');
      return decorateResult(result, summary);
    } catch (error) {
      await persist(publicIntelligenceSummary(brief), error?.code === 'DECRYPTER_INTELLIGENCE_BLOCKED' ? 'blocked' : 'failed', error?.message || String(error));
      throw error;
    }
  };

  GeminiAgent.prototype.processCommand = async function decrypterBuild(command, context, agentRules = '', attachments = [], approvedPlan = null) {
    const brief = createExecutionBrief({
      mode: 'build',
      command,
      context,
      agentRules,
      attachments,
      approvedPlan
    });
    const directive = serializeExecutionBrief(brief);
    let result;
    try {
      result = await originalBuild.call(this, command, context, directive, attachments, approvedPlan);
      const validation = assertProviderResult(result, brief);
      const summary = publicIntelligenceSummary(brief, validation);
      await persist(summary, 'validated');
      return decorateResult(result, summary);
    } catch (error) {
      await persist(publicIntelligenceSummary(brief), error?.code === 'DECRYPTER_INTELLIGENCE_BLOCKED' ? 'blocked' : 'failed', error?.message || String(error));
      throw error;
    }
  };

  globalThis.LovableDecrypterIntelligenceRuntime = Object.freeze({
    build: 15,
    schema: 'ld-intelligence/1',
    providerRole: 'executor_only',
    knowledgeActive: false,
    modelGatewayActive: false
  });
}
