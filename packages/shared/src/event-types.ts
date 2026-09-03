import type {
  CausationId,
  CorrelationId,
  JsonValue,
  TraceId,
} from '@github-decrypter/protocol';

declare const eventIdBrand: unique symbol;

export type EventId = string & { readonly [eventIdBrand]: 'EventId' };
export type EventName = `gd.${string}`;
export type EventCatalog = Record<string, JsonValue>;
export type EventNameOf<TCatalog extends EventCatalog> = string extends keyof TCatalog
  ? EventName
  : Extract<keyof TCatalog, EventName>;

export interface EventMetadata {
  readonly eventId: EventId;
  readonly emittedAt: string;
  readonly source: string;
  readonly correlationId?: CorrelationId;
  readonly causationId?: CausationId;
  readonly traceId?: TraceId;
}

export interface BusEvent<
  TName extends EventName = EventName,
  TPayload extends JsonValue = JsonValue,
> {
  readonly name: TName;
  readonly payload: TPayload;
  readonly meta: EventMetadata;
}

export type EventOf<
  TCatalog extends EventCatalog,
  TName extends EventNameOf<TCatalog>,
> = BusEvent<TName, Extract<TCatalog[TName], JsonValue>>;

export type AnyEventOf<TCatalog extends EventCatalog> = {
  [TName in EventNameOf<TCatalog>]: EventOf<TCatalog, TName>;
}[EventNameOf<TCatalog>];

export type EventHandler<TEvent extends BusEvent = BusEvent> = (
  event: TEvent,
) => void | Promise<void>;

export type Unsubscribe = () => void;

export interface PublishMetadataInput {
  readonly source?: string;
  readonly correlationId?: CorrelationId;
  readonly causationId?: CausationId;
  readonly traceId?: TraceId;
}

export interface EventDeliveryFailure {
  readonly subscriptionId: number;
  readonly eventName: EventName;
  readonly cause: unknown;
}

export interface PublishReport<TEvent extends BusEvent = BusEvent> {
  readonly event: TEvent;
  readonly matched: number;
  readonly succeeded: number;
  readonly failures: readonly EventDeliveryFailure[];
}

export interface EventBusOptions {
  readonly defaultSource?: string;
  readonly maxListenersPerEvent?: number;
  readonly now?: () => string;
  readonly createEventId?: () => EventId;
}

export function asEventId(value: string): EventId {
  if (!value.startsWith('gd_evt_') || value.length <= 'gd_evt_'.length) {
    throw new TypeError('Event IDs must use the gd_evt_ namespace.');
  }

  return value as EventId;
}

export function isEventName(value: unknown): value is EventName {
  return typeof value === 'string'
    && /^gd\.[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)*$/.test(value);
}

export function assertEventName(value: unknown): asserts value is EventName {
  if (!isEventName(value)) {
    throw new TypeError('Event names must use normalized gd.<domain>.<event> notation.');
  }
}
