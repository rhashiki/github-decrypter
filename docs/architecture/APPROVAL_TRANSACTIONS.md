# Approval Transactions

Build 17 makes durable human approval a Local Runtime security primitive.

## Authority

`apps/local/src/approval-transactions.ts` is the canonical authority. Approval state is persisted in SQLite schema 7 through `gd_approval_transactions`.

The transaction lifecycle is:

`pending → approved → consumed`

or one of the terminal alternatives:

`pending → denied | expired | cancelled`

An approved transaction may also expire or be cancelled before consumption.

## Binding

Every request is bound to:

- one durable job;
- a named action;
- a human-readable summary;
- an explicit set of capability/resource requirements;
- a SHA-256 `payloadDigest` for the exact operation payload shown for approval;
- a bounded expiration time.

The payload digest prevents a previously approved request from authorizing modified work.

## Human decision

Approval and denial require `reviewerKind: "human"` and a non-empty reviewer identifier. Build 17 does not add a model/self-approval path.

Approval produces a random 256-bit one-shot receipt. Only its SHA-256 hash is persisted. The plaintext receipt is returned once to the authorized caller and is erased from persistence on consumption, expiry or cancellation.

## Consumption

Consumption is atomic and requires:

1. approved state;
2. matching one-shot receipt;
3. matching payload digest;
4. the original job to remain non-terminal;
5. unexpired approval.

A receipt cannot be reused after successful consumption.

## Transport boundary

Build 17 intentionally exposes no `/v1/approval`, `/v1/approve`, `/v1/deny` or equivalent HTTP/RPC decision endpoint. Health/readiness may expose counts and boolean invariants only.

A later Studio/Extension interaction must cross an explicitly designed authenticated transport rather than turning the loopback daemon into an unguarded approval API.

## Not the Audit Ledger

The transaction row stores only state required for approval correctness. Product-wide immutable auditing belongs to Build 18 — Audit Ledger.
