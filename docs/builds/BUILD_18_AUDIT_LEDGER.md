# Build 18 — Audit Ledger

Status: **IMPLEMENTED ON BUILD BRANCH**

## Purpose

Create the canonical local Audit Ledger for durable, tamper-evident recording of security-relevant metadata without creating a secret store, external audit API or Transaction Ledger UI prematurely.

## Implemented

- SQLite migration 8;
- `gd_audit_entries`;
- monotonic audit sequence;
- SHA-256 previous-hash/entry-hash chain;
- append-only UPDATE/DELETE rejection triggers;
- full integrity verification during startup;
- metadata-only capability, Vault and Approval Transaction capture;
- non-sensitive audit health/readiness state;
- Audit Ledger Event Bus readiness/append metadata;
- daemon lifecycle integration before security authorities emit audited events;
- Architecture Guardian Audit Ledger boundary.

## Acceptance criteria

- [x] Audit Ledger persistence is owned only by `apps/local`;
- [x] migrations 1–7 remain unchanged;
- [x] audit entries are append-only under normal database access;
- [x] every entry is chained to the previous entry with SHA-256;
- [x] sequence gaps fail integrity verification;
- [x] previous-hash mismatch fails integrity verification;
- [x] entry-content tampering fails integrity verification;
- [x] daemon readiness requires verified Audit Ledger integrity;
- [x] security event capture uses metadata rather than tokens/receipts/secret values;
- [x] Vault events identify only opaque secret IDs;
- [x] no external Audit Ledger control/query endpoint exists;
- [x] Transaction Ledger Build 77 is not implemented early;
- [x] no Release, OTA, store publication, deploy or DNS mutation is performed.

## Architecture Guardian

Build 18 adds AG160–AG169 for Audit Ledger ownership, schema, append-only persistence, hash-chain verification, mutation rejection, external transport exclusion, metadata-only source boundaries, machine-readable invariant protection, Transaction Ledger phase separation and required artifacts.

## Explicit exclusions

- Workspace Manager — Build 19;
- Project Detection — Build 20;
- Git Runtime — Build 21;
- Transaction Ledger — Build 77;
- remote audit synchronization/notarization;
- generic audit HTTP/RPC;
- Release/OTA/store/deploy/DNS authority.

## North Star review

- user actions and privileged decisions gain durable traceability: **yes**;
- Audit Ledger can grant or expand authority: **no**;
- model/frontend can rewrite audit history: **no**;
- tokens, approval receipts or secret values are audit payloads: **no**;
- integrity failure is hidden and execution continues: **no**.

## Next Build

Build 19 — Workspace Manager.
