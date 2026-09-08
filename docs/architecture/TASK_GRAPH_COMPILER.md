# Task Graph Compiler

Build 40 introduces the deterministic DAG compilation boundary immediately after Build 39 Requirement Compiler.

## Ownership

- Owner package: `@github-decrypter/plan`
- Owner source: `packages/plan/src/task-graph.ts`
- Input schema: `gd-requirement-spec/1`
- Output schema: `gd-task-graph/1`
- Build owner: 40
- Environment-neutral and dependency-free
- No application consumes this package yet

## Responsibilities

The compiler accepts exactly one field: `spec`, containing canonical Build 39 Requirement Compiler output.

It performs deterministic structural graph compilation only:

1. Validates the canonical Requirement Spec boundary and its source digest metadata.
2. Creates one task node for every requirement item whose kind is `requirement`.
3. Preserves Goal, Constraint, Acceptance, Non-goal and Context item identities as `supportingRequirementIds` rather than pretending they are executable tasks.
4. Reads dependencies only from explicit `[depends: req-NNNN]` annotations in task-producing requirement statements.
5. Rejects unknown dependency ids, self-dependencies, dependencies on non-task-producing items and malformed annotations.
6. Creates dependency edges from prerequisite task to dependent task.
7. Validates the graph as a DAG and rejects cycles.
8. Produces a stable topological order using source/task ordinal as the deterministic tie-breaker.
9. Freezes the graph, nodes, dependency lists, edges, ordering and supporting identities.

Maximum accepted source items/nodes: 4,096.
Maximum dependency edges: 16,384.

## No dependency inference

Build 40 does not infer sequencing from prose, item order, filenames, verbs, goals or constraints. Two requirements with no explicit dependency annotation remain independent DAG nodes.

This is deliberate. Semantic planning and execution decisions belong to later roadmap authorities; Build 40 must not invent work relationships that the structured input did not state.

## Example explicit dependency

A requirement statement such as:

`Add the API client. [depends: req-0001, req-0002]`

may declare dependencies on task-producing requirement items `req-0001` and `req-0002`. Those requirement ids are resolved to canonical `task-NNNN` node ids in the compiled graph.

## Downstream ownership

- Build 41 — Hierarchical Context Engine
- Build 42 — Context Continuation Engine
- Build 43 — Token Abstraction Layer
- Build 44 — Conversation Engine
- Build 45 — Attachment Engine
- Build 46 — Context Mentions
- Build 47 — Jobs Center
- Build 48 — Plan Authority
- Build 52 — Build Orchestrator

## Explicit non-authority

Build 40 does **not**:

- infer undeclared dependencies;
- semantically reinterpret requirements;
- schedule or execute tasks;
- persist task/job state;
- create hierarchical or continuation context;
- abstract tokens;
- own conversations, attachments or mentions;
- call or route AI models;
- access network, filesystem, database, browser storage or Local Runtime;
- activate the compiler inside Studio, Extension or Local Runtime.

## Security posture

The compiler is fail-closed. Invalid source contracts and invalid dependency declarations are rejected rather than repaired heuristically. A successfully returned graph has passed structural DAG validation only; this does not grant execution authority or imply that the work is safe, approved or semantically complete.
