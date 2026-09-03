# Local Runtime Daemon

Status: **Build 10 authority**

`apps/local` is the first privileged process boundary of GitHub Decrypter. It is an independent Node.js process whose lifecycle is not owned by the Chrome extension, Studio tab, chat view, or React state.

## Build 10 responsibility

Build 10 establishes only the daemon foundation:

- independent Node.js process entrypoint;
- loopback-only HTTP listener;
- deterministic lifecycle state machine;
- single-instance coordination lock;
- `/healthz` liveness endpoint;
- `/readyz` readiness endpoint;
- `gd-protocol/1` handshake endpoint;
- graceful `SIGINT` / `SIGTERM` shutdown;
- in-process Central Event Bus lifecycle events.

It intentionally does **not** introduce privileged coding operations yet.

## Network boundary

Default bind:

```text
127.0.0.1:43110
```

Configuration:

- `GD_LOCAL_HOST` — accepted only when it is `127.0.0.1` or `::1`;
- `GD_LOCAL_PORT` — integer `0..65535`; port `0` is useful for tests;
- `GD_LOCAL_LOCK_PATH` — optional lock path override for controlled environments/tests.

A public bind such as `0.0.0.0` is rejected before the server starts.

Build 10 does not enable CORS, remote-network access, file writes, command execution, Git mutations, model execution, database writes, deploys, or other privileged RPCs. Later security/capability Builds must be in place before such authority is exposed over this boundary.

## Endpoints

### `GET /healthz`

Returns `gd-local-health/1` with product/build/version, lifecycle state, PID, bound loopback address, start timestamp, uptime and protocol schema.

### `GET /readyz`

Returns `gd-local-readiness/1`. HTTP 200 means the daemon lifecycle state is `running`; non-ready state returns HTTP 503 when the listener is available.

### `POST /v1/handshake`

Accepts a `gd-protocol/1` `handshake.hello` envelope.

The daemon selects the highest mutually supported protocol version through the shared protocol package. Success returns `handshake.accept`; no common version returns HTTP 426 with `handshake.reject` / `UNSUPPORTED_PROTOCOL`.

Request bodies are bounded to 64 KiB. Malformed protocol messages fail closed with HTTP 400.

## Lifecycle

```text
idle
  ↓
starting
  ↓
running
  ↓
stopping
  ↓
stopped
```

Startup errors transition to `failed`.

Every transition is published on the in-process Event Bus as:

```text
gd.local.lifecycle
```

The Event Bus is observational in this Build; it does not become a durable queue or execution scheduler.

## Single-instance coordination

The daemon acquires an exclusive local lock file before opening the listener. The lock contains only:

- schema;
- PID;
- creation timestamp.

A live PID causes a second daemon start to fail. A stale/invalid lock is removed and reacquired. The lock is removed during graceful shutdown.

This lock is lifecycle coordination, **not** the Persistent Local Database from Build 11 and not durable product state.

## Process ownership

The CLI entrypoint is:

```text
apps/local/src/cli.ts
```

Development invocation:

```text
pnpm --filter @github-decrypter/local start
```

Build 10 does not install an OS service, configure startup-at-login, package binaries, or add auto-update. Those responsibilities remain with later installer/distribution Builds.

## Security posture

The daemon now owns process lifetime and loopback transport authority, but it does not yet own capability authorization. Therefore Build 10 deliberately exposes only non-destructive health/readiness and protocol negotiation.

No future endpoint may infer write/execute authority merely because a caller can reach localhost. Build 15 remains the owner of the Capability Security Model and Build 17 remains the owner of approval transactions.

## North Star alignment

The daemon supports the North Star by moving execution ownership away from browser lifecycle, enabling a local-first foundation and preserving user control. It does not pretend local resources are unlimited and does not silently perform sensitive actions.
