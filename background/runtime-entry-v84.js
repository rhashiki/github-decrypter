'use strict';

const BUILD = 84;
const VERSION = '2.6.84';
const SCHEMA = 'ld-runtime-bus/1';
const LICENSE_ENDPOINT = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1/ld-license-validate';
const ACCOUNT_KEY = 'ld84_account';
const DEVICE_KEY = 'ld84_device_id';

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
  account: { capability: 'license.activation', phase: '84.3', state: 'reattached' },
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

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, value => resolve(value || {})));
}

function storageSet(value) {
  return new Promise(resolve => chrome.storage.local.set(value, () => resolve()));
}

function storageRemove(keys) {
  return new Promise(resolve => chrome.storage.local.remove(keys, () => resolve()));
}

async function deviceId() {
  const stored = await storageGet([DEVICE_KEY]);
  let value = String(stored[DEVICE_KEY] || '').trim();
  if (!value) {
    value = crypto.randomUUID();
    await storageSet({ [DEVICE_KEY]: value });
  }
  return value;
}

function safeAccount(stored) {
  const account = stored && typeof stored === 'object' ? stored : {};
  return {
    active: account.active === true,
    validatedAt: account.validatedAt || null,
    deviceBound: account.deviceBound === true,
    license: account.license || null
  };
}

async function accountStatus() {
  const stored = await storageGet([ACCOUNT_KEY]);
  return { ok: true, schema: 'ld-account-runtime/1', account: safeAccount(stored[ACCOUNT_KEY]) };
}

async function accountActivate(message) {
  const licenseKey = String(message?.licenseKey || '').trim();
  const deviceLabel = String(message?.deviceLabel || 'Chrome · Lovable Decrypter').slice(0, 120);
  if (!licenseKey) return { ok: false, code: 'KEY_REQUIRED' };
  if (!licenseKey.startsWith('LD2.')) return { ok: false, code: 'KEY_INVALID_FORMAT' };

  const id = await deviceId();
  let response;
  try {
    response = await fetch(LICENSE_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': id,
        'x-device-label': deviceLabel
      },
      body: JSON.stringify({ device_id: id, device_label: deviceLabel })
    });
  } catch (error) {
    return { ok: false, code: 'LICENSE_BACKEND_UNREACHABLE', message: error?.message || String(error) };
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.valid !== true) {
    return { ok: false, code: String(body?.code || `LICENSE_HTTP_${response.status}`), message: body?.message || null };
  }

  const storedAccount = {
    active: true,
    licenseKey,
    deviceBound: body.device_bound === true,
    validatedAt: new Date().toISOString(),
    license: body.license || null
  };
  await storageSet({ [ACCOUNT_KEY]: storedAccount });
  return { ok: true, schema: 'ld-account-runtime/1', account: safeAccount(storedAccount) };
}

async function accountClear() {
  await storageRemove([ACCOUNT_KEY]);
  return { ok: true, schema: 'ld-account-runtime/1', account: { active: false, validatedAt: null, deviceBound: false, license: null } };
}

async function responseFor(message) {
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
      legacyBoot: false,
      accountRuntime: true
    };
  }

  if (type === 'ld84.runtime.catalog') return { ok: true, schema: SCHEMA, build: BUILD, modules: MODULES };
  if (type === 'ld84.account.status') return accountStatus();
  if (type === 'ld84.account.activate') return accountActivate(message);
  if (type === 'ld84.account.clear') return accountClear();

  if (type === 'ld84.runtime.command') {
    const id = String(message?.module || '');
    const action = String(message?.action || 'details');
    const module = MODULES[id];
    if (!module) return { ok: false, code: 'MODULE_NOT_REGISTERED', module: id };
    const functionalInvocation = id === 'account';
    return {
      ok: true,
      schema: SCHEMA,
      build: BUILD,
      module: id,
      action,
      capability: module.capability,
      state: module.state,
      targetPhase: module.phase,
      functionalInvocation,
      message: functionalInvocation
        ? 'Conta & Licença reattached through clean Build84 account runtime.'
        : `Capacidade ${module.capability} preservada e registrada para reattachment na fase ${module.phase}.`
    };
  }

  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!senderAllowed(sender)) {
    sendResponse({ ok: false, code: 'SENDER_NOT_ALLOWED' });
    return false;
  }
  Promise.resolve(responseFor(message)).then(response => {
    if (response) sendResponse(response);
  }).catch(error => sendResponse({ ok: false, code: 'RUNTIME_INTERNAL_ERROR', message: error?.message || String(error) }));
  return true;
});

Object.defineProperty(globalThis, 'LovableDecrypterRuntimeV84', {
  value: Object.freeze({ build: BUILD, version: VERSION, schema: SCHEMA, modules: MODULES }),
  configurable: false,
  enumerable: false,
  writable: false
});
