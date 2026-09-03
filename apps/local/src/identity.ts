import { asPeerId, PROTOCOL_SCHEMA, type ProtocolPeer } from '@github-decrypter/protocol';
import { randomUUID } from 'node:crypto';

export const LOCAL_RUNTIME_BUILD = 10 as const;
export const LOCAL_RUNTIME_VERSION = '0.0.10' as const;
export const LOCAL_RUNTIME_FEATURES = [
  'loopback-http',
  'health',
  'readiness',
  'protocol-handshake',
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
  authority: 'Independent local daemon lifecycle and loopback transport boundary.',
});
