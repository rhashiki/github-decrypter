import type { PeerId, SessionId } from './ids.js';

export const PEER_ROLES = ['studio', 'extension', 'local-runtime'] as const;
export type PeerRole = (typeof PEER_ROLES)[number];

export interface ProtocolPeer {
  readonly id: PeerId;
  readonly role: PeerRole;
  readonly product: 'github-decrypter';
  readonly productVersion: string;
  readonly sessionId?: SessionId;
}

export function isPeerRole(value: unknown): value is PeerRole {
  return typeof value === 'string' && PEER_ROLES.includes(value as PeerRole);
}
