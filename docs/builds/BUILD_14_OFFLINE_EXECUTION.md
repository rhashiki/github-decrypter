# Build 14 — Offline Execution

Status: **IMPLEMENTED ON BUILD BRANCH**

## Purpose

Allow the independent Local Runtime to keep executing local-safe durable work when network connectivity is unavailable, while network-dependent work waits durably and resumes deterministically.

## Implemented

- SQLite migration 4;
- durable `unknown | online | offline` connectivity state;
- connectivity transition history;
- explicit network-required job metadata;
- persistent network-blocked waiting state;
- local jobs remain claimable offline;
- network-required queued jobs park in `waiting` offline/unknown;
- network waits resume to `queued` when connectivity returns;
- cooperative `waitForNetwork()` for running work;
- network requirement removal/resume;
- restart reconciliation after Crash & Power Recovery;
- health/readiness offline status;
- Event Bus connectivity/offline events;
- no automatic outbound network probe;
- Architecture Guardian offline authority.

## Acceptance criteria

- [x] local durable work remains executable while offline;
- [x] `unknown` fails closed for network-required work;
- [x] network-required queued work is durably parked rather than failed;
- [x] returning online resumes only network-blocked jobs;
- [x] generic waiting jobs are not incorrectly resumed;
- [x] waiting for connectivity does not decrement or reset attempt budget;
- [x] connectivity/network waits persist across restart;
- [x] daemon can be healthy/ready while offline;
- [x] no automatic outbound connectivity probe exists;
- [x] Capability Security is not implemented early;
- [x] no job-control HTTP/RPC is exposed;
- [x] no Release, OTA, store publication, deploy, production mutation or DNS mutation is performed.

## Architecture Guardian

Build 14 adds:

- `AG120` — Offline Execution policy missing/invalid;
- `AG121` — connectivity/offline persistence escaped `apps/local`;
- `AG122` — automatic/outbound network probing introduced;
- `AG123` — Capability Security introduced before Build 15;
- `AG124` — required Offline Execution artifact missing.

`AG112` from Build 13 becomes phase-aware now that Build 14 legitimately owns Offline Execution.

## Explicit exclusions

- Capability Security Model — Build 15;
- Secrets Vault — Build 16;
- Approval Transactions — Build 17;
- product-wide Audit Ledger — Build 18;
- Workspace/Git/GitHub providers;
- Tool Runtime/model execution;
- Jobs Center/job-control transport — Build 47;
- Background Concurrency — Build 115.

## North Star review

- work that does not need the internet can continue locally: **yes**;
- network-required work waits instead of silently failing: **yes**;
- real limits are exposed rather than hidden: **yes**;
- hidden cloud/network authority is introduced: **no**;
- user control over pause/cancel/recovery remains intact: **yes**.

## Next Build

Build 15 — Capability Security Model.
