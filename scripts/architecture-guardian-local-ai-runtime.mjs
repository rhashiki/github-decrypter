import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.localAIRuntimeAuthority;
const violations = [];

const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};
const sourceBuild = (source, pattern) => {
  const match = source.match(pattern);
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 34 || rule.minimumBuild !== 34 || policy.phaseGates?.localAIRuntimeBuild !== 34
  || rule.ownerRoot !== 'apps/local' || rule.contractPackage !== '@github-decrypter/ai'
  || rule.schema !== 'gd-local-ai-runtime/1'
) {
  violations.push({ code: 'AG320', message: 'Build 34 Local AI Runtime authority is missing or inactive.' });
} else {
  const runtime = read('apps/local/src/ai-runtime.ts');
  const daemon = read('apps/local/src/daemon.ts');
  const lifecycle = read('apps/local/src/lifecycle.ts');
  const identity = read('apps/local/src/identity.ts');
  const server = read('apps/local/src/server.ts');
  const localPackage = json('apps/local/package.json');
  const rootPackage = json('package.json');
  const appRule = policy.appRules?.['@github-decrypter/local'];
  const identityBuild = sourceBuild(identity, /LOCAL_RUNTIME_BUILD = (\d+)/);
  const identityVersionBuild = sourceBuild(identity, /LOCAL_RUNTIME_VERSION = '0\.0\.(\d+)'/);

  if (
    localPackage.name !== '@github-decrypter/local' || versionBuild(localPackage.version) === null || versionBuild(localPackage.version) < 34
    || localPackage.dependencies?.['@github-decrypter/ai'] !== 'workspace:*'
    || !appRule?.allowedWorkspaceDependencies?.includes('@github-decrypter/ai')
    || identityBuild === null || identityBuild < 34 || identityVersionBuild === null || identityVersionBuild < 34
  ) violations.push({ code: 'AG321', message: 'Local Runtime identity/dependency activation is inconsistent.' });

  for (const marker of [
    "LOCAL_AI_RUNTIME_BUILD = 34",
    "LOCAL_AI_RUNTIME_SCHEMA = 'gd-local-ai-runtime/1'",
    "LOCAL_AI_RUNTIME_OPERATIONS = ['providers.list', 'models.list', 'generate']",
    'class LocalAIRuntime',
    'createLocalAIRuntime',
    'listProviders(',
    'listModels(',
    'generate(',
    "descriptor.kind !== 'local'",
    "descriptor.credentialMode !== 'none'",
    'constructionOnlyAdapters: true',
  ]) if (!runtime.includes(marker)) violations.push({ code: 'AG322', message: 'Local-only adapter runtime contract is incomplete.', detail: marker });
  if (
    rule.localOnly !== true || rule.constructionOnlyAdapters !== true || rule.runtimeExecution !== true
    || rule.externalProviderExecution !== false || JSON.stringify(rule.allowedOperations) !== JSON.stringify(['providers.list','models.list','generate'])
  ) violations.push({ code: 'AG322', message: 'Machine policy does not preserve local-only construction-time adapter execution.' });

  for (const marker of [
    "capability: 'READ', resource: LOCAL_AI_PROVIDERS_RESOURCE",
    "capability: 'READ', resource: modelsResource(providerId)",
    "capability: 'EXECUTE', resource: modelResource(request.providerId, request.modelId)",
  ]) if (!runtime.includes(marker)) violations.push({ code: 'AG323', message: 'Local AI Runtime capability boundary is incomplete.', detail: marker });
  if (rule.readCapability !== 'READ' || rule.executeCapability !== 'EXECUTE') {
    violations.push({ code: 'AG323', message: 'Local AI Runtime capability policy drifted.' });
  }

  if (/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\bEventSource\b|https?:\/\//.test(runtime)) {
    violations.push({ code: 'AG324', message: 'Local AI Runtime gained direct network transport.' });
  }
  if (/secrets-vault|SecretsVault|\bSECRETS\b|database\.js|LocalDatabase|node:fs|node:child_process|spawn\s*\(|exec\s*\(/.test(runtime)) {
    violations.push({ code: 'AG324', message: 'Local AI Runtime gained secret, persistence, filesystem or process authority.' });
  }
  if (/\b(?:openai|anthropic|gemini|ollama|vllm|qwen)\b/i.test(runtime)) {
    violations.push({ code: 'AG324', message: 'Provider/model-specific implementation arrived in Build 34.' });
  }
  if (/\b(?:installModel|downloadModel|removeModel|setDefaultModel|routeModel|selectModel|registerProvider|unregisterProvider)\b/.test(runtime)) {
    violations.push({ code: 'AG324', message: 'Installer, model-manager or routing authority leaked into the Build 34 runtime owner.' });
  }
  if (
    rule.networkAuthority !== false || rule.secretsAuthority !== false || rule.promptPersistence !== false
    || rule.responsePersistence !== false || rule.providerConfigurationPersistence !== false
    || rule.filesystemAuthority !== false || rule.databaseAuthority !== false
    || rule.modelInstallation !== false || rule.modelManagement !== false || rule.automaticRouting !== false
    || rule.providerSpecificImplementation !== false
  ) violations.push({ code: 'AG324', message: 'Build 34 machine policy granted deferred authority.' });

  for (const marker of [
    "import { createLocalAIRuntime, type LocalAIRuntime } from './ai-runtime.js'",
    'readonly aiRuntime?: LocalAIRuntime;',
    'readonly #aiRuntime: LocalAIRuntime;',
    'createLocalAIRuntime({ capabilities: this.#capabilities',
    'await this.#aiRuntime.initialize()',
    'get aiRuntime(): LocalAIRuntime',
    'this.#aiRuntime.shutdown()',
  ]) if (!daemon.includes(marker)) violations.push({ code: 'AG325', message: 'Daemon lifecycle integration is incomplete.', detail: marker });
  if (/\/v1\/(?:ai|models?|providers?)/i.test(server) || server.includes('ai-runtime')) {
    violations.push({ code: 'AG325', message: 'Build 34 exposed an unauthorized Studio/HTTP AI transport.' });
  }
  if (rule.studioTransport !== false) violations.push({ code: 'AG325', message: 'Studio AI transport arrived before its owning phase.' });

  for (const marker of [
    "'gd.local.ai-runtime.ready'",
    "'gd.local.ai-runtime.operation'",
    'promptPersistence: false',
    'responsePersistence: false',
  ]) if (!lifecycle.includes(marker) && !runtime.includes(marker)) violations.push({ code: 'AG326', message: 'Local AI Runtime sanitized event boundary is incomplete.', detail: marker });
  if (/LocalRuntimeAIRuntime(?:Ready|Operation)Payload[^;]*(?:prompt|messages|text|responseBody|raw)/i.test(lifecycle)) {
    violations.push({ code: 'AG326', message: 'AI Runtime event catalog appears to expose prompt/response content.' });
  }

  if (
    rule.localAIInstallerBuild !== 35 || rule.modelManagerBuild !== 36 || rule.modelRoutingBuild !== 37
    || rule.conversationEngineBuild !== 44
  ) violations.push({ code: 'AG327', message: 'Build 34 future AI authority boundaries drifted.' });

  if (
    versionBuild(rootPackage.version) === null || versionBuild(rootPackage.version) < 34
    || !rootPackage.scripts?.guardian?.includes('architecture-guardian-local-ai-runtime.mjs')
    || !rootPackage.scripts?.['check:build34']?.includes('test-build34-local-ai-runtime.mjs')
    || !rootPackage.scripts?.ci?.includes('check:build34')
  ) violations.push({ code: 'AG328', message: 'Build 34 root identity/scripts are inconsistent.' });

  for (const required of [
    'apps/local/src/ai-runtime.ts',
    'docs/architecture/LOCAL_AI_RUNTIME.md',
    'docs/builds/BUILD_34_LOCAL_AI_RUNTIME.md',
    'scripts/architecture-guardian-local-ai-runtime.mjs',
    'scripts/test-build34-local-ai-runtime.mjs',
    'scripts/test-build34-local-ai-runtime-runtime.ts',
    'scripts/test-build34-local-ai-runtime-guardian-negative.mjs',
    'scripts/tsconfig.build34-tests.json',
    '.github/workflows/build34-local-ai-runtime.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG329', message: 'Required Build 34 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-local-ai-runtime-report/1',
  currentBuild: policy.currentBuild,
  runtimeSchema: rule?.schema ?? null,
  localOnly: rule?.localOnly ?? null,
  runtimeExecution: rule?.runtimeExecution ?? null,
  networkAuthority: rule?.networkAuthority ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
