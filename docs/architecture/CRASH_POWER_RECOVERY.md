# Crash & Power Recovery

Build 13 makes durable execution recoverable after process crashes, abrupt termination and machine power loss without moving execution authority into browser state.

## Authority

`apps/local` remains the sole owner of recovery policy and recovery persistence.

The Build adds SQLite schema version 3:

- `gd_runtime_sessions` — durable daemon-session journal;
- `gd_job_recoveries` — per-job recovery records tied to the session that performed reconciliation.

These tables are operational recovery records. They are not the product-wide Audit Ledger owned by Build 18.

## Startup reconciliation

The Local Runtime acquires its single-instance lock before opening recovery authority. After the database and Durable Job Engine are ready, a new runtime session is inserted and every job left in `running` is reconciled before readiness is exposed.

Recovery policy is deterministic:

| Interrupted state/flag | Recovery result |
| --- | --- |
| `cancel_requested = 1` | `cancelled` |
| `pause_requested = 1` | `paused` |
| attempts remain | `queued` |
| retry budget exhausted | `failed` |

A requeued job preserves its existing `checkpoint_json`. Recovery never decrements `attempt_count`; the interrupted attempt remains consumed. A later claim consumes the next attempt.

Every recovered job has its prior worker/lease information recorded in `gd_job_recoveries`, while the active job row has `worker_id`, `lease_token` and `lease_expires_at` cleared. This invalidates stale workers after recovery.

## Runtime lease sweeps

While the daemon is running, the recovery coordinator periodically checks only `running` jobs whose lease has expired. The same deterministic policy is applied transactionally.

Sweeps are idempotent because only `running` rows are candidates. Once a job is reconciled, a repeated sweep cannot recover it again.

A sweep failure makes recovery health fail closed until a later successful sweep. Local Runtime readiness requires recovery health.

## Clean shutdown

Before the SQLite database is closed, a graceful daemon stop performs a final handoff of any remaining `running` jobs using the same policy and then marks the runtime session with `clean_shutdown_at` and `shutdown_reason`.

If this sequence cannot complete, the session is deliberately left unclean. The next daemon start sees that unreconciled session and performs startup reconciliation.

Unclean prior sessions are marked `reconciled_at` after a successful later startup so they are not counted repeatedly forever.

## Health and events

Health exposes only non-sensitive recovery state:

- recovery ready/healthy;
- whether a runtime session is active;
- number of unreconciled prior sessions seen at startup;
- startup recovery count;
- most recent lease-sweep count/time.

It does not expose session IDs, lease tokens, database paths or generic recovery mutation endpoints.

Event Bus additions:

- `gd.local.recovery.ready`;
- `gd.local.recovery.sweep`;
- `gd.local.recovery.closed`.

Recovered jobs continue to emit `gd.local.job.changed`.

## Deliberate boundaries

Build 13 does not implement:

- network/offline awareness or network-dependent waiting policy — Build 14;
- capability grants, privilege checks or execution authorization — Build 15;
- secrets — Build 16;
- approval transactions — Build 17;
- product-wide audit authority — Build 18;
- job-control HTTP/RPC or Jobs Center UI — Build 47;
- AI checkpoint orchestration — Build 56.

No Release, OTA, browser-store publication, production deploy, production backend mutation or DNS mutation is authorized by this architecture.
