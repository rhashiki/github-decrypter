# Impact Simulation — Build 51

## Authority

Build 51 introduces a deterministic, environment-neutral Impact Simulation contract owned by `@github-decrypter/plan`.

- source: `packages/plan/src/impact-simulation.ts`
- schema: `gd-impact-simulation/1`
- source Plan schema: `gd-plan-authority/1`
- source Project Rules schema: `gd-project-rules/1`
- mode: `PLAN`

## Purpose

Impact Simulation binds explicit impact observations to an already-canonical draft Plan and its workspace-scoped Project Rules constitution. It answers a narrow planning question: **what explicit impacts have been declared for this Plan, which canonical tasks/rules do they reference, and what immutable digest identifies that analysis?**

Build 51 does not invent impacts. The caller supplies each observation explicitly with an area, effect, severity, summary, related rule keys and related task identities. The engine validates those references against the canonical Plan and Project Rules records, normalizes the material, binds the records cryptographically, and returns an immutable simulation snapshot.

## Deterministic contract

Each accepted impact receives a stable ordinal identity (`impact-NNNN`). The canonical material binds:

1. canonical draft Plan identity and authority digest;
2. canonical Project Rules identity and rules digest;
3. workspace identity inherited from Project Rules;
4. ordered explicit impact observations;
5. canonical rule/task references.

The result uses SHA-256 and is deeply immutable.

## Read-only PLAN preservation

Impact Simulation is analysis inside PLAN. It preserves the runtime-enforced read-only Plan boundary established by Build 48 and the workspace constitution boundary established by Build 50.

It does not approve a Plan, change Plan status, mutate Project Rules, grant capabilities, enqueue jobs, write files, access a database, use the network, call AI providers, or execute tools.

## Explicit non-authority

Build 51 does not own or activate:

- Build Orchestrator — Build 52;
- Tool Runtime — Build 53;
- Scope Intelligence — Build 54;
- Scope Lock — Build 55;
- Checkpoint Engine — Build 56;
- Validation Pipeline — Build 57.

It does not authorize the PLAN-to-BUILD transition. Simulation output is evidence for later authorities, never execution permission.

## Evaluation boundary

`severity` and `effect` are explicit caller declarations. Build 51 performs no semantic inference, automatic scoring, rule compliance verdict, acceptance verdict, scope expansion, or AI judgment. Later validation/orchestration authorities may consume the immutable record according to their own contracts.
