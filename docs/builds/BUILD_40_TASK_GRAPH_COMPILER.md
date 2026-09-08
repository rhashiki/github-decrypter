# Build 40 — Task Graph Compiler

Status: **COMPLETE — ✅**

## Objective

Compile canonical Build 39 requirement specifications into a deterministic validated DAG without crossing into context, scheduling, execution or AI authorities.

## Implemented scope

- `gd-task-graph/1` environment-neutral graph contract
- canonical `gd-requirement-spec/1` validation
- one task node per `requirement` item
- non-task kinds preserved as supporting requirement identities
- explicit `[depends: req-NNNN]` dependency declarations only
- deterministic requirement-id to task-id resolution
- stable dependency edges
- deterministic topological ordering
- unknown dependency rejection
- self-dependency rejection
- non-task dependency rejection
- malformed dependency annotation rejection
- cycle rejection
- immutable graph outputs
- 4,096 node/source-item ceiling
- 16,384 edge ceiling
- no dependencies in `@github-decrypter/plan`
- Build 39 regression made forward-compatible with Build 40 package versioning without weakening Requirement Compiler ownership

## Closure gates

The implementation gate passed on the exact validated code head before completion was recorded:

1. Task Graph Compiler static contract — ✅
2. Build 40 TypeScript project — ✅
3. Task Graph runtime behavior — ✅
4. Architecture Guardian AG380–AG389 — ✅
5. Guardian negative probes — ✅
6. Accumulated Build 4–40 CI — ✅
7. Root workspace TypeScript checks — ✅
8. Modern-engine preservation — ✅

The final documentation head is revalidated before PR. Historical pull-request workflows and protected-head merge remain mandatory merge gates.

## Deferred by design

- Build 41 — Hierarchical Context Engine
- Build 42 — Context Continuation Engine
- Build 43 — Token Abstraction Layer
- Build 44 — Conversation Engine
- Build 45 — Attachment Engine
- Build 46 — Context Mentions
- task scheduling and execution
- semantic dependency inference
- persistence
- Studio/Extension/Local Runtime activation

## Release boundary

No release, deployment, DNS, Chrome Store, Supabase or production-backend mutation is part of Build 40.
