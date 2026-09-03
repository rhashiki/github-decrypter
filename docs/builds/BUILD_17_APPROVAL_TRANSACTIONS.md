# Build 17 — Approval Transactions

Status: **IMPLEMENTED ON BUILD BRANCH**

## Purpose

Create a durable, explicit and one-shot approval primitive for privileged actions without allowing an approval to become a capability grant or a model-controlled authorization path.

## Implemented

- SQLite migration 7;
- `gd_approval_transactions`;
- pending/approved/denied/consumed/expired/cancelled lifecycle;
- durable job binding;
- explicit capability/resource requirement snapshot;
- SHA-256 payload digest binding;
- bounded expiration;
- 256-bit opaque one-shot approval receipts;
- SHA-256-only receipt persistence;
- explicit decision actor/reason metadata;
- atomic receipt consumption;
- daemon lifecycle integration before readiness;
- Event Bus approval metadata events;
- Architecture Guardian approval boundary.

## Acceptance criteria

- [x] approval is distinct from capability authority;
- [x] approval is bound to one durable job;
- [x] approval is bound to the exact payload digest;
- [x] approval receipts are never persisted in plaintext;
- [x] approved receipt is one-shot and atomically consumed;
- [x] receipt replay fails closed;
- [x] expiration fails closed;
- [x] denied/cancelled transactions cannot be consumed;
- [x] terminal jobs cannot request/use approval;
- [x] decision actor is explicit;
- [x] no approval HTTP/RPC decision endpoint exists;
- [x] Audit Ledger is not implemented early;
- [x] no Release, OTA, store publication, deploy or DNS mutation is performed.

## Architecture Guardian

Build 17 adds AG150–AG158 for approval ownership, schema, receipt-hash-only persistence, one-shot consumption, absence of external decision transport, Audit Ledger phase gate and required artifacts.

## Explicit exclusions

- Audit Ledger — Build 18;
- approval UI/Jobs Center transport — later owning Builds;
- Workspace Manager — Build 19;
- Git Runtime — Build 21;
- Tool Runtime — Build 53;
- provider/deployment approval UX;
- Release/OTA/store/deploy/DNS authority.

## North Star review

- user remains final authority for operations outside already granted scope: **yes**;
- approval can silently broaden a capability: **no**;
- model/frontend can self-approve: **no**;
- approval is specific, inspectable and expiring: **yes**;
- replay is allowed: **no**.

## Next Build

Build 18 — Audit Ledger.
