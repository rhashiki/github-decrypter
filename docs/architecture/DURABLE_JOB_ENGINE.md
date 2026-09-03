# Durable Job Engine

Build 12 makes durable jobs a first-class authority of the independent Local Runtime.

## Authority

`apps/local` owns durable job persistence and queue decisions. Studio, Extension and packages do not own the queue and do not write its SQLite tables directly.

The engine is internal to the Local Runtime in this Build. There is intentionally no `/v1/jobs` control surface yet.

## Persistent schema

SQLite migration 2 adds:

- `gd_jobs` — durable job state, payload, priority/order, attempts, worker lease, checkpoint/result/error and control requests;
- `gd_job_dependencies` — directed prerequisite edges;
- `gd_job_transitions` — internal state-transition history.

`gd_job_transitions` is an operational job history, not the product Audit Ledger. The broader audit authority belongs to Build 18.

## States

```text
queued
  ↓ claim
running
  ├─→ checkpointed ─→ queued
  ├─→ waiting ──────→ queued
  ├─→ paused ───────→ queued
  ├─→ completed
  ├─→ failed ───────→ queued (manual retry within maxAttempts)
  └─→ cancelled

queued / waiting / paused / checkpointed
  └─→ skipped or cancelled
```

Terminal states are `completed`, `failed`, `cancelled` and `skipped`.

## Queue and DAG semantics

Runnable jobs are selected atomically under `BEGIN IMMEDIATE` using:

1. state `queued`;
2. `available_at <= now`;
3. remaining attempt budget;
4. every prerequisite in `completed` or `skipped`;
5. highest priority first;
6. stable insertion order second.

Dependency edges are immutable after the first attempt begins. Additional edges are cycle-checked with a recursive CTE.

## Claims and leases

Every claim receives:

- worker ID;
- random `gd_lease_*` token;
- lease expiry;
- incremented attempt count.

Worker mutations that complete, fail, checkpoint, wait or acknowledge pause/cancel require the active lease token. This prevents a stale worker from mutating a claim after a later owner replaces that token.

Build 12 can detect expired leases through `listExpiredLeases()` but does not automatically requeue them. Automatic crash/power recovery is Build 13.

## Control semantics

- pause/cancel on a non-running job transition immediately;
- pause/cancel on a running job set durable request flags;
- the active worker acknowledges the request with its lease token;
- `resume()` returns paused/waiting/checkpointed work to `queued`;
- `retry()` returns a failed job to `queued` only while `attempt_count < max_attempts`;
- `skip()` is available before terminal completion and satisfies downstream dependency edges.

## Daemon integration

After SQLite migrations complete, daemon startup validates the job engine and emits `gd.local.jobs.ready`.

`/healthz` exposes only non-sensitive job counts/readiness. `/readyz` requires both database and job-engine readiness.

No queue payloads, job IDs, database paths, lease tokens or job-control methods are exposed through HTTP in Build 12.

## Build boundaries

Build 12 does not implement:

- automatic stale-running recovery after crash/power loss — Build 13;
- network-aware waiting/retry/offline execution — Build 14;
- capability enforcement for privileged jobs — Build 15;
- secrets — Build 16;
- approval transactions — Build 17;
- product-wide Audit Ledger — Build 18;
- Jobs Center UI/control transport — Build 47;
- AI task checkpoint semantics — Build 56.
