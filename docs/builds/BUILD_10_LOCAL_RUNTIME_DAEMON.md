# Build 10 — Local Runtime Daemon

Status: **IMPLEMENTED ON BUILD BRANCH**

## Purpose

Create the first real independent local execution process for GitHub Decrypter without prematurely implementing persistence, durable jobs, capability security, AI serving, Git mutation or tooling authority.

## Implemented

- promoted `apps/local` from placeholder to real Node.js daemon authority;
- loopback-only host validation;
- configurable local port with stable default `43110`;
- exclusive single-instance lock with stale-lock recovery;
- lifecycle states `idle → starting → running → stopping → stopped`, plus `failed`;
- lifecycle publication through `gd.local.lifecycle` on the Build 8 Event Bus;
- `/healthz` using schema `gd-local-health/1`;
- `/readyz` using schema `gd-local-readiness/1`;
- `/v1/handshake` using the Build 7 `gd-protocol/1` contract;
- protocol-version negotiation and `handshake.accept` / `handshake.reject`;
- bounded JSON request body;
- graceful SIGINT/SIGTERM shutdown;
- real runtime behavior tests.

## Explicit exclusions

Build 10 does not implement:

- Persistent Local Database — Build 11;
- Durable Job Engine — Build 12;
- crash/power resume — Build 13;
- Offline Execution orchestration — Build 14;
- Capability Security Model — Build 15;
- Secrets Vault — Build 16;
- Approval Transactions — Build 17;
- Audit Ledger — Build 18;
- Workspace Manager — Build 19;
- Git Runtime — Build 21;
- model serving / Local AI Runtime — later AI Builds;
- Studio React/Vite — Build 27;
- extension activation — Build 25;
- release/deployment authority.

No generic privileged RPC endpoint exists in this Build.

## Acceptance criteria

- [x] `apps/local` is an independent executable process boundary.
- [x] daemon refuses non-loopback bind addresses.
- [x] port `0` can be used for isolated tests while default production-development port remains deterministic.
- [x] second daemon instance using the same lock is rejected.
- [x] stale lock handling is implemented.
- [x] health endpoint reports product/build/version/state/PID/address/protocol.
- [x] readiness reports the running state.
- [x] protocol handshake succeeds for a common supported version.
- [x] incompatible protocol negotiation fails closed.
- [x] request body is bounded.
- [x] SIGINT/SIGTERM trigger graceful shutdown.
- [x] lock is released on graceful shutdown.
- [x] lifecycle transitions are emitted through the Central Event Bus.
- [x] no database/job/security/tool/Git/model authority is mixed into Build 10.
- [x] Architecture Guardian remains authoritative.
- [x] no Release, OTA, store publication, deploy, production DB mutation or DNS mutation is performed.

## Validation

Build 10 adds:

- `scripts/test-build10-local-runtime-daemon.mjs` — structural regression;
- `scripts/tsconfig.build10-tests.json` — compile-time validation;
- `scripts/test-build10-local-runtime-runtime.ts` — real daemon lifecycle/network behavior;
- `.github/workflows/build10-local-runtime-daemon.yml` — CI gate.

The runtime test starts the daemon on an ephemeral loopback port, verifies health/readiness and protocol negotiation, verifies instance locking and public-bind rejection, then performs graceful shutdown.

## North Star review

- Moves privileged execution out of browser lifecycle: **yes**.
- Strengthens local-first autonomy: **yes**.
- Removes user control: **no**.
- Silently executes sensitive actions: **no**.
- Claims unlimited local resources/context/tokens: **no**.
- Improves the foundation needed to turn user intent into durable software work: **yes**.

## Next Build

Build 11 — Persistent Local Database.
