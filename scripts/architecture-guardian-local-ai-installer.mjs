import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.localAIInstallerAuthority;
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
  !rule || policy.currentBuild < 35 || rule.minimumBuild !== 35 || policy.phaseGates?.localAIInstallerBuild !== 35
  || rule.ownerRoot !== 'apps/local' || rule.contractPackage !== '@github-decrypter/ai'
  || rule.schema !== 'gd-local-ai-installer/1'
) {
  violations.push({ code: 'AG330', message: 'Build 35 Local AI Installer authority is missing or inactive.' });
} else {
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
    localPackage.name !== '@github-decrypter/local' || versionBuild(localPackage.version) === null || versionBuild(localPackage.version) < 35
    || identityBuild === null || identityBuild < 35 || identityVersionBuild === null || identityVersionBuild < 35
    || localPackage.dependencies?.['@github-decrypter/ai'] !== 'workspace:*'
  ) violations.push({ code: 'AG331', message: 'Build 35 Local Runtime identity/dependency activation is inconsistent.' });

  for (const marker of [
    'LOCAL_AI_INSTALLER_BUILD = 35',
    "LOCAL_AI_INSTALLER_SCHEMA = 'gd-local-ai-installer/1'",
    "LOCAL_AI_INSTALL_RESULT_SCHEMA = 'gd-local-ai-install-result/1'",
    "LOCAL_AI_INSTALLER_OPERATIONS = ['installers.list', 'models.install']",
    "LOCAL_AI_RUNTIME_FAMILIES = ['ollama-compatible', 'vllm-compatible', 'custom-local']",
    'class LocalAIInstaller',
    'createLocalAIInstaller',
    'listInstallers(',
    'installModel(',
    "input.provider.kind !== 'local'",
    "input.provider.credentialMode !== 'none'",
    "row.provider.kind !== 'local'",
    "row.provider.credentialMode !== 'none'",
    "modelId.includes('://')",
    'constructionOnlyAdapters: true',
    'modelInstallation: true',
    'modelRemoval: false',
    'modelUpdate: false',
    'defaultSelection: false',
    'automaticRouting: false',
  ]) if (!installer.includes(marker)) violations.push({ code: 'AG332', message: 'Local AI Installer contract is incomplete.', detail: marker });
  if (
    rule.localOnly !== true || rule.constructionOnlyAdapters !== true || rule.adapterOwnedInstallation !== true
    || rule.externalProviderInstallation !== false || rule.arbitrarySourceUrl !== false
    || JSON.stringify(rule.allowedOperations) !== JSON.stringify(['installers.list','models.install'])
    || JSON.stringify(rule.runtimeFamilies) !== JSON.stringify(['ollama-compatible','vllm-compatible','custom-local'])
  ) violations.push({ code: 'AG332', message: 'Build 35 machine policy does not preserve the installer contract.' });

  for (const marker of [
    "capability: 'READ', resource: LOCAL_AI_INSTALLERS_RESOURCE",
    "{ capability: 'WRITE', resource }",
    "{ capability: 'EXECUTE', resource }",
    "requirements.push({ capability: 'NETWORK', resource })",
    "connectivity !== 'online'",
  ]) if (!installer.includes(marker)) violations.push({ code: 'AG333', message: 'Local AI Installer capability/offline boundary is incomplete.', detail: marker });
  if (
    rule.readCapability !== 'READ' || rule.writeCapability !== 'WRITE' || rule.executeCapability !== 'EXECUTE'
    || rule.networkCapability !== 'NETWORK' || rule.networkConditional !== true
  ) violations.push({ code: 'AG333', message: 'Build 35 capability policy drifted.' });

  if (/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\bEventSource\b|https?:\/\//.test(installer)) {
    violations.push({ code: 'AG334', message: 'Local AI Installer gained direct transport or embedded URL authority.' });
  }
  if (/secrets-vault|SecretsVault|\bSECRETS\b|database\.js|LocalDatabase|node:fs|node:child_process|spawn\s*\(|exec\s*\(/.test(installer)) {
    violations.push({ code: 'AG334', message: 'Local AI Installer gained secret, database, filesystem or process authority.' });
  }
  if (/\b(?:removeModel|deleteModel|updateModel|setDefaultModel|routeModel|selectModel|registerProvider|unregisterProvider)\b/.test(installer)) {
    violations.push({ code: 'AG334', message: 'Model Manager or Routing authority arrived before Builds 36–37.' });
  }
  if (/\b(?:openai|anthropic|gemini|qwen)\b/i.test(installer)) {
    violations.push({ code: 'AG334', message: 'Provider/model-specific implementation arrived in Build 35.' });
  }
  if (
    rule.secretsAuthority !== false || rule.providerConfigurationPersistence !== false || rule.modelStatePersistence !== false
    || rule.directFilesystemAuthority !== false || rule.databaseAuthority !== false || rule.studioTransport !== false
    || rule.modelRemoval !== false || rule.modelUpdate !== false || rule.defaultSelection !== false
    || rule.automaticRouting !== false || rule.providerSpecificImplementation !== false
  ) violations.push({ code: 'AG334', message: 'Build 35 policy granted deferred authority.' });

  for (const marker of [
    "import { createLocalAIInstaller, type LocalAIInstaller } from './ai-installer.js'",
    'readonly aiInstaller?: LocalAIInstaller;',
    'readonly #aiInstaller: LocalAIInstaller;',
    'createLocalAIInstaller({ capabilities: this.#capabilities, offline: this.#offline, eventBus: this.#eventBus',
    'await this.#aiInstaller.initialize()',
    'get aiInstaller(): LocalAIInstaller',
    'this.#aiInstaller.shutdown()',
    '#closeAIInstallerBestEffort()',
  ]) if (!daemon.includes(marker)) violations.push({ code: 'AG335', message: 'Daemon Local AI Installer lifecycle integration is incomplete.', detail: marker });
  if (/\/v1\/(?:ai|models?|providers?|installers?)/i.test(server) || server.includes('ai-installer')) {
    violations.push({ code: 'AG335', message: 'Build 35 exposed an unauthorized Studio/HTTP installer transport.' });
  }

  for (const marker of [
    "'gd.local.ai-installer.ready'",
    "'gd.local.ai-installer.operation'",
    'networkRequired: boolean | null',
    'reused: boolean | null',
    'persistence: false',
  ]) if (!lifecycle.includes(marker) && !installer.includes(marker)) violations.push({ code: 'AG336', message: 'Local AI Installer sanitized event boundary is incomplete.', detail: marker });
  if (/LocalRuntimeAIInstaller(?:Ready|Operation)Payload[^;]*(?:sourceUrl|downloadUrl|endpointUrl|baseUrl|apiKey|secret|credential|raw)/i.test(lifecycle)) {
    violations.push({ code: 'AG336', message: 'Installer event catalog appears to expose sensitive transport/configuration fields.' });
  }

  if (
    rule.localAIRuntimeBuild !== 34 || rule.modelManagerBuild !== 36 || rule.modelRoutingBuild !== 37
    || policy.localAIRuntimeAuthority?.modelInstallation !== false
  ) violations.push({ code: 'AG337', message: 'Build 35 ownership boundaries with Builds 34/36/37 drifted.' });
  if (/\b(?:installModel|downloadModel|removeModel|setDefaultModel|routeModel|selectModel)\b/.test(runtime)) {
    violations.push({ code: 'AG337', message: 'Installer/manager/routing authority leaked into the Build 34 runtime owner.' });
  }

  if (
    versionBuild(rootPackage.version) === null || versionBuild(rootPackage.version) < 35
    || !rootPackage.scripts?.guardian?.includes('architecture-guardian-local-ai-installer.mjs')
    || !rootPackage.scripts?.['check:build35']?.includes('test-build35-local-ai-installer-core.mjs')
    || !rootPackage.scripts?.ci?.includes('check:build35')
  ) violations.push({ code: 'AG338', message: 'Build 35 root identity/scripts are inconsistent.' });

  for (const required of [
    'apps/local/src/ai-installer.ts',
    'docs/architecture/LOCAL_AI_INSTALLER.md',
    'docs/builds/BUILD_35_LOCAL_AI_INSTALLER.md',
    'scripts/architecture-guardian-local-ai-installer.mjs',
    'scripts/test-build35-local-ai-installer-core.mjs',
    'scripts/test-build35-local-ai-installer-core-runtime.ts',
    'scripts/test-build35-local-ai-installer-guardian-negative.mjs',
    'scripts/tsconfig.build35-core-tests.json',
    '.github/workflows/build35-local-ai-installer.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG339', message: 'Required Build 35 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-local-ai-installer-report/1',
  currentBuild: policy.currentBuild,
  installerSchema: rule?.schema ?? null,
  localOnly: rule?.localOnly ?? null,
  networkConditional: rule?.networkConditional ?? null,
  modelInstallation: rule?.modelInstallation ?? null,
  modelManagementDeferred: rule?.modelRemoval === false && rule?.modelUpdate === false,
  automaticRouting: rule?.automaticRouting ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
