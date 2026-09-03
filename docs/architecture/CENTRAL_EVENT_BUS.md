# Central Event Bus

Build 8 establishes the in-process event backbone used by GitHub Decrypter modules without turning transport, persistence or security into Event Bus responsibilities.

## Authority

The canonical Event Bus implementation lives in:

`@github-decrypter/shared`

Primary files:

- `packages/shared/src/event-types.ts`
- `packages/shared/src/event-bus.ts`

The wire protocol remains independently owned by `@github-decrypter/protocol` (`gd-protocol/1`).

## Boundary: protocol vs Event Bus

```text
Between processes / transport boundary
    @github-decrypter/protocol
    gd-protocol/1

Inside one process / composition root
    @github-decrypter/shared
    EventBus
```

The Event Bus must not become a second wire protocol. Transport adapters introduced by later Builds may translate validated protocol events into local Event Bus publications, but the bus itself does not open sockets, call HTTP endpoints or own Chrome messaging.

## Event namespace

Every event uses normalized names beginning with `gd.`.

Examples of future valid names:

- `gd.workspace.opened`
- `gd.git.status.changed`
- `gd.job.started`
- `gd.preview.ready`

Build 8 does not claim ownership of those domain events; the examples only demonstrate naming. Domain packages define their events when their frozen Builds arrive.

## Event model

An event contains:

```text
name
payload
meta
  eventId
  emittedAt
  source
  correlationId?
  causationId?
  traceId?
```

Payloads must be JSON-safe, reusing the Build 7 JSON boundary rules. Correlation, causation and trace identifiers are shared with the protocol so a later transport adapter can preserve observability across process boundaries.

## Dispatch semantics

The Build 8 Event Bus guarantees:

1. deterministic subscription order;
2. sequential handler execution for one publication;
3. `once` subscriptions are deactivated before invocation, making reentrant publication safe;
4. one handler failure does not stop later handlers;
5. publication returns a delivery report containing successes and failures;
6. subscriptions created during a dispatch do not receive the event already in flight;
7. subscriptions removed before their turn are skipped;
8. listener limits prevent accidental unbounded subscription growth;
9. unsubscribe operations are idempotent;
10. payloads are validated before dispatch.

## Lifecycle

Build 8 deliberately does **not** export a global singleton.

Each future application/process composition root owns exactly one authoritative Event Bus instance and injects it into its modules. This keeps tests isolated and avoids hidden cross-workspace global state.

Expected future composition roots:

- Studio process
- Extension process
- Local Runtime process

The bus is central **within a process**, not magically shared between processes.

## Failure behavior

Handler failures are isolated and returned in `PublishReport.failures`.

The Event Bus does not automatically retry failed handlers. Retry, durable queues, checkpointing and crash recovery belong to the Durable Job Engine and persistence Builds.

## Environment neutrality

The Event Bus must not depend on:

- Chrome extension APIs
- DOM/browser globals
- Node.js APIs
- WebSocket
- HTTP/fetch
- Supabase or another database
- Ollama/vLLM or another AI provider
- localStorage/chrome.storage
- timers used as retry/scheduling authority

## Explicit non-goals for Build 8

Build 8 does not implement:

- Architecture Guardian enforcement (Build 9)
- daemon/process transport (Build 10)
- persistent event storage (Build 11+)
- durable queues/jobs/retries (Build 12)
- crash recovery (Build 13)
- capability authorization (Build 15)
- Audit Ledger (Build 18)
- Git/workspace/domain-specific event catalogs
- Studio UI event wiring

This keeps the Event Bus a small deterministic primitive rather than an accidental workflow engine.
