import { installLocalModelRuntime } from './local-model-runtime.js';
import { installToolRuntime } from './tool-runtime.js';
import { installMcpRuntime } from './mcp-runtime.js';
import { installMcpMarketplaceRuntime } from './mcp-marketplace-runtime.js';
import { installContextEngineRuntime } from './context-engine-runtime.js';
import { installScopeIntelligenceRuntime } from './scope-intelligence-runtime.js';
import { installReversibleOperationsRuntime } from './reversible-operations-runtime.js';
import { installContinuityRuntime } from './continuity-runtime.js';
import { installLocalAgentOrchestrator } from './local-agent-orchestrator.js';
import { installIntegrationReadinessRuntime } from './integration-readiness-runtime.js';
import { installIntegrationCallbackRuntime } from './integration-callback-runtime.js';
import { installAgentRuntimeRegistryRuntime } from './agent-runtime-registry-runtime.js';
import { installPortableSkillsRuntime } from './portable-skills-runtime.js';
import { installAgentSandboxRuntime } from './agent-sandbox-runtime.js';
import { installNativeAgentSessionRuntime } from './native-agent-session-runtime.js';

const BUILD = 83;
const BRIDGE_SCHEMA = 'ld-canonical-runtime-bridge/2';

const MODULES = Object.freeze({
  'local-model': Object.freeze({
    id: 'local-model',
    title: 'Local Model Runtime',
    sourceBuild: 60,
    currentBuild: 68,
    installer: installLocalModelRuntime,
    port: 'ld2-local-model-runtime',
    statusAction: 'status',
    writePolicy: 'read-only-local-inference'
  }),
  'tool-runtime': Object.freeze({
    id: 'tool-runtime',
    title: 'Tool Runtime',
    sourceBuild: 61,
    currentBuild: 68,
    installer: installToolRuntime,
    port: 'ld2-tool-runtime',
    statusAction: 'list',
    writePolicy: 'fail-closed'
  }),
  'mcp-runtime': Object.freeze({
    id: 'mcp-runtime',
    title: 'MCP Core + Trust Gateway',
    sourceBuild: 62,
    currentBuild: 62,
    installer: installMcpRuntime,
    port: 'ld2-mcp-runtime',
    statusAction: 'status',
    writePolicy: 'trust-gateway-approval'
  }),
  'mcp-marketplace': Object.freeze({
    id: 'mcp-marketplace',
    title: 'Curated MCP Marketplace',
    sourceBuild: 63,
    currentBuild: 63,
    installer: installMcpMarketplaceRuntime,
    port: 'ld2-mcp-marketplace',
    statusAction: 'status',
    writePolicy: 'curated-install-only'
  }),
  'context-pack': Object.freeze({
    id: 'context-pack',
    title: 'Context Engine v2',
    sourceBuild: 64,
    currentBuild: 64,
    installer: installContextEngineRuntime,
    port: 'ld2-context-engine',
    statusAction: 'status',
    writePolicy: 'read-only'
  }),
  'scope-intelligence': Object.freeze({
    id: 'scope-intelligence',
    title: 'Scope Intelligence v2',
    sourceBuild: 65,
    currentBuild: 65,
    installer: installScopeIntelligenceRuntime,
    port: 'ld2-scope-intelligence',
    statusAction: 'status',
    writePolicy: 'fail-closed-before-write'
  }),
  'smart-undo': Object.freeze({
    id: 'smart-undo',
    title: 'Smart Undo / Redo',
    sourceBuild: 66,
    currentBuild: 66,
    installer: installReversibleOperationsRuntime,
    port: 'ld2-reversible-operations',
    statusAction: 'status',
    writePolicy: 'preview-before-reversal'
  }),
  'continuity': Object.freeze({
    id: 'continuity',
    title: 'Continuity Engine',
    sourceBuild: 67,
    currentBuild: 67,
    installer: installContinuityRuntime,
    port: 'ld2-continuity-runtime',
    statusAction: 'status',
    writePolicy: 'leased-resumable-work'
  }),
  'local-agent': Object.freeze({
    id: 'local-agent',
    title: 'Local Agent Orchestrator',
    sourceBuild: 68,
    currentBuild: 68,
    installer: installLocalAgentOrchestrator,
    port: 'ld2-local-agent-orchestrator',
    statusAction: 'status',
    writePolicy: 'approval-transaction'
  }),
  'account': Object.freeze({
    id: 'account',
    title: 'Account Integration Gate',
    sourceBuild: 70,
    currentBuild: 70,
    installer: installIntegrationReadinessRuntime,
    port: 'ld2-account-integration-readiness',
    statusAction: 'status',
    writePolicy: 'fail-closed-readiness-gate'
  }),
  'integration-callback': Object.freeze({
    id: 'integration-callback',
    title: 'Integration Callback Runtime',
    sourceBuild: 70,
    currentBuild: 70,
    installer: installIntegrationCallbackRuntime,
    port: null,
    statusAction: null,
    writePolicy: 'trusted-callback-only'
  }),
  'agent-runtime-registry': Object.freeze({
    id: 'agent-runtime-registry',
    title: 'Universal Agent Runtime Registry',
    sourceBuild: 71,
    currentBuild: 71,
    installer: installAgentRuntimeRegistryRuntime,
    port: 'ld2-agent-runtime-registry',
    statusAction: 'status',
    writePolicy: 'capability-gated'
  }),
  'portable-skills': Object.freeze({
    id: 'portable-skills',
    title: 'Portable Skills v2',
    sourceBuild: 72,
    currentBuild: 72,
    installer: installPortableSkillsRuntime,
    port: 'ld2-portable-skills-v2',
    statusAction: 'status',
    writePolicy: 'staged-and-sanitized'
  }),
  'agent-sandbox': Object.freeze({
    id: 'agent-sandbox',
    title: 'Agent Sandbox / Shadow Worktree',
    sourceBuild: 73,
    currentBuild: 73,
    installer: installAgentSandboxRuntime,
    port: 'ld2-agent-sandbox',
    statusAction: 'status',
    writePolicy: 'sandbox-only-until-approved'
  }),
  'native-agent-sessions': Object.freeze({
    id: 'native-agent-sessions',
    title: 'Native Agent Sessions',
    sourceBuild: 74,
    currentBuild: 74,
    installer: installNativeAgentSessionRuntime,
    port: 'ld2-native-agent-sessions',
    statusAction: 'status',
    writePolicy: 'no-direct-write-authority'
  })
});

const GROUPS = Object.freeze({
  'mcp-runtime': Object.freeze(['mcp-runtime', 'mcp-marketplace']),
  'account': Object.freeze(['account', 'integration-callback']),
  'local-agent': Object.freeze([
    'local-model',
    'tool-runtime',
    'context-pack',
    'scope-intelligence',
    'continuity',
    'local-agent',
    'agent-runtime-registry',
    'portable-skills',
    'agent-sandbox',
    'native-agent-sessions'
  ])
});

const VALIDATION_BUILDS = Object.freeze([
  Object.freeze({ build: 69, id: 'decrypterbench-v2', title: 'DecrypterBench v2', runtime: false, role: 'validation-benchmark' }),
  Object.freeze({ build: 75, id: 'universal-agent-bench', title: 'Universal Agent Bench', runtime: false, role: 'validation-benchmark' })
]);

const active = new Set();
const activating = new Map();

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
  if (activating.has(id)) return activating.get(id);

  const task = Promise.resolve().then(() => {
    if (typeof definition.installer !== 'function') {
      const error = new Error('CANONICAL_RUNTIME_INSTALLER_MISSING');
      error.code = 'CANONICAL_RUNTIME_INSTALLER_MISSING';
      throw error;
    }
    definition.installer();
    active.add(id);
    return publicModule(definition);
  });

  activating.set(id, task);
  try {
    return await task;
  } finally {
    activating.delete(id);
  }
}

async function activateGroup(groupId) {
  const id = String(groupId || '').trim();
  const members = GROUPS[id] || (MODULES[id] ? [id] : null);
  if (!members) {
    const error = new Error('CANONICAL_RUNTIME_GROUP_NOT_ALLOWED');
    error.code = 'CANONICAL_RUNTIME_GROUP_NOT_ALLOWED';
    throw error;
  }
  const modules = [];
  for (const member of members) modules.push(await activate(member));
  return { id, modules };
}

function catalog() {
  return {
    schema: BRIDGE_SCHEMA,
    build: BUILD,
    mode: 'static-source-lazy-install',
    staticSourceAssembly: true,
    automaticActivation: false,
    installersActiveAtBoot: 0,
    polling: false,
    mutationObservers: false,
    bridgeTimers: false,
    modules: Object.values(MODULES).map(publicModule),
    groups: Object.entries(GROUPS).map(([id, members]) => ({ id, members: [...members] })),
    validationBuilds: VALIDATION_BUILDS.map(item => ({ ...item }))
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
          activating: [...activating.keys()],
          automaticActivation: false,
          installersActiveAtBoot: 0
        }
      };
    }
    if (type === 'ld83.runtime.activate') return { ok: true, data: await activate(message?.moduleId) };
    if (type === 'ld83.runtime.activate_group') return { ok: true, data: await activateGroup(message?.groupId || message?.moduleId) };
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
  sourceAssembly: 'static-esm',
  automaticActivation: false,
  installersActiveAtBoot: 0,
  supportedModules: Object.keys(MODULES),
  validationBuilds: VALIDATION_BUILDS.map(item => item.build)
});
