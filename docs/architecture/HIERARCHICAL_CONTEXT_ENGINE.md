# Hierarchical Context Engine — Build 41

## Authority

Build 41 activates the environment-neutral `@github-decrypter/context` package as the sole owner of deterministic hierarchical context compilation.

Input authorities remain owned upstream:

- Build 39 — `gd-requirement-spec/1`
- Build 40 — `gd-task-graph/1`

Build 41 emits `gd-hierarchical-context/1` and does not replace either upstream contract.

## Input contract

`buildHierarchicalContext({ spec, graph })` accepts exactly the canonical Requirement Compiler specification and the Task Graph produced from the same source digest.

The engine fails closed when:

- spec or graph schemas are not canonical;
- source SHA-256 digests differ;
- graph task identities drift from requirement identities;
- statements or source ranges are no longer bound to the requirement specification;
- graph edges disagree with `dependsOn` declarations;
- the topological order is incomplete, duplicated or violates dependencies;
- supporting requirement identities no longer match the specification.

## Hierarchy

The Build 41 hierarchy is structural and deterministic:

1. `ctx-root` — specification-wide supporting context.
2. `ctx-level-NNNN` — tasks grouped by dependency depth.
3. `ctx-task-NNNN` — one context record per canonical Task Graph node.

The root preserves the full statements of these Build 39 kinds:

- `goal`
- `constraint`
- `acceptance`
- `non-goal`
- `context`

Task context preserves:

- task and requirement identity;
- requirement statement and source line range;
- direct task dependencies;
- deterministic transitive dependency closure;
- topological hierarchy depth.

No semantic relationship is invented between supporting items and individual tasks.

## Determinism

For the same canonical spec and graph, output identities, ordering, hierarchy levels, direct dependencies and dependency closures are stable. The engine performs no model call and no semantic expansion.

## Explicit non-authority

Build 41 does not own:

- Build 42 — Context Continuation Engine;
- Build 43 — Token Abstraction Layer;
- Build 44 — Conversation Engine;
- Build 45 — Attachment Engine;
- Build 46 — Context Mentions;
- Build 66 — Project Memory;
- Build 67 — Context Engine vFinal;
- task execution or scheduling;
- project-memory persistence or context-pack persistence;
- token budgeting or model-window abstraction;
- AI execution;
- filesystem, network, database, browser or local-runtime transport.

The package is a pure in-memory compiler and is not activated inside Studio, Extension or Local Runtime in Build 41.
