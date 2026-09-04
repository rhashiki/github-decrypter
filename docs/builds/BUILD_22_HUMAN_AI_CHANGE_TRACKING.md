# Build 22 — Human vs AI Change Tracking

Status: **IMPLEMENTED ON `build/22-human-ai-change-tracking` PENDING VALIDATION/MERGE**

## Objective

Introduce explicit, fail-closed path-level attribution of local uncommitted changes without guessing authorship and without activating later GitHub, agent, UI or commit/push workflow layers.

## Delivered

- environment-neutral `gd-change-tracking/1` contract in `@github-decrypter/git`;
- origins: `human`, `ai`, `mixed`, `unknown`;
- durable AI change sessions bound to workspace + durable job + Local Runtime process;
- explicit human observation boundary;
- `WRITE` capability required for AI session start/completion;
- one active AI change session per workspace;
- deterministic pre/post dirty-state capture through Build 21 Git Runtime;
- SHA-256 path-state digests and baseline integrity digest;
- human + AI overlap becomes `mixed`;
- unexplained drift, cancellation and stale sessions fail closed to `unknown`/invalidated state;
- SQLite schema 10 with session and attribution-event metadata;
- no source-content/diff/patch persistence in Change Tracking tables;
- no workspace filesystem mutation by the tracker;
- metadata-only Event Bus lifecycle;
- daemon lifecycle, health and readiness integration;
- Architecture Guardian AG200–AG209;
- static, runtime and negative failure-injection regressions.

## Security decisions

AI attribution is not proof produced after the fact. It is only established by an explicit session around authorized AI work.

The capability resource is:

`gd://workspace/<workspace-id>/files`

The durable job must be non-terminal, the capability token must authorize `WRITE` for that exact workspace resource and the session must still belong to the same Local Runtime process.

Build 22 deliberately prefers `unknown` to false certainty.

## Attribution granularity

Build 22 is path-level only. Hunk-level attribution is explicitly out of scope because interleaved edits and line movement require a richer provenance model. Later layers may refine presentation without weakening the explicit boundary established here.

## Phase boundaries preserved

Build 22 does not claim:

- Build 23 GitHub App;
- Build 24 GitHub Provider;
- Build 25 GitHub Chrome Extension;
- Build 58 Agent Runtime;
- Build 60 Coding Agent;
- Build 76 Git Panel;
- Build 77 Transaction Ledger;
- Build 109 Commit Workflow;
- Build 110 Push Workflow;
- Build 111 Pull Request Workflow;
- Build 134 release authority.

No generic Change Tracking HTTP/RPC endpoint is introduced.

## Validation target

Build 22 CI must prove:

1. Architecture Guardian including AG200–AG209;
2. complete Build 4–22 regression chain;
3. TypeScript workspace checks;
4. real Git workspace human attribution;
5. explicit AI attribution with `WRITE` authorization;
6. human + AI overlap becoming `mixed`;
7. unexplained drift remaining `unknown`;
8. denied capability and terminal-job rejection;
9. cancelled/stale sessions failing closed;
10. baseline-integrity verification;
11. no project content persistence in attribution tables;
12. metadata-only Event Bus behavior;
13. daemon health/readiness integration;
14. no Change Tracking HTTP/RPC endpoint;
15. modern-engine preservation.

No Release, OTA, tag, Chrome Store publication, production deploy, production backend mutation or DNS mutation is authorized by this Build.
