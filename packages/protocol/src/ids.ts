declare const protocolIdBrand: unique symbol;

export type ProtocolId<TKind extends string> = string & {
  readonly [protocolIdBrand]: TKind;
};

export type MessageId = ProtocolId<'message'>;
export type CorrelationId = ProtocolId<'correlation'>;
export type CausationId = ProtocolId<'causation'>;
export type TraceId = ProtocolId<'trace'>;
export type PeerId = ProtocolId<'peer'>;
export type SessionId = ProtocolId<'session'>;

function asProtocolId<TKind extends string>(value: string): ProtocolId<TKind> {
  if (!value.trim()) throw new TypeError('Protocol IDs must be non-empty strings.');
  return value as ProtocolId<TKind>;
}

export const asMessageId = (value: string): MessageId => asProtocolId<'message'>(value);
export const asCorrelationId = (value: string): CorrelationId => asProtocolId<'correlation'>(value);
export const asCausationId = (value: string): CausationId => asProtocolId<'causation'>(value);
export const asTraceId = (value: string): TraceId => asProtocolId<'trace'>(value);
export const asPeerId = (value: string): PeerId => asProtocolId<'peer'>(value);
export const asSessionId = (value: string): SessionId => asProtocolId<'session'>(value);
