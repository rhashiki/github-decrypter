# Build 15 — Capability Security Model

Status: **IMPLEMENTED ON BUILD BRANCH**

## Purpose

Create the deny-by-default Local Runtime security boundary that later privileged tools, Git operations, network providers, database mutations, MCP calls and secret access must pass through.

## Implemented

- SQLite migration 5;
- canonical capabilities `READ`, `WRITE`, `EXECUTE`, `NETWORK`, `DATABASE_WRITE`, `GIT_WRITE`, `DESTRUCTIVE`, `SECRETS`;
- job-bound grants;
- explicit `gd://` resource scopes;
- exact and prefix scope matching;
- opaque 256-bit capability tokens;
- SHA-256-only token persistence;
- bounded grant TTL;
- explicit revocation;
- deny-by-default authorization decisions;
- no capability implication;
- multi-capability requirements;
- terminal-job denial;
- process-bound grants until Secrets Vault exists;
- restart revocation of prior-process grants;
- graceful-shutdown revocation;
- Event Bus security lifecycle events without token exposure;
- non-sensitive health/readiness status;
- Architecture Guardian capability authority.

## Acceptance criteria

- [x] no token means deny;
- [x] unknown token means deny;
- [x] wrong job means deny;
- [x] revoked grant means deny;
- [x] expired grant means deny;
- [x] terminal job means deny;
- [x] missing capability or scope means deny;
- [x] every required capability must be explicitly present;
- [x] exact and prefix scopes are deterministic;
- [x] capability names do not imply one another;
- [x] plaintext tokens are never persisted;
- [x] old-process grants are revoked after restart;
- [x] capability readiness is part of daemon readiness;
- [x] no capability grant/control HTTP endpoint exists;
- [x] Secrets Vault is not implemented early;
- [x] Approval Transactions are not implemented early;
- [x] Audit Ledger is not implemented early;
- [x] no Release, OTA, store publication, deploy, production mutation or DNS mutation is performed.

## Architecture Guardian

Build 15 adds:

- `AG130` — Capability Security policy missing/invalid;
- `AG131` — capability persistence authority escaped `apps/local`;
- `AG132` — plaintext capability token persistence introduced;
- `AG133` — Secrets Vault introduced before Build 16;
- `AG134` — Approval Transactions introduced before Build 17;
- `AG135` — Audit Ledger introduced before Build 18;
- `AG136` — external capability grant transport introduced early;
- `AG137` — canonical capability/invariant policy weakened;
- `AG138` — required Build 15 authority artifact missing.

Build 14's `AG123` becomes phase-aware because Capability Security is now legitimately owned by Build 15.

## Explicit exclusions

- Secrets Vault — Build 16;
- Approval Transactions — Build 17;
- Audit Ledger — Build 18;
- Workspace Manager — Build 19;
- Git Runtime — Build 21;
- GitHub provider/app/extension;
- Plan/Build authority;
- Tool Runtime;
- MCP Trust Gateway;
- external capability issuance transport;
- Jobs Center/job-control transport — Build 47.

## North Star review

- user/control boundary becomes explicit rather than model-defined: **yes**;
- privileged actions fail closed without authority: **yes**;
- limits are visible rather than hidden: **yes**;
- plaintext security tokens are persisted for convenience: **no**;
- frontend or model can self-authorize: **no**;
- future providers can share one security contract: **yes**.

## Next Build

Build 16 — Secrets Vault.
