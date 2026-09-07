import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.modelManagerAuthority;
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
  !rule || policy.currentBuild < 36 || rule.minimumBuild !== 36 || policy.phaseGates?.modelManagerBuild !== 36
  || rule.ownerRoot !== 'apps/local' || rule.contractPackage !== '@github-decrypter/ai'
  || rule.schema !== 'gd-local-ai-model-manager/1'
) {
  violations.push({ code: 'AG340', message: 'Build 36 Model Manager authority is missing or inactive.' });
} else {
  const manager = read('apps/local/src/ai-model-manager.ts');
  const installer = read('apps/local/src/ai-installer.ts');
  const runtime = read('apps/local/src/ai-runtime.ts');
  const daemon = read('apps/local/src/daemon.ts');
  const lifecycle = read('apps/local/src/lifecycle.ts');
  const identity = read('apps/local/src/identity.ts');
  const server = read('apps/local/src/server.ts');
  const localPackage = json('apps/local/package.json');
  const rootPackage = json('package.json');
  const identityBuild = sourceBuild(identity, /LOCAL_RUNTIME_BUILD = (\d+)/);
  const identityVersionBuild = sourceBuild(identity, /LOCAL_RUNTIME_VERSION = '0\.0\.(\d+)'/);

  if (
    localPackage.name !== '@github-decrypter/local' || versionBuild(localPackage.version) === null || versionBuild(localPackage.version) < 36
    || identityBuild === null || identityBuild < 36 || identityVersionBuild === null || identityVersionBuild < 36
    || localPackage.dependencies?.['@github-decrypter/ai'] !== 'workspace:*'
  ) violations.push({ code: 'AG341', message: 'Build 36 Local Runtime identity/dependency activation is inconsistent.' });

  for (const marker of [
    'LOCAL_AI_MODEL_MANAGER_BUILD = 36',
    "LOCAL_AI_MODEL_MANAGER_SCHEMA = 'gd-local-ai-model-manager/1'",
    "LOCAL_AI_MODEL_MUTATION_SCHEMA = 'gd-local-ai-model-mutation/1'",
    "'models.remove'",
    "'models.update'",
    "'default.get'",
    "'default.set'",
    "'default.clear'",
    'class LocalAIModelManager',
    'createLocalAIModelManager',
    'listManagers(',
    'listModels(',
    'removeModel(',
    'updateModel(',
    'getDefaultModel(',
    'setDefaultModel(',
    'clearDefaultModel(',
    "input.provider.kind !== 'local'",
    "input.provider.credentialMode !== 'none'",
    "modelId.includes('://')",
    'modelInventory: true',
    'modelRemoval: true',
    'modelUpdate: true',
    'defaultSelection: true',
    'defaultSelectionPersistence: false',
    'automaticRouting: false',
  ]) if (!manager.includes(marker)) violations.push({ code: 'AG342', message: 'Local AI Model Manager contract is incomplete.', detail: marker });
  if (
    rule.localOnly !== true || rule.constructionOnlyAdapters !== true || rule.adapterOwnedManagement !== true
    || rule.externalProviderManagement !== false || rule.arbitrarySourceUrl !== false
    || rule.modelInventory !== true || rule.modelRemoval !== true || rule.modelUpdate !== true || rule.defaultSelection !== true
    || JSON.stringify(rule.allowedOperations) !== JSON.stringify(['managers.list','models.list','models.remove','models.update','default.get','default.set','default.clear'])
    || JSON.stringify(rule.runtimeFamilies) !== JSON.stringify(['ollama-compatible','vllm-compatible','custom-local'])
  ) violations.push({ code: 'AG342', message: 'Build 36 machine policy does not preserve the Model Manager contract.' });

  for (const marker of [
    "capability: 'READ', resource: LOCAL_AI_MODEL_MANAGERS_RESOURCE",
    "capability: 'READ', resource: modelsResource(providerId)",
    "{ capability: 'WRITE', resource }",
    "{ capability: 'EXECUTE', resource }",
    "{ capability: 'DESTRUCTIVE', resource }",
    "requirements.push({ capability: 'NETWORK', resource })",
    "connectivity !== 'online'",
    "capability: 'WRITE', resource: LOCAL_AI_MODEL_DEFAULT_RESOURCE",
  ]) if (!manager.includes(marker)) violations.push({ code: 'AG343', message: 'Model Manager capability/offline boundary is incomplete.', detail: marker });
  if (
    rule.readCapability !== 'READ' || rule.writeCapability !== 'WRITE' || rule.executeCapability !== 'EXECUTE'
    || rule.destructiveCapability !== 'DESTRUCTIVE' || rule.networkCapability !== 'NETWORK'
    || rule.updateNetworkConditional !== true
  ) violations.push({ code: 'AG343', message: 'Build 36 capability policy drifted.' });

  if (/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\bEventSource\b|https?:\/\//.test(manager)) {
    violations.push({ code: 'AG344', message: 'Model Manager gained direct transport or embedded URL authority.' });
  }
  if (/secrets-vault|SecretsVault|\bSECRETS\b|database\.js|LocalDatabase|node:fs|node:child_process|spawn\s*\(|exec\s*\(/.test(manager)) {
    violations.push({ code: 'AG344', message: 'Model Manager gained secret, database, filesystem or process authority.' });
  }
  if (/\b(?:routeModel|routeByRole|automaticRoute|selectByRole|registerProvider|unregisterProvider)\b/.test(manager)) {
    violations.push({ code: 'AG344', message: 'Model Routing or provider registration authority arrived before Build 37.' });
  }
  if (/\b(?:openai|anthropic|gemini|qwen)\b/i.test(manager)) {
    violations.push({ code: 'AG344', message: 'Provider/model-specific implementation arrived in Build 36.' });
  }
  if (
    rule.defaultSelectionPersistence !== false || rule.automaticRouting !== false || rule.secretsAuthority !== false
    || rule.providerConfigurationPersistence !== false || rule.modelStatePersistence !== false
    || rule.directFilesystemAuthority !== false || rule.databaseAuthority !== false || rule.studioTransport !== false
    || rule.providerSpecificImplementation !== false
  ) violations.push({ code: 'AG344', message: 'Build 36 policy granted deferred or forbidden authority.' });

  for (const marker of [
    "import { createLocalAIModelManager, type LocalAIModelManager } from './ai-model-manager.js'",
    'readonly aiModelManager?: LocalAIModelManager;',
    'readonly #aiModelManager: LocalAIModelManager;',
    'createLocalAIModelManager({ capabilities: this.#capabilities, offline: this.#offline, eventBus: this.#eventBus',
    'await this.#aiModelManager.initialize()',
    'get aiModelManager(): LocalAIModelManager',
    'this.#aiModelManager.shutdown()',
    '#closeAIModelManagerBestEffort()',
  ]) if (!daemon.includes(marker)) violations.push({ code: 'AG345', message: 'Daemon Model Manager lifecycle integration is incomplete.', detail: marker });
  if (/\/v1\/(?:ai|models?|providers?|installers?|model-manager)/i.test(server) || server.includes('ai-model-manager')) {
    violations.push({ code: 'AG345', message: 'Build 36 exposed an unauthorized Studio/HTTP model-management transport.' });
  }

  for (const marker of [
    "'gd.local.ai-model-manager.ready'",
    "'gd.local.ai-model-manager.operation'",
    'networkRequired: boolean | null',
    'changed: boolean | null',
    'persistence: false',
  ]) if (!lifecycle.includes(marker) && !manager.includes(marker)) violations.push({ code: 'AG346', message: 'Model Manager sanitized event boundary is incomplete.', detail: marker });
  if (/LocalRuntimeAIModelManager(?:Ready|Operation)Payload[^;]*(?:path|sourceUrl|downloadUrl|endpointUrl|baseUrl|apiKey|secret|credential|raw)/i.test(lifecycle)) {
    violations.push({ code: 'AG346', message: 'Model Manager event catalog appears to expose sensitive/provider-owned fields.' });
  }

  if (
    rule.localAIRuntimeBuild !== 34 || rule.localAIInstallerBuild !== 35 || rule.modelRoutingBuild !== 37
    || policy.localAIRuntimeAuthority?.modelManagement !== false
    || policy.localAIInstallerAuthority?.modelRemoval !== false
    || policy.localAIInstallerAuthority?.modelUpdate !== false
    || policy.localAIInstallerAuthority?.defaultSelection !== false
  ) violations.push({ code: 'AG347', message: 'Build 36 ownership boundaries with Builds 34/35/37 drifted.' });
  if (/\b(?:removeModel|updateModel|setDefaultModel|clearDefaultModel|routeModel|selectByRole)\b/.test(runtime)) {
    violations.push({ code: 'AG347', message: 'Model management/routing authority leaked into the Build 34 runtime owner.' });
  }
  if (/\b(?:removeModel|updateModel|setDefaultModel|clearDefaultModel|routeModel|selectByRole)\b/.test(installer)) {
    violations.push({ code: 'AG347', message: 'Model management/routing authority leaked into the Build 35 installer owner.' });
  }

  if (
    versionBuild(rootPackage.version) === null || versionBuild(rootPackage.version) < 36
    || !rootPackage.scripts?.guardian?.includes('architecture-guardian-model-manager.mjs')
    || !rootPackage.scripts?.['check:build36']?.includes('test-build36-model-manager.mjs')
    || !rootPackage.scripts?.ci?.includes('check:build36')
  ) violations.push({ code: 'AG348', message: 'Build 36 root identity/scripts are inconsistent.' });

  for (const required of [
    'apps/local/src/ai-model-manager.ts',
    'docs/architecture/LOCAL_AI_MODEL_MANAGER.md',
    'docs/builds/BUILD_36_MODEL_MANAGER.md',
    'scripts/architecture-guardian-model-manager.mjs',
    'scripts/test-build36-model-manager.mjs',
    'scripts/test-build36-model-manager-runtime.ts',
    'scripts/test-build36-model-manager-guardian-negative.mjs',
    'scripts/tsconfig.build36-core-tests.json',
    '.github/workflows/build36-model-manager.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG349', message: 'Required Build 36 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-model-manager-report/1',
  currentBuild: policy.currentBuild,
  managerSchema: rule?.schema ?? null,
  inventory: rule?.modelInventory ?? null,
  removal: rule?.modelRemoval ?? null,
  update: rule?.modelUpdate ?? null,
  defaultSelection: rule?.defaultSelection ?? null,
  automaticRouting: rule?.automaticRouting ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);