import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const installer = read('apps/local/src/ai-installer.ts');
const index = read('apps/local/src/index.ts');

for (const marker of [
  "LOCAL_AI_INSTALLER_BUILD = 35",
  "LOCAL_AI_INSTALLER_SCHEMA = 'gd-local-ai-installer/1'",
  "LOCAL_AI_INSTALL_RESULT_SCHEMA = 'gd-local-ai-install-result/1'",
  "LOCAL_AI_INSTALLER_OPERATIONS = ['installers.list', 'models.install']",
  "LOCAL_AI_RUNTIME_FAMILIES = ['ollama-compatible', 'vllm-compatible', 'custom-local']",
  'class LocalAIInstaller',
  'createLocalAIInstaller',
  'listInstallers(',
  'installModel(',
  "capability: 'READ'",
  "capability: 'WRITE'",
  "capability: 'EXECUTE'",
  "capability: 'NETWORK'",
  'modelInstallation: true',
  'modelRemoval: false',
  'modelUpdate: false',
  'defaultSelection: false',
  'automaticRouting: false',
  'arbitrarySourceUrl: false',
  'secretsAuthority: false',
  'providerConfigurationPersistence: false',
  'modelStatePersistence: false',
  'studioTransport: false',
  'readonly providerId: string;',
  'readonly modelId: string;',
]) assert.ok(installer.includes(marker), `missing Build 35 marker: ${marker}`);

assert.ok(index.includes("export * from './ai-installer.js';"));
assert.doesNotMatch(installer, /\b(?:SecretsVault|SECRETS|LocalDatabase|node:fs|node:child_process|spawn\s*\(|exec\s*\(|WebSocket|XMLHttpRequest|EventSource)\b/);
assert.doesNotMatch(installer, /https?:\/\//);
assert.doesNotMatch(installer, /\b(?:removeModel|deleteModel|updateModel|setDefaultModel|routeModel|selectModel)\b/);
assert.doesNotMatch(installer, /\b(?:sourceUrl|downloadUrl|endpointUrl|baseUrl|apiKey|credentialValue|secretValue)\s*\??:/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build35-local-ai-installer-core-static/1',
  build: 35,
  providerNeutral: true,
  ollamaVllmCompatibleFamilies: true,
  explicitInstallOnly: true,
  arbitrarySourceUrl: false,
  secretsAuthority: false,
  modelManagement: false,
  automaticRouting: false,
}, null, 2));