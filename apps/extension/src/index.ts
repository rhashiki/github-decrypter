import { PROTOCOL_SCHEMA, type PeerRole } from '@github-decrypter/protocol';

const protocolRole: PeerRole = 'extension';

export const appIdentity = Object.freeze({
  id: 'extension',
  packageName: '@github-decrypter/extension',
  protocolRole,
  protocolSchema: PROTOCOL_SCHEMA,
  role: 'Lightweight GitHub launcher/bridge placeholder; repository launcher arrives later.'
});
