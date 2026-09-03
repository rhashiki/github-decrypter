# Approval Transactions

Build 17 introduces the Local Runtime authority for explicit human approval of a concrete privileged operation.

## Separation of authorities

Capability Security answers whether a job holds the required technical authority for a resource. Approval Transactions answer whether a human decision authorized one exact proposed operation. Approval does not mint, widen or replace a capability.

## Transaction lifecycle

`pending → approved → consumed`

Alternative terminal paths are `denied`, `expired` and `cancelled`.

Each transaction is bound to:
- one durable job;
- a normalized action and human-readable summary;
- explicit capability/resource requirements;
- a SHA-256 digest of the exact proposed payload;
- a bounded expiration time.

Approval creates a 256-bit opaque receipt. Only its SHA-256 hash is persisted. Consumption requires the same transaction, receipt and payload digest, then atomically clears the hash and transitions to `consumed`. Reuse fails closed.

## Persistence

SQLite schema 7 adds `gd_approval_transactions`. The table contains decision metadata and a receipt hash, never a plaintext receipt. This is not the product-wide Audit Ledger; the general audit authority remains Build 18.

## Human control

The decision actor is explicit. Approval cannot be synthesized by the model, Event Bus, frontend state or a capability grant. Build 17 deliberately exposes no `/v1/approval*` endpoint; later UI/transport work must preserve the same authority boundary.

## Security invariants

- job-bound;
- payload-digest-bound;
- expires fail-closed;
- terminal jobs cannot request/use approvals;
- one-shot receipts;
- plaintext approval receipts are never persisted;
- approval never implies a capability;
- no external decision transport in Build 17;
- no Audit Ledger before Build 18.
