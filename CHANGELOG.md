# GitHub Decrypter Changelog

The active changelog uses the independent GitHub Decrypter Build numbering. Earlier predecessor history remains available through Git history and `GITHUB_DECRYPTER_ORIGIN.md`.

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
