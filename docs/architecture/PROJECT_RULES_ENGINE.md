# Project Rules Engine

Build 50 introduces the canonical workspace-scoped project rules contract inside `@github-decrypter/plan`.

## Authority

- owner package: `@github-decrypter/plan`
- owner source: `packages/plan/src/project-rules.ts`
- schema: `gd-project-rules/1`
- source Plan schema: `gd-plan-authority/1`
- mode: `PLAN`
- minimum Build: 50

The engine binds an explicit project constitution to one canonical draft Plan and one explicit workspace identity. It does not discover, infer, persist, or execute rules.

## Canonical input

`bindProjectRules(input)` accepts exactly:

- `plan`: canonical Build 48 Plan Authority record, still in `draft` status;
- `workspaceId`: explicit opaque workspace identity;
- `rules`: explicit ordered rules supplied by the caller.

A rule contains exactly `key`, `kind`, and `statement`. Supported kinds are `require`, `forbid`, and `prefer`. Rule keys are normalized and unique within the workspace constitution.

## Determinism and binding

The output is deterministic and deeply immutable. Its SHA-256 identity binds together:

- the canonical Plan identity and authority digest;
- the workspace identity;
- ordered canonical rule identities, kinds, keys, and statements.

Changing the Plan, workspace identity, rule order, rule kind, rule key, or rule statement changes the resulting rules digest.

## PLAN boundary

Build 50 preserves the runtime-enforced read-only PLAN boundary established by Build 48. Project Rules are policy material for planning; they do not grant capabilities and do not mutate the Plan.

The core is environment-neutral and has no network, filesystem, database, Studio, Local Runtime, scheduler, persistence, job, tool, or execution authority.

## Explicit non-authority

Build 50 does not own or activate:

- Impact Simulation — Build 51;
- Build Orchestrator — Build 52;
- Tool Runtime — Build 53;
- Scope Intelligence — Build 54;
- Scope Lock — Build 55;
- Checkpoint Engine — Build 56;
- Validation Pipeline — Build 57.

It does not automatically evaluate whether a Plan complies with a rule. That analysis belongs to Impact Simulation and later validation authorities. It also does not authorize the transition from PLAN to BUILD.

## Relationship to Build 49

Decision Engine remains the Build 49 authority for explicit architectural choices. Project Rules Engine is a separate Build 50 authority. A project constitution may constrain later analysis, but Build 50 does not retroactively change Decision Engine semantics or automatically score architectural alternatives.
