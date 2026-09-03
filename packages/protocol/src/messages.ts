import type { ProtocolEnvelope } from './envelope.js';
import type { ProtocolError } from './errors.js';

export interface ProtocolRequestPayload<TCommand extends string = string, TInput = unknown> {
  readonly command: TCommand;
  readonly input: TInput;
}

export type ProtocolRequest<
  TCommand extends string = string,
  TInput = unknown,
> = ProtocolEnvelope<'request', ProtocolRequestPayload<TCommand, TInput>>;

export interface ProtocolSuccessPayload<TData = unknown> {
  readonly ok: true;
  readonly data: TData;
}

export interface ProtocolFailurePayload {
  readonly ok: false;
  readonly error: ProtocolError;
}

export type ProtocolResponsePayload<TData = unknown> =
  | ProtocolSuccessPayload<TData>
  | ProtocolFailurePayload;

export type ProtocolResponse<TData = unknown> = ProtocolEnvelope<
  'response',
  ProtocolResponsePayload<TData>
>;

export interface ProtocolEventPayload<TEvent extends string = string, TData = unknown> {
  readonly event: TEvent;
  readonly data: TData;
}

export type ProtocolEvent<
  TEvent extends string = string,
  TData = unknown,
> = ProtocolEnvelope<'event', ProtocolEventPayload<TEvent, TData>>;

export interface ProtocolHeartbeatPayload {
  readonly sequence: number;
  readonly sentAt: string;
}

export type ProtocolHeartbeat = ProtocolEnvelope<'heartbeat', ProtocolHeartbeatPayload>;
