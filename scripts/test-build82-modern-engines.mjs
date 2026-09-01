import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const exists = relative => fs.existsSync(path.join(root, relative));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const packageSpec = JSON.parse(read('release/runtime-package.json'));

const builds = Object.freeze({
  60: ['core/local-model-router.js', 'background/local-model-runtime.js', 'runtime/decrypter-local/ollama-gateway.py'],
  61: ['core/tool-runtime.js', 'core/operation-journal.js', 'core/patch-engine.js', 'background/tool-runtime.js', 'content/tool-runtime-client.js'],
  62: ['core/mcp-client.js', 'core/mcp-protocol.js', 'core/mcp-trust-gateway.js', 'background/mcp-runtime.js', 'content/mcp-runtime-client.js'],
  63: ['core/mcp-marketplace.js', 'background/mcp-marketplace-runtime.js', 'content/mcp-marketplace-client.js'],
  64: ['core/context-engine-v2.js', 'background/context-engine-runtime.js', 'content/context-engine-client.js'],
  65: ['core/scope-intelligence-v2.js', 'background/scope-intelligence-runtime.js'],
  66: ['core/reversible-operations.js', 'background/reversible-operations-runtime.js', 'content/reversible-operations-client.js'],
  67: ['core/continuity-engine.js', 'background/continuity-runtime.js', 'content/continuity-runtime-client.js'],
  68: ['core/local-agent-approval.js', 'background/local-agent-orchestrator.js', 'content/local-agent-orchestrator-client.js'],
  69: ['benchmark/decrypterbench-v2.mjs', 'benchmark/lib/catalog.mjs', 'benchmark/lib/evaluator.mjs', 'benchmark/lib/runner.mjs'],
  70: ['core/account-integration-readiness.js', 'background/integration-readiness-runtime.js', 'background/integration-callback-runtime.js', 'content/integration-readiness-client.js', 'content/integration-callback-bridge.js'],
  71: ['core/agent-runtime-registry.js', 'background/agent-runtime-registry-runtime.js', 'content/agent-runtime-registry-client.js'],
  72: ['core/portable-skills.js', 'background/portable-skills-runtime.js', 'content/portable-skills-client.js'],
  73: ['core/agent-sandbox.js', 'background/agent-sandbox-runtime.js', 'content/agent-sandbox-client.js'],
  74: ['core/native-agent-sessions.js', 'background/native-agent-session-runtime.js', 'content/native-agent-session-client.js'],
  75: ['benchmark/universal-agent-bench.mjs', 'benchmark/universal-agent-bench-v1.mjs']
});

const missing = [];
const preserved = [];
for (const [build, files] of Object.entries(builds)) {
  for (const file of files) {
    if (!exists(file)) missing.push(`Build ${build}: ${file}`);
    else preserved.push(file);
  }
}
assert.deepEqual(missing, [], `modern engine preservation failure:\n${missing.join('\n')}`);

assert.equal(manifest.version, '2.6.82');
assert.ok(!manifest.background, 'modern engines must remain source-only in Build82');
const activeScripts = (manifest.content_scripts || []).flatMap(item => item.js || []);
assert.deepEqual(activeScripts, ['launcher/launcher-runtime.js']);
for (const file of preserved) {
  assert.ok(!JSON.stringify(manifest).includes(file), `modern engine must not be activated by Build82 manifest: ${file}`);
}

const shippedRoots = new Set((packageSpec.paths || []).map(item => String(item).replace(/\\/g, '/').split('/')[0]));
for (const rootName of ['background', 'content', 'core', 'runtime', 'benchmark']) {
  assert.ok(!shippedRoots.has(rootName), `${rootName}/ must remain source-only in Build82 package`);
  assert.ok((packageSpec.forbidden_roots || []).includes(rootName), `${rootName}/ must be forbidden from Build82 package`);
}

const entry = read('background/service-worker-entry.js');
const sourceAssembly = Object.freeze([
  ['./tool-runtime.js', 'installToolRuntime();'],
  ['./mcp-runtime.js', 'installMcpRuntime();'],
  ['./mcp-marketplace-runtime.js', 'installMcpMarketplaceRuntime();'],
  ['./context-engine-runtime.js', 'installContextEngineRuntime();'],
  ['./scope-intelligence-runtime.js', 'installScopeIntelligenceRuntime();'],
  ['./reversible-operations-runtime.js', 'installReversibleOperationsRuntime();'],
  ['./continuity-runtime.js', 'installContinuityRuntime();'],
  ['./local-model-runtime.js', 'installLocalModelRuntime();'],
  ['./local-agent-orchestrator.js', 'installLocalAgentOrchestrator();'],
  ['./integration-readiness-runtime.js', 'installIntegrationReadinessRuntime();'],
  ['./integration-callback-runtime.js', 'installIntegrationCallbackRuntime();'],
  ['./agent-runtime-registry-runtime.js', 'installAgentRuntimeRegistryRuntime();'],
  ['./portable-skills-runtime.js', 'installPortableSkillsRuntime();'],
  ['./agent-sandbox-runtime.js', 'installAgentSandboxRuntime();'],
  ['./native-agent-session-runtime.js', 'installNativeAgentSessionRuntime();']
]);
for (const [importToken, installToken] of sourceAssembly) {
  assert.ok(entry.includes(importToken), `service-worker source assembly lost modern engine import ${importToken}`);
  assert.ok(entry.includes(installToken), `service-worker source assembly lost modern engine install ${installToken}`);
}
for (const token of ['decrypter-chat-runtime', 'multi-agent-runtime-v74', 'ui/', 'diagnostic/']) {
  assert.ok(!entry.includes(token), `service-worker source assembly must not reference legacy visual layer: ${token}`);
}

const settings = read('settings/config.js');
for (const schema of [
  'ld-tool-runtime/1',
  'ld-operation-journal/1',
  'ld-mcp-runtime/1',
  'ld-mcp-marketplace/1',
  'ld-context-pack/2',
  'ld-scope-intelligence/2',
  'ld-reversible-operation/1',
  'ld-continuity-task/1',
  'ld-local-model-router/1',
  'ld-local-agent/1',
  'ld-decrypterbench/2',
  'ld-account-integration-readiness/1',
  'ld-agent-runtime-registry/1',
  'ld-portable-skill/2',
  'ld-agent-sandbox/1',
  'ld-native-agent-session/1',
  'ld-universal-agent-bench/1'
]) assert.ok(settings.includes(schema), `settings lost modern schema ${schema}`);

assert.ok(!exists('ui/multi-agent-runtime-v74.js'));
assert.ok(!exists('ui/multi-agent-runtime-v74.css'));

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build82-modern-engine-preservation/1',
  builds: Object.keys(builds).map(Number),
  preservedEnginePaths: preserved.length,
  sourceAssemblyEntries: sourceAssembly.length,
  activeEnginePaths: 0,
  canonicalActiveScript: 'launcher/launcher-runtime.js'
}, null, 2));
