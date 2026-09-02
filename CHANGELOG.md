# GitHub Decrypter Changelog

The active changelog uses the independent GitHub Decrypter Build numbering. Earlier predecessor history remains available through Git history and `GITHUB_DECRYPTER_ORIGIN.md`.

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
