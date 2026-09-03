# Shared Protocol

Build 7 establishes the canonical wire contract shared by GitHub Decrypter Studio, the Chrome extension bridge and the Local Runtime.

## Authority

The single protocol package is:

`@github-decrypter/protocol`

Current wire schema:

`gd-protocol/1`

Current protocol version:

`1`

No app may define a competing protocol schema literal. Studio, Extension and Local Runtime consume the workspace package directly.

## Peer roles

The V1 protocol recognizes three transport-neutral peer roles:

- `studio`
- `extension`
- `local-runtime`

A peer descriptor carries a branded peer ID, product identity, product version and optional session ID.

## Envelope

Every wire message uses the same envelope:

```text
schema
version
kind
meta
  messageId
  timestamp
  source
  destination?
  correlationId?
  causationId?
  traceId?
payload
```

The metadata model is designed to support request correlation, causal chains and tracing without requiring any particular transport.

Payloads must be plain JSON-safe values. Protocol helpers and boundary guards reject functions, `undefined`, non-finite numbers, cyclic objects and class instances.

## Message kinds

Build 7 freezes the base message families only:

- `handshake.hello`
- `handshake.accept`
- `handshake.reject`
- `request`
- `response`
- `event`
- `heartbeat`

Domain-specific commands and events are intentionally not centralized here yet. Later packages may define typed command/event names while reusing this envelope.

## Request / response

Requests contain a command name and input. Responses are discriminated by `ok`:

```text
ok: true  -> data
ok: false -> ProtocolError
```

The base error vocabulary includes malformed messages, unsupported protocol versions, unknown commands, invalid requests, timeouts, unavailable peers, conflicts and internal errors. Later security Builds may add security-specific error semantics without replacing the base error shape.

## Version negotiation

Handshake peers advertise supported numeric versions. `selectProtocolVersion()` selects the highest common version supported by the current package. No silent downgrade outside the package-supported version set is allowed.

The handshake `features` field is descriptive protocol negotiation only. It is **not** the security Capability Model from Build 15 and cannot grant authority.

## Environment neutrality

`packages/protocol` must remain independent from:

- Chrome extension APIs
- DOM/browser globals
- Node.js APIs
- WebSocket
- HTTP/fetch
- database clients
- AI providers

Transport adapters belong to later Builds. The shared protocol describes data, not connection ownership.

## Explicit non-goals for Build 7

Build 7 does not implement:

- Event Bus routing (Build 8)
- Architecture Guardian (Build 9)
- Local daemon transport (Build 10)
- durable jobs (Build 12)
- Capability Security Model (Build 15)
- GitHub launcher behavior (Build 25/26)
- Studio UI (Build 27+)

This separation prevents the wire vocabulary from becoming coupled to an unfinished runtime implementation.
