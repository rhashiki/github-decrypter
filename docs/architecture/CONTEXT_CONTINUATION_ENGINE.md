# Context Continuation Engine

Build 42 introduces deterministic context continuation between canonical task contexts.

## Authority

- Owner package: `@github-decrypter/context`
- Owner source: `packages/context/src/continuation.ts`
- Input: `gd-hierarchical-context/1`
- Output: `gd-context-continuation/1`
- Root context: `ctx-root`

The engine consumes the immutable Hierarchical Context produced by Build 41. It does not rebuild requirements, the task graph, or the hierarchy.

## Continuation model

Each canonical task context receives exactly one continuation frame. Frames are ordered by the canonical task-context order from Build 41.

A frame records:

- the current task context, task and requirement identities;
- the previous continuation frame and previous task context for sequential handoff;
- direct dependency context identities;
- the deterministic transitive dependency-context closure;
- the context identities that must be carried into the task: `ctx-root` plus its dependency closure.

The previous-frame pointer establishes continuation between tasks without claiming that unrelated prior task content is semantically required by the current task.

## Determinism and validation

The engine validates the complete Build 41 boundary before producing frames. It rejects malformed roots, task-context ordering, dependency closures, hierarchy levels, digest metadata, or any source output that claims Build 42 authority prematurely.

Frame identifiers and order are deterministic. Outputs and nested arrays are immutable.

## Explicit non-authorities

Build 42 does not summarize, rewrite, infer, rank, compress or synthesize context. It has no model execution and no token-window policy.

The following remain owned by later roadmap stages:

- Build 43 — Token Abstraction Layer
- Build 44 — Conversation Engine
- Build 45 — Attachment Engine
- Build 46 — Context Mentions
- Build 66 — Project Memory
- Build 67 — Context Engine vFinal

Build 42 also has no persistence, context-pack storage, network, filesystem, database, browser, Studio, Extension or Local Runtime authority.

## Security boundary

The continuation core is environment-neutral and uses type-only imports. It cannot execute tasks, call AI providers, mutate state, access secrets or perform transport.
