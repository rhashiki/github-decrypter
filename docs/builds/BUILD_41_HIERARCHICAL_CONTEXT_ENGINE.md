# Build 41 — Hierarchical Context Engine

Status: **IMPLEMENTATION IN PROGRESS — CI GATE NOT YET CLOSED**

## Objective

Compile the canonical Build 39 Requirement Specification and Build 40 Task Graph into a deterministic, dependency-aware hierarchical context structure without crossing into continuation, token abstraction, memory, execution or persistence authorities.

## Implemented scope

- `@github-decrypter/context` activated at Build 41
- input validation for `gd-requirement-spec/1` + `gd-task-graph/1`
- source SHA-256 digest binding between specification and graph
- canonical graph-to-requirement identity binding
- `gd-hierarchical-context/1` output
- specification-wide `ctx-root`
- supporting statements retained for goal, constraint, acceptance, non-goal and context items
- deterministic dependency-depth levels
- one task context per canonical Task Graph node
- direct dependency preservation
- deterministic transitive dependency closure
- stable task-context ordering
- immutable output records and arrays
- fail-closed validation of edges and topological order
- 4,096 task and hierarchy-level ceilings
- environment-neutral package boundary
- no Studio, Extension or Local Runtime activation

## Required closure gates

Build 41 must not be marked complete until all of the following are green on the exact validated head:

1. Hierarchical Context Engine static contract.
2. Build 41 TypeScript project.
3. Hierarchical Context runtime behavior.
4. Architecture Guardian AG390–AG399.
5. Guardian negative probes.
6. Accumulated Build 4–41 CI.
7. Root workspace TypeScript checks.
8. Modern-engine preservation.
9. Historical pull-request workflow matrix.
10. Protected-head merge check.

## Deferred by design

- Build 42 — Context Continuation Engine
- Build 43 — Token Abstraction Layer
- Build 44 — Conversation Engine
- Build 45 — Attachment Engine
- Build 46 — Context Mentions
- Build 66 — Project Memory
- Build 67 — Context Engine vFinal
- semantic context expansion
- task scheduling and execution
- project-memory persistence
- context-pack persistence
- model/token-window budgeting
- AI execution
- network, filesystem, database, browser or runtime transport

## Release boundary

No release, deployment, tag, DNS, Chrome Store, Supabase or production-backend mutation is part of Build 41.
