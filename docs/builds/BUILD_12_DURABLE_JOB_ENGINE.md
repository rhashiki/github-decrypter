# Build 12 — Durable Job Engine

Status: **IMPLEMENTED ON BUILD BRANCH**

## Purpose

Give the Local Runtime a durable, deterministic and inspectable execution queue on top of Build 11 SQLite persistence, without prematurely implementing crash recovery, offline orchestration or privileged capabilities.

## Implemented

- SQLite migration 2 for durable jobs;
- persistent `gd_jobs` queue;
- prerequisite DAG through `gd_job_dependencies`;
- operational transition history through `gd_job_transitions`;
- JSON-safe payload/checkpoint/result/error storage;
- stable priority + insertion-order scheduling;
- atomic claim under SQLite transaction;
- worker IDs and random lease tokens;
- lease heartbeat/expiry tracking;
- max-attempt budget and explicit retry;
- checkpoint/wait/pause/resume lifecycle;
- durable pause/cancel request flags for running jobs;
- worker acknowledgement for pause/cancel;
- completion/failure/cancellation/skipping terminal paths;
- recursive dependency cycle rejection;
- expired-lease detection without automatic recovery;
- `gd.local.jobs.ready` and `gd.local.job.changed` Event Bus events;
- job readiness/counts in health/readiness endpoints;
- Architecture Guardian job authority rules.

## Explicit exclusions

Build 12 does not implement:

- automatic stale-running requeue/recovery — Build 13;
- crash/power recovery policy — Build 13;
- offline/network-aware execution — Build 14;
- capability enforcement — Build 15;
- secrets — Build 16;
- approval transactions — Build 17;
- product-wide audit ledger — Build 18;
- workspace/Git execution — Builds 19+;
- job-control HTTP/RPC surface or Jobs Center — Build 47;
- AI checkpoint engine — Build 56.

## Acceptance criteria

- [x] jobs survive database/daemon restart;
- [x] runnable selection is deterministic;
- [x] claims are atomic;
- [x] lease token is required for running-worker state transitions;
- [x] prerequisites block dependents until completed/skipped;
- [x] dependency cycles are rejected;
- [x] checkpoint/wait/pause can resume to queued;
- [x] failure can retry only within maxAttempts;
- [x] cancel and skip persist as terminal states;
- [x] expired running leases can be detected;
- [x] Build 12 does not automatically recover expired leases;
- [x] job control is not exposed over HTTP;
- [x] SQLite authority remains inside `apps/local`;
- [x] no external queue/database service is required;
- [x] no Release, OTA, store publication, deploy, production backend mutation or DNS mutation is performed.

## Architecture Guardian

Build 12 adds:

- `AG101` — durable job persistence escaped `apps/local`;
- `AG102` — automatic crash recovery arrived before Build 13;
- `AG103` — job-control transport arrived before Build 47;
- `AG104` — required Durable Job Engine artifact missing.

Failure injection proves AG101/AG102/AG103 and then verifies the restored tree passes.

## Validation

- structural Build 12 regression;
- TypeScript compilation of the Local Runtime and runtime test;
- real SQLite queue/DAG/lease/checkpoint/control/retry tests;
- persistence across database and daemon restarts;
- health/readiness integration;
- job-control HTTP absence;
- Build 4–11 regression chain;
- modern-engine migration-asset preservation.

## North Star review

- durable execution continues outside browser state: **yes**;
- the user retains control through pause/cancel semantics: **yes**;
- hidden cloud queue authority is introduced: **no**;
- expired jobs are silently recovered before the owning Build: **no**;
- privileged execution is granted before capability security: **no**.

## Next Build

Build 13 — Crash & Power Recovery.
