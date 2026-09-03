# GitHub Decrypter Changelog

The active changelog uses the independent GitHub Decrypter Build numbering. Earlier predecessor history remains available through Git history and `GITHUB_DECRYPTER_ORIGIN.md`.

## Build 15 — Capability Security Model — 2026-09-03

### Capability security
- Added SQLite migration 5 with `gd_capability_grants` and `gd_capability_claims` owned exclusively by the Local Runtime.
- Added deny-by-default `READ`, `WRITE`, `EXECUTE`, `NETWORK`, `DATABASE_WRITE`, `GIT_WRITE`, `DESTRUCTIVE` and `SECRETS` capabilities.
- Added job-bound grants with explicit `gd://` resource scopes, deterministic exact/prefix matching, bounded TTL and explicit revocation.
- Kept capabilities independent: no capability implies another, and multi-authority operations must satisfy every required claim.

### Token security
- Added opaque 256-bit capability tokens while persisting only SHA-256 token hashes.
- Added no plaintext token persistence, health exposure or Event Bus token exposure.
- Made grants process-bound before Secrets Vault exists; active grants from an older runtime process are revoked on startup.
- Added graceful-shutdown revocation and terminal-job denial.

### Runtime
- Integrated Capability Security after recovery/offline initialization and before daemon readiness.
- Added `gd.local.capability.ready`, `gd.local.capability.granted`, `gd.local.capability.revoked` and `gd.local.capability.denied` events.
- Added non-sensitive capability readiness/counts to health/readiness.
- Kept capability grant/control HTTP/RPC absent so Studio, Extension and models cannot self-grant authority.
- Kept `NETWORK` authorization independent from Build 14 connectivity availability.

### Architecture Guardian
- Added Capability Security ownership gates and AG130–AG138.
- Blocked capability persistence outside `apps/local`, plaintext token persistence and premature external grant transport.
- Kept Secrets Vault blocked until Build 16, Approval Transactions until Build 17 and Audit Ledger until Build 18.
- Made historical Build 13/14 capability-blocking regressions phase-aware now that Build 15 legitimately owns Capability Security.

### Validation
- Proved no/unknown token denial, job binding, exact/prefix scopes, no implicit capability inheritance and multi-capability enforcement.
- Proved token hash-only persistence, expiry, revocation, terminal-job denial and restart fail-closed behavior.
- Proved daemon readiness integration and absence of capability/job-control endpoints.
- Added AG131–AG137 failure injection plus the full Build 4–14 regression chain, TypeScript workspace checks and preservation of modern-engine migration assets.

### Safety
- No Secrets Vault, Approval Transactions, Audit Ledger, external grant transport, Tool Runtime, Git/GitHub write provider, Release, OTA, store publication, production deployment, production backend mutation or DNS change is authorized by this Build.

## Build 14 — Offline Execution — 2026-09-03

### Offline execution
- Added SQLite migration 4 with durable `gd_connectivity_state`, `gd_connectivity_events` and `gd_job_network_requirements` state.
- Added explicit `unknown | online | offline` connectivity semantics, with `unknown` failing closed for network-required work.
- Added network-required job classification, durable network waits and deterministic resume when connectivity returns.
- Kept local-safe jobs claimable and executable while connectivity is unavailable.
- Added cooperative `waitForNetwork()` for already-running network-dependent jobs without resetting consumed attempt budgets.

### Runtime
- Integrated Offline Execution after Crash & Power Recovery reconciliation and before daemon readiness.
- Added `gd.local.offline.ready`, `gd.local.connectivity.changed`, `gd.local.offline.waiting` and `gd.local.offline.resumed` Event Bus events.
- Added non-sensitive offline/connectivity status to health/readiness while allowing the daemon to remain ready for local work when offline.
- Kept connectivity control and job-control HTTP/RPC absent.
- Deliberately added no automatic outbound internet, DNS, HTTP or socket probe.

### Architecture Guardian
- Added Offline Execution ownership gates and AG120–AG124.
- Blocked connectivity persistence outside `apps/local`.
- Blocked automatic outbound network probes in the Local Runtime during this phase.
- Kept Capability Security blocked until Build 15.
- Made the Build 13 AG112 regression phase-aware now that Build 14 legitimately owns Offline Execution.

### Validation
- Proved local durable jobs continue while connectivity is unknown/offline.
- Proved network-required jobs wait durably, resume only when connectivity returns, preserve attempt budgets and reject stale leases.
- Proved generic non-network waiting jobs are isolated from connectivity transitions and offline state survives restart.
- Proved daemon health/readiness remains available for local work without network.
- Added AG121/AG122/AG123 failure injection plus the full Build 4–13 regression chain, TypeScript workspace checks and preservation of 46 modern-engine migration assets.

### Safety
- No Capability Security, Secrets Vault, external provider network authority, generic connectivity/job-control RPC, Release, OTA, store publication, production deployment, production backend mutation or DNS change is authorized by this Build.

## Build 13 — Crash & Power Recovery — 2026-09-03

### Recovery
- Added durable `gd_runtime_sessions` and `gd_job_recoveries` persistence on SQLite migration 3.
- Added deterministic startup reconciliation of orphaned `running` jobs before Local Runtime readiness.
- Added expired-lease recovery sweeps while the daemon remains alive.
- Preserved checkpoints, user pause/cancel intent and consumed attempt budgets across interruption while invalidating stale worker leases.
- Added graceful-shutdown handoff plus clean-shutdown and later-reconciliation session markers.

### Runtime
- Integrated recovery startup, health and shutdown into the Local Runtime lifecycle.
- Added `gd.local.recovery.ready`, `gd.local.recovery.sweep` and `gd.local.recovery.closed` events.
- Made readiness fail closed when recovery is not ready/healthy while exposing only non-sensitive recovery status.
- Kept recovery/job mutation transport internal; `/v1/jobs` remains absent.

### Architecture Guardian
- Added recovery ownership gates and AG111–AG114.
- Kept Offline Execution blocked until Build 14 and Capability Security blocked until Build 15.
- Made the Build 12 AG102 regression phase-aware now that Build 13 legitimately owns crash recovery.

### Validation
- Proved unclean restart detection, startup recovery, checkpoint-preserving requeue, pause/cancel intent preservation, retry-exhaustion failure and stale lease rejection.
- Proved expired-lease sweep, recovery idempotency, graceful-shutdown handoff, clean-session reconciliation and daemon restart/readiness integration.
- Added AG111/AG112/AG113 failure injection plus the full Build 4–12 regression chain, TypeScript workspace checks and preservation of 46 modern-engine migration assets.

### Safety
- No Offline Execution, Capability Security, Secrets Vault, Approval Transactions, product-wide Audit Ledger, generic job-control HTTP/RPC, Release, OTA, store publication, production deployment, production backend mutation or DNS change is authorized by this Build.

## Build 12 — Durable Job Engine — 2026-09-03

### Jobs
- Added persistent `gd_jobs`, dependency DAG and internal transition history on SQLite migration 2.
- Added deterministic priority/insertion-order scheduling with atomic `BEGIN IMMEDIATE` claims.
- Added worker IDs, random lease tokens, lease heartbeat/expiry tracking and attempt budgets.
- Added checkpoint, wait, pause/resume, cancel, skip, completion, failure and explicit retry semantics.
- Added recursive dependency-cycle rejection and dependency gating where completed/skipped prerequisites satisfy downstream work.

### Runtime
- Integrated the Durable Job Engine into Local Runtime startup/readiness.
- Added `gd.local.jobs.ready` and `gd.local.job.changed` events.
- Added non-sensitive job readiness/counts to health/readiness while keeping job-control HTTP absent.
- Persisted queue state across database and daemon restarts.

### Architecture Guardian
- Added job authority rules owned exclusively by `apps/local`.
- Blocked automatic crash/power recovery before Build 13.
- Blocked job-control transport before the owning Jobs Center phase.
- Kept the narrow `cortex.yml` generated-map write exception unchanged.

### Validation
- Proved deterministic queueing, DAG blocking, cycle rejection, lease-token enforcement, heartbeat, checkpoint/resume, pause/resume, wait/resume, cancel, skip, retry budget and expired-lease detection.
- Proved expired `running` jobs persist and are detected but are not auto-recovered in Build 12.
- Added AG101/AG102/AG103 failure injection plus the full Build 4–11 regression chain, TypeScript workspace checks and modern-engine preservation.

### Safety
- No automatic crash recovery, offline execution, capability security, generic job-control RPC, Release, OTA, store publication, production deployment, production backend mutation or DNS change is authorized by this Build.

## Build 11 — Persistent Local Database — 2026-09-03

### Database
- Added file-backed SQLite owned exclusively by `apps/local` through Node 22 `node:sqlite`.
- Added OS-aware storage paths, WAL, foreign keys, busy timeout, trusted-schema hardening and integrity-gated readiness.
- Added checksummed transactional migrations with fail-closed provenance and future-schema validation.
- Added schema v1 with only `gd_schema_migrations` and `gd_metadata`, plus JSON-safe metadata persistence and rollback transactions.

### Runtime
- Integrated database open/close into the Local Runtime lifecycle.
- Added `gd.local.database.opened` and `gd.local.database.closed` events.
- Extended health/readiness with non-sensitive database state without exposing filesystem paths or generic SQL/database RPC.

### Architecture Guardian
- Pinned `node:sqlite` authority to `apps/local` and blocked Durable Job Engine schema before Build 12.
- Reconciled the pre-existing project-map `cortex.yml` workflow with a narrow write scope limited to `graphify-out/**`, plain `git push`, no tags/releases/deploys.

### Validation
- Proved persistence across database reopen and daemon restart, WAL, foreign keys, rollback, integrity checks, migration tamper rejection and future-schema rejection.
- Added failure injection for SQLite authority escape, premature job schema and project-map write-scope expansion.
- Build 4–10 regressions, all TypeScript workspaces and modern-engine preservation remain prerequisites.

### Safety
- No Durable Job Engine, crash recovery, capability security, generic database RPC, Release, OTA, store publication, production deployment, production backend mutation or DNS change is authorized by this Build.

## Build 10 — Local Runtime Daemon — 2026-09-03

### Runtime
- Promoted `@github-decrypter/local` from placeholder to an independent Node.js daemon process.
- Added loopback-only HTTP binding, default port `43110`, health/readiness endpoints and bounded JSON intake.
- Added `gd-protocol/1` handshake negotiation with explicit accept/reject behavior.
- Added deterministic lifecycle states, Central Event Bus lifecycle events and graceful SIGINT/SIGTERM shutdown.
- Added single-instance coordination with stale-lock recovery.

### Architecture
- Kept the daemon deliberately non-privileged at the RPC surface: no file/tool/Git/model/database/job execution endpoint exists yet.
- Extended the Architecture Guardian with explicit local-app dependency and browser-platform boundaries.
- Advanced the canonical root version and Guardian Build authority to Build 10.

### Validation
- Added structural, compile-time and real loopback runtime tests.
- Added failure injection proving the app Guardian rejects browser authority and undeclared workspace/external dependencies.
- Build 4–9 regressions, all TypeScript workspaces and modern-engine preservation remain prerequisites.

### Safety
- No Release, OTA, store publication, production deployment, production backend mutation or DNS change is authorized by this Build.

## Build 9 — Architecture Guardian — 2026-09-03

### North Star
- Adopted the GitHub Decrypter North Star Manifesto as an official repository authority.
- Recorded source SHA-256 provenance and principles P01–P22.
- Formalized the paid monthly/semiannual/annual/lifetime commercial direction plus a 24-hour free trial.
- Formalized local-first without false unlimited-token/context/compute claims.
- Added Constitutional Amendment 001 instead of silently rewriting the frozen Constitution.
- Mapped Adaptive User Profile, Named Agents, Mentor, Explain This, Voice, Perception, Explore Mode, Visual Mapping, Interactive QA and Adaptive Explanation into existing Builds without decimal Build numbering.

### Architecture Guardian
- Added machine-readable `architecture.guardian.json`.
- Added `scripts/architecture-guardian.mjs` with stable `AGxxx` violations.
- Enforced authority-document presence, monorepo boundaries, sensitive package dependency rules, phase gates and inherited-authority regression checks.
- Kept workflows fail-closed against write/release authority until explicitly amended by the owning future Build.
- Added North Star review questions to the PR template and Definition of Done.

### Validation
- Added Build 9 regression tests and Architecture Guardian CI.
- Build 4–8 regressions, full TypeScript workspace checks and modern-engine preservation remain prerequisites.

### Safety
- No Release, OTA, store publication, production deployment, production backend mutation or DNS change is authorized by this Build.

## Build 8 — Central Event Bus — 2026-09-03

### Events
- Promoted `@github-decrypter/shared` into the owner of the deterministic in-process Event Bus primitive.
- Added typed `gd.*` event names, `gd_evt_*` IDs and JSON-safe payload boundaries.
- Added correlation, causation and trace metadata compatible with the Build 7 protocol vocabulary.
- Added exact subscriptions, one-shot subscriptions and global observers.
- Added mutation-safe sequential dispatch, listener limits, idempotent unsubscribe and handler-failure isolation.

### Architecture
- Preserved `@github-decrypter/protocol` as the only wire contract.
- Event Bus remains in-process only: no WebSocket/HTTP/Chrome transport, durable queue, retry scheduler, database or security authority.
- No hidden global singleton is created; future composition roots own their bus instance.

### Validation
- Added structural and runtime Event Bus tests plus full workspace typechecking.
- Build 4/5/6/7 and modern-engine preservation remain prerequisites.

### Safety
- No Release, OTA, store publication, deployment, production backend mutation or DNS change is authorized by this Build.

## Build 7 — Shared Protocol — 2026-09-03

### Protocol
- Promoted `@github-decrypter/protocol` from placeholder to the canonical shared wire contract.
- Added schema `gd-protocol/1`, version negotiation, peer roles, branded IDs, envelopes, request/response/event/heartbeat messages, handshake contracts and protocol errors.
- Added JSON-safety and envelope boundary guards.
- Bound Studio, Extension and Local Runtime workspaces to the same protocol package via `workspace:*`.

### Architecture
- Kept the protocol environment-neutral: no Chrome, DOM, Node, HTTP, WebSocket, database or provider authority.
- Kept Event Bus routing, durable jobs and the Capability Security Model in their later frozen Builds.

### Validation
- Added Build 7 regression checks and retained Build 4/5/6 plus modern-engine preservation as prerequisites.

### Safety
- No Release, OTA, store publication, deployment, production backend mutation or DNS change is authorized by this Build.

## Build 6 — Monorepo Foundation — 2026-09-02

### Foundation
- Added canonical pnpm workspace root and strict shared TypeScript configuration.
- Added application boundaries for Studio, Extension and Local Runtime.
- Added initial domain package boundaries for UI, Protocol, Shared, Git, Workspace, Chat, Plan, Build, Preview, Context, Tools, Scope and AI.
- Kept inherited modern engines as migration inputs rather than prematurely moving them into unfinished packages.

### Validation
- Added Build 6 structural regression checks and workspace type-checking.
- Build 4 decoupling, Build 5 identity and modern-engine preservation remain CI prerequisites.

### Safety
- No Release, OTA, store publication, deployment, production backend mutation or DNS change is authorized by this Build.

## Build 5 — GitHub Decrypter Rebrand — 2026-09-02

### Identity
- Canonical product name became **GitHub Decrypter**.
- Canonical storage/protocol namespace became `gd-*` / `gd_*`.
- Active README and manifest stopped describing the inherited predecessor product.

### Independence
- Inherited hosted Vault, release-feed and store endpoints stopped being product defaults/authorities.
- Legacy local settings migration became one-shot.

### Safety
- Extension remained intentionally inert until the GitHub-native launcher is introduced by the frozen roadmap.
