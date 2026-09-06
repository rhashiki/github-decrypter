import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.aiProviderAuthority;
const violations = [];

function versionBuild(value) {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
}

if (
  !rule || policy.currentBuild < 33 || rule.minimumBuild !== 33 || policy.phaseGates?.aiProviderBuild !== 33
  || rule.contractPackage !== '@github-decrypter/ai' || rule.contractOnly !== true
) {
  violations.push({ code: 'AG310', message: 'Build 33 AI Provider API authority is missing, inactive or not contract-only.' });
} else {
  const manifest = json('packages/ai/package.json');
  const contract = read('packages/ai/src/index.ts');
  const packageRule = policy.packageRules?.['@github-decrypter/ai'];
  for (const marker of [
    'AI_PROVIDER_BUILD = 33',
    "AI_PROVIDER_SCHEMA = 'gd-ai-provider/1'",
    "AI_PROVIDER_MODEL_SCHEMA = 'gd-ai-provider-model/1'",
    "AI_PROVIDER_REQUEST_SCHEMA = 'gd-ai-provider-request/1'",
    "AI_PROVIDER_RESPONSE_SCHEMA = 'gd-ai-provider-response/1'",
    'AIProviderDescriptor',
    'AIProviderModelDescriptor',
    'AIProviderGenerateRequest',
    'AIProviderGenerateResult',
    'AIProviderAdapter',
    'assertExactKeys',
  ]) if (!contract.includes(marker)) violations.push({ code: 'AG311', message: 'AI Provider contract is incomplete.', detail: marker });
  if (manifest.name !== '@github-decrypter/ai' || versionBuild(manifest.version) === null || versionBuild(manifest.version) < 33) {
    violations.push({ code: 'AG311', message: '@github-decrypter/ai package identity/version is invalid.' });
  }
  if (!packageRule || packageRule.environmentNeutral !== true || JSON.stringify(packageRule.allowedWorkspaceDependencies ?? []) !== '[]') {
    violations.push({ code: 'AG311', message: '@github-decrypter/ai must remain dependency-free and environment-neutral.' });
  }
  if (/\bnode:|\bprocess\.|\bwindow\.|\bdocument\.|\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|https?:\/\//.test(contract)) {
    violations.push({ code: 'AG311', message: 'AI Provider contract gained environment-specific transport authority.' });
  }

  for (const marker of [
    "AI_PROVIDER_KINDS = ['local', 'external']",
    "AI_PROVIDER_CREDENTIAL_MODES = ['none', 'runtime-vault']",
    "row.kind === 'local' && row.credentialMode !== 'none'",
  ]) if (!contract.includes(marker)) violations.push({ code: 'AG312', message: 'AI Provider local-first/provider-kind boundary is incomplete.', detail: marker });
  if (
    rule.localFirstClass !== true || rule.externalProvidersOptional !== true || rule.mandatoryProvider !== null
    || JSON.stringify(rule.providerKinds) !== JSON.stringify(['local', 'external'])
  ) violations.push({ code: 'AG312', message: 'Machine policy no longer preserves local-first optional-provider behavior.' });

  for (const marker of [
    "assertExactKeys(row, ['schema', 'id', 'displayName', 'kind', 'credentialMode']",
    "assertExactKeys(row, ['schema', 'providerId', 'id', 'displayName', 'contextWindowTokens', 'maxOutputTokens']",
    "assertExactKeys(row, ['schema', 'providerId', 'modelId', 'messages', 'maxOutputTokens', 'temperature']",
    "assertExactKeys(row, ['schema', 'providerId', 'modelId', 'text', 'finishReason', 'usage']",
    'assertAIProviderGenerateResultForRequest',
  ]) if (!contract.includes(marker)) violations.push({ code: 'AG313', message: 'AI Provider public schema validation is not fail-closed.', detail: marker });
  if (/\b(?:apiKey|accessToken|authorization|bearerToken|rawResponse|requestHeaders|responseHeaders|baseUrl|endpointUrl)\b/.test(contract)) {
    violations.push({ code: 'AG313', message: 'AI Provider public contract exposes credential, transport or raw-provider fields.' });
  }
  if (rule.secretFields !== false || rule.rawProviderResponse !== false || rule.providerEndpointConfiguration !== false) {
    violations.push({ code: 'AG313', message: 'Machine policy permits public secret/raw-provider/endpoint transport.' });
  }

  for (const marker of [
    'listModels(): Promise<readonly AIProviderModelDescriptor[]>',
    'generate(request: AIProviderGenerateRequest): Promise<AIProviderGenerateResult>',
    'validateAIProviderModelList',
    'AI provider model belongs to a different provider',
    'AI provider model id is duplicated',
  ]) if (!contract.includes(marker)) violations.push({ code: 'AG314', message: 'AI Provider adapter/model ownership contract is incomplete.', detail: marker });
  if (/\b(?:openai|anthropic|gemini|ollama|vllm|qwen)\b/i.test(contract)) {
    violations.push({ code: 'AG314', message: 'Build 33 activated a provider/model-specific implementation inside the neutral contract.' });
  }

  const appManifests = ['apps/local/package.json', 'apps/studio/package.json', 'apps/extension/package.json'];
  for (const manifestPath of appManifests) {
    const appManifest = json(manifestPath);
    const blocks = [appManifest.dependencies, appManifest.devDependencies, appManifest.peerDependencies, appManifest.optionalDependencies].filter(Boolean);
    if (blocks.some((block) => Object.prototype.hasOwnProperty.call(block, '@github-decrypter/ai'))) {
      violations.push({ code: 'AG315', message: 'Build 33 crossed into active app AI execution authority.', detail: manifestPath });
    }
  }
  if (exists('apps/local/src/ai-provider-runtime.ts')) {
    violations.push({ code: 'AG315', message: 'Local AI runtime arrived before Build 34.', detail: 'apps/local/src/ai-provider-runtime.ts' });
  }
  for (const appRoot of ['apps/local/src', 'apps/studio/src', 'apps/extension/src']) {
    if (!exists(appRoot)) continue;
    const stack = [path.join(root, appRoot)];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(absolute);
        else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) && fs.readFileSync(absolute, 'utf8').includes("@github-decrypter/ai")) {
          violations.push({ code: 'AG315', message: 'Build 33 app source imports the AI provider contract before runtime activation.', detail: path.relative(root, absolute) });
        }
      }
    }
  }

  if (
    rule.runtimeExecution !== false || rule.directNetworkAuthority !== false || rule.promptPersistence !== false
    || rule.responsePersistence !== false || rule.providerConfigurationPersistence !== false || rule.studioTransport !== false
  ) violations.push({ code: 'AG316', message: 'Build 33 machine policy granted execution, network, persistence or Studio transport authority.' });

  if (
    rule.localAIRuntimeBuild !== 34 || rule.localAIInstallerBuild !== 35 || rule.modelManagerBuild !== 36
    || rule.modelRoutingBuild !== 37 || rule.conversationEngineBuild !== 44 || rule.toolRuntimeBuild !== 53
    || rule.agentRuntimeBuild !== 58
  ) violations.push({ code: 'AG317', message: 'AI Provider future roadmap authority boundaries drifted.' });

  const rootPackage = json('package.json');
  const localPackage = json('apps/local/package.json');
  const studioPackage = json('apps/studio/package.json');
  if (
    versionBuild(rootPackage.version) === null || versionBuild(rootPackage.version) < 33
    || policy.currentBuild === 33 && localPackage.version !== '0.0.32'
    || policy.currentBuild === 33 && studioPackage.version !== '0.0.32'
    || !rootPackage.scripts?.guardian?.includes('architecture-guardian-ai-provider.mjs')
    || !rootPackage.scripts?.['check:build33']?.includes('test-build33-ai-provider-api.mjs')
    || !rootPackage.scripts?.ci?.includes('check:build33')
  ) violations.push({ code: 'AG318', message: 'Build 33 root identity/scripts or contract-only app versions are inconsistent.' });

  for (const required of [
    'packages/ai/package.json',
    'packages/ai/src/index.ts',
    'docs/architecture/AI_PROVIDER_API.md',
    'docs/builds/BUILD_33_AI_PROVIDER_API.md',
    'scripts/architecture-guardian-ai-provider.mjs',
    'scripts/test-build33-ai-provider-api.mjs',
    'scripts/test-build33-ai-provider-api-runtime.ts',
    'scripts/test-build33-ai-provider-guardian-negative.mjs',
    'scripts/tsconfig.build33-tests.json',
    '.github/workflows/build33-ai-provider-api.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG319', message: 'Required Build 33 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-ai-provider-report/1',
  currentBuild: policy.currentBuild,
  contractSchema: rule?.schema ?? null,
  contractOnly: rule?.contractOnly ?? null,
  localFirstClass: rule?.localFirstClass ?? null,
  externalProvidersOptional: rule?.externalProvidersOptional ?? null,
  runtimeExecution: rule?.runtimeExecution ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
