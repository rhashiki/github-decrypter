# Build 16 — Secrets Vault

Status: **COMPLETE — VALIDATED FOR MERGE**

## Purpose

Create the canonical encrypted local Secrets Vault that later provider integrations can use without placing credentials in browser state, plaintext SQLite columns, logs or events.

## Implemented

- SQLite migration 6;
- `gd_vault_metadata` and `gd_vault_secrets`;
- AES-256-GCM authenticated encryption;
- HKDF-SHA256 subkey separation;
- HMAC-SHA256 resource lookup;
- encrypted secret resource names and values;
- 256-bit local master key file with owner-only POSIX permissions;
- key/database fingerprint mismatch detection;
- capability-gated reads and writes using `SECRETS`;
- `SECRETS + DESTRUCTIVE` requirement for deletion;
- Vault lifecycle integrated into Local Runtime readiness;
- non-sensitive Vault health/readiness;
- Event Bus metadata-only Vault events;
- removal of inherited predecessor `security/vault.js` authority;
- Architecture Guardian Vault boundary.

## Acceptance criteria

- [x] secret values are never persisted as plaintext SQLite columns;
- [x] secret resource names are never persisted as plaintext SQLite columns;
- [x] master key is never stored in SQLite;
- [x] master key is randomly generated at 256 bits;
- [x] POSIX key file is owner-only;
- [x] AES-GCM authenticates ciphertext and associated data;
- [x] resource lookup uses keyed HMAC rather than plaintext identifiers;
- [x] missing/invalid capability fails closed;
- [x] secret deletion requires an independent destructive capability;
- [x] mismatched master key fails closed;
- [x] Vault readiness is required for daemon readiness;
- [x] no Vault secret value/resource is emitted through health/events;
- [x] no Vault HTTP/RPC control endpoint exists;
- [x] inherited remote predecessor Vault authority is removed;
- [x] Approval Transactions are not implemented early;
- [x] Audit Ledger is not implemented early;
- [x] no Release, OTA, store publication, production deploy or DNS mutation is performed.

## Architecture Guardian

Build 16 adds:

- `AG140` — Vault policy missing/invalid;
- `AG141` — Vault persistence escaped `apps/local`;
- `AG142` — plaintext/incorrect Vault persistence schema;
- `AG143` — master-key backend weakened or moved into SQLite;
- `AG144` — cryptographic/capability invariant missing;
- `AG145` — external Vault transport introduced early;
- `AG146` — inherited remote Vault authority returned/remained;
- `AG147` — machine-readable Vault invariants weakened;
- `AG148` — required Build 16 artifact missing.

Build 15's `AG133` becomes phase-aware because Secrets Vault is now legitimately owned by Build 16.

## Validation completed

The Build 16 workflow passed the complete Build 4–16 regression chain, full workspace TypeScript checking and modern-engine preservation. Runtime tests proved encrypted values/resources at rest, HMAC lookup, capability gating, destructive-delete gating, persistence across restart, authenticated tamper detection, mismatched-key failure, owner-only POSIX key permissions and daemon readiness without external Vault transport.

Failure injection proved the Guardian rejects `AG141`, `AG142`, `AG143`, `AG145`, `AG146` and `AG147` and that the tree returns to a passing state afterward.

## Explicit exclusions

- Approval Transactions — Build 17;
- Audit Ledger — Build 18;
- Workspace Manager — Build 19;
- Git Runtime — Build 21;
- GitHub provider/app/extension;
- provider-specific credential UX;
- remote/cloud Vault synchronization;
- generic secret-control HTTP/RPC;
- Tool Runtime;
- MCP Trust Gateway;
- deployment providers.

## North Star review

- credentials stay local by default: **yes**;
- privileged access remains capability-gated: **yes**;
- secret deletion requires an explicit destructive authority: **yes**;
- secret material is exposed in health/logs/events: **no**;
- browser/model can self-authorize secret access: **no**;
- later providers can share one local credential boundary: **yes**.

## Next Build

Build 17 — Approval Transactions.
