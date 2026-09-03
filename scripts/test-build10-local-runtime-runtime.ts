import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SUPPORTED_PROTOCOL_VERSIONS,
  asMessageId,
  asPeerId,
  envelope,
} from '../packages/protocol/src/index.js';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  LocalRuntimeDaemon,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build10-'));
const lockPath = join(tempRoot, 'runtime.lock');
const databasePath = join(tempRoot, 'runtime.sqlite3');
const config = { host: '127.0.0.1', port: 0, lockPath, databasePath } as const;

try {
  assert.throws(
    () => new LocalRuntimeDaemon({ config: { ...config, host: '0.0.0.0' } }),
    /loopback/i,
  );

  const lifecycle: string[] = [];
  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build10-test' });
  bus.subscribe('gd.local.lifecycle', (event) => {
    lifecycle.push(event.payload.current);
  });

  const daemon = new LocalRuntimeDaemon({ config, eventBus: bus });
  const address = await daemon.start();
  assert.equal(daemon.state, 'running');
  assert.ok(existsSync(lockPath));
  assert.match(address.origin, /^http:\/\/127\.0\.0\.1:\d+$/);

  const healthResponse = await fetch(`${address.origin}/healthz`);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json() as Record<string, any>;
  assert.equal(health.schema, 'gd-local-health/1');
  assert.equal(health.product, 'github-decrypter');
  assert.ok(Number(health.build) >= 10);
  assert.match(String(health.version), /^0\.0\.\d+$/);
  assert.equal(health.state, 'running');
  assert.equal(health.port, address.port);
  assert.equal(health.protocol, 'gd-protocol/1');

  const readyResponse = await fetch(`${address.origin}/readyz`);
  assert.equal(readyResponse.status, 200);
  const readiness = await readyResponse.json() as Record<string, unknown>;
  assert.equal(readiness.schema, 'gd-local-readiness/1');
  assert.equal(readiness.ready, true);

  const studioPeer = {
    id: asPeerId('gd_peer_build10_studio'),
    role: 'studio' as const,
    product: 'github-decrypter' as const,
    productVersion: 'test',
  };
  const hello = envelope({
    kind: 'handshake.hello',
    meta: { messageId: asMessageId('gd_msg_build10_hello'), timestamp: new Date().toISOString(), source: studioPeer },
    payload: { peer: studioPeer, supportedVersions: [...SUPPORTED_PROTOCOL_VERSIONS], features: ['build10-test'] },
  });

  const handshakeResponse = await fetch(`${address.origin}/v1/handshake`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(hello),
  });
  assert.equal(handshakeResponse.status, 200);
  const handshake = await handshakeResponse.json() as Record<string, any>;
  assert.equal(handshake.schema, 'gd-protocol/1');
  assert.equal(handshake.kind, 'handshake.accept');
  assert.equal(handshake.payload.selectedVersion, 1);
  assert.equal(handshake.payload.peer.role, 'local-runtime');
  assert.ok(handshake.payload.features.includes('loopback-http'));

  const mismatchedPeerHello = {
    ...hello,
    meta: { ...hello.meta, messageId: asMessageId('gd_msg_build10_mismatch') },
    payload: { ...hello.payload, peer: { ...studioPeer, id: asPeerId('gd_peer_build10_other') } },
  };
  const mismatchResponse = await fetch(`${address.origin}/v1/handshake`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(mismatchedPeerHello),
  });
  assert.equal(mismatchResponse.status, 400);
  const mismatch = await mismatchResponse.json() as Record<string, any>;
  assert.equal(mismatch.error.code, 'PEER_MISMATCH');

  const incompatibleHello = {
    ...hello,
    meta: { ...hello.meta, messageId: asMessageId('gd_msg_build10_incompatible') },
    payload: { ...hello.payload, supportedVersions: [999] },
  };
  const incompatibleResponse = await fetch(`${address.origin}/v1/handshake`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(incompatibleHello),
  });
  assert.equal(incompatibleResponse.status, 426);
  const incompatible = await incompatibleResponse.json() as Record<string, any>;
  assert.equal(incompatible.kind, 'handshake.reject');
  assert.equal(incompatible.payload.error.code, 'UNSUPPORTED_PROTOCOL');

  assert.equal((await fetch(`${address.origin}/v1/not-implemented`)).status, 404);

  const secondDaemon = new LocalRuntimeDaemon({ config });
  await assert.rejects(() => secondDaemon.start(), /already running/i);
  assert.equal(secondDaemon.state, 'failed');

  await daemon.stop('Build 10 test complete');
  assert.equal(daemon.state, 'stopped');
  assert.equal(existsSync(lockPath), false);
  assert.deepEqual(lifecycle, ['starting', 'running', 'stopping', 'stopped']);

  writeFileSync(lockPath, JSON.stringify({ schema: 'gd-local-runtime-lock/1', pid: 2_147_483_647, createdAt: '2000-01-01T00:00:00.000Z' }));
  const recoveredDaemon = new LocalRuntimeDaemon({ config });
  const recoveredAddress = await recoveredDaemon.start();
  assert.ok(recoveredAddress.port > 0);
  await recoveredDaemon.stop('stale-lock recovery verified');
  assert.equal(existsSync(lockPath), false);

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build10-local-runtime-runtime/2',
    minimumBuild: 10,
    loopbackBind: true,
    health: true,
    readiness: true,
    protocolHandshake: true,
    peerMismatchRejected: true,
    incompatibleProtocolRejected: true,
    singleInstance: true,
    staleLockRecovery: true,
    gracefulShutdown: true,
    lifecycle,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
