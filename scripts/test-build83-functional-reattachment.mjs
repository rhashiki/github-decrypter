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
const bridge = read('background/canonical-runtime-entry.js');
const client = read('launcher/canonical-runtime-client.js');
const launcher = read('launcher/launcher-runtime.js');

assert(manifest.version === '2.6.83', 'manifest must be 2.6.83');
assert(manifest.background?.service_worker === 'background/canonical-runtime-entry.js', 'canonical service worker must be the only background entry');
assert(manifest.background?.type === 'module', 'canonical service worker must be module type');
const permissions = new Set(manifest.permissions || []);
for (const permission of ['storage','alarms','identity']) assert(permissions.has(permission), `missing required modern runtime permission: ${permission}`);
assert(permissions.size === 3, 'Build83 must not add unrelated required permissions');
assert((manifest.host_permissions || []).includes('https://lovable.dev/*'), 'Lovable host permission missing');
assert((manifest.host_permissions || []).includes('https://api.github.com/*'), 'GitHub API host permission missing');
assert((manifest.host_permissions || []).includes('https://*.supabase.co/*'), 'Supabase host permission missing');
for (const pattern of ['https://*/*','http://127.0.0.1/*','http://localhost/*']) {
  assert((manifest.optional_host_permissions || []).includes(pattern), `optional runtime host permission missing: ${pattern}`);
}

assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length === 1, 'exactly one content-script declaration required');
const scripts = manifest.content_scripts[0]?.js || [];
assert(JSON.stringify(scripts) === JSON.stringify(['launcher/launcher-runtime.js','launcher/canonical-runtime-client.js']), 'only canonical visual launcher + nonvisual runtime client may be injected');

assert(/data-ld-ui-authority['"],\s*['"]canonical-v11/.test(launcher), 'canonical-v11 visual authority must remain intact');
assert(!/MutationObserver|setInterval\s*\(|setTimeout\s*\(/.test(client), 'canonical runtime client cannot poll, observe or schedule timers');
assert(!/MutationObserver|setInterval\s*\(|setTimeout\s*\(|chrome\.alarms/.test(bridge), 'canonical bridge cannot poll, observe, schedule timers or alarms');
assert(!/\bimport\s*\(/.test(bridge), 'dynamic import is forbidden in MV3 extension service workers');
assert(!/service-worker-entry/.test(bridge), 'old service-worker entry cannot be referenced');
assert(/explicit-user-action-only/.test(bridge), 'bridge must declare explicit-user-action-only activation');
assert(/automaticActivation:\s*false/.test(bridge), 'automatic activation must remain disabled');
assert(/installersActiveAtBoot:\s*0/.test(bridge), 'no modern runtime installer may be active at boot');
assert(!/^\s*install[A-Z][A-Za-z0-9_]*Runtime\(\);\s*$/m.test(bridge), 'runtime installers cannot execute at top level');

const runtimeModules = Object.freeze({
  60: ['local-model', './local-model-runtime.js', 'installLocalModelRuntime'],
  61: ['tool-runtime', './tool-runtime.js', 'installToolRuntime'],
  62: ['mcp-runtime', './mcp-runtime.js', 'installMcpRuntime'],
  63: ['mcp-marketplace', './mcp-marketplace-runtime.js', 'installMcpMarketplaceRuntime'],
  64: ['context-pack', './context-engine-runtime.js', 'installContextEngineRuntime'],
  65: ['scope-intelligence', './scope-intelligence-runtime.js', 'installScopeIntelligenceRuntime'],
  66: ['smart-undo', './reversible-operations-runtime.js', 'installReversibleOperationsRuntime'],
  67: ['continuity', './continuity-runtime.js', 'installContinuityRuntime'],
  68: ['local-agent', './local-agent-orchestrator.js', 'installLocalAgentOrchestrator'],
  70: ['account', './integration-readiness-runtime.js', 'installIntegrationReadinessRuntime'],
  71: ['agent-runtime-registry', './agent-runtime-registry-runtime.js', 'installAgentRuntimeRegistryRuntime'],
  72: ['portable-skills', './portable-skills-runtime.js', 'installPortableSkillsRuntime'],
  73: ['agent-sandbox', './agent-sandbox-runtime.js', 'installAgentSandboxRuntime'],
  74: ['native-agent-sessions', './native-agent-session-runtime.js', 'installNativeAgentSessionRuntime']
});
for (const [build, [id, modulePath, installer]] of Object.entries(runtimeModules)) {
  assert(bridge.includes(`'${id}'`), `Build ${build} canonical module missing: ${id}`);
  assert(bridge.includes(`from '${modulePath}'`), `Build ${build} static MV3 import missing: ${modulePath}`);
  assert(bridge.includes(installer), `Build ${build} installer missing: ${installer}`);
}
assert(bridge.includes("'integration-callback'"), 'Build70 integration callback runtime missing');
assert(bridge.includes("from './integration-callback-runtime.js'"), 'Build70 callback static import missing');
assert(bridge.includes('build: 69') && bridge.includes('decrypterbench-v2'), 'Build69 validation benchmark metadata missing');
assert(bridge.includes('build: 75') && bridge.includes('universal-agent-bench'), 'Build75 validation benchmark metadata missing');

const requiredPackagePaths = [
  'launcher/launcher-runtime.js',
  'launcher/canonical-runtime-client.js',
  'background/canonical-runtime-entry.js',
  'background/local-model-runtime.js',
  'background/tool-runtime.js',
  'background/mcp-runtime.js',
  'background/mcp-marketplace-runtime.js',
  'background/context-engine-runtime.js',
  'background/scope-intelligence-runtime.js',
  'background/reversible-operations-runtime.js',
  'background/continuity-runtime.js',
  'background/local-agent-orchestrator.js',
  'background/integration-readiness-runtime.js',
  'background/integration-callback-runtime.js',
  'background/agent-runtime-registry-runtime.js',
  'background/portable-skills-runtime.js',
  'background/agent-sandbox-runtime.js',
  'background/native-agent-session-runtime.js',
  'core/local-model-router.js',
  'core/tool-runtime.js',
  'core/mcp-client.js',
  'core/mcp-protocol.js',
  'core/mcp-trust-gateway.js',
  'core/mcp-marketplace.js',
  'core/context-engine-v2.js',
  'core/scope-intelligence-v2.js',
  'core/reversible-operations.js',
  'core/continuity-engine.js',
  'core/local-agent-approval.js',
  'core/account-integration-readiness.js',
  'core/agent-runtime-registry.js',
  'core/portable-skills.js',
  'core/agent-sandbox.js',
  'core/native-agent-sessions.js',
  'security/mcp-oauth.js',
  'storage/settings-store.js',
  'github/git-adapter.js',
  'settings/config.js'
];
const packagePaths = packageSpec.paths || [];
const packaged = new Set(packagePaths);
for (const item of requiredPackagePaths) assert(packaged.has(item), `runtime package missing ${item}`);
for (const broadRoot of ['background','core','security','storage','github','settings']) {
  assert(!packagePaths.includes(broadRoot), `whole runtime root cannot be packaged: ${broadRoot}`);
}
for (const forbiddenPath of ['background/service-worker-entry.js','background/service-worker.js','background/decrypter-chat-runtime.js']) {
  assert((packageSpec.forbidden_paths || []).includes(forbiddenPath), `legacy background path must be explicitly forbidden: ${forbiddenPath}`);
  assert(!packaged.has(forbiddenPath), `legacy background path packaged: ${forbiddenPath}`);
}

const forbiddenRoots = new Set(['ui','content','diagnostic','benchmark','runtime','updates']);
for (const item of packagePaths) {
  const top = String(item).replace(/\\/g, '/').split('/')[0];
  assert(!forbiddenRoots.has(top), `forbidden runtime/package root shipped: ${top}`);
}

function isPackagedFile(relative) {
  const normalized = relative.replace(/\\/g, '/');
  if (packaged.has(normalized)) return true;
  return packagePaths.some(item => {
    const candidate = String(item).replace(/\\/g, '/').replace(/\/$/, '');
    return exists(candidate) && fs.statSync(path.join(root, candidate)).isDirectory() && normalized.startsWith(`${candidate}/`);
  });
}

const importPattern = /(?:\bimport\s+(?:[^'";]+?\s+from\s+)?|\bexport\s+[^'";]+?\s+from\s+|\bimport\s*)['"]([^'"]+)['"]/g;
const unresolvedImports = [];
const forbiddenImports = [];
for (const file of packagePaths.filter(item => item.endsWith('.js'))) {
  assert(exists(file), `packaged JS path does not exist: ${file}`);
  const source = read(file);
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    const top = resolved.split('/')[0];
    if (forbiddenRoots.has(top)) forbiddenImports.push(`${file} -> ${resolved}`);
    if (!isPackagedFile(resolved)) unresolvedImports.push(`${file} -> ${resolved}`);
  }
}
assert(forbiddenImports.length === 0, `packaged runtime imports forbidden roots:\n${forbiddenImports.join('\n')}`);
assert(unresolvedImports.length === 0, `runtime package has unresolved relative imports:\n${unresolvedImports.join('\n')}`);

for (const validationFile of [
  'benchmark/decrypterbench-v2.mjs',
  'benchmark/universal-agent-bench.mjs',
  'tests/build69-decrypterbench-v2.test.mjs',
  'tests/build75-universal-agent-bench.test.mjs'
]) assert(exists(validationFile), `validation-only Build69/75 source missing: ${validationFile}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build83-modern-runtime-restoration-gate/2',
  version: manifest.version,
  visualAuthority: 'canonical-v11',
  backgroundEntry: manifest.background.service_worker,
  automaticActivation: false,
  installersActiveAtBoot: 0,
  sourceAssembly: 'static-esm-mv3-compatible',
  runtimeBuilds: Object.keys(runtimeModules).map(Number),
  validationBuilds: [69,75],
  canonicalModules: Object.values(runtimeModules).map(item => item[0]),
  injectedScripts: scripts,
  packagePaths: packagePaths.length,
  unresolvedImports: unresolvedImports.length,
  forbiddenImports: forbiddenImports.length
}, null, 2));
