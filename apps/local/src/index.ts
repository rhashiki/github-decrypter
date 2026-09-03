import { PROTOCOL_SCHEMA, type PeerRole } from '@github-decrypter/protocol';

const protocolRole: PeerRole = 'local-runtime';

export const appIdentity = Object.freeze({
  id: 'local',
  packageName: '@github-decrypter/local',
  protocolRole,
  protocolSchema: PROTOCOL_SCHEMA,
  role: 'Durable local runtime process placeholder; daemon implementation begins in Build 10.'
});
