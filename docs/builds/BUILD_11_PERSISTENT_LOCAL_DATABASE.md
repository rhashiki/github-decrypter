# Build 11 — Persistent Local Database

Status: **COMPLETE — VALIDATED FOR MERGE**

## Purpose

Give the independent Local Runtime a durable local database foundation before the Durable Job Engine, recovery, security and workspace layers are implemented.

## Implemented

- SQLite through Node 22 `node:sqlite`;
- OS-aware local data path plus `GD_LOCAL_DB_PATH` / `GD_LOCAL_DATA_DIR` overrides;
- restrictive local directory/file permissions where supported;
- WAL journal mode;
- foreign-key enforcement;
- busy timeout, trusted-schema hardening and normal synchronous mode;
- `PRAGMA quick_check` readiness requirement;
- migration ledger with SHA-256 provenance;
- transactional migrations and `PRAGMA user_version`;
- fail-closed migration checksum/name validation;
- fail-closed rejection of newer unsupported schemas;
- schema version 1 with only `gd_schema_migrations` and `gd_metadata`;
- JSON-safe metadata persistence;
- synchronous transaction helper with rollback;
- database open/close integrated into daemon lifecycle;
- `gd.local.database.opened` and `gd.local.database.closed` events;
- database readiness included in `/healthz` and `/readyz` without exposing filesystem paths;
- database authority Architecture Guardian.

## Explicit exclusions

Build 11 does not implement:

- Durable Job Engine or job/queue schema — Build 12;
- crash/power recovery — Build 13;
- Offline Execution orchestration — Build 14;
- Capability Security Model — Build 15;
- Secrets Vault — Build 16;
- Approval Transactions — Build 17;
- Audit Ledger — Build 18;
- Workspace/Git state — Builds 19+;
- model/runtime persistence for AI — later AI Builds;
- generic SQL/database network endpoints.

## Acceptance criteria

- [x] database is owned only by `apps/local`;
- [x] no external DB service/package is required;
- [x] database persists data after close/reopen;
- [x] daemon restart sees previously committed local metadata;
- [x] WAL is active;
- [x] foreign keys are active;
- [x] integrity check passes before readiness;
- [x] migration history is checksummed and fail-closed;
- [x] future unsupported schema fails closed;
- [x] transaction rollback is proven by runtime test;
- [x] health/readiness include DB readiness but not local DB path;
- [x] no job/queue/checkpoint schema arrives early;
- [x] Architecture Guardian rejects SQLite authority outside `apps/local`;
- [x] scoped project-map workflow write authority remains bounded to generated `graphify-out/**` content;
- [x] no Release, OTA, store publication, deploy, production backend mutation or DNS mutation is performed.

## Validation

Build 11 adds:

- `scripts/test-build11-persistent-local-database.mjs` — structural policy regression;
- `scripts/tsconfig.build11-tests.json` — compile-time validation;
- `scripts/test-build11-persistent-local-database-runtime.ts` — real file-backed SQLite persistence, migration, rollback, daemon restart and tamper tests;
- `scripts/test-build11-database-guardian-negative.mjs` — failure injection for authority escape and premature job schema;
- `scripts/test-build11-workflow-guardian-negative.mjs` — failure injection for the scoped project-map write exception;
- `.github/workflows/build11-persistent-local-database.yml` — read-only CI gate.

Validated behavior includes WAL, foreign keys, persistence across database reopen and daemon restart, rollback, migration-provenance rejection, future-schema rejection, full workspace typechecking and preservation of the 46 modern migration assets.

Previous Build 10 runtime/CLI tests were made forward-compatible and given explicit temporary database paths so regression tests never write into the runner's normal user data directory.

## Base-main workflow reconciliation

The Build 11 branch was created from the then-current `main` commit `8689533066970bf180d75524bd522b071700d9aa`, which already contained `.github/workflows/cortex.yml` for generated project-map updates. That workflow requests `contents: write` to commit `graphify-out/`, so the Build 9 Guardian correctly rejected it as `AG070` until its authority was explicitly reconciled.

Build 11 does not grant that workflow general repository-write or release authority. The Guardian now allows exactly `.github/workflows/cortex.yml` under a separate scoped rule that requires:

- only `contents: write`;
- staged paths restricted to `graphify-out`;
- only plain `git push`;
- no tags;
- no releases;
- no deployment/publish commands.

Negative tests prove that broadening `git add` outside `graphify-out` or changing the push to `git push --tags` fails closed. This reconciliation preserves the pre-existing project-map automation without weakening the general workflow write policy.

## North Star review

- strengthens local-first autonomy: **yes**;
- makes durable execution possible without a cloud database: **yes**;
- creates hidden remote authority: **no**;
- exposes database/SQL mutation to browser clients before capability security: **no**;
- claims unlimited local resources: **no**;
- preserves the user as final authority: **yes**.

## Next Build

Build 12 — Durable Job Engine.
