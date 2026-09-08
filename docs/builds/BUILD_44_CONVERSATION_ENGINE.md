# Build 44 — Conversation Engine

Status: 🚧 IMPLEMENTATION IN PROGRESS — CI GATE NOT YET CLOSED

## Objective

Introduce persistent, workspace-scoped conversations that remain independent from Durable Job Engine lifecycle and compile complete conversation history against the finite-context abstraction established in Build 43.

## Implemented scope

- `@github-decrypter/chat` advanced to `0.0.44`
- canonical `gd-conversation/1` contract
- canonical `gd-conversation-message/1` contract
- canonical `gd-conversation-dispatch/1` contract
- canonical IDs and timestamps
- immutable ordered conversation transcript
- monotonic conversation revision
- complete-history AI Provider request compilation
- explicit `fullHistoryOrReject: true`
- explicit `silentTruncation: false`
- Build 43 `gd-token-abstraction/1` envelope binding
- persistent Local SQLite Conversation Store
- migration 12 with `gd_conversations` and `gd_conversation_messages`
- no `job_id` linkage in conversation persistence
- persistence across database reopen
- Local Runtime export of Conversation Store
- Architecture Guardian AG420–AG429
- static, TypeScript, runtime and negative-guardian gates
- accumulated Build 4–44 CI workflow

## Correctness boundaries

Build 44 does not fabricate token measurements and does not infer that content fits a model window. It does not truncate or summarize history automatically. If a future orchestration layer cannot fit the required context honestly, that decision must be handled explicitly by the appropriate later authority.

Conversation persistence is independent from job lifecycle. A conversation is not a Durable Job and does not require a `gd_jobs` row to exist or survive restart.

## Explicitly deferred

- Build 45 — Attachment Engine
- Build 46 — Context Mentions
- voice transport/audio capture/speech execution
- Chat Studio transport or UI activation
- direct AI provider execution inside the Chat package
- tool/task execution
- Build 66 — Project Memory
- Build 67 — Context Engine vFinal
- deployment/release/tag/DNS/Chrome Store/Supabase/production mutation

## Completion gate

This build must not be marked complete until the exact implementation head passes:

1. Build 44 Architecture Guardian AG420–AG429
2. Build 44 static contract gate
3. Build 44 TypeScript gate
4. Build 44 runtime gate
5. Build 44 negative Guardian gate
6. accumulated Builds 4–44 CI
7. all workspace typechecks
8. Build 4 modern-engine preservation

After the implementation head is green, this document and the canonical roadmap may be marked complete. The resulting documentation head must then pass the same accumulated gate before a protected PR is opened.
