# Build Orchestrator

Build 52 owns the explicit transition from an approved PLAN into an immutable BUILD orchestration record.

## Authority

- owner package: `@github-decrypter/build`
- owner source: `packages/build/src/index.ts`
- schema: `gd-build-orchestrator/1`
- source Plan: `gd-plan-authority/1`
- source Project Rules: `gd-project-rules/1`
- source Impact Simulation: `gd-impact-simulation/1`
- transition: `PLAN_TO_BUILD`
- resulting mode: `BUILD`

The orchestrator accepts only a canonical **approved** Plan. It does not approve a Plan on behalf of the user. Project Rules and Impact Simulation remain immutable inputs bound to the same Plan identity and workspace.

## Deterministic orchestration

Each canonical Plan task maps one-to-one to a `build-step-NNNN`. Plan task dependencies map deterministically to build-step dependencies, and the Plan topological order becomes the canonical build order. The complete orchestration is bound by a SHA-256 digest and returned as deeply immutable data.

## Security boundary

The invariant for Build 52 is:

`orchestrate != execute`

Entering BUILD does not itself authorize mutation. The orchestration record explicitly requires capabilities and Scope Lock before mutating execution can exist. Build 52 therefore keeps:

- `mutationAuthorized: false`
- `toolExecution: false`
- `scopeIntelligence: false`
- `scopeLock: false`
- `checkpoints: false`
- `validationPipeline: false`
- `execution: false`
- `scheduling: false`
- `jobCreation: false`
- `persistence: false`
- network/filesystem/database authority disabled
- Studio and Local Runtime transport disabled

This preserves the Product Constitution rule that BUILD operates only through explicit capabilities and Scope Lock.

## Downstream ownership

Build 52 does not implement downstream execution concerns:

- Build 53 — Tool Runtime
- Build 54 — Scope Intelligence
- Build 55 — Scope Lock
- Build 56 — Checkpoint Engine
- Build 57 — Validation Pipeline

No deploy, release, browser-store publication, DNS mutation, production database mutation, or other production-affecting action is authorized by this Build.
