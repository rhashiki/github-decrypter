import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.localAIModelRoutingAuthority;
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
  !rule || policy.currentBuild < 37 || rule.minimumBuild !== 37 || policy.phaseGates?.modelRoutingBuild !== 37
  || rule.ownerRoot !== 'apps/local' || rule.contractPackage !== '@github-decrypter/ai'
  || rule.schema !== 'gd-local-ai-model-routing/1'
) {
  violations.push({ code: 'AG350', message: 'Build 37 Model Routing authority is missing or inactive.' });
} else {
  const routing = read('apps/local/src/ai-model-routing.ts');
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
    localPackage.name !== '@github-decrypter/local' || versionBuild(localPackage.version) === null || versionBuild(localPackage.version) < 37
    || identityBuild === null || identityBuild < 37 || identityVersionBuild === null || identityVersionBuild < 37
    || localPackage.dependencies?.['@github-decrypter/ai'] !== 'workspace:*'
  ) violations.push({ code: 'AG351', message: 'Build 37 Local Runtime identity/dependency activation is inconsistent.' });

  for (const marker of [
    'LOCAL_AI_MODEL_ROUTING_BUILD = 37',
    "LOCAL_AI_MODEL_ROUTING_SCHEMA = 'gd-local-ai-model-routing/1'",
    "LOCAL_AI_MODEL_ROUTE_DECISION_SCHEMA = 'gd-local-ai-model-route-decision/1'",
    "LOCAL_AI_MODEL_ROUTING_OPERATIONS = ['routes.select']",
    "LOCAL_AI_MODEL_ROUTE_REASONS = ['preferred', 'default', 'fallback']",
    'class LocalAIModelRouting',
    'createLocalAIModelRouting',
    'selectRoute(',
    'automaticRouting: true',
    'deterministic: true',
    'decisionOnly: true',
    "modelId.includes('://')",
  ]) if (!routing.includes(marker)) violations.push({ code: 'AG352', message: 'Local AI Model Routing contract is incomplete.', detail: marker });
  if (
    rule.localOnly !== true || rule.deterministic !== true || rule.decisionOnly !== true || rule.automaticRouting !== true
    || rule.preferredSelection !== true || rule.manualDefaultPrecedence !== true || rule.deterministicFallback !== true
    || JSON.stringify(rule.allowedOperations) !== JSON.stringify(['routes.select'])
  ) violations.push({ code: 'AG352', message: 'Build 37 machine policy does not preserve deterministic decision-only routing.' });

  for (const marker of [
    "capability: 'READ', resource: LOCAL_AI_MODEL_ROUTE_SELECT_RESOURCE",
    'this.#modelManager.listManagers(input)',
    'this.#modelManager.listModels(',
    'this.#modelManager.getDefaultModel(input)',
  ]) if (!routing.includes(marker)) violations.push({ code: 'AG353', message: 'Model Routing capability/composed-manager boundary is incomplete.', detail: marker });
  if (rule.readCapability !== 'READ' || rule.composedManagerReadAuthorization !== true) {
    violations.push({ code: 'AG353', message: 'Build 37 routing authorization policy drifted.' });
  }

  if (/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\bEventSource\b|https?:\/\//.test(routing)) {
    violations.push({ code: 'AG354', message: 'Model Routing gained direct network or embedded URL authority.' });
  }
  if (/secrets-vault|SecretsVault|\bSECRETS\b|database\.js|LocalDatabase|node:fs|node:child_process|spawn\s*\(|exec\s*\(/.test(routing)) {
    violations.push({ code: 'AG354', message: 'Model Routing gained secret, database, filesystem or process authority.' });
  }
  if (/\b(?:installModel|removeModel|updateModel|setDefaultModel|clearDefaultModel|generate|registerProvider|unregisterProvider)\b/.test(routing)) {
    violations.push({ code: 'AG354', message: 'Model Routing gained installer, manager, execution or provider-registration authority.' });
  }
  if (/\b(?:openai|anthropic|gemini|ollama|vllm|qwen)\b/i.test(routing)) {
    violations.push({ code: 'AG354', message: 'Provider/model-specific implementation arrived in Build 37.' });
  }
  if (
    rule.runtimeExecution !== false || rule.modelInstallation !== false || rule.modelManagement !== false || rule.defaultMutation !== false
    || rule.externalProviderRouting !== false || rule.networkAuthority !== false || rule.secretsAuthority !== false
    || rule.routingPersistence !== false || rule.promptInspection !== false || rule.adaptiveRouting !== false
    || rule.studioTransport !== false || rule.filesystemAuthority !== false || rule.databaseAuthority !== false
    || rule.providerSpecificImplementation !== false
  ) violations.push({ code: 'AG354', message: 'Build 37 policy granted deferred or forbidden routing authority.' });

  for (const marker of [
    "import { createLocalAIModelRouting, type LocalAIModelRouting } from './ai-model-routing.js'",
    'readonly aiModelRouting?: LocalAIModelRouting;',
    'readonly #aiModelRouting: LocalAIModelRouting;',
    'createLocalAIModelRouting({ capabilities: this.#capabilities, modelManager: this.#aiModelManager',
    'await this.#aiModelRouting.initialize()',
    'get aiModelRouting(): LocalAIModelRouting',
    'this.#aiModelRouting.shutdown()',
    '#closeAIModelRoutingBestEffort()',
  ]) if (!daemon.includes(marker)) violations.push({ code: 'AG355', message: 'Daemon Model Routing lifecycle integration is incomplete.', detail: marker });
  if (/\/v1\/(?:ai|models?|providers?|routing|model-routing)/i.test(server) || server.includes('ai-model-routing')) {
    violations.push({ code: 'AG355', message: 'Build 37 exposed an unauthorized Studio/HTTP model-routing transport.' });
  }

  for (const marker of [
    "'gd.local.ai-model-routing.ready'",
    "'gd.local.ai-model-routing.operation'",
    'reason: LocalAIModelRouteReason | null',
    'candidatesConsidered: number',
    'persistence: false',
  ]) if (!lifecycle.includes(marker) && !routing.includes(marker)) violations.push({ code: 'AG356', message: 'Model Routing sanitized event boundary is incomplete.', detail: marker });
  if (/LocalRuntimeAIModelRouting(?:Ready|Operation)Payload[^;]*(?:prompt|messages|text|responseBody|raw|apiKey|secret|credential|path)/i.test(lifecycle)) {
    violations.push({ code: 'AG356', message: 'Model Routing event catalog appears to expose sensitive/content fields.' });
  }

  if (
    rule.localAIRuntimeBuild !== 34 || rule.localAIInstallerBuild !== 35 || rule.modelManagerBuild !== 36
    || policy.localAIRuntimeAuthority?.automaticRouting !== false
    || policy.localAIInstallerAuthority?.automaticRouting !== false
    || policy.modelManagerAuthority?.automaticRouting !== false
  ) violations.push({ code: 'AG357', message: 'Build 37 ownership boundaries with Builds 34–36 drifted.' });
  if (/\b(?:routeModel|selectRoute|automaticRoute|selectByRole)\b/.test(runtime)) {
    violations.push({ code: 'AG357', message: 'Routing authority leaked into the Build 34 runtime owner.' });
  }
  if (/\b(?:routeModel|selectRoute|automaticRoute|selectByRole)\b/.test(installer)) {
    violations.push({ code: 'AG357', message: 'Routing authority leaked into the Build 35 installer owner.' });
  }
  if (/\b(?:routeModel|selectRoute|automaticRoute|selectByRole)\b/.test(manager)) {
    violations.push({ code: 'AG357', message: 'Automatic routing authority leaked into the Build 36 manager owner.' });
  }

  if (
    versionBuild(rootPackage.version) === null || versionBuild(rootPackage.version) < 37
    || !rootPackage.scripts?.guardian?.includes('architecture-guardian-model-routing.mjs')
    || !rootPackage.scripts?.['check:build37']?.includes('test-build37-model-routing.mjs')
    || !rootPackage.scripts?.ci?.includes('check:build37')
  ) violations.push({ code: 'AG358', message: 'Build 37 root identity/scripts are inconsistent.' });

  for (const required of [
    'apps/local/src/ai-model-routing.ts',
    'docs/architecture/LOCAL_AI_MODEL_ROUTING.md',
    'docs/builds/BUILD_37_MODEL_ROUTING.md',
    'scripts/architecture-guardian-model-routing.mjs',
    'scripts/test-build37-model-routing.mjs',
    'scripts/test-build37-model-routing-runtime.ts',
    'scripts/test-build37-model-routing-guardian-negative.mjs',
    'scripts/tsconfig.build37-tests.json',
    '.github/workflows/build37-model-routing.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG359', message: 'Required Build 37 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-model-routing-report/1',
  currentBuild: policy.currentBuild,
  routingSchema: rule?.schema ?? null,
  automaticRouting: rule?.automaticRouting ?? null,
  deterministic: rule?.deterministic ?? null,
  decisionOnly: rule?.decisionOnly ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);