import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AI_PROVIDER_RESPONSE_SCHEMA,
  createAIProviderDescriptor,
  createAIProviderGenerateRequest,
  createAIProviderModelDescriptor,
  type AIProviderAdapter,
  type AIProviderGenerateRequest,
} from '../packages/ai/src/index.js';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  CapabilitySecurityAuthority,
  DurableJobEngine,
  LocalAIRuntime,
  LocalDatabase,
  LOCAL_AI_PROVIDERS_RESOURCE,
  LOCAL_AI_RUNTIME_SCHEMA,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build34-'));
let nowMs = Date.parse('2026-09-06T03:30:00.000Z');
const now = () => new Date(nowMs).toISOString();

try {
  const database = new LocalDatabase({ path: join(tempRoot, 'runtime.sqlite3'), now });
  database.open();
  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build34-test' });
  const eventPayloads: string[] = [];
  bus.subscribe('gd.local.ai-runtime.ready', (event) => {
    eventPayloads.push(JSON.stringify(event.payload));
  });
  bus.subscribe('gd.local.ai-runtime.operation', (event) => {
    eventPayloads.push(JSON.stringify(event.payload));
  });

  const jobs = new DurableJobEngine({ database, eventBus: bus, now });
  const capabilities = new CapabilitySecurityAuthority({
    database,
    eventBus: bus,
    now,
    processInstanceId: 'gd_process_build34',
  });
  await capabilities.initialize();

  const localDescriptor = createAIProviderDescriptor({
    id: 'fake-local',
    displayName: 'Fake Local',
    kind: 'local',
    credentialMode: 'none',
  });
  const localModel = createAIProviderModelDescriptor({
    providerId: localDescriptor.id,
    id: 'fake-model',
    displayName: 'Fake Model',
    contextWindowTokens: 4096,
    maxOutputTokens: 512,
  });
  let generationCalls = 0;
  const localAdapter: AIProviderAdapter = Object.freeze({
    descriptor: localDescriptor,
    async listModels() { return Object.freeze([localModel]); },
    async generate(request: AIProviderGenerateRequest) {
      generationCalls += 1;
      return Object.freeze({
        schema: AI_PROVIDER_RESPONSE_SCHEMA,
        providerId: request.providerId,
        modelId: request.modelId,
        text: 'pong-from-local-adapter',
        finishReason: 'stop' as const,
        usage: Object.freeze({ inputTokens: 3, outputTokens: 4, totalTokens: 7 }),
      });
    },
  });

  const externalAdapter: AIProviderAdapter = Object.freeze({
    descriptor: createAIProviderDescriptor({
      id: 'fake-external',
      displayName: 'Fake External',
      kind: 'external',
      credentialMode: 'runtime-vault',
    }),
    async listModels() { return Object.freeze([]); },
    async generate(request: AIProviderGenerateRequest) {
      return Object.freeze({
        schema: AI_PROVIDER_RESPONSE_SCHEMA,
        providerId: request.providerId,
        modelId: request.modelId,
        text: '',
        finishReason: 'stop' as const,
        usage: null,
      });
    },
  });

  assert.throws(
    () => new LocalAIRuntime({ capabilities, adapters: [externalAdapter] }),
    /only local providers/i,
  );
  assert.throws(
    () => new LocalAIRuntime({ capabilities, adapters: [localAdapter, localAdapter] }),
    /duplicated/i,
  );

  const runtime = new LocalAIRuntime({ capabilities, adapters: [localAdapter], eventBus: bus, now });
  const status = await runtime.initialize();
  assert.equal(status.ready, true);
  assert.equal(status.schema, LOCAL_AI_RUNTIME_SCHEMA);
  assert.equal(status.registeredProviders, 1);
  assert.equal(status.localOnly, true);
  assert.equal(status.runtimeExecution, true);
  assert.equal(status.networkAuthority, false);
  assert.equal(status.secretsAuthority, false);
  assert.equal(status.promptPersistence, false);
  assert.equal(status.responsePersistence, false);
  assert.equal(status.providerConfigurationPersistence, false);
  assert.equal(status.automaticRouting, false);
  assert.equal(status.modelInstallation, false);
  assert.equal(status.modelManagement, false);
  assert.equal(status.studioTransport, false);

  const job = await jobs.enqueue({ kind: 'ai.local.generate', payload: null, maxAttempts: 1 });
  await assert.rejects(
    () => runtime.listProviders({ jobId: job.id, token: 'invalid-token' }),
    /Capability authorization denied/i,
  );

  const readOnlyGrant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [{ capability: 'READ', resource: LOCAL_AI_PROVIDERS_RESOURCE, match: 'prefix' }],
  });
  const providers = await runtime.listProviders({ jobId: job.id, token: readOnlyGrant.token });
  assert.deepEqual(providers.map((provider) => provider.id), ['fake-local']);
  const models = await runtime.listModels({ jobId: job.id, token: readOnlyGrant.token, providerId: 'fake-local' });
  assert.deepEqual(models.map((model) => model.id), ['fake-model']);

  const promptMarker = 'build34-sensitive-prompt-marker';
  const request = createAIProviderGenerateRequest({
    providerId: 'fake-local',
    modelId: 'fake-model',
    messages: [{ role: 'user', content: promptMarker }],
    maxOutputTokens: 64,
    temperature: 0,
  });
  await assert.rejects(
    () => runtime.generate({ jobId: job.id, token: readOnlyGrant.token, request }),
    /Capability authorization denied/i,
    'READ must not imply EXECUTE',
  );
  assert.equal(generationCalls, 0);

  const executeGrant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [{
      capability: 'EXECUTE',
      resource: 'gd://ai-runtime/providers/fake-local/models/fake-model',
      match: 'exact',
    }],
  });
  const result = await runtime.generate({ jobId: job.id, token: executeGrant.token, request });
  assert.equal(result.text, 'pong-from-local-adapter');
  assert.equal(result.providerId, 'fake-local');
  assert.equal(result.modelId, 'fake-model');
  assert.equal(generationCalls, 1);

  const unavailableRequest = createAIProviderGenerateRequest({
    providerId: 'fake-local',
    modelId: 'missing-model',
    messages: [{ role: 'user', content: 'missing' }],
    maxOutputTokens: null,
    temperature: null,
  });
  const missingModelGrant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [{
      capability: 'EXECUTE',
      resource: 'gd://ai-runtime/providers/fake-local/models/missing-model',
      match: 'exact',
    }],
  });
  await assert.rejects(
    () => runtime.generate({ jobId: job.id, token: missingModelGrant.token, request: unavailableRequest }),
    /not available/i,
  );
  assert.equal(generationCalls, 1);

  await assert.rejects(
    () => runtime.listModels({ jobId: job.id, token: readOnlyGrant.token, providerId: 'unknown-provider' }),
    /not registered/i,
  );

  await new Promise((resolve) => setImmediate(resolve));
  const eventText = eventPayloads.join('\n');
  assert.ok(eventPayloads.length >= 4);
  assert.equal(eventText.includes(promptMarker), false, 'prompt content leaked into Event Bus metadata');
  assert.equal(eventText.includes('pong-from-local-adapter'), false, 'response content leaked into Event Bus metadata');

  const aiTables = database.read((sqlite) => sqlite.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'gd_ai%'
  `).all() as unknown as Array<{ name: string }>);
  assert.deepEqual(aiTables, [], 'Build 34 must not persist AI provider/model/prompt/response state.');

  runtime.shutdown();
  assert.equal(runtime.status().ready, false);
  await capabilities.shutdown('Build 34 verified');
  database.close();
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build34-local-ai-runtime-runtime/1',
  localProviderExecuted: true,
  externalProviderRejected: true,
  readExecuteSeparation: true,
  promptResponseEventLeakage: false,
  aiPersistence: false,
}, null, 2));
