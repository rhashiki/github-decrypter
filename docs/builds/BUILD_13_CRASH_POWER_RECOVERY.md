# Build 13 — Crash & Power Recovery

Status: **IMPLEMENTED ON BUILD BRANCH**

## Purpose

Make Build 12 durable jobs recover deterministically after daemon crashes, abrupt process termination and machine power loss while keeping recovery authority entirely inside the independent Local Runtime.

## Implemented

- SQLite migration 3;
- durable `gd_runtime_sessions` journal;
- durable `gd_job_recoveries` ledger;
- startup detection of prior unreconciled sessions;
- startup reconciliation of all orphaned `running` jobs before readiness;
- expired-lease recovery sweeps while the daemon is alive;
- deterministic cancel/pause/requeue/fail policy;
- retry-budget preservation;
- checkpoint preservation during requeue;
- stale worker lease invalidation;
- idempotent recovery selection;
- graceful-shutdown handoff of still-running jobs;
- clean-shutdown markers and later reconciliation markers;
- recovery readiness/health integrated into daemon health/readiness;
- recovery lifecycle Event Bus events;
- Architecture Guardian recovery authority.

## Recovery policy

1. `cancel_requested` → `cancelled`.
2. `pause_requested` → `paused`.
3. `attempt_count < max_attempts` → `queued`.
4. otherwise → `failed` with `GD_RECOVERY_ATTEMPTS_EXHAUSTED`.

No recovery path decrements the attempt counter. Requeued jobs retain existing checkpoints and receive a fresh lease only when claimed again.

## Explicit exclusions

Build 13 does not implement:

- Offline Execution — Build 14;
- Capability Security Model — Build 15;
- Secrets Vault — Build 16;
- Approval Transactions — Build 17;
- product-wide Audit Ledger — Build 18;
- workspace/Git/tool/model execution;
- Jobs Center or job-control HTTP/RPC — Build 47;
- Checkpoint Engine orchestration — Build 56.

## Acceptance criteria

- [x] jobs left `running` across an unclean restart are reconciled before readiness;
- [x] prior unclean runtime sessions are detected and later marked reconciled;
- [x] cancel/pause requests survive a crash and determine recovery outcome;
- [x] interrupted jobs with retries remaining return to `queued`;
- [x] interrupted jobs with exhausted retries become `failed`;
- [x] checkpoints survive recovery requeue;
- [x] stale lease tokens cannot mutate recovered jobs;
- [x] expired leases can be recovered while the daemon remains alive;
- [x] recovery is idempotent;
- [x] graceful shutdown hands off running jobs before marking the session clean;
- [x] health/readiness fail closed when recovery is unhealthy;
- [x] no job-control transport is exposed;
- [x] Offline Execution and Capability Security are not implemented early;
- [x] no Release, OTA, store publication, deploy, production backend mutation or DNS mutation is performed.

## Architecture Guardian

Build 13 adds:

- `AG111` — recovery persistence escaped `apps/local`;
- `AG112` — Offline Execution arrived before Build 14;
- `AG113` — Capability Security authority arrived before Build 15;
- `AG114` — required Crash & Power Recovery artifact missing.

`AG102` from Build 12 becomes phase-aware: it remains proof that recovery was blocked before Build 13, but it is no longer expected to reject the now-authorized Build 13 implementation.

## Validation

- structural Build 13 regression;
- TypeScript compilation of Local Runtime and recovery tests;
- real SQLite crash/restart simulation;
- unclean-session reconciliation;
- checkpoint-preserving requeue;
- pause/cancel recovery;
- retry-exhaustion failure;
- stale lease rejection;
- expired-lease sweep;
- idempotency;
- graceful shutdown handoff;
- daemon health/readiness integration;
- AG111/AG112/AG113 failure injection;
- Build 4–12 regressions;
- full workspace typecheck;
- modern-engine preservation.

## North Star review

- durable work survives browser closure and daemon restart: **yes**;
- the user’s pause/cancel intent survives interruption: **yes**;
- hidden cloud recovery authority is introduced: **no**;
- stale workers retain write authority after recovery: **no**;
- offline policy or privileged execution is implemented early: **no**.

## Next Build

Build 14 — Offline Execution.
