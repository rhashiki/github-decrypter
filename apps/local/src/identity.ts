import { asPeerId, PROTOCOL_SCHEMA, type ProtocolPeer } from '@github-decrypter/protocol';
import { randomUUID } from 'node:crypto';

export const LOCAL_RUNTIME_BUILD = 17 as const;
export const LOCAL_RUNTIME_VERSION = '0.0.17' as const;
export const LOCAL_RUNTIME_FEATURES = [
  'loopback-http',
  'health',
  'readiness',
  'protocol-handshake',
  'persistent-sqlite',
  'schema-migrations',
  'durable-jobs',
  'job-dependencies',
  'job-leases',
  'crash-recovery',
  'runtime-sessions',
  'lease-recovery',
  'offline-execution',
  'connectivity-state',
  'network-wait-resume',
  'capability-security',
  'deny-by-default',
  'scoped-capability-grants',
  'secrets-vault',
  'encrypted-secret-storage',
  'capability-gated-secrets',
  'approval-transactions',
  'human-approval-receipts',
  'payload-digest-binding',
] as const;

export function createLocalRuntimePeer(): ProtocolPeer {
  return {
    id: asPeerId(`gd_peer_local_${randomUUID()}`),
    role: 'local-runtime',
    product: 'github-decrypter',
    productVersion: LOCAL_RUNTIME_VERSION,
  };
}

export const localRuntimeIdentity = Object.freeze({
  id: 'local',
  packageName: '@github-decrypter/local',
  product: 'GitHub Decrypter',
  build: LOCAL_RUNTIME_BUILD,
  version: LOCAL_RUNTIME_VERSION,
  protocolRole: 'local-runtime' as const,
  protocolSchema: PROTOCOL_SCHEMA,
  authority: 'Independent local daemon lifecycle, persistent SQLite, durable jobs, recovery, offline scheduling, capability security, encrypted Secrets Vault and durable human Approval Transactions boundary.',
});
