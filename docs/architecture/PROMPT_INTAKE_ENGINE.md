# Prompt Intake Engine

Build 38 introduces the first deterministic intake boundary for user-authored prompt text.

## Ownership

- Owner package: `@github-decrypter/plan`
- Contract schema: `gd-prompt-intake/1`
- Build owner: 38
- Environment-neutral and dependency-free
- No app consumes this package yet

## Responsibilities

The engine accepts exactly one field: `text`.

It performs only deterministic structural intake:

1. Unicode NFC normalization.
2. CRLF/CR line endings normalized to LF.
3. Outer whitespace trimming while preserving internal indentation/content.
4. Empty and oversized prompt rejection.
5. SHA-256 fingerprint of normalized text.
6. Structural metadata: character count, line count, single/multi-line shape and explicit fenced-code presence.
7. Immutable `PromptIntakeRecord` output.

Maximum normalized input length is 262,144 JavaScript string characters.

## Downstream ownership

The next pipeline stages remain separately owned:

- Build 39 — Requirement Compiler
- Build 40 — Task Graph Compiler
- Build 41 — Hierarchical Context Engine
- Build 42 — Context Continuation Engine
- Build 43 — Token Abstraction Layer
- Build 44 — Conversation Engine
- Build 45 — Attachment Engine
- Build 46 — Context Mentions

## Explicit non-authority

Build 38 does **not**:

- infer user intent semantically;
- compile requirements;
- compile task graphs;
- build hierarchical context;
- continue context;
- abstract tokens;
- own conversation history;
- ingest attachments;
- resolve context mentions;
- call AI providers or route models;
- access network, filesystem, database, browser storage or Local Runtime;
- persist prompt text or fingerprints.

The returned text remains caller-owned transient data. The SHA-256 fingerprint is an equivalence/integrity aid for later pipeline stages, not an authentication or authorization primitive.

## Security posture

Input is fail-closed and exact-keyed. Unknown fields are rejected rather than silently accepted so later attachment, mention or conversation metadata cannot leak into Build 38 ahead of their owning phases.

No application gains a dependency on `@github-decrypter/plan` in this Build. Integration into conversation/job flows is intentionally deferred.
