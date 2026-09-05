# GitHub Decrypter

GitHub Decrypter is a local-first, Git-native and GitHub-native AI Development Studio.

Target workflow:

`GitHub repository → local workspace → Plan → approved Build → live local preview → diff → commit → push → pull request → optional deploy/domain workflow`

The browser extension is a lightweight GitHub launcher/bridge. The main interface is a React + TypeScript + Vite PWA Studio, while privileged and durable execution belongs to an independent local runtime rather than browser state.

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
- Build 15 — Capability Security Model
- Build 16 — Secrets Vault
- Build 17 — Approval Transactions
- Build 18 — Audit Ledger
- Build 19 — Workspace Manager
- Build 20 — Project Detection
- Build 21 — Git Runtime
- Build 22 — Human vs AI Change Tracking
- Build 23 — GitHub App
- Build 24 — GitHub Provider
- Build 25 — GitHub Chrome Extension
- Build 26 — Repository Launcher
- Build 27 — React Studio Foundation
- Build 28 — PWA
- Build 29 — Unified Design System

Next: **Build 30 — IDE Layout**.

The repository has the canonical pnpm/TypeScript topology:

```text
apps/
  studio/
  extension/
  local/

packages/
  ui/ protocol/ shared/ git/ workspace/ chat/ plan/ build/
  preview/ context/ tools/ scope/ ai/ github-app/ github-provider/
```

`@github-decrypter/protocol` is the single transport-neutral wire contract shared by Studio, Extension and Local Runtime. Its current schema is `gd-protocol/1`.

`@github-decrypter/shared` owns the deterministic in-process Central Event Bus. Events use the `gd.*` namespace, JSON-safe payloads, correlation/causation/trace metadata and isolated sequential delivery. The bus is intentionally not a network transport, durable queue, retry engine or security authority.

`@github-decrypter/local` is a real independent Node.js daemon. It owns loopback-only process/transport authority, file-backed SQLite persistence, the durable job queue, crash/power recovery, connectivity-aware offline scheduling, the deny-by-default Capability Security boundary, the encrypted local Secrets Vault, durable one-shot Approval Transactions, the append-only local Audit Ledger, the local Workspace Manager, read-only Project Detection, capability-gated Git Runtime, Human-vs-AI change attribution, GitHub App authentication/webhook trust and the read-only installation-scoped GitHub Provider. SQLite uses Node 22 `node:sqlite`, WAL, foreign keys, checksummed migrations and integrity-gated readiness.

Build 12 supplies stable queue ordering, prerequisite DAGs, atomic claims, worker leases, attempt budgets and durable checkpoints. Build 13 adds durable runtime-session journaling plus deterministic recovery of interrupted jobs. Build 14 adds persistent `unknown | online | offline` connectivity state and explicit network-required job metadata: local-safe work remains claimable without network, while network-required work waits durably and returns to the queue when connectivity is restored.

Build 15 adds explicit job-bound capabilities: `READ`, `WRITE`, `EXECUTE`, `NETWORK`, `DATABASE_WRITE`, `GIT_WRITE`, `DESTRUCTIVE` and `SECRETS`. Grants carry exact or prefix-scoped `gd://` resources, bounded expiry and explicit revocation. Capabilities do not imply one another, so operations requiring multiple authorities must request every required claim. Capability tokens are opaque 256-bit values and only their SHA-256 hashes are persisted. Grants remain process-bound and stale active grants are revoked after restart rather than being silently trusted by a new runtime process.

Build 16 adds the canonical local Secrets Vault. Secret values and `gd://secret/...` resource names are encrypted at rest with AES-256-GCM; HKDF-SHA256 separates encryption and lookup subkeys, while HMAC-SHA256 provides deterministic resource lookup without a plaintext resource column. The 256-bit master key is stored separately from SQLite in a local owner-only key file on POSIX systems. The database stores only a key fingerprint to detect a mismatched key and fail closed. This Build does not claim OS-keychain-backed storage.

Vault reads/writes require an existing job-bound `SECRETS` capability, while deletion additionally requires `DESTRUCTIVE`. Vault readiness is part of daemon readiness. Health and Event Bus messages expose only non-sensitive status/IDs and never secret values or resource names. The inherited predecessor remote Vault implementation was removed so the local Vault is the single active authority.

Build 17 adds durable Approval Transactions as a separate authority from Capability Security. An approval is tied to one durable job, an explicit capability/resource requirement snapshot and the SHA-256 digest of the exact proposed payload. Approval receipts are opaque 256-bit values; only their SHA-256 hashes are persisted. Approved receipts are consumed atomically once and their persisted hash is cleared, while replay, denial, cancellation, expiry, terminal-job use and payload mismatch fail closed. Approval therefore cannot silently broaden capabilities or become a reusable grant.

Build 18 adds the canonical local Audit Ledger. Audit entries are append-only under SQLite triggers, carry a monotonic sequence and are chained by SHA-256 previous-hash/entry-hash values. Full ledger integrity is verified before daemon readiness, so sequence gaps, chain mismatches or entry tampering fail closed. The ledger records only security-relevant metadata for capability, Vault and Approval Transaction events; it does not persist capability tokens, approval receipts, secret values or plaintext secret resource names, and it has no external transport authority.

Build 19 adds the canonical local Workspace Manager. Existing local directories are registered by canonical `realpath` under opaque `gd_ws_<uuid>` identities in SQLite schema 9. Duplicate registration of the same canonical root is idempotent. Workspace-relative resolution performs both lexical containment and post-`realpath` containment so symlink escapes fail closed. This Build resolves existing paths only: it does not create, edit, move, delete or otherwise mutate project files. Health, readiness and Event Bus messages expose workspace IDs/counts/timestamps rather than filesystem paths or display names.

Build 20 adds read-only Project Detection on top of Workspace Manager. It inspects only known root files, recognizes pnpm/npm/yarn/bun, detects Next.js/Astro/React/Vue/Svelte/Vite/vanilla project families, derives a deterministic `dev` or `start` command when possible, caps `package.json` at 1 MiB and rejects malformed JSON or symlink escapes. It performs no recursive scan, file mutation, process execution, network access or Git operation, and it does not persist a project-detection cache.

Build 21 adds the canonical Git Runtime. The environment-neutral `@github-decrypter/git` contract defines normalized status, diff, log, branch, merge-base, blame and mutation results, while the real process authority stays in `apps/local`. Git is launched as the fixed `git` executable with argument arrays, `shell: false`, bounded output, command timeouts and `GIT_TERMINAL_PROMPT=0`. Read operations are workspace-scoped. Every mutation requires a job-bound `GIT_WRITE` capability for `gd://workspace/<workspace-id>/git`; clone/fetch/pull/push additionally require `NETWORK` and Build 14 connectivity state `online`. Clone is restricted to an existing empty registered workspace root, pull is fast-forward-only, embedded remote credentials are rejected, and Build 21 deliberately introduces no force push, hard reset or forced branch deletion.

Build 22 adds explicit Human-vs-AI change attribution boundaries without persisting source content. Build 23 adds GitHub App JWT, installation-token and webhook-verification foundations with private material confined to the local Secrets Vault and installation tokens kept ephemeral. Build 24 adds a read-only, installation-scoped GitHub Provider for repository and branch discovery without generic request or collaboration mutation authority.

Build 25 activates the Manifest V3 GitHub Chrome Extension as a lightweight GitHub-only bridge. Build 26 adds repository detection and the extension-owned `Open in GitHub Decrypter` launcher flow while deliberately stopping short of direct Studio launch/runtime authority. Build 27 rebuilds the Studio foundation on React 19 + TypeScript + Vite 8. Build 28 makes that Studio an installable PWA with a bounded same-origin offline app shell. Build 29 activates `@github-decrypter/ui` as the canonical reusable design-system authority with semantic tokens, `--gd-*` CSS variables and reusable accessible React primitives; IDE/workspace layout remains reserved for Build 30.

Build 14 deliberately performs no automatic outbound connectivity probe. `unknown` fails closed for network-required work, but network availability is not required for the daemon to be healthy and ready for local execution. `NETWORK` capability authorizes network use; it does not bypass Build 14 connectivity state.

There is still no generic SQL, coding, tool, Git, model, connectivity-control, capability-control, secret-control, approval-control, audit-control, workspace-control, project-detection-control, GitHub-provider-control or job-control HTTP endpoint. In particular, the GitHub App and GitHub Provider remain internal Local Runtime authorities rather than generic browser-callable transports. The default development endpoint is `127.0.0.1:43110`. Run it with:

```bash
pnpm --filter @github-decrypter/local start
```

The Architecture Guardian enforces product authorities, app/package boundaries, SQLite ownership, durable-job ownership, recovery ownership, Offline Execution ownership, Capability Security ownership, Secrets Vault ownership, Approval Transactions ownership, Audit Ledger ownership, Workspace Manager ownership, Project Detection ownership, Git Runtime ownership, Human-vs-AI attribution boundaries, GitHub App authority, GitHub Provider read-only scope, Extension/Repository Launcher authority, React Studio/PWA ownership, Unified Design System ownership, phase gates, sensitive persistence rules, outbound-network restrictions and the narrow write scope of the generated project-map workflow.

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
React + Vite                      127.0.0.1 / ::1 only
   │                                      │
   └─ @github-decrypter/ui         EventBus + SQLite
      design system                       │
                                          ▼
                                  Durable Job Engine
                                          │
                                          ▼
                                  Security foundation
                         capabilities + vault + approvals + audit
                                          │
                                          ▼
                                  Workspace + Project
                                          │
                                          ▼
                                   Git Runtime
                                          │
                                          ▼
                              GitHub App + Provider

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
- `docs/architecture/CAPABILITY_SECURITY_MODEL.md` — Build 15 deny-by-default capability boundary
- `docs/architecture/SECRETS_VAULT.md` — Build 16 encrypted local secret boundary
- `docs/architecture/APPROVAL_TRANSACTIONS.md` — Build 17 one-shot human approval boundary
- `docs/architecture/AUDIT_LEDGER.md` — Build 18 append-only tamper-evident local audit boundary
- `docs/architecture/WORKSPACE_MANAGER.md` — Build 19 canonical local workspace registry and path boundary
- `docs/architecture/PROJECT_DETECTION.md` — Build 20 root-only read-only project inspection boundary
- `docs/architecture/GIT_RUNTIME.md` — Build 21 workspace-scoped capability-gated Git execution boundary
- `docs/architecture/HUMAN_AI_CHANGE_TRACKING.md` — Build 22 attribution boundary
- `docs/builds/BUILD_23_GITHUB_APP.md` — Build 23 GitHub App trust foundation
- `docs/architecture/GITHUB_PROVIDER.md` — Build 24 read-only provider authority
- `docs/architecture/GITHUB_CHROME_EXTENSION.md` — Build 25 lightweight extension bridge
- `docs/architecture/REPOSITORY_LAUNCHER.md` — Build 26 repository launcher flow
- `docs/architecture/REACT_STUDIO_FOUNDATION.md` — Build 27 Studio foundation
- `docs/architecture/PWA_FOUNDATION.md` — Build 28 installable/offline app shell
- `docs/architecture/UNIFIED_DESIGN_SYSTEM.md` — Build 29 canonical UI system

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
