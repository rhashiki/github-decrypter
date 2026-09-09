# Build 50 — Project Rules Engine

Status: IMPLEMENTATION IN PROGRESS — CI GATE NOT YET CLOSED

## Objective

Add the V1 workspace-scoped project constitution contract while preserving the runtime-enforced read-only PLAN boundary and all Build 48–49 authorities.

## Contract

- owner: `@github-decrypter/plan`
- source: `packages/plan/src/project-rules.ts`
- schema: `gd-project-rules/1`
- source schema: `gd-plan-authority/1`
- source Plan must remain `draft`
- explicit workspace identity
- explicit ordered rules only
- rule kinds: `require`, `forbid`, `prefer`
- deterministic SHA-256 identity
- deeply immutable result
- PLAN remains read-only
- no automatic semantic rule evaluation
- Plan-to-Build transition remains unauthorized

## Explicit non-authority

Build 50 does not own or activate:

- Impact Simulation — Build 51
- Build Orchestrator — Build 52
- Tool Runtime — Build 53
- Scope Intelligence — Build 54
- Scope Lock — Build 55
- Checkpoint Engine — Build 56
- Validation Pipeline — Build 57

It also adds no Local Runtime transport, Studio transport, persistence, scheduler, job creation, capability grant, filesystem/database/network authority, AI execution, tool execution, deploy, release, DNS, or production mutation authority.

## Validation gate

The implementation is not complete until an implementation head passes:

- Architecture Guardian including AG480–AG489;
- static Build 50 contract test;
- TypeScript compile/runtime coverage;
- negative Guardian probes;
- accumulated Builds 4–50 CI;
- workspace TypeScript checks;
- modern-engine preservation.

Only after that gate is green may this document and `docs/product/ROADMAP_V1.md` be marked complete. The final documentation head must then pass the same gates again before PR creation.

## Next owner

Build 51 — Impact Simulation.
