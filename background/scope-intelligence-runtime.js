import { loadRecentUserEdits } from '../core/context-engine-v2.js';
import {
  SCOPE_INTELLIGENCE_SCHEMA,
  deriveHumanIntentLocks,
  evaluateScopeIntelligence
} from '../core/scope-intelligence-v2.js';

const PORT_NAME = 'ld2-scope-intelligence';
const BUILD = 65;
const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

async function handle(action, payload = {}) {
  const op = text(action || 'status', 80).toLowerCase();
  if (op === 'status') return {
    schema: SCOPE_INTELLIGENCE_SCHEMA,
    build: BUILD,
    engine: 'scope-intelligence-v2',
    comparison: 'request->approved-plan->prepared-diff',
    enforcement: 'fail-closed-before-write',
    humanIntentPolicy: 'USER_EDIT > AI_EDIT',
    strongLockPolicy: 'explicit-path-override-required',
    softLockPolicy: 'preserve-unless-current-request-explicitly-targets-path',
    skipApprovalBypassesScope: false
  };
  const projectId = text(payload?.projectId, 180);
  const recentUserEdits = Array.isArray(payload?.recentUserEdits)
    ? payload.recentUserEdits
    : await loadRecentUserEdits(projectId, 80);
  if (op === 'locks') return {
    schema: 'ld-human-intent-locks/1',
    projectId,
    locks: deriveHumanIntentLocks(recentUserEdits)
  };
  if (op === 'evaluate') return {
    report: evaluateScopeIntelligence({
      command: payload?.command || '',
      approvedPlan: payload?.approvedPlan || payload?.plan || {},
      files: payload?.files || [],
      recentUserEdits,
      humanIntentOverrides: payload?.humanIntentOverrides || [],
      decision: payload?.decision || 'approve'
    })
  };
  throw Object.assign(new Error('SCOPE_INTELLIGENCE_ACTION_INVALID'), { code: 'SCOPE_INTELLIGENCE_ACTION_INVALID' });
}

export function installScopeIntelligenceRuntime() {
  if (globalThis.__LD65_SCOPE_INTELLIGENCE_RUNTIME__) return;
  globalThis.__LD65_SCOPE_INTELLIGENCE_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 160);
      try {
        const data = await handle(message?.action || 'status', message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || '',
            scopeIntelligence: error?.scopeIntelligence || null
          });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterScopeIntelligence = Object.freeze({
    build: BUILD,
    schema: SCOPE_INTELLIGENCE_SCHEMA,
    port: PORT_NAME,
    failClosed: true,
    humanIntentAware: true,
    genericPlanApprovalDoesNotOverrideHumanIntent: true
  });
}
