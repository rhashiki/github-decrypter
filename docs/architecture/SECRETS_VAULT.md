# Secrets Vault

Build 16 makes `apps/local` the sole Secrets Vault authority for GitHub Decrypter.

## Purpose

The Vault persists credentials required by later AI, GitHub, backend, MCP and deployment providers without storing plaintext secret values in SQLite or browser state.

The Vault is local-first and unavailable unless Capability Security is already ready.

## Cryptographic design

- master key: 256 random bits generated locally;
- key backend: `local-key-file-v1`;
- default key file: sibling `vault.key` in the Local Runtime data directory;
- POSIX mode: owner-only `0600`;
- subkey derivation: HKDF-SHA256 with independent encryption and lookup contexts;
- encryption: AES-256-GCM with random 96-bit nonces;
- authenticated associated data binds ciphertext to secret ID and lookup identity;
- resource lookup: HMAC-SHA256 under a derived lookup key;
- secret values are encrypted BLOBs;
- resource names are encrypted BLOBs and are not persisted as plaintext columns;
- the master key is never stored in SQLite.

The database stores a SHA-256 key fingerprint only to detect a mismatched key file and fail closed.

## Capability boundary

Vault reads and writes require an explicit `SECRETS` capability for the requested `gd://secret/...` resource.

Deletion additionally requires `DESTRUCTIVE` for the same resource.

A Vault operation does not mint a capability. The caller must already possess a valid job-bound Build 15 capability token.

## Persistence

SQLite schema 6 adds:

- `gd_vault_metadata` — non-secret cryptographic metadata and key fingerprint;
- `gd_vault_secrets` — encrypted resource/value BLOBs, HMAC lookup identity, nonce/tag data and timestamps.

The key file and SQLite database are intentionally separate. Copying only the database is insufficient to decrypt secrets.

## Lifecycle

Startup order is:

`Database → Jobs → Recovery → Offline Execution → Capability Security → Secrets Vault → HTTP readiness`

If Vault key permissions are unsafe, the key length is invalid, the database fingerprint does not match the key, or authenticated decryption fails, the Vault fails closed.

Derived keys are kept only in Local Runtime memory and are zeroized on Vault shutdown as far as JavaScript/Node buffers permit.

## Health and events

Health/readiness expose only non-sensitive Vault state:

- ready/not-ready;
- secret count;
- cipher/KDF/key-backend identifiers;
- guarantees that plaintext persistence and external transport are disabled.

Events contain only secret IDs, operation type and timestamp. Secret resource names and values are never emitted.

## Explicit exclusions

Build 16 does not add:

- `/v1/vault`, `/v1/secret` or `/v1/secrets` HTTP/RPC endpoints;
- browser/PWA secret storage;
- remote/cloud Vault backup;
- secret values in logs/events/health;
- key rotation UI;
- OS keychain providers;
- Approval Transactions — Build 17;
- product-wide Audit Ledger — Build 18;
- provider-specific credential flows;
- Release, OTA, store publication, production deploy or DNS mutation.

## Legacy migration

The inherited `security/vault.js` implementation used predecessor license/Supabase remote backup semantics. Build 16 removes it after introducing the canonical local Vault so it cannot remain as a second authority.
