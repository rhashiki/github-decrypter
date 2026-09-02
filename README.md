# GitHub Decrypter

GitHub Decrypter is a local-first, Git-native and GitHub-native AI Development Studio.

Its target workflow is:

`GitHub repository → local workspace → Plan → approved Build → live local preview → diff → commit → push → pull request → optional deploy/domain workflow`

The browser extension is intentionally a lightweight GitHub launcher/bridge. The main interface is a React + TypeScript + Vite PWA Studio, and privileged/durable execution belongs to an independent local runtime rather than to the browser.

## Current implementation status

The project is being rebuilt through frozen numbered Builds. At Build 5 the inherited Lovable-specific runtime authority has already been removed, but the new Studio/local-runtime topology is not yet implemented. The extension package is therefore intentionally inert rather than pretending to provide the final product early.

Completed:

- Build 1 — Project Fork & Independence
- Build 2 — Product Constitution & Scope Freeze
- Build 3 — Full Legacy Inventory
- Build 4 — Lovable Decoupling
- Build 5 — GitHub Decrypter Rebrand

Next: Build 6 — Monorepo Foundation.

## Product principles

- Git is the source of truth for code.
- The local filesystem is the working tree.
- GitHub is the remote collaboration layer for repositories, branches, issues, pull requests, checks and Actions.
- Local execution is first-class; paid AI APIs are optional rather than mandatory.
- Browser/PWA state is never the security or durable-job authority.
- Jobs, checkpoints, transactions and recovery must survive browser closure and resume from the last consistent durable checkpoint after runtime restart.
- PLAN is backend-enforced read-only.
- BUILD receives explicit capabilities and Scope Lock.
- Backends, AI providers, deployment providers and domain providers use contracts/plugins instead of product lock-in.
- Supabase is first-class but optional.
- MCP and plugins pass through capability, scope and approval boundaries.
- No Release, OTA, Chrome Store publication, production deploy or DNS mutation happens without explicit authorization.

## Target architecture

```text
Chrome Extension
  └─ GitHub repository detection + lightweight launcher/bridge

GitHub Decrypter Studio
  └─ React + TypeScript + Vite PWA
     Chat / Plan / Build / Preview / Code / Diff / Console / Git / Jobs

GitHub Decrypter Local Runtime
  └─ workspace + Git + AI + tools + MCP + context + scope + jobs
     preview/process manager + diagnostics/LSP + SQLite/checkpoints
```

The detailed frozen constitution and V1 scope live under `docs/product/`.

## Reuse policy

GitHub Decrypter does not reinvent mature components unnecessarily. Compatible third-party implementations may be adopted or adapted with their required notices; incompatible implementations are used only as architectural/behavioral references and reimplemented independently.

The audited source-mining policy and provenance ledger are stored in:

- `docs/audit/EXTERNAL_SOURCE_MINING.md`
- `docs/legal/THIRD_PARTY_PROVENANCE.md`
- `third-party-sources.json`

## Historical lineage

GitHub Decrypter originated from a snapshot of its predecessor project, but it is independent and has its own roadmap and release authority. The predecessor continues separately. Exact lineage is recorded in `GITHUB_DECRYPTER_ORIGIN.md`; inherited implementation history remains available through Git history rather than through active product documentation.

## Repository

`rhashiki/github-decrypter`
