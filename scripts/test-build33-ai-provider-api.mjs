import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const versionBuild = (value) => Number(/^0\.0\.(\d+)$/.exec(value)?.[1] ?? NaN);

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const aiPackage = json('packages/ai/package.json');
const contract = read('packages/ai/src/index.ts');

assert.ok(policy.currentBuild >= 33);
assert.equal(policy.phaseGates.aiProviderBuild, 33);
assert.equal(policy.aiProviderAuthority.minimumBuild, 33);
assert.equal(policy.aiProviderAuthority.contractPackage, '@github-decrypter/ai');
assert.equal(policy.aiProviderAuthority.contractOnly, true);
assert.equal(policy.aiProviderAuthority.localFirstClass, true);
assert.equal(policy.aiProviderAuthority.externalProvidersOptional, true);
assert.equal(policy.aiProviderAuthority.runtimeExecution, false);
assert.equal(policy.aiProviderAuthority.directNetworkAuthority, false);
assert.equal(policy.aiProviderAuthority.secretFields, false);
assert.equal(policy.aiProviderAuthority.rawProviderResponse, false);
assert.equal(policy.aiProviderAuthority.providerEndpointConfiguration, false);

assert.equal(aiPackage.name, '@github-decrypter/ai');
assert.ok(versionBuild(aiPackage.version) >= 33);
assert.deepEqual(policy.packageRules['@github-decrypter/ai'].allowedWorkspaceDependencies, []);
assert.equal(policy.packageRules['@github-decrypter/ai'].environmentNeutral, true);

for (const marker of [
  'AI_PROVIDER_BUILD = 33',
  "gd-ai-provider/1",
  "gd-ai-provider-model/1",
  "gd-ai-provider-request/1",
  "gd-ai-provider-response/1",
  'AIProviderAdapter',
  'listModels()',
  'generate(request: AIProviderGenerateRequest)',
  'assertExactKeys',
  'assertAIProviderGenerateResultForRequest',
]) assert.match(contract, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.doesNotMatch(contract, /\bnode:|\bprocess\.|\bwindow\.|\bdocument\.|\bfetch\s*\(|\bWebSocket\b|https?:\/\//);
assert.doesNotMatch(contract, /\b(?:apiKey|accessToken|authorization|bearerToken|rawResponse|baseUrl|endpointUrl)\b/);
assert.doesNotMatch(contract, /\b(?:openai|anthropic|gemini|ollama|vllm|qwen)\b/i);

const localManifest = json('apps/local/package.json');
const studioManifest = json('apps/studio/package.json');
const extensionManifest = json('apps/extension/package.json');
const localDependencies = { ...localManifest.dependencies, ...localManifest.devDependencies, ...localManifest.peerDependencies, ...localManifest.optionalDependencies };
const studioDependencies = { ...studioManifest.dependencies, ...studioManifest.devDependencies, ...studioManifest.peerDependencies, ...studioManifest.optionalDependencies };
const extensionDependencies = { ...extensionManifest.dependencies, ...extensionManifest.devDependencies, ...extensionManifest.peerDependencies, ...extensionManifest.optionalDependencies };
if (policy.currentBuild === 33) {
  assert.equal(localDependencies['@github-decrypter/ai'], undefined, 'Build 33 must remain contract-only.');
  assert.equal(fs.existsSync('apps/local/src/ai-runtime.ts'), false, 'Local AI Runtime must not exist before Build 34.');
} else {
  assert.equal(policy.phaseGates.localAIRuntimeBuild, 34);
  assert.equal(localDependencies['@github-decrypter/ai'], 'workspace:*', 'Build 34+ Local Runtime must consume the neutral AI contract.');
}
assert.equal(studioDependencies['@github-decrypter/ai'], undefined, 'Studio must not directly consume AI Provider API at this phase.');
assert.equal(extensionDependencies['@github-decrypter/ai'], undefined, 'Extension must not directly consume AI Provider API at this phase.');
assert.equal(fs.existsSync('apps/local/src/ai-provider-runtime.ts'), false);
assert.ok(versionBuild(rootPackage.version) >= 33);
assert.match(rootPackage.scripts.guardian, /architecture-guardian-ai-provider\.mjs/);
assert.match(rootPackage.scripts['check:build33'], /test-build33-ai-provider-api\.mjs/);
assert.match(rootPackage.scripts.ci, /check:build33/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build33-ai-provider-static/2',
  build: 33,
  contractOnly: true,
  localFirstClass: true,
  externalProvidersOptional: true,
  localRuntimeActivated: policy.currentBuild >= 34,
  directNetworkAuthority: false,
}, null, 2));
