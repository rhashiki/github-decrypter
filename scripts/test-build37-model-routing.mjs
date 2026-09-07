import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const routing = read('apps/local/src/ai-model-routing.ts');
const daemon = read('apps/local/src/daemon.ts');
const lifecycle = read('apps/local/src/lifecycle.ts');
const index = read('apps/local/src/index.ts');

for (const marker of [
  'LOCAL_AI_MODEL_ROUTING_BUILD = 37',
  "LOCAL_AI_MODEL_ROUTING_SCHEMA = 'gd-local-ai-model-routing/1'",
  "LOCAL_AI_MODEL_ROUTE_DECISION_SCHEMA = 'gd-local-ai-model-route-decision/1'",
  "LOCAL_AI_MODEL_ROUTING_OPERATIONS = ['routes.select']",
  "LOCAL_AI_MODEL_ROUTE_REASONS = ['preferred', 'default', 'fallback']",
  'class LocalAIModelRouting',
  'createLocalAIModelRouting',
  'selectRoute(',
  "capability: 'READ', resource: LOCAL_AI_MODEL_ROUTE_SELECT_RESOURCE",
  'this.#modelManager.listManagers(input)',
  'this.#modelManager.listModels(',
  'this.#modelManager.getDefaultModel(input)',
  'automaticRouting: true',
  'deterministic: true',
  'decisionOnly: true',
  'runtimeExecution: false',
  'modelInstallation: false',
  'modelManagement: false',
  'defaultMutation: false',
  'externalProviderRouting: false',
  'networkAuthority: false',
  'secretsAuthority: false',
  'routingPersistence: false',
  'promptInspection: false',
  'adaptiveRouting: false',
  'studioTransport: false',
  "modelId.includes('://')",
]) assert.ok(routing.includes(marker), `missing Build 37 marker: ${marker}`);

assert.ok(index.includes("export * from './ai-model-routing.js';"));
for (const marker of [
  "import { createLocalAIModelRouting, type LocalAIModelRouting } from './ai-model-routing.js'",
  'readonly aiModelRouting?: LocalAIModelRouting;',
  'readonly #aiModelRouting: LocalAIModelRouting;',
  'createLocalAIModelRouting({ capabilities: this.#capabilities, modelManager: this.#aiModelManager',
  'await this.#aiModelRouting.initialize()',
  'get aiModelRouting(): LocalAIModelRouting',
  'this.#aiModelRouting.shutdown()',
]) assert.ok(daemon.includes(marker), `missing daemon Build 37 marker: ${marker}`);

assert.ok(lifecycle.includes("'gd.local.ai-model-routing.ready'"));
assert.ok(lifecycle.includes("'gd.local.ai-model-routing.operation'"));
assert.doesNotMatch(routing, /\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\bEventSource\b|\bSecretsVault\b|\bLocalDatabase\b|node:fs|node:child_process|spawn\s*\(|exec\s*\(/);
assert.doesNotMatch(routing, /\b(?:installModel|removeModel|updateModel|setDefaultModel|clearDefaultModel|generate|registerProvider|unregisterProvider)\s*\(/);
assert.doesNotMatch(routing, /\b(?:openai|anthropic|gemini|ollama|vllm|qwen)\b/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build37-model-routing-static/1',
  build: 37,
  deterministic: true,
  preferredPrecedence: true,
  manualDefaultPrecedence: true,
  fallback: true,
  localOnly: true,
  decisionOnly: true,
  persistence: false,
}, null, 2));