import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAIProviderDescriptor } from '../packages/ai/src/index.js';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  CapabilitySecurityAuthority,
  DurableJobEngine,
  LocalAIInstaller,
  LocalDatabase,
  LOCAL_AI_INSTALLERS_RESOURCE,
  LOCAL_AI_INSTALLER_SCHEMA,
  createLocalAIInstallerDescriptor,
  type LocalAIInstallRequest,
  type LocalAIInstallerAdapter,
  type LocalAIInstallerEventCatalog,
} from '../apps/local/src/index.js';
import type { ConnectivityState } from '../apps/local/src/offline-execution.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build35-core-'));
const now = () => '2026-09-06T11:15:00.000Z';

try {
  const database = new LocalDatabase({ path: join(tempRoot, 'runtime.sqlite3'), now });
  database.open();
  const jobs = new DurableJobEngine({ database, now });
  const capabilities = new CapabilitySecurityAuthority({
    database,
    now,
    processInstanceId: 'gd_process_build35_core',
  });
  await capabilities.initialize();

  const provider = createAIProviderDescriptor({
    id: 'fake-local',
    displayName: 'Fake Local',
    kind: 'local',
    credentialMode: 'none',
  });
  const descriptor = createLocalAIInstallerDescriptor({
    provider,
    runtimeFamily: 'ollama-compatible',
    networkRequired: true,
  });

  let installCalls = 0;
  const adapter: LocalAIInstallerAdapter = Object.freeze({
    descriptor,
    installModel: async (request: LocalAIInstallRequest) => {
      installCalls += 1;
      return Object.freeze({
        schema: 'gd-local-ai-install-result/1' as const,
        providerId: request.providerId,
        modelId: request.modelId,
        installed: true as const,
        reused: false,
      });
    },
  });

  const localOnlyDescriptor = createLocalAIInstallerDescriptor({
    provider: createAIProviderDescriptor({
      id: 'fake-cache',
      displayName: 'Fake Cache',
      kind: 'local',
      credentialMode: 'none',
    }),
    runtimeFamily: 'custom-local',
    networkRequired: false,
  });
  let cacheCalls = 0;
  const cacheAdapter: LocalAIInstallerAdapter = Object.freeze({
    descriptor: localOnlyDescriptor,
    installModel: async (request: LocalAIInstallRequest) => {
      cacheCalls += 1;
      return Object.freeze({
        schema: 'gd-local-ai-install-result/1' as const,
        providerId: request.providerId,
        modelId: request.modelId,
        installed: true as const,
        reused: true,
      });
    },
  });

  assert.throws(() => createLocalAIInstallerDescriptor({
    provider: createAIProviderDescriptor({
      id: 'external',
      displayName: 'External',
      kind: 'external',
      credentialMode: 'runtime-vault',
    }),
    runtimeFamily: 'custom-local',
    networkRequired: true,
  }), /only local providers/i);

  let connectivityState: ConnectivityState = 'online';
  const offline = { status: () => ({ ready: true, connectivity: connectivityState }) };
  assert.throws(
    () => new LocalAIInstaller({ capabilities, offline, adapters: [adapter, adapter] }),
    /duplicated/i,
  );

  const events: string[] = [];
  const eventBus = createEventBus<LocalAIInstallerEventCatalog>({ defaultSource: 'build35-core-test' });
  eventBus.subscribe('gd.local.ai-installer.ready', (event) => { events.push(JSON.stringify(event.payload)); });
  eventBus.subscribe('gd.local.ai-installer.operation', (event) => { events.push(JSON.stringify(event.payload)); });

  const installer = new LocalAIInstaller({ capabilities, offline, adapters: [adapter, cacheAdapter], eventBus, now });
  const status = await installer.initialize();
  assert.equal(status.ready, true);
  assert.equal(status.schema, LOCAL_AI_INSTALLER_SCHEMA);
  assert.equal(status.registeredInstallers, 2);
  assert.equal(status.modelInstallation, true);
  assert.equal(status.modelRemoval, false);
  assert.equal(status.modelUpdate, false);
  assert.equal(status.defaultSelection, false);
  assert.equal(status.automaticRouting, false);
  assert.equal(status.arbitrarySourceUrl, false);
  assert.equal(status.secretsAuthority, false);
  assert.equal(status.providerConfigurationPersistence, false);
  assert.equal(status.modelStatePersistence, false);
  assert.equal(status.studioTransport, false);

  const job = await jobs.enqueue({ kind: 'ai.local.install', payload: null, maxAttempts: 1 });
  await assert.rejects(
    () => installer.listInstallers({ jobId: job.id, token: 'invalid-token' }),
    /Capability authorization denied/i,
  );

  const readGrant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [{ capability: 'READ', resource: LOCAL_AI_INSTALLERS_RESOURCE, match: 'prefix' }],
  });
  const listed = await installer.listInstallers({ jobId: job.id, token: readGrant.token });
  assert.deepEqual(listed.map((entry) => entry.provider.id), ['fake-cache', 'fake-local']);

  await assert.rejects(
    () => installer.installModel({ jobId: job.id, token: readGrant.token, providerId: 'fake-local', modelId: 'qwen-test:latest' }),
    /Capability authorization denied/i,
  );
  assert.equal(installCalls, 0);

  const installResource = 'gd://ai-installer/providers/fake-local/models/qwen-test%3Alatest';
  const noNetworkGrant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [
      { capability: 'WRITE', resource: installResource, match: 'exact' },
      { capability: 'EXECUTE', resource: installResource, match: 'exact' },
    ],
  });
  await assert.rejects(
    () => installer.installModel({ jobId: job.id, token: noNetworkGrant.token, providerId: 'fake-local', modelId: 'qwen-test:latest' }),
    /Capability authorization denied/i,
  );
  assert.equal(installCalls, 0);

  const fullGrant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [
      { capability: 'WRITE', resource: installResource, match: 'exact' },
      { capability: 'EXECUTE', resource: installResource, match: 'exact' },
      { capability: 'NETWORK', resource: installResource, match: 'exact' },
    ],
  });
  const installed = await installer.installModel({
    jobId: job.id,
    token: fullGrant.token,
    providerId: 'fake-local',
    modelId: 'qwen-test:latest',
  });
  assert.equal(installed.installed, true);
  assert.equal(installed.reused, false);
  assert.equal(installCalls, 1);

  connectivityState = 'offline';
  await assert.rejects(
    () => installer.installModel({ jobId: job.id, token: fullGrant.token, providerId: 'fake-local', modelId: 'qwen-test:latest' }),
    /requires online connectivity/i,
  );
  assert.equal(installCalls, 1);

  const cacheResource = 'gd://ai-installer/providers/fake-cache/models/local-bundle';
  const cacheGrant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [
      { capability: 'WRITE', resource: cacheResource, match: 'exact' },
      { capability: 'EXECUTE', resource: cacheResource, match: 'exact' },
    ],
  });
  const cached = await installer.installModel({
    jobId: job.id,
    token: cacheGrant.token,
    providerId: 'fake-cache',
    modelId: 'local-bundle',
  });
  assert.equal(cached.reused, true);
  assert.equal(cacheCalls, 1);

  await assert.rejects(
    () => installer.installModel({ jobId: job.id, token: cacheGrant.token, providerId: 'unknown', modelId: 'local-bundle' }),
    /not registered/i,
  );
  await assert.rejects(
    () => installer.installModel({ jobId: job.id, token: cacheGrant.token, providerId: 'fake-cache', modelId: 'https://example.com/model' }),
    /AI model id is invalid/i,
  );

  await new Promise<void>((resolve) => setImmediate(resolve));
  const eventText = events.join('\n');
  assert.equal(eventText.includes('https://'), false);
  assert.equal(eventText.includes('apiKey'), false);
  assert.equal(eventText.includes('secretValue'), false);

  const installerTables = database.read((sqlite) => sqlite.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'gd_ai_installer%'
  `).all() as unknown as Array<{ name: string }>);
  assert.deepEqual(installerTables, []);

  installer.shutdown();
  assert.equal(installer.status().ready, false);
  await capabilities.shutdown('Build 35 core verified');
  database.close();
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build35-local-ai-installer-core-runtime/1',
  localProviderOnly: true,
  writeExecuteRequired: true,
  networkConditional: true,
  offlineNetworkInstallRejected: true,
  offlineCachedInstallAllowed: true,
  arbitrarySourceUrlRejected: true,
  persistence: false,
  modelManagement: false,
  automaticRouting: false,
}, null, 2));