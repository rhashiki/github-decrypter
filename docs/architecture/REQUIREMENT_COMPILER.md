# Requirement Compiler

Build 39 introduces the deterministic Requirement Compiler immediately after the Build 38 Prompt Intake boundary.

## Ownership

- Owner package: `@github-decrypter/plan`
- Input contract: `gd-prompt-intake/1`
- Output contract: `gd-requirement-spec/1`
- Build owner: 39
- Environment-neutral and dependency-free
- No Studio, Extension or Local Runtime activation in this Build

## Responsibilities

The compiler accepts exactly one field: `intake`, containing canonical Build 38 `PromptIntakeRecord` output.

Before compilation it fail-closes on malformed intake metadata and verifies the SHA-256 digest against the normalized prompt text. The resulting specification remains bound to that source digest.

Compilation is intentionally syntax-directed and deterministic. It recognizes only explicit structural signals:

- canonical Markdown headings for Goal, Requirements, Constraints, Acceptance Criteria, Non-goals and Context;
- Markdown list items;
- explicit `Goal:`, `Requirement:`, `Constraint:`, `Acceptance:`, `Acceptance Criteria:`, `Non-goal:` and `Context:` prefixes;
- otherwise, caller text is retained as a requirement under the active section.

The compiler does not infer unstated intent or claim natural-language semantic understanding. Fenced code is kept as opaque requirement/context content rather than parsed as requirement syntax.

Each immutable requirement item contains a deterministic ordinal ID, kind, statement and source line range. The immutable specification includes per-kind counts, the original Prompt Intake digest and source structural counts. A maximum of 4,096 compiled items prevents unbounded structural expansion.

## Requirement kinds

- `goal`
- `requirement`
- `constraint`
- `acceptance`
- `non-goal`
- `context`

## Explicit non-authority

Build 39 does **not**:

- perform AI-backed semantic interpretation;
- invent requirements that were not structurally present in the intake;
- compile a task graph or DAG;
- construct hierarchical context;
- continue context between tasks;
- abstract token budgeting;
- own conversation history;
- ingest attachments;
- resolve context mentions;
- execute an AI provider or route a model;
- access network, filesystem, database, browser storage or Local Runtime;
- persist prompt text, requirement specifications or fingerprints.

## Downstream ownership

- Build 40 — Task Graph Compiler consumes structured requirements and owns DAG/task compilation.
- Build 41 — Hierarchical Context Engine owns hierarchical context construction.
- Build 42 — Context Continuation Engine owns continuation between tasks.
- Build 43 — Token Abstraction Layer owns user-facing token/context abstraction.
- Build 44 — Conversation Engine owns persistent conversational continuity.
- Build 45 — Attachment Engine owns attachment/media ingestion.
- Build 46 — Context Mentions owns project-aware mention resolution.

## Security posture

The Requirement Compiler is an environment-neutral pure transformation. Exact-key input, source digest verification, immutable output and explicit downstream flags prevent Build 39 from silently becoming a transport, persistence, execution or later-roadmap authority.
