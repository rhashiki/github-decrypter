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
  LocalAIModelRouting,
  LocalDatabase,
  LOCAL_AI_MODEL_DEFAULT_RESOURCE,
  LOCAL_AI_MODEL_ROUTING_SCHEMA,
  createLocalAIModelManagerDescriptor,
  type LocalAIManagedModelRequest,
  type LocalAIModelManagerAdapter,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build37-routing-'));
const now = () => '2026-09-07T12:00:00.000Z';

try {
  const database = new LocalDatabase({ path: join(tempRoot, 'runtime.sqlite3'), now });
  database.open();
  const jobs = new DurableJobEngine({ database, now });
  const capabilities = new CapabilitySecurityAuthority({
    database,
    now,
    processInstanceId: 'gd_process_build37_routing',
  });
  await capabilities.initialize();

  const providerA = createAIProviderDescriptor({ id: 'alpha-local', displayName: 'Alpha Local', kind: 'local', credentialMode: 'none' });
  const providerZ = createAIProviderDescriptor({ id: 'zeta-local', displayName: 'Zeta Local', kind: 'local', credentialMode: 'none' });
  const modelA = createAIProviderModelDescriptor({ providerId: providerA.id, id: 'model-a:latest', displayName: 'Model A', contextWindowTokens: 32768, maxOutputTokens: 4096 });
  const modelZ = createAIProviderModelDescriptor({ providerId: providerZ.id, id: 'model-z:latest', displayName: 'Model Z', contextWindowTokens: 16384, maxOutputTokens: 2048 });

  let alphaModels: AIProviderModelDescriptor[] = [modelA];
  let zetaModels: AIProviderModelDescriptor[] = [modelZ];

  const createAdapter = (
    provider: typeof providerA,
    models: () => AIProviderModelDescriptor[],
  ): LocalAIModelManagerAdapter => Object.freeze({
    descriptor: createLocalAIModelManagerDescriptor({ provider, runtimeFamily: 'custom-local', updateNetworkRequired: false }),
    async listInstalledModels() { return Object.freeze([...models()]); },
    async removeModel(request: LocalAIManagedModelRequest) {
      return Object.freeze({ schema: 'gd-local-ai-model-mutation/1' as const, action: 'remove' as const, providerId: request.providerId, modelId: request.modelId, changed: false });
    },
    async updateModel(request: LocalAIManagedModelRequest) {
      return Object.freeze({ schema: 'gd-local-ai-model-mutation/1' as const, action: 'update' as const, providerId: request.providerId, modelId: request.modelId, changed: false });
    },
  });

  const offline = { status: () => ({ ready: true, connectivity: 'online' as const }) };
  const events: string[] = [];
  const eventBus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build37-routing-test' });
  eventBus.subscribe('gd.local.ai-model-routing.ready', (event) => { events.push(JSON.stringify(event.payload)); });
  eventBus.subscribe('gd.local.ai-model-routing.operation', (event) => { events.push(JSON.stringify(event.payload)); });

  const manager = new LocalAIModelManager({
    capabilities,
    offline,
    adapters: [createAdapter(providerZ, () => zetaModels), createAdapter(providerA, () => alphaModels)],
    eventBus,
    now,
  });
  await manager.initialize();

  const routing = new LocalAIModelRouting({ capabilities, modelManager: manager, eventBus, now });
  const status = await routing.initialize();
  assert.equal(status.ready, true);
  assert.equal(status.schema, LOCAL_AI_MODEL_ROUTING_SCHEMA);
  assert.equal(status.automaticRouting, true);
  assert.equal(status.deterministic, true);
  assert.equal(status.localOnly, true);
  assert.equal(status.decisionOnly, true);
  assert.equal(status.runtimeExecution, false);
  assert.equal(status.modelInstallation, false);
  assert.equal(status.modelManagement, false);
  assert.equal(status.defaultMutation, false);
  assert.equal(status.externalProviderRouting, false);
  assert.equal(status.networkAuthority, false);
  assert.equal(status.secretsAuthority, false);
  assert.equal(status.routingPersistence, false);
  assert.equal(status.promptInspection, false);
  assert.equal(status.adaptiveRouting, false);
  assert.equal(status.studioTransport, false);

  const job = await jobs.enqueue({ kind: 'ai.local.route', payload: null, maxAttempts: 1 });

  await assert.rejects(
    () => routing.selectRoute({ jobId: job.id, token: 'invalid-token' }),
    /Capability authorization denied/i,
  );

  const routingOnlyGrant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [{ capability: 'READ', resource: 'gd://ai-model-routing', match: 'prefix' }],
  });
  await assert.rejects(
    () => routing.selectRoute({ jobId: job.id, token: routingOnlyGrant.token }),
    /Capability authorization denied/i,
  );

  const readGrant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [
      { capability: 'READ', resource: 'gd://ai-model-routing', match: 'prefix' },
      { capability: 'READ', resource: 'gd://ai-model-manager', match: 'prefix' },
    ],
  });

  const fallback = await routing.selectRoute({ jobId: job.id, token: readGrant.token });
  assert.deepEqual(fallback, {
    schema: 'gd-local-ai-model-route-decision/1',
    providerId: 'alpha-local',
    modelId: 'model-a:latest',
    reason: 'fallback',
    candidatesConsidered: 2,
    deterministic: true,
    localOnly: true,
  });

  const defaultWriteGrant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [{ capability: 'WRITE', resource: LOCAL_AI_MODEL_DEFAULT_RESOURCE, match: 'exact' }],
  });
  await manager.setDefaultModel({ jobId: job.id, token: defaultWriteGrant.token, providerId: 'zeta-local', modelId: 'model-z:latest' });

  const defaultDecision = await routing.selectRoute({ jobId: job.id, token: readGrant.token });
  assert.equal(defaultDecision.providerId, 'zeta-local');
  assert.equal(defaultDecision.modelId, 'model-z:latest');
  assert.equal(defaultDecision.reason, 'default');

  const preferred = await routing.selectRoute({
    jobId: job.id,
    token: readGrant.token,
    preferred: { providerId: 'alpha-local', modelId: 'model-a:latest' },
  });
  assert.equal(preferred.providerId, 'alpha-local');
  assert.equal(preferred.reason, 'preferred');

  await assert.rejects(
    () => routing.selectRoute({
      jobId: job.id,
      token: readGrant.token,
      preferred: { providerId: 'alpha-local', modelId: 'missing-model' },
    }),
    /not installed/i,
  );
  await assert.rejects(
    () => routing.selectRoute({
      jobId: job.id,
      token: readGrant.token,
      preferred: { providerId: 'alpha-local', modelId: 'https://example.com/model' },
    }),
    /cannot be a URL/i,
  );

  await manager.clearDefaultModel({ jobId: job.id, token: defaultWriteGrant.token });
  alphaModels = [];
  zetaModels = [];
  await assert.rejects(
    () => routing.selectRoute({ jobId: job.id, token: readGrant.token }),
    /no installed local models/i,
  );

  await new Promise<void>((resolve) => setImmediate(resolve));
  const eventText = events.join('\n');
  for (const forbidden of ['https://', 'apiKey', 'secret', 'prompt', 'response', tempRoot]) {
    assert.equal(eventText.includes(forbidden), false, `routing events leaked forbidden marker: ${forbidden}`);
  }

  const routingTables = database.read((sqlite) => sqlite.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'gd_ai_model_routing%'
  `).all() as unknown as Array<{ name: string }>);
  assert.deepEqual(routingTables, []);

  routing.shutdown();
  assert.equal(routing.status().ready, false);
  manager.shutdown();
  await capabilities.shutdown('Build 37 routing verified');
  database.close();
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build37-model-routing-runtime/1',
  preferredPrecedence: true,
  manualDefaultPrecedence: true,
  deterministicFallback: true,
  capabilityComposedReads: true,
  decisionOnly: true,
  localOnly: true,
  persistence: false,
  networkAuthority: false,
  secretsAuthority: false,
}, null, 2));