# Build 39 — Requirement Compiler

Status: **IMPLEMENTATION IN PROGRESS — CI GATE NOT YET CLOSED**

## Objective

Add the first structured-requirement authority after Build 38 Prompt Intake without crossing into Build 40 Task Graph compilation or later context/conversation authorities.

## Implemented scope

- `gd-requirement-spec/1` environment-neutral specification contract
- canonical Build 38 Prompt Intake validation and SHA-256 source binding
- deterministic syntax-directed requirement compilation
- explicit Goal / Requirement / Constraint / Acceptance / Non-goal / Context kinds
- Markdown section and list handling
- fenced-code opacity
- deterministic IDs and source line ranges
- immutable item/spec/count outputs
- 4,096 item safety ceiling
- no dependencies in `@github-decrypter/plan`
- Build 38 regression updated to permit the Build 39 authority without weakening Prompt Intake boundaries

## Required closure gates

Build 39 must not be marked complete until all of the following are green on the exact validated head:

1. Requirement Compiler static contract.
2. Build 39 TypeScript project.
3. Requirement Compiler runtime behavior.
4. Architecture Guardian AG370–AG379.
5. Guardian negative probes.
6. Accumulated Build 4–39 CI.
7. Root workspace TypeScript checks.
8. Modern-engine preservation.
9. Historical pull-request workflow matrix.
10. Protected-head merge check.

## Deferred by design

- Build 40 — Task Graph Compiler
- Build 41 — Hierarchical Context Engine
- Build 42 — Context Continuation Engine
- Build 43 — Token Abstraction Layer
- Build 44 — Conversation Engine
- Build 45 — Attachment Engine
- Build 46 — Context Mentions
- AI-backed semantic interpretation
- persistence
- Studio/Extension/Local Runtime activation

## Release boundary

No release, deployment, DNS, Chrome Store, Supabase or production-backend mutation is part of Build 39.
