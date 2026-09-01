import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const fail = message => { throw new Error(`BUILD83_GATE: ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

const manifest = json('manifest.json');
const packageSpec = json('release/runtime-package.json');
const entry = read('background/service-worker-entry.js');

assert(manifest.version === '2.6.83', 'manifest must be 2.6.83');
assert(manifest.background?.service_worker === 'background/service-worker-entry.js', 'functional service-worker entry must be authoritative');
assert(manifest.background?.type === 'module', 'service worker must be module type');
assert(!JSON.stringify(manifest).includes('launcher/launcher-runtime.js'), 'canonical launcher must not be injected');
assert(!JSON.stringify(manifest).includes('launcher/canonical-runtime-client.js'), 'canonical runtime client must not be injected');

const permissions = new Set(manifest.permissions || []);
for (const permission of ['storage','tabs','downloads','unlimitedStorage','alarms','identity']) {
  assert(permissions.has(permission), `missing functional permission: ${permission}`);
}

const contentScripts = manifest.content_scripts || [];
const app = contentScripts.find(item => Array.isArray(item.js) && item.js.includes('ui/ui-kernel-v48.js'));
assert(app, 'functional application content-script declaration missing');
const injected = new Set(app.js || []);
const functionalUi = [
  'ui/ui.js',
  'ui/license-gate-premium.js',
  'ui/chat-activation-premium-v45.js',
  'ui/ui-kernel-v48.js',
  'ui/integrations-v49.js',
  'ui/project-intelligence-v50.js',
  'ui/engineering-suite-v51.js',
  'ui/project-tools-v52.js',
  'ui/settings-v53.js',
  'ui/update-center-v54.js',
  'ui/backend-messaging-v55.js'
];
for (const file of functionalUi) assert(injected.has(file), `functional UI script missing from boot: ${file}`);

const modernClients = [
  'content/tool-runtime-client.js',
  'content/mcp-runtime-client.js',
  'content/mcp-marketplace-client.js',
  'content/context-engine-client.js',
  'content/reversible-operations-client.js',
  'content/continuity-runtime-client.js',
  'content/local-agent-orchestrator-client.js',
  'content/integration-readiness-client.js',
  'content/integration-callback-bridge.js',
  'content/agent-runtime-registry-client.js',
  'content/portable-skills-client.js',
  'content/agent-sandbox-client.js',
  'content/native-agent-session-client.js'
];
for (const file of modernClients) assert(injected.has(file), `modern client missing from functional boot: ${file}`);

for (const file of ['assets/fab.png', ...functionalUi, ...modernClients]) assert(exists(file), `required runtime file missing: ${file}`);

assert(entry.includes("import { installDecrypterChatRuntime } from './decrypter-chat-runtime.js'"), 'Decrypter Chat runtime import missing');
assert(entry.includes('installDecrypterChatRuntime();'), 'Decrypter Chat runtime is not installed at boot');
const modernBackground = [
  ['./agent-runtime-client.js','installAgentRuntimeClient'],
  ['./local-model-runtime.js','installLocalModelRuntime'],
  ['./tool-runtime.js','installToolRuntime'],
  ['./mcp-runtime.js','installMcpRuntime'],
  ['./mcp-marketplace-runtime.js','installMcpMarketplaceRuntime'],
  ['./context-engine-runtime.js','installContextEngineRuntime'],
  ['./scope-intelligence-runtime.js','installScopeIntelligenceRuntime'],
  ['./reversible-operations-runtime.js','installReversibleOperationsRuntime'],
  ['./continuity-runtime.js','installContinuityRuntime'],
  ['./local-agent-orchestrator.js','installLocalAgentOrchestrator'],
  ['./integration-readiness-runtime.js','installIntegrationReadinessRuntime'],
  ['./integration-callback-runtime.js','installIntegrationCallbackRuntime'],
  ['./agent-runtime-registry-runtime.js','installAgentRuntimeRegistryRuntime'],
  ['./portable-skills-runtime.js','installPortableSkillsRuntime'],
  ['./agent-sandbox-runtime.js','installAgentSandboxRuntime'],
  ['./native-agent-session-runtime.js','installNativeAgentSessionRuntime']
];
for (const [modulePath, installer] of modernBackground) {
  assert(entry.includes(`from '${modulePath}'`), `modern background module missing: ${modulePath}`);
  assert(entry.includes(`${installer}();`), `modern background installer inactive: ${installer}`);
}

const packagePaths = new Set(packageSpec.paths || []);
for (const item of ['manifest.json','ai','assets','background','content','core','github','security','settings','storage','tools','ui','updates/update-manager.js']) {
  assert(packagePaths.has(item), `functional runtime package missing: ${item}`);
}
assert((packageSpec.forbidden_roots || []).includes('launcher'), 'launcher root must be forbidden from functional test package');
assert(![...packagePaths].some(item => String(item).startsWith('launcher')), 'canonical launcher leaked into package paths');
assert((packageSpec.forbidden_paths || []).includes('updates/latest.json'), 'OTA latest metadata must remain excluded');
assert((packageSpec.forbidden_paths || []).includes('updates/release.json'), 'release metadata must remain excluded');
assert(/No OTA metadata, GitHub Release or store publication is authorized/.test(packageSpec.notes || ''), 'publication prohibition note missing');

const manifestRefs = [];
manifestRefs.push(manifest.background.service_worker);
for (const value of Object.values(manifest.icons || {})) manifestRefs.push(value);
for (const block of manifest.content_scripts || []) {
  manifestRefs.push(...(block.js || []), ...(block.css || []));
}
for (const block of manifest.web_accessible_resources || []) manifestRefs.push(...(block.resources || []));
for (const ref of manifestRefs.filter(Boolean)) assert(exists(ref), `manifest reference missing on disk: ${ref}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build83-functional-runtime-reattachment/3',
  version: manifest.version,
  visualAuthority: 'build57-functional-ui',
  activationAuthority: 'license-gate-premium+chat-activation-v45',
  backgroundEntry: manifest.background.service_worker,
  functionalUiScripts: functionalUi.length,
  modernContentClients: modernClients.length,
  modernBackgroundInstallers: modernBackground.length,
  canonicalLauncherInjected: false,
  packageIncludesFunctionalRoots: true,
  publicationAuthorized: false
}, null, 2));
