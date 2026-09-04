# Audit Ledger — Build 18

The Audit Ledger is the canonical local, append-only security audit authority owned by `apps/local`.

## Purpose

Record security-relevant decisions and actions in a durable form that can be verified after restart without turning the ledger into a secret store or an externally writable control plane.

## Persistence

Build 18 adds SQLite schema 8 and `gd_audit_entries`.

Each entry contains a monotonic sequence, opaque entry ID, timestamp, category, action, actor, subject ID, optional durable job ID, outcome, JSON-safe metadata, the previous entry hash and the current entry hash.

Historical migrations 1–7 remain unchanged. Migration 8 only appends the new audit schema.

## Tamper evidence

Every entry is SHA-256 chained to the prior entry. The first entry uses the fixed genesis hash of 64 zeroes.

The runtime recomputes the complete chain during Audit Ledger initialization. A sequence gap, previous-hash mismatch or recomputed entry-hash mismatch causes initialization to fail closed before daemon readiness.

The database also installs `BEFORE UPDATE` and `BEFORE DELETE` triggers on `gd_audit_entries`. Ordinary runtime code therefore cannot mutate or erase a committed audit entry.

This is tamper-evident local auditing, not a claim of hardware-backed immutability or protection against an administrator who can replace the entire database and application together.

## Captured security events

Build 18 records metadata-only events for:

- capability grants, revocations and denials;
- Vault create/update/delete metadata using opaque secret IDs only;
- approval request, decision, consumption and cancellation metadata;
- explicit safe runtime audit entries.

The ledger does not subscribe to or persist capability tokens, approval receipts, secret values, encrypted secret payloads or plaintext secret resource names.

## Authority boundary

The Audit Ledger does not grant capabilities, approve operations, read secrets or execute jobs. It observes metadata emitted by the existing authorities and appends verifiable records.

Audit readiness and integrity become part of Local Runtime readiness. Health/readiness may expose only non-sensitive summary state such as entry count, chain head hash and integrity status.

## External transport

Build 18 adds no `/v1/audit`, `/v1/audit-ledger`, `/v1/ledger` or equivalent read/write endpoint. Studio and Extension cannot append, edit or erase audit records through HTTP/RPC in this phase.

The later Transaction Ledger experience remains owned by Build 77 and must not be pulled forward by Build 18.

## Architecture Guardian

`architecture-guardian-audit.mjs` enforces:

- Local Runtime ownership;
- append-only database triggers;
- SHA-256 chain and startup integrity verification;
- absence of mutable audit SQL in runtime source;
- absence of premature external Audit Ledger transport;
- metadata-only source boundaries;
- phase separation from Build 77 Transaction Ledger.

## Explicit exclusions

- Transaction Ledger UI — Build 77;
- generic audit query/export HTTP API;
- remote audit synchronization;
- hardware-backed or remote notarization;
- workspace/Git execution authority;
- Release, OTA, store publication, production deploy or DNS authority.
