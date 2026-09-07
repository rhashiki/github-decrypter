import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const manager = read('apps/local/src/ai-model-manager.ts');
const daemon = read('apps/local/src/daemon.ts');
const lifecycle = read('apps/local/src/lifecycle.ts');
const index = read('apps/local/src/index.ts');

for (const marker of [
  'LOCAL_AI_MODEL_MANAGER_BUILD = 36',
  "LOCAL_AI_MODEL_MANAGER_SCHEMA = 'gd-local-ai-model-manager/1'",
  "LOCAL_AI_MODEL_MUTATION_SCHEMA = 'gd-local-ai-model-mutation/1'",
  "'models.remove'",
  "'models.update'",
  "'default.set'",
  'class LocalAIModelManager',
  'createLocalAIModelManager',
  'listManagers(',
  'listModels(',
  'removeModel(',
  'updateModel(',
  'getDefaultModel(',
  'setDefaultModel(',
  'clearDefaultModel(',
  "{ capability: 'DESTRUCTIVE', resource }",
  "requirements.push({ capability: 'NETWORK', resource })",
  "modelId.includes('://')",
  'modelRemoval: true',
  'modelUpdate: true',
  'defaultSelection: true',
  'defaultSelectionPersistence: false',
  'automaticRouting: false',
  'modelStatePersistence: false',
  'directFilesystemAuthority: false',
]) assert.ok(manager.includes(marker), `missing Build 36 marker: ${marker}`);

assert.ok(index.includes("export * from './ai-model-manager.js';"));
assert.ok(daemon.includes("createLocalAIModelManager"));
assert.ok(daemon.includes('await this.#aiModelManager.initialize()'));
assert.ok(daemon.includes('this.#aiModelManager.shutdown()'));
assert.ok(lifecycle.includes("'gd.local.ai-model-manager.ready'"));
assert.ok(lifecycle.includes("'gd.local.ai-model-manager.operation'"));

assert.doesNotMatch(manager, /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource)\b/);
assert.doesNotMatch(manager, /https?:\/\//);
assert.doesNotMatch(manager, /\b(?:SecretsVault|SECRETS|LocalDatabase|node:fs|node:child_process|spawn\s*\(|exec\s*\()\b/);
assert.doesNotMatch(manager, /\b(?:routeModel|routeByRole|automaticRoute|selectByRole)\b/);
assert.doesNotMatch(manager, /\b(?:openai|anthropic|gemini|qwen)\b/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build36-model-manager-static/1',
  build: 36,
  localOnly: true,
  inventory: true,
  destructiveRemoval: true,
  conditionalNetworkUpdate: true,
  manualDefaultSelection: true,
  defaultPersistence: false,
  automaticRouting: false,
}, null, 2));