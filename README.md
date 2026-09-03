# GitHub Decrypter

GitHub Decrypter is a local-first, Git-native and GitHub-native AI Development Studio.

Target workflow:

`GitHub repository → local workspace → Plan → approved Build → live local preview → diff → commit → push → pull request → optional deploy/domain workflow`

The browser extension is a lightweight GitHub launcher/bridge. The main interface will be a React + TypeScript + Vite PWA Studio, while privileged and durable execution belongs to an independent local runtime rather than browser state.

## Current implementation status

Completed:

- Build 1 — Project Fork & Independence
- Build 2 — Product Constitution & Scope Freeze
- Build 3 — Full Legacy Inventory
- Build 4 — Lovable Decoupling
- Build 5 — GitHub Decrypter Rebrand
- Build 6 — Monorepo Foundation
- Build 7 — Shared Protocol
- Build 8 — Central Event Bus
- Build 9 — Architecture Guardian
- Build 10 — Local Runtime Daemon
- Build 11 — Persistent Local Database
- Build 12 — Durable Job Engine
- Build 13 — Crash & Power Recovery
- Build 14 — Offline Execution

Next: **Build 15 — Capability Security Model**.

The repository has the canonical pnpm/TypeScript topology:

```text
apps/
  studio/
  extension/
  local/

packages/
  ui/ protocol/ shared/ git/ workspace/ chat/ plan/ build/
  preview/ context/ tools/ scope/ ai/
```

`@github-decrypter/protocol` is the single transport-neutral wire contract shared by Studio, Extension and Local Runtime. Its current schema is `gd-protocol/1`.

`@github-decrypter/shared` owns the deterministic in-process Central Event Bus. Events use the `gd.*` namespace, JSON-safe payloads, correlation/causation/trace metadata and isolated sequential delivery. The bus is intentionally not a network transport, durable queue, retry engine or security authority.

`@github-decrypter/local` is a real independent Node.js daemon. It owns loopback-only process/transport authority, file-backed SQLite persistence, the durable job queue, crash/power recovery and connectivity-aware offline scheduling. SQLite uses Node 22 `node:sqlite`, WAL, foreign keys, checksummed migrations and integrity-gated readiness.

Build 12 supplies stable queue ordering, prerequisite DAGs, atomic claims, worker leases, attempt budgets and durable checkpoints. Build 13 adds durable runtime-session journaling plus deterministic recovery of interrupted jobs. Build 14 adds persistent `unknown | online | offline` connectivity state and explicit network-required job metadata: local-safe work remains claimable without network, while network-required work waits durably and returns to the queue when connectivity is restored.

Build 14 deliberately performs no automatic outbound connectivity probe. `unknown` fails closed for network-required work, but network availability is not required for the daemon to be healthy and ready for local execution. Connectivity observations are supplied through the in-process Local Runtime boundary until later provider/security Builds own external network authority.

There is still no generic SQL, coding, tool, Git, model, connectivity-control or job-control HTTP endpoint. Privileged capability enforcement remains reserved for Build 15. The default development endpoint is `127.0.0.1:43110`. Run it with:

```bash
pnpm --filter @github-decrypter/local start
```

The Architecture Guardian enforces product authorities, app/package boundaries, SQLite ownership, durable-job ownership, recovery ownership, Offline Execution ownership, phase gates, outbound-probe restrictions and the narrow write scope of the generated project-map workflow.

## North Star

The North Star Manifesto is an official repository authority together with the Product Constitution. Its direction is:

> Entenda a pessoa.  
> Entenda o projeto.  
> Construa com ela.  
> Teste o resultado.  
> Ensine quando ela quiser.  
> Nunca retire dela o controle.  
> Dê autonomia sem esconder os limites reais.  
> Cobre pelo valor da plataforma, não por cada pensamento local da IA.

The V1 roadmap remains Builds **1–134**. North Star additions are mapped into existing owning Builds rather than creating decimal/ad-hoc Builds.

## Product principles

- Git is the source of truth for code.
- The local filesystem is the working tree.
- GitHub is the remote collaboration layer.
- Local execution is first-class; paid AI APIs are optional.
- Browser/PWA state is never the security or durable-job authority.
- PLAN is backend-enforced read-only; BUILD receives explicit capabilities and Scope Lock.
- Providers use contracts/plugins rather than product lock-in.
- Supabase is first-class but optional.
- MCP/plugins pass through capability, scope and approval boundaries.
- The user remains the final authority outside already granted scope.
- Local-first does not mean free, infinite compute, infinite tokens or infinite context.
- GitHub Decrypter is a paid commercial product with monthly, semiannual, annual and lifetime options plus a 24-hour free trial as the current commercial direction.
- No Release, OTA, Chrome Store publication, production deploy or DNS mutation happens merely because a Build is complete.

## Architecture

```text
Chrome Extension
       │
       ├──── gd-protocol/1 ───────────────┐
       │                                  │
Studio PWA                         Local Runtime Daemon
   │                               127.0.0.1 / ::1 only
   │                                      │
   └─ EventBus                      EventBus
      (in-process)                  (in-process)
                                           │
                                           ▼
                                   SQLite runtime.sqlite3
                                   WAL + migrations
                                           │
                                           ▼
                                  Durable Job Engine
                                  queue + DAG + leases
                                           │
                                           ▼
                                Crash & Power Recovery
                              sessions + reconciliation
                                           │
                                           ▼
                                   Offline Execution
                          local work runs / network work waits

            │
            ▼
   Architecture Guardian
Constitution + North Star + Scope
```

See:

- `docs/product/PRODUCT_CONSTITUTION_V1.md` — frozen V1 constitution
- `docs/product/CONSTITUTION_AMENDMENT_001_NORTH_STAR.md` — explicit North Star amendment
- `docs/product/NORTH_STAR_MANIFESTO.md` — normative North Star authority
- `docs/product/NORTH_STAR_ROADMAP_MAPPING.md` — mapping into Builds 1–134
- `docs/architecture/MONOREPO_FOUNDATION.md` — workspace ownership
- `docs/architecture/SHARED_PROTOCOL.md` — Build 7 wire contract
- `docs/architecture/CENTRAL_EVENT_BUS.md` — Build 8 event architecture
- `docs/architecture/ARCHITECTURE_GUARDIAN.md` — Build 9 policy gate
- `docs/architecture/LOCAL_RUNTIME_DAEMON.md` — Build 10 process and loopback boundary
- `docs/architecture/PERSISTENT_LOCAL_DATABASE.md` — Build 11 SQLite authority and migration policy
- `docs/architecture/DURABLE_JOB_ENGINE.md` — Build 12 queue, DAG and lease semantics
- `docs/architecture/CRASH_POWER_RECOVERY.md` — Build 13 session and recovery semantics
- `docs/architecture/OFFLINE_EXECUTION.md` — Build 14 connectivity-aware local scheduling semantics

## Architecture check

```bash
pnpm run guardian
```

Architecture violations fail with stable `AGxxx` codes. Semantic North Star alignment is also reviewed through the pull-request checklist.

## Reuse policy

Compatible third-party implementations may be adopted/adapted with required provenance and notices. Incompatible implementations are architecture/behavior references only and are reimplemented independently. See `docs/audit/EXTERNAL_SOURCE_MINING.md`, `docs/legal/THIRD_PARTY_PROVENANCE.md` and `third-party-sources.json`.

## Historical lineage

GitHub Decrypter originated from a snapshot of its predecessor project but has independent roadmap and release authority. Exact lineage is recorded in `GITHUB_DECRYPTER_ORIGIN.md`.

## Repository

`rhashiki/github-decrypter`
