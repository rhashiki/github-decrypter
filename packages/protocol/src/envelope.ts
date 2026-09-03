import type {
  CausationId,
  CorrelationId,
  MessageId,
  PeerId,
  TraceId,
} from './ids.js';
import type { ProtocolPeer, PeerRole } from './peer.js';
import { PROTOCOL_SCHEMA, PROTOCOL_VERSION, type ProtocolVersion } from './version.js';

export const PROTOCOL_MESSAGE_KINDS = [
  'handshake.hello',
  'handshake.accept',
  'handshake.reject',
  'request',
  'response',
  'event',
  'heartbeat',
] as const;

export type ProtocolMessageKind = (typeof PROTOCOL_MESSAGE_KINDS)[number];

export interface ProtocolDestination {
  readonly role: PeerRole | 'broadcast';
  readonly peerId?: PeerId;
}

export interface ProtocolMetadata {
  readonly messageId: MessageId;
  readonly timestamp: string;
  readonly source: ProtocolPeer;
  readonly destination?: ProtocolDestination;
  readonly correlationId?: CorrelationId;
  readonly causationId?: CausationId;
  readonly traceId?: TraceId;
}

export interface ProtocolEnvelope<
  TKind extends ProtocolMessageKind = ProtocolMessageKind,
  TPayload = unknown,
> {
  readonly schema: typeof PROTOCOL_SCHEMA;
  readonly version: ProtocolVersion;
  readonly kind: TKind;
  readonly meta: ProtocolMetadata;
  readonly payload: TPayload;
}

export type ProtocolEnvelopeInput<
  TKind extends ProtocolMessageKind,
  TPayload,
> = Omit<ProtocolEnvelope<TKind, TPayload>, 'schema' | 'version'>;

export function envelope<TKind extends ProtocolMessageKind, TPayload>(
  input: ProtocolEnvelopeInput<TKind, TPayload>,
): ProtocolEnvelope<TKind, TPayload> {
  return {
    schema: PROTOCOL_SCHEMA,
    version: PROTOCOL_VERSION,
    ...input,
  };
}
