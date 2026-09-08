# Build 46 — Context Mentions

Status: 🚧 IMPLEMENTATION IN PROGRESS — CI GATE NOT YET CLOSED

## Objective

Introduce deterministic project-aware context-reference resolution for the frozen V1 mention kinds while preserving Build 44 conversation authority and Build 45 attachment authority, without directly reading source systems, materializing target content, creating Durable Jobs, or prematurely implementing Build 47 — Jobs Center.

## Implemented scope

- `@github-decrypter/chat` advanced to `0.0.46`
- `./mentions` package subpath
- canonical `gd-context-mention/1`
- canonical `gd-context-mention-target/1`
- canonical `gd-context-mention-resolution/1`
- supported kinds: file, folder, repository, commit, branch, pull-request, issue, database, preview, terminal
- structured references only
- no invented textual `@...` parser
- exact `(kind, reference)` matching
- explicit authoritative catalog only
- workspace-scoped catalog validation
- binding to the same conversation and a committed user message
- duplicate mention/catalog rejection
- unknown target rejection
- immutable deterministic output
- maximum 64 mentions per resolution
- maximum 4096 catalog targets
- maximum 2048 reference characters
- maximum 256 label characters
- Architecture Guardian AG440–AG449
- static, TypeScript, runtime and negative-guardian gates

## Correctness boundaries

A resolved mention proves only that the structured reference exactly matched a target identity supplied by an explicit catalog for the same workspace. Build 46 does not claim that referenced content was read, parsed, interpreted, fetched, attached, injected into a provider prompt or otherwise materialized.

The core does not read filesystem/folder content, invoke Git, access GitHub, query databases, inspect Preview state, read Terminal state, access the network or call AI providers.

Build 46 also does not introduce a second conversation authority. Mentions remain bound to the existing Build 44 conversation and committed user-message identities.

## Explicitly deferred

- textual mention syntax and autocomplete UI
- source adapters/materialization for file/folder/Git/GitHub/database/Preview/Terminal content
- automatic target-to-prompt projection
- provider execution
- persistence of mention resolutions
- Durable Job creation or controls
- **Build 47 — Jobs Center**
- Build 66 — Project Memory
- Build 67 — Context Engine vFinal
- deployment/release/tag/DNS/Chrome Store/Supabase/production mutation

## Completion gate

This build must not be marked complete until the exact implementation head passes:

1. Build 46 Architecture Guardian AG440–AG449
2. Build 46 static contract gate
3. Build 46 TypeScript gate
4. Build 46 runtime gate
5. Build 46 negative Guardian gate
6. accumulated Builds 4–46 CI
7. all workspace typechecks
8. Build 4 modern-engine preservation

After the implementation head is green, this document and the canonical roadmap may be marked complete. The resulting documentation head must then pass the same accumulated gate before a protected PR is opened. The full historical PR workflow matrix must be green on that exact final head before merge.
