import type { ProtocolEnvelope } from './envelope.js';
import type { ProtocolError } from './errors.js';
import type { ProtocolPeer } from './peer.js';
import type { ProtocolVersion } from './version.js';

export interface ProtocolHandshakeHelloPayload {
  readonly peer: ProtocolPeer;
  readonly supportedVersions: readonly number[];
  readonly features: readonly string[];
}

export interface ProtocolHandshakeAcceptPayload {
  readonly peer: ProtocolPeer;
  readonly selectedVersion: ProtocolVersion;
  readonly features: readonly string[];
}

export interface ProtocolHandshakeRejectPayload {
  readonly error: ProtocolError;
}

export type ProtocolHandshakeHello = ProtocolEnvelope<
  'handshake.hello',
  ProtocolHandshakeHelloPayload
>;

export type ProtocolHandshakeAccept = ProtocolEnvelope<
  'handshake.accept',
  ProtocolHandshakeAcceptPayload
>;

export type ProtocolHandshakeReject = ProtocolEnvelope<
  'handshake.reject',
  ProtocolHandshakeRejectPayload
>;
