import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const versionBuild = (value) => Number(/^0\.0\.(\d+)$/.exec(value)?.[1] ?? NaN);

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const localPackage = json('apps/local/package.json');
const runtime = read('apps/local/src/ai-runtime.ts');
const daemon = read('apps/local/src/daemon.ts');
const lifecycle = read('apps/local/src/lifecycle.ts');
const identity = read('apps/local/src/identity.ts');
const server = read('apps/local/src/server.ts');

assert.ok(policy.currentBuild >= 34);
assert.equal(policy.phaseGates.localAIRuntimeBuild, 34);
assert.equal(policy.localAIRuntimeAuthority.minimumBuild, 34);
assert.equal(policy.localAIRuntimeAuthority.contractPackage, '@github-decrypter/ai');
assert.equal(policy.localAIRuntimeAuthority.schema, 'gd-local-ai-runtime/1');
assert.equal(policy.localAIRuntimeAuthority.localOnly, true);
assert.equal(policy.localAIRuntimeAuthority.runtimeExecution, true);
assert.equal(policy.localAIRuntimeAuthority.externalProviderExecution, false);
assert.equal(policy.localAIRuntimeAuthority.networkAuthority, false);
assert.equal(policy.localAIRuntimeAuthority.secretsAuthority, false);
assert.equal(policy.localAIRuntimeAuthority.promptPersistence, false);
assert.equal(policy.localAIRuntimeAuthority.responsePersistence, false);
assert.equal(policy.localAIRuntimeAuthority.providerConfigurationPersistence, false);
assert.equal(policy.localAIRuntimeAuthority.automaticRouting, false);
assert.equal(policy.localAIRuntimeAuthority.modelInstallation, false);
assert.equal(policy.localAIRuntimeAuthority.modelManagement, false);
assert.deepEqual(policy.localAIRuntimeAuthority.allowedOperations, ['providers.list','models.list','generate']);

assert.equal(localPackage.version, '0.0.34');
assert.equal(localPackage.dependencies['@github-decrypter/ai'], 'workspace:*');
assert.ok(policy.appRules['@github-decrypter/local'].allowedWorkspaceDependencies.includes('@github-decrypter/ai'));
assert.match(identity, /LOCAL_RUNTIME_BUILD = 34/);
assert.match(identity, /LOCAL_RUNTIME_VERSION = '0\.0\.34'/);

for (const marker of [
  "LOCAL_AI_RUNTIME_BUILD = 34",
  "LOCAL_AI_RUNTIME_SCHEMA = 'gd-local-ai-runtime/1'",
  "LOCAL_AI_RUNTIME_OPERATIONS = ['providers.list', 'models.list', 'generate']",
  'LocalAIRuntimeStatus',
  'LocalAIRuntimeAuthorization',
  'createLocalAIRuntime',
  "descriptor.kind !== 'local'",
  "descriptor.credentialMode !== 'none'",
  "capability: 'READ'",
  "capability: 'EXECUTE'",
  'validateAIProviderModelList',
  'assertAIProviderGenerateResultForRequest',
  'constructionOnlyAdapters: true',
  'networkAuthority: false',
  'secretsAuthority: false',
  'automaticRouting: false',
]) assert.ok(runtime.includes(marker), `Local AI Runtime marker missing: ${marker}`);

assert.doesNotMatch(runtime, /\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|https?:\/\//);
assert.doesNotMatch(runtime, /SecretsVault|secrets-vault|\bSECRETS\b|LocalDatabase|database\.js|node:fs|node:child_process/);
assert.doesNotMatch(runtime, /\b(?:openai|anthropic|gemini|ollama|vllm|qwen)\b/i);
assert.doesNotMatch(runtime, /\b(?:installModel|downloadModel|removeModel|setDefaultModel|routeModel|selectModel|registerProvider|unregisterProvider)\b/);

for (const marker of [
  "createLocalAIRuntime, type LocalAIRuntime",
  'readonly aiRuntime?: LocalAIRuntime;',
  'readonly #aiRuntime: LocalAIRuntime;',
  'await this.#aiRuntime.initialize()',
  'get aiRuntime(): LocalAIRuntime',
  'this.#aiRuntime.shutdown()',
]) assert.ok(daemon.includes(marker), `Daemon Local AI integration marker missing: ${marker}`);
assert.ok(lifecycle.includes("'gd.local.ai-runtime.ready'"));
assert.ok(lifecycle.includes("'gd.local.ai-runtime.operation'"));
assert.doesNotMatch(server, /\/v1\/(?:ai|models?|providers?)/i);
assert.equal(server.includes('ai-runtime'), false);

assert.ok(versionBuild(rootPackage.version) >= 34);
assert.match(rootPackage.scripts.guardian, /architecture-guardian-local-ai-runtime\.mjs/);
assert.match(rootPackage.scripts['check:build34'], /test-build34-local-ai-runtime\.mjs/);
assert.match(rootPackage.scripts.ci, /check:build34/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build34-local-ai-runtime-static/1',
  build: 34,
  localOnly: true,
  capabilityGated: true,
  externalProviderExecution: false,
  networkAuthority: false,
  persistence: false,
  installerManagerRoutingDeferred: true,
}, null, 2));
