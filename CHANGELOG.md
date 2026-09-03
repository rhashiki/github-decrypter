# GitHub Decrypter Changelog

The active changelog uses the independent GitHub Decrypter Build numbering. Earlier predecessor history remains available through Git history and `GITHUB_DECRYPTER_ORIGIN.md`.

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
