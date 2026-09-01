'use strict';

const BUILD = 84;
const VERSION = '2.6.84';
const SCHEMA = 'ld-runtime-bus/1';

const MODULES = Object.freeze({
  github: { capability: 'integration.github', phase: '84.5', state: 'preserved-source' },
  supabase: { capability: 'integration.supabase', phase: '84.5', state: 'preserved-source' },
  lovable: { capability: 'project.state', phase: '84.5', state: 'preserved-source' },
  gemini: { capability: 'ai.gateway', phase: '84.9', state: 'preserved-source' },
  'project-state': { capability: 'project.state', phase: '84.5', state: 'preserved-source' },
  'git-history': { capability: 'project.history', phase: '84.5', state: 'preserved-source' },
  'context-pack': { capability: 'context.pack', phase: '84.6', state: 'preserved-source' },
  'local-agent': { capability: 'agent.local', phase: '84.9', state: 'preserved-source' },
  'scope-intelligence': { capability: 'scope.intelligence', phase: '84.6', state: 'preserved-source' },
  continuity: { capability: 'continuity.engine', phase: '84.8', state: 'preserved-source' },
  'tool-runtime': { capability: 'tools.read', phase: '84.7', state: 'preserved-source' },
  'mcp-runtime': { capability: 'mcp.core', phase: '84.7', state: 'preserved-source' },
  'agent-sandbox': { capability: 'agent.sandbox', phase: '84.9', state: 'preserved-source' },
  'smart-undo': { capability: 'recovery.undo-redo', phase: '84.8', state: 'preserved-source' },
  checkpoint: { capability: 'recovery.checkpoints', phase: '84.8', state: 'preserved-source' },
  'runtime-events': { capability: 'activity.runtime-events', phase: '84.5', state: 'preserved-source' },
  operations: { capability: 'activity.operations', phase: '84.5', state: 'preserved-source' },
  security: { capability: 'security.fail-closed', phase: '84.2', state: 'preserved-source' },
  updates: { capability: 'updates.center', phase: '84.5', state: 'preserved-source' },
  account: { capability: 'license.activation', phase: '84.3', state: 'preserved-source' },
  community: { capability: 'messaging.backend', phase: '84.5', state: 'preserved-source' },
  settings: { capability: 'account.details', phase: '84.3', state: 'preserved-source' }
});

function senderAllowed(sender) {
  const url = String(sender?.url || sender?.tab?.url || '');
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'chrome-extension:' || parsed.hostname === 'lovable.dev' || parsed.hostname.endsWith('.lovable.dev');
  } catch {
    return false;
  }
}

function responseFor(message) {
  const type = String(message?.type || '');
  if (type === 'ld84.runtime.health') {
    return {
      ok: true,
      schema: SCHEMA,
      build: BUILD,
      version: VERSION,
      authority: 'background/runtime-entry-v84.js',
      mode: 'event-driven',
      activeHeavyRuntimes: 0,
      polling: false,
      globalObservers: false,
      legacyBoot: false
    };
  }

  if (type === 'ld84.runtime.catalog') {
    return { ok: true, schema: SCHEMA, build: BUILD, modules: MODULES };
  }

  if (type === 'ld84.runtime.command') {
    const id = String(message?.module || '');
    const action = String(message?.action || 'details');
    const module = MODULES[id];
    if (!module) return { ok: false, code: 'MODULE_NOT_REGISTERED', module: id };
    return {
      ok: true,
      schema: SCHEMA,
      build: BUILD,
      module: id,
      action,
      capability: module.capability,
      state: module.state,
      targetPhase: module.phase,
      functionalInvocation: false,
      message: `Capacidade ${module.capability} preservada e registrada para reattachment na fase ${module.phase}.`
    };
  }

  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!senderAllowed(sender)) {
    sendResponse({ ok: false, code: 'SENDER_NOT_ALLOWED' });
    return false;
  }
  const response = responseFor(message);
  if (!response) return false;
  sendResponse(response);
  return false;
});

Object.defineProperty(globalThis, 'LovableDecrypterRuntimeV84', {
  value: Object.freeze({ build: BUILD, version: VERSION, schema: SCHEMA, modules: MODULES }),
  configurable: false,
  enumerable: false,
  writable: false
});
