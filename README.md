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

Next: **Build 7 — Shared Protocol**.

The Build 6 repository now has the canonical pnpm/TypeScript topology:

```text
apps/
  studio/
  extension/
  local/

packages/
  ui/ protocol/ shared/ git/ workspace/ chat/ plan/ build/
  preview/ context/ tools/ scope/ ai/
```

These workspaces are intentionally minimal. React/Vite Studio, Chrome launcher behavior and the local daemon remain owned by their later frozen Builds.

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
- No Release, OTA, Chrome Store publication, production deploy or DNS mutation happens without explicit authorization.

## Architecture

```text
Chrome Extension
  └─ GitHub repository detection + launcher/bridge

GitHub Decrypter Studio
  └─ React + TypeScript + Vite PWA

GitHub Decrypter Local Runtime
  └─ workspace + Git + AI + tools + MCP + jobs + preview/processes + persistence
```

See `docs/product/` for the frozen V1 constitution and `docs/architecture/MONOREPO_FOUNDATION.md` for Build 6 ownership boundaries.

## Reuse policy

Compatible third-party implementations may be adopted/adapted with required provenance and notices. Incompatible implementations are architecture/behavior references only and are reimplemented independently. See `docs/audit/EXTERNAL_SOURCE_MINING.md`, `docs/legal/THIRD_PARTY_PROVENANCE.md` and `third-party-sources.json`.

## Historical lineage

GitHub Decrypter originated from a snapshot of its predecessor project but has independent roadmap and release authority. Exact lineage is recorded in `GITHUB_DECRYPTER_ORIGIN.md`.

## Repository

`rhashiki/github-decrypter`
