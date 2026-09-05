import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import {
  assertEnvironmentDoctorReport,
  ENVIRONMENT_DOCTOR_SCHEMA,
  type EnvironmentDoctorReport,
} from '../packages/protocol/src/index.js';
import { buildEnvironmentDoctorReport } from '../apps/local/src/environment-doctor.js';
import { createLocalRuntimePeer } from '../apps/local/src/identity.js';
import { createLocalRuntimeHttpServer, type LocalRuntimeServerContext } from '../apps/local/src/server.js';
import { requestEnvironmentDoctorReport } from '../apps/studio/src/environment-doctor-client.js';

const snapshot = {
  build: 32,
  version: '0.0.32',
  state: 'running',
  protocol: 'gd-protocol/1' as const,
  database: { open: true, integrity: 'ok' as const },
  jobs: { ready: true, expiredLeases: 0 },
  recovery: { ready: true, healthy: true },
  offline: { ready: true, connectivity: 'offline', localExecutionAvailable: true as const },
  capabilities: { ready: true, denyByDefault: true as const, secretsVaultReady: true },
  audit: { ready: true, integrity: 'ok' as const },
  workspaces: { ready: true, registered: 0, available: 0 },
  projectDetection: { ready: true },
  git: { ready: true, available: true, version: 'git version test' },
  changeTracking: { ready: true },
};

const report = buildEnvironmentDoctorReport(snapshot, '2026-09-05T20:00:00.000Z');
assertEnvironmentDoctorReport(report);
assert.equal(report.schema, ENVIRONMENT_DOCTOR_SCHEMA);
assert.equal(report.readOnly, true);
assert.equal(report.metadataOnly, true);
assert.equal(report.summary.fail, 0);
assert.equal(report.summary.warning, 2, 'Offline connectivity and no registered workspace should warn, not fail.');
assert.equal(report.summary.ready, true);
assert.equal(report.checks.find((item) => item.id === 'offline.execution')?.status, 'warning');
assert.equal(report.checks.find((item) => item.id === 'workspace.availability')?.status, 'warning');
assert.equal(report.checks.find((item) => item.id === 'git.runtime')?.status, 'pass');
assert.doesNotMatch(JSON.stringify(report), /private[-_ ]?key|access[-_ ]?token|webhook[-_ ]?secret|databasePath|workspaceRoot/i);

const context = {
  peer: createLocalRuntimePeer(),
  getState: () => 'running',
  getStartedAt: () => '2026-09-05T19:59:00.000Z',
  getAddress: () => null,
  getDatabaseStatus: () => ({ open: true, schemaVersion: 11, journalMode: 'wal', foreignKeys: true, integrity: 'ok' }),
  getJobEngineStatus: () => ({ ready: true, summary: { total: 0, nonTerminal: 0, expiredLeases: 0 } }),
  getRecoveryStatus: () => ({ ready: true, sessionActive: true, healthy: true, priorUncleanSessions: 0, startupRecovered: 0, lastSweepRecovered: 0, lastSweepAt: null }),
  getOfflineExecutionStatus: () => ({ ready: true, connectivity: 'online', waitingForNetwork: 0, localQueued: 0 }),
  getCapabilitySecurityStatus: () => ({ ready: true, activeGrants: 0, revokedGrants: 0, expiredGrants: 0 }),
  getSecretsVaultStatus: () => ({ ready: true, secretCount: 0, cipher: 'AES-256-GCM', kdf: 'HKDF-SHA256', keyBackend: 'local-key-file-v1' }),
  getAuditLedgerStatus: () => ({ ready: true, entryCount: 0, headHash: '0'.repeat(64), integrity: 'ok' }),
  getWorkspaceManagerStatus: () => ({ ready: true, registered: 0, available: 0 }),
  getProjectDetectionStatus: () => ({ ready: true, detections: 0 }),
  getGitRuntimeStatus: () => ({ ready: true, available: true, version: 'git version test', operations: 0 }),
  getChangeTrackerStatus: () => ({ ready: true, activeSessions: 0, invalidatedSessions: 0, trackedPaths: 0, human: 0, ai: 0, mixed: 0, unknown: 0 }),
  now: () => '2026-09-05T20:00:00.000Z',
} as unknown as LocalRuntimeServerContext;

const server = createLocalRuntimeHttpServer(context);
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
try {
  const address = server.address() as AddressInfo;
  const endpoint = `http://127.0.0.1:${address.port}/v1/environment-doctor`;
  const allowedOrigin = 'http://127.0.0.1:5173';
  const response = await fetch(endpoint, { headers: { origin: allowedOrigin } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  const livePayload: unknown = await response.json();
  assertEnvironmentDoctorReport(livePayload);
  assert.equal(livePayload.runtime.build, 32);

  const preflight = await fetch(endpoint, { method: 'OPTIONS', headers: { origin: allowedOrigin } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), allowedOrigin);

  const denied = await fetch(endpoint, { headers: { origin: 'https://example.invalid' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

let injectedCalls = 0;
const clientReport = await requestEnvironmentDoctorReport({
  timeoutMs: 1000,
  fetchImpl: async (input, init) => {
    injectedCalls += 1;
    assert.equal(String(input), 'http://127.0.0.1:43110/v1/environment-doctor');
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.redirect, 'error');
    assert.equal((init as RequestInit & { targetAddressSpace?: string })?.targetAddressSpace, 'loopback');
    return new Response(JSON.stringify(report), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
assert.equal(injectedCalls, 1);
assert.equal(clientReport.schema, ENVIRONMENT_DOCTOR_SCHEMA);

await assert.rejects(
  () => requestEnvironmentDoctorReport({
    timeoutMs: 1000,
    fetchImpl: async () => new Response(JSON.stringify({ schema: 'wrong' }), { status: 200 }),
  }),
  /Environment Doctor report is invalid/,
);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build32-environment-doctor-runtime/1',
  reportReadyWithWarnings: true,
  metadataOnly: true,
  httpEndpoint: true,
  loopbackCorsAllowed: true,
  externalOriginRejected: true,
  credentials: false,
  injectedStudioClient: true,
}, null, 2));
