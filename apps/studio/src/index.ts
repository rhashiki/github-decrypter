import { PROTOCOL_SCHEMA, type PeerRole } from '@github-decrypter/protocol';

const protocolRole: PeerRole = 'studio';

export const appIdentity = Object.freeze({
  id: 'studio',
  packageName: '@github-decrypter/studio',
  protocolRole,
  protocolSchema: PROTOCOL_SCHEMA,
  role: 'PWA visual authority placeholder; React/Vite begins in Build 27.'
});
