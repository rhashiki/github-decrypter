import { assertJsonValue, type JsonValue } from '@github-decrypter/protocol';
import {
  asEventId,
  assertEventName,
  type AnyEventOf,
  type BusEvent,
  type EventBusOptions,
  type EventCatalog,
  type EventDeliveryFailure,
  type EventHandler,
  type EventName,
  type EventNameOf,
  type EventOf,
  type PublishMetadataInput,
  type PublishReport,
  type Unsubscribe,
} from './event-types.js';

interface SubscriptionRecord {
  readonly id: number;
  readonly eventName: EventName | '*';
  readonly handler: EventHandler;
  readonly once: boolean;
  active: boolean;
}

let eventSequence = 0;

function defaultCreateEventId() {
  eventSequence = eventSequence >= Number.MAX_SAFE_INTEGER ? 1 : eventSequence + 1;
  return asEventId(`gd_evt_${Date.now().toString(36)}_${eventSequence.toString(36)}`);
}

function defaultNow() {
  return new Date().toISOString();
}

function assertPositiveListenerLimit(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError('maxListenersPerEvent must be a positive safe integer.');
  }
}

export class EventBus<TCatalog extends EventCatalog = EventCatalog> {
  readonly #subscriptions = new Map<number, SubscriptionRecord>();
  readonly #defaultSource: string;
  readonly #maxListenersPerEvent: number;
  readonly #now: () => string;
  readonly #createEventId: () => ReturnType<typeof asEventId>;
  #nextSubscriptionId = 1;

  constructor(options: EventBusOptions = {}) {
    this.#defaultSource = options.defaultSource?.trim() || 'github-decrypter';
    this.#maxListenersPerEvent = options.maxListenersPerEvent ?? 100;
    assertPositiveListenerLimit(this.#maxListenersPerEvent);
    this.#now = options.now ?? defaultNow;
    this.#createEventId = options.createEventId ?? defaultCreateEventId;
  }

  subscribe<TName extends EventNameOf<TCatalog>>(
    eventName: TName,
    handler: EventHandler<EventOf<TCatalog, TName>>,
  ): Unsubscribe {
    return this.#addSubscription(eventName, handler as EventHandler, false);
  }

  once<TName extends EventNameOf<TCatalog>>(
    eventName: TName,
    handler: EventHandler<EventOf<TCatalog, TName>>,
  ): Unsubscribe {
    return this.#addSubscription(eventName, handler as EventHandler, true);
  }

  subscribeAll(handler: EventHandler<AnyEventOf<TCatalog>>): Unsubscribe {
    return this.#addSubscription('*', handler as EventHandler, false);
  }

  async publish<TName extends EventNameOf<TCatalog>>(
    eventName: TName,
    payload: Extract<TCatalog[TName], JsonValue>,
    metadata: PublishMetadataInput = {},
  ): Promise<PublishReport<EventOf<TCatalog, TName>>> {
    assertEventName(eventName);
    assertJsonValue(payload);

    const source = metadata.source?.trim() || this.#defaultSource;
    const emittedAt = this.#now();
    if (!emittedAt || typeof emittedAt !== 'string') {
      throw new TypeError('Event clock must return a non-empty timestamp string.');
    }

    const event = {
      name: eventName,
      payload,
      meta: {
        eventId: this.#createEventId(),
        emittedAt,
        source,
        ...(metadata.correlationId ? { correlationId: metadata.correlationId } : {}),
        ...(metadata.causationId ? { causationId: metadata.causationId } : {}),
        ...(metadata.traceId ? { traceId: metadata.traceId } : {}),
      },
    } as EventOf<TCatalog, TName>;

    return this.publishEvent(event);
  }

  async publishEvent<TName extends EventNameOf<TCatalog>>(
    event: EventOf<TCatalog, TName>,
  ): Promise<PublishReport<EventOf<TCatalog, TName>>> {
    this.#assertEvent(event as BusEvent);

    const snapshot = [...this.#subscriptions.values()].filter(
      (subscription) => subscription.active
        && (subscription.eventName === '*' || subscription.eventName === event.name),
    );

    const failures: EventDeliveryFailure[] = [];
    let succeeded = 0;

    for (const subscription of snapshot) {
      if (!subscription.active) continue;

      if (subscription.once) {
        this.#deactivate(subscription);
      }

      try {
        await subscription.handler(event as BusEvent);
        succeeded += 1;
      } catch (cause) {
        failures.push({
          subscriptionId: subscription.id,
          eventName: event.name,
          cause,
        });
      }
    }

    return {
      event,
      matched: snapshot.length,
      succeeded,
      failures,
    };
  }

  listenerCount(eventName?: EventName): number {
    if (eventName !== undefined) assertEventName(eventName);

    let count = 0;
    for (const subscription of this.#subscriptions.values()) {
      if (!subscription.active) continue;
      if (eventName === undefined || subscription.eventName === eventName) count += 1;
    }
    return count;
  }

  clear(eventName?: EventName): void {
    if (eventName !== undefined) assertEventName(eventName);

    for (const subscription of [...this.#subscriptions.values()]) {
      if (eventName === undefined || subscription.eventName === eventName) {
        this.#deactivate(subscription);
      }
    }
  }

  #addSubscription(
    eventName: EventName | '*',
    handler: EventHandler,
    once: boolean,
  ): Unsubscribe {
    if (eventName !== '*') assertEventName(eventName);
    if (typeof handler !== 'function') throw new TypeError('Event handler must be a function.');

    const existing = [...this.#subscriptions.values()].filter(
      (subscription) => subscription.active && subscription.eventName === eventName,
    ).length;

    if (existing >= this.#maxListenersPerEvent) {
      throw new RangeError(`Listener limit reached for ${eventName}.`);
    }

    const id = this.#nextSubscriptionId++;
    const record: SubscriptionRecord = {
      id,
      eventName,
      handler,
      once,
      active: true,
    };
    this.#subscriptions.set(id, record);

    return () => this.#deactivate(record);
  }

  #deactivate(subscription: SubscriptionRecord): void {
    if (!subscription.active) return;
    subscription.active = false;
    this.#subscriptions.delete(subscription.id);
  }

  #assertEvent(event: BusEvent): void {
    assertEventName(event?.name);
    assertJsonValue(event?.payload);

    if (!event.meta || typeof event.meta !== 'object') {
      throw new TypeError('Event metadata is required.');
    }
    asEventId(event.meta.eventId);
    if (typeof event.meta.emittedAt !== 'string' || event.meta.emittedAt.length === 0) {
      throw new TypeError('Event emittedAt must be a non-empty string.');
    }
    if (typeof event.meta.source !== 'string' || event.meta.source.trim().length === 0) {
      throw new TypeError('Event source must be a non-empty string.');
    }
  }
}

export function createEventBus<TCatalog extends EventCatalog = EventCatalog>(
  options?: EventBusOptions,
): EventBus<TCatalog> {
  return new EventBus<TCatalog>(options);
}
