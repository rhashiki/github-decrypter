import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createAIProviderDescriptor,
  createAIProviderModelDescriptor,
  type AIProviderModelDescriptor,
} from '../packages/ai/src/index.js';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  CapabilitySecurityAuthority,
  DurableJobEngine,
  LocalAIModelManager,
  LocalDatabase,
  LOCAL_AI_MODEL_DEFAULT_RESOURCE,
  LOCAL_AI_MODEL_MANAGER_SCHEMA,
  createLocalAIModelManagerDescriptor,
  type LocalAIManagedModelRequest,
  type LocalAIModelManagerAdapter,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';
import type { ConnectivityState } from '../apps/local/src/offline-execution.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build36-manager-'));
const now = () => '2026-09-07T11:30:00.000Z';

try {
  const database = new LocalDatabase({ path: join(tempRoot, 'runtime.sqlite3'), now });
  database.open();
  const jobs = new DurableJobEngine({ database, now });
  const capabilities = new CapabilitySecurityAuthority({
    database,
    now,
    processInstanceId: 'gd_process_build36_manager',
  });
  await capabilities.initialize();

  const provider = createAIProviderDescriptor({
    id: 'fake-local',
    displayName: 'Fake Local',
    kind: 'local',
    credentialMode: 'none',
  });
  const cachedProvider = createAIProviderDescriptor({
    id: 'fake-cache',
    displayName: 'Fake Cache',
    kind: 'local',
    credentialMode: 'none',
  });
  const externalProvider = createAIProviderDescriptor({
    id: 'external',
    displayName: 'External',
    kind: 'external',
    credentialMode: 'runtime-vault',
  });

  const modelA = createAIProviderModelDescriptor({
    providerId: provider.id,
    id: 'model-a:latest',
    displayName: 'Model A',
    contextWindowTokens: 32768,
    maxOutputTokens: 4096,
  });
  const modelB = createAIProviderModelDescriptor({
    providerId: cachedProvider.id,
    id: 'model-b:local',
    displayName: 'Model B',
    contextWindowTokens: 16384,
    maxOutputTokens: 2048,
  });

  const descriptor = createLocalAIModelManagerDescriptor({
    provider,
    runtimeFamily: 'ollama-compatible',
    updateNetworkRequired: true,
  });
  const cachedDescriptor = createLocalAIModelManagerDescriptor({
    provider: cachedProvider,
    runtimeFamily: 'custom-local',
    updateNetworkRequired: false,
  });

  assert.throws(() => createLocalAIModelManagerDescriptor({
    provider: externalProvider,
    runtimeFamily: 'custom-local',
    updateNetworkRequired: true,
  }), /only local providers/i);

  let primaryModels: AIProviderModelDescriptor[] = [modelA];
  let cachedModels: AIProviderModelDescriptor[] = [modelB];
  let removeCalls = 0;
  let updateCalls = 0;
  let cachedUpdateCalls = 0;

  const primaryAdapter: LocalAIModelManagerAdapter = Object.freeze({
    descriptor,
    async listInstalledModels() {
      return Object.freeze([...primaryModels]);
    },
    async removeModel(request: LocalAIManagedModelRequest) {
      removeCalls += 1;
      const before = primaryModels.length;
      primaryModels = primaryModels.filter((model) => model.id !== request.modelId);
      return Object.freeze({
        schema: 'gd-local-ai-model-mutation/1' as const,
        action: 'remove' as const,
        providerId: request.providerId,
        modelId: request.modelId,
        changed: primaryModels.length !== before,
      });
    },
    async updateModel(request: LocalAIManagedModelRequest) {
      updateCalls += 1;
      return Object.freeze({
        schema: 'gd-local-ai-model-mutation/1' as const,
        action: 'update' as const,
        providerId: request.providerId,
        modelId: request.modelId,
        changed: true,
      });
    },
  });

  const cachedAdapter: LocalAIModelManagerAdapter = Object.freeze({
    descriptor: cachedDescriptor,
    async listInstalledModels() {
      return Object.freeze([...cachedModels]);
    },
    async removeModel(request: LocalAIManagedModelRequest) {
      const before = cachedModels.length;
      cachedModels = cachedModels.filter((model) => model.id !== request.modelId);
      return Object.freeze({
        schema: 'gd-local-ai-model-mutation/1' as const,
        action: 'remove' as const,
        providerId: request.providerId,
        modelId: request.modelId,
        changed: cachedModels.length !== before,
      });
    },
    async updateModel(request: LocalAIManagedModelRequest) {
      cachedUpdateCalls += 1;
      return Object.freeze({
        schema: 'gd-local-ai-model-mutation/1' as const,
        action: 'update' as const,
        providerId: request.providerId,
        modelId: request.modelId,
        changed: true,
      });
    },
  });

  let connectivityState: ConnectivityState = 'online';
  const offline = { status: () => ({ ready: true, connectivity: connectivityState }) };

  assert.throws(
    () => new LocalAIModelManager({ capabilities, offline, adapters: [primaryAdapter, primaryAdapter] }),
    /duplicated/i,
  );

  const events: string[] = [];
  const eventBus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build36-manager-test' });
  eventBus.subscribe('gd.local.ai-model-manager.ready', (event) => { events.push(JSON.stringify(event.payload)); });
  eventBus.subscribe('gd.local.ai-model-manager.operation', (event) => { events.push(JSON.stringify(event.payload)); });

  const manager = new LocalAIModelManager({
    capabilities,
    offline,
    adapters: [primaryAdapter, cachedAdapter],
    eventBus,
    now,
  });
  const status = await manager.initialize();
  assert.equal(status.ready, true);
  assert.equal(status.schema, LOCAL_AI_MODEL_MANAGER_SCHEMA);
  assert.equal(status.registeredManagers, 2);
  assert.equal(status.modelInventory, true);
  assert.equal(status.modelRemoval, true);
  assert.equal(status.modelUpdate, true);
  assert.equal(status.defaultSelection, true);
  assert.equal(status.defaultSelectionPersistence, false);
  assert.equal(status.automaticRouting, false);
  assert.equal(status.modelStatePersistence, false);
  assert.equal(status.directFilesystemAuthority, false);

  const job = await jobs.enqueue({ kind: 'ai.local.manage', payload: null, maxAttempts: 1 });

  await assert.rejects(
    () => manager.listManagers({ jobId: job.id, token: 'invalid-token' }),
    /Capability authorization denied/i,
  );

  const managersRead = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [{ capability: 'READ', resource: 'gd://ai-model-manager/providers', match: 'prefix' }],
  });
  const managers = await manager.listManagers({ jobId: job.id, token: managersRead.token });
  assert.deepEqual(managers.map((entry) => entry.provider.id), ['fake-cache', 'fake-local']);

  const modelsRead = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [{ capability: 'READ', resource: 'gd://ai-model-manager/providers/fake-local/models', match: 'prefix' }],
  });
  const listed = await manager.listModels({ jobId: job.id, token: modelsRead.token, providerId: 'fake-local' });
  assert.deepEqual(listed.map((model) => model.id), ['model-a:latest']);

  const defaultWrite = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [{ capability: 'WRITE', resource: LOCAL_AI_MODEL_DEFAULT_RESOURCE, match: 'exact' }],
  });
  const selected = await manager.setDefaultModel({
    jobId: job.id,
    token: defaultWrite.token,
    providerId: 'fake-local',
    modelId: 'model-a:latest',
  });
  assert.deepEqual(selected, { providerId: 'fake-local', modelId: 'model-a:latest' });

  const defaultRead = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [{ capability: 'READ', resource: LOCAL_AI_MODEL_DEFAULT_RESOURCE, match: 'exact' }],
  });
  assert.deepEqual(await manager.getDefaultModel({ jobId: job.id, token: defaultRead.token }), selected);

  const modelResource = 'gd://ai-model-manager/providers/fake-local/models/model-a%3Alatest';
  const noDestructive = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [
      { capability: 'WRITE', resource: modelResource, match: 'exact' },
      { capability: 'EXECUTE', resource: modelResource, match: 'exact' },
    ],
  });
  await assert.rejects(
    () => manager.removeModel({ jobId: job.id, token: noDestructive.token, providerId: 'fake-local', modelId: 'model-a:latest' }),
    /Capability authorization denied/i,
  );
  assert.equal(removeCalls, 0);

  const destructive = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [
      { capability: 'WRITE', resource: modelResource, match: 'exact' },
      { capability: 'EXECUTE', resource: modelResource, match: 'exact' },
      { capability: 'DESTRUCTIVE', resource: modelResource, match: 'exact' },
    ],
  });
  const removed = await manager.removeModel({
    jobId: job.id,
    token: destructive.token,
    providerId: 'fake-local',
    modelId: 'model-a:latest',
  });
  assert.equal(removed.changed, true);
  assert.equal(removeCalls, 1);
  assert.equal(await manager.getDefaultModel({ jobId: job.id, token: defaultRead.token }), null);

  primaryModels = [modelA];
  const noNetwork = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [
      { capability: 'WRITE', resource: modelResource, match: 'exact' },
      { capability: 'EXECUTE', resource: modelResource, match: 'exact' },
    ],
  });
  await assert.rejects(
    () => manager.updateModel({ jobId: job.id, token: noNetwork.token, providerId: 'fake-local', modelId: 'model-a:latest' }),
    /Capability authorization denied/i,
  );
  assert.equal(updateCalls, 0);

  const networkUpdate = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [
      { capability: 'WRITE', resource: modelResource, match: 'exact' },
      { capability: 'EXECUTE', resource: modelResource, match: 'exact' },
      { capability: 'NETWORK', resource: modelResource, match: 'exact' },
    ],
  });
  const updated = await manager.updateModel({
    jobId: job.id,
    token: networkUpdate.token,
    providerId: 'fake-local',
    modelId: 'model-a:latest',
  });
  assert.equal(updated.changed, true);
  assert.equal(updateCalls, 1);

  connectivityState = 'offline';
  await assert.rejects(
    () => manager.updateModel({ jobId: job.id, token: networkUpdate.token, providerId: 'fake-local', modelId: 'model-a:latest' }),
    /requires online connectivity/i,
  );
  assert.equal(updateCalls, 1);

  const cachedResource = 'gd://ai-model-manager/providers/fake-cache/models/model-b%3Alocal';
  const cachedGrant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [
      { capability: 'WRITE', resource: cachedResource, match: 'exact' },
      { capability: 'EXECUTE', resource: cachedResource, match: 'exact' },
    ],
  });
  const cachedUpdate = await manager.updateModel({
    jobId: job.id,
    token: cachedGrant.token,
    providerId: 'fake-cache',
    modelId: 'model-b:local',
  });
  assert.equal(cachedUpdate.changed, true);
  assert.equal(cachedUpdateCalls, 1);

  await assert.rejects(
    () => manager.setDefaultModel({
      jobId: job.id,
      token: defaultWrite.token,
      providerId: 'fake-cache',
      modelId: 'https://example.com/model',
    }),
    /cannot be a URL/i,
  );

  await manager.clearDefaultModel({ jobId: job.id, token: defaultWrite.token });
  assert.equal(await manager.getDefaultModel({ jobId: job.id, token: defaultRead.token }), null);

  await new Promise<void>((resolve) => setImmediate(resolve));
  const eventText = events.join('\n');
  assert.equal(eventText.includes('https://'), false);
  assert.equal(eventText.includes('apiKey'), false);
  assert.equal(eventText.includes('secret'), false);
  assert.equal(eventText.includes(tempRoot), false);

  const managerTables = database.read((sqlite) => sqlite.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'gd_ai_model_manager%'
  `).all() as unknown as Array<{ name: string }>);
  assert.deepEqual(managerTables, []);

  manager.shutdown();
  assert.equal(manager.status().ready, false);
  await capabilities.shutdown('Build 36 manager verified');
  database.close();
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build36-model-manager-runtime/1',
  inventoryReadGated: true,
  removalRequiresDestructive: true,
  updateNetworkConditional: true,
  offlineNetworkUpdateRejected: true,
  offlineLocalUpdateAllowed: true,
  manualDefaultSelection: true,
  defaultClearedOnRemoval: true,
  persistence: false,
  automaticRouting: false,
}, null, 2));