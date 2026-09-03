# Build 17 — Approval Transactions

Status: **IMPLEMENTED ON BUILD BRANCH**

## Purpose

Add durable, explicit human approval transactions between privileged intent and later execution without exposing an unsafe approval endpoint or implementing the product-wide Audit Ledger early.

## Implemented

- SQLite migration 7;
- `gd_approval_transactions`;
- states `pending`, `approved`, `denied`, `consumed`, `expired`, `cancelled`;
- explicit job/action/summary/capability-resource binding;
- SHA-256 payload digest binding against TOCTOU changes;
- required human reviewer identity/kind;
- 256-bit one-shot approval receipts;
- receipt hash-only persistence;
- atomic single-use consumption;
- expiration and cancellation;
- terminal-job rejection;
- Local Runtime lifecycle/readiness integration;
- metadata-only Event Bus events;
- no external approval-decision transport;
- Architecture Guardian approval boundary.

## Acceptance criteria

- [x] approval state persists across process restart;
- [x] approval is tied to one durable job;
- [x] exact capability/resource requirements are persisted;
- [x] approved payload is bound by SHA-256 digest;
- [x] only `reviewerKind: human` can make a decision;
- [x] approval receipt is random 256-bit material;
- [x] only the receipt hash is persisted;
- [x] receipt is one-shot and cannot be replayed after consumption;
- [x] expired approvals fail closed;
- [x] denied/cancelled approvals cannot be consumed;
- [x] terminal jobs cannot request/consume approval;
- [x] health/readiness expose no receipt or sensitive payload;
- [x] no approval-control HTTP/RPC endpoint exists;
- [x] Audit Ledger remains Build 18;
- [x] no Release, OTA, store publication, production deploy or DNS mutation is performed.

## Guardian

Build 17 adds AG150–AG157 covering ownership, hash-only receipts, human review, payload binding, transport prohibition, Audit Ledger phase gate and required artifacts.

## Explicit exclusions

- Audit Ledger — Build 18;
- Workspace Manager — Build 19;
- Tool Runtime — Build 53;
- approval UI in Studio;
- public approval RPC/HTTP;
- automatic model self-approval;
- Git/GitHub write providers;
- deployment/domain providers.

## North Star review

- user remains final authority for privileged intent: **yes**;
- approval cannot silently authorize modified payload: **yes**;
- model/browser can self-approve: **no**;
- approval survives process interruption: **yes**;
- approval receipt is stored plaintext: **no**.

## Next Build

Build 18 — Audit Ledger.
