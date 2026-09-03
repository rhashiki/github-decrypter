# Build 8 — Central Event Bus

## Objective

Create the deterministic in-process event backbone used by GitHub Decrypter modules while preserving the separation between local event dispatch, the Build 7 wire protocol and later durable/security authorities.

## Delivered

- promoted `@github-decrypter/shared` into the owner of the central Event Bus primitive;
- added typed `gd.*` event names and event catalogs;
- added branded `gd_evt_*` event IDs;
- added event metadata with source, correlation, causation and trace support;
- added deterministic sequential dispatch;
- added exact subscriptions, `once` and `subscribeAll`;
- added idempotent unsubscribe and listener cleanup;
- added per-event listener limits;
- added mutation-safe dispatch snapshots;
- added handler-failure isolation and delivery reports;
- reused Build 7 JSON payload validation;
- added structural and runtime CI coverage.

## Boundaries preserved

Build 8 does not create a global singleton and does not implement transport, persistence, retry queues, jobs, security capabilities, audit storage, Git events or UI event wiring.

`@github-decrypter/protocol` remains the only wire contract. The Event Bus is an in-process primitive.

## Acceptance criteria

Build 8 is accepted only when:

1. Build 4 Lovable decoupling remains green;
2. Build 5 GitHub Decrypter identity remains green;
3. Build 6 monorepo foundation remains green;
4. Build 7 shared protocol remains green;
5. Build 8 structural Event Bus regression passes;
6. Build 8 runtime behavior tests pass;
7. all pnpm workspaces typecheck;
8. inherited modern engines remain preserved for later migration;
9. Event Bus code contains no browser, Chrome, Node transport, database or AI-provider authority.

## Runtime semantics tested

- deterministic subscriber order;
- one-shot subscriptions;
- global observers;
- handler error isolation;
- unsubscribe during active dispatch;
- subscribe during active dispatch;
- invalid event-name rejection;
- non-JSON payload rejection;
- listener-limit enforcement;
- explicit cleanup.

## Safety

No Release, OTA, Chrome Store publication, deployment, production backend mutation or DNS change is authorized by this Build.
