const BUILD = 83;
const BRIDGE_SCHEMA = 'ld-canonical-runtime-bridge/1';

const MODULES = Object.freeze({
  'tool-runtime': Object.freeze({
    id: 'tool-runtime',
    title: 'Tool Runtime',
    sourceBuild: 61,
    currentBuild: 68,
    module: './tool-runtime.js',
    installer: 'installToolRuntime',
    port: 'ld2-tool-runtime',
    statusAction: 'list',
    writePolicy: 'fail-closed'
  }),
  'context-pack': Object.freeze({
    id: 'context-pack',
    title: 'Context Engine v2',
    sourceBuild: 64,
    currentBuild: 64,
    module: './context-engine-runtime.js',
    installer: 'installContextEngineRuntime',
    port: 'ld2-context-engine',
    statusAction: 'status',
    writePolicy: 'read-only'
  }),
  'scope-intelligence': Object.freeze({
    id: 'scope-intelligence',
    title: 'Scope Intelligence v2',
    sourceBuild: 65,
    currentBuild: 65,
    module: './scope-intelligence-runtime.js',
    installer: 'installScopeIntelligenceRuntime',
    port: 'ld2-scope-intelligence',
    statusAction: 'status',
    writePolicy: 'fail-closed-before-write'
  })
});

const active = new Set();
const loading = new Map();

function trustedSender(sender) {
  const value = String(sender?.url || sender?.tab?.url || '');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'lovable.dev' || url.hostname.endsWith('.lovable.dev'));
  } catch {
    return false;
  }
}

function publicModule(definition) {
  return {
    id: definition.id,
    title: definition.title,
    sourceBuild: definition.sourceBuild,
    currentBuild: definition.currentBuild,
    port: definition.port,
    statusAction: definition.statusAction,
    writePolicy: definition.writePolicy,
    activation: 'explicit-user-action-only',
    active: active.has(definition.id)
  };
}

async function activate(moduleId) {
  const id = String(moduleId || '').trim();
  const definition = MODULES[id];
  if (!definition) {
    const error = new Error('CANONICAL_RUNTIME_MODULE_NOT_ALLOWED');
    error.code = 'CANONICAL_RUNTIME_MODULE_NOT_ALLOWED';
    throw error;
  }
  if (active.has(id)) return publicModule(definition);
  if (loading.has(id)) return loading.get(id);

  const task = (async () => {
    const runtime = await import(definition.module);
    const installer = runtime?.[definition.installer];
    if (typeof installer !== 'function') {
      const error = new Error('CANONICAL_RUNTIME_INSTALLER_MISSING');
      error.code = 'CANONICAL_RUNTIME_INSTALLER_MISSING';
      throw error;
    }
    installer();
    active.add(id);
    return publicModule(definition);
  })();

  loading.set(id, task);
  try {
    return await task;
  } finally {
    loading.delete(id);
  }
}

function catalog() {
  return {
    schema: BRIDGE_SCHEMA,
    build: BUILD,
    mode: 'lazy-on-demand',
    automaticActivation: false,
    polling: false,
    mutationObservers: false,
    timers: false,
    modules: Object.values(MODULES).map(publicModule)
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = String(message?.type || '');
  if (!type.startsWith('ld83.runtime.')) return false;
  if (!trustedSender(sender)) {
    sendResponse({ ok: false, code: 'CANONICAL_RUNTIME_UNTRUSTED_SENDER' });
    return false;
  }

  const reply = async () => {
    if (type === 'ld83.runtime.catalog') return { ok: true, data: catalog() };
    if (type === 'ld83.runtime.health') {
      return {
        ok: true,
        data: {
          schema: BRIDGE_SCHEMA,
          build: BUILD,
          active: [...active],
          loading: [...loading.keys()],
          automaticActivation: false
        }
      };
    }
    if (type === 'ld83.runtime.activate') {
      return { ok: true, data: await activate(message?.moduleId) };
    }
    return { ok: false, code: 'CANONICAL_RUNTIME_ACTION_INVALID' };
  };

  reply().then(sendResponse).catch(error => {
    sendResponse({
      ok: false,
      code: error?.code || 'CANONICAL_RUNTIME_ACTIVATION_FAILED',
      error: error?.message || String(error)
    });
  });
  return true;
});

globalThis.LovableDecrypterCanonicalRuntime = Object.freeze({
  schema: BRIDGE_SCHEMA,
  build: BUILD,
  activation: 'explicit-user-action-only',
  automaticActivation: false,
  supportedModules: Object.keys(MODULES)
});
