# Build 7 — Shared Protocol

## Objective

Create one versioned, transport-neutral protocol shared by Studio, Extension and Local Runtime before introducing Event Bus or daemon implementations.

## Delivered

- `@github-decrypter/protocol` promoted from placeholder to real zero-dependency package.
- canonical schema `gd-protocol/1` and protocol version `1`.
- branded IDs for messages, peers, sessions, correlation, causation and traces.
- canonical peer roles: Studio, Extension and Local Runtime.
- canonical envelope metadata and destination model.
- request, response, event and heartbeat contracts.
- handshake hello/accept/reject and protocol version negotiation.
- base protocol error contract.
- runtime guards for message kind, peer role, JSON payload and complete envelopes.
- all three apps consume the canonical protocol through `workspace:*`.
- Build 7 regression gate preventing environment-specific protocol authority or duplicated schema literals in apps.

## Boundaries preserved

This Build deliberately does not implement Event Bus routing, WebSocket/HTTP transports, durable job semantics, security capabilities, GitHub launcher behavior or Studio UI.

The `features` field used during handshake is negotiation metadata only and cannot authorize privileged behavior.

## Validation

Build 7 is accepted only when:

1. Build 4 decoupling remains green.
2. Build 5 identity remains green.
3. Build 6 monorepo foundation remains green.
4. Build 7 protocol regression passes.
5. all pnpm workspaces typecheck.
6. inherited modern engines remain present for later migration.

## Safety

No Release, OTA, Chrome Store publication, production deployment, production backend mutation or DNS change is authorized by this Build.
