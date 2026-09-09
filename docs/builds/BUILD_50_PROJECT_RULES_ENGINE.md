# Build 50 — Project Rules Engine

Status: IMPLEMENTATION IN PROGRESS — CI GATE NOT YET CLOSED

## Objective

Implement the frozen V1 requirement for **project rules/constitution per workspace** without weakening PLAN read-only authority or preempting Impact Simulation and Build execution.

## Implemented contract

### Core
- `packages/plan/src/project-rules.ts`
- schema `gd-project-rules/1`
- rule schema `gd-project-rule/1`
- stage projection `gd-project-rules-stage/1`
- workspace binding to `gd-workspace/1`
- deterministic SHA-256 identity
- maximum 256 rules
- explicit categories, directives and stages
- deep immutability
- deterministic stage selection
- no semantic inference or automatic compliance decision

### Local persistence
- `apps/local/src/project-rules-store.ts`
- schema `gd-local-project-rules-store/1`
- existing durable SQLite `gd_metadata` storage
- workspace-scoped metadata namespace
- workspace existence validation
- monotonic storage revision
- durable restart persistence
- no new database migration
- no Durable Job creation
- no RPC/Studio transport

### Preserved boundaries
- PLAN remains runtime-enforced read-only
- Decision Engine ownership remains Build 49
- Impact Simulation remains Build 51
- `buildTransitionAuthorized: false`
- no Build Orchestrator
- no Tool Runtime
- no Scope Intelligence/Lock
- no checkpoints/validation
- no execution or scheduling

## Verification gates

The Build is not complete until all are green on the same implementation head:

1. Architecture Guardian including AG480–AG489
2. static Build 50 test
3. TypeScript Build 50 test compilation
4. runtime Project Rules test
5. negative Guardian probes
6. accumulated Builds 4–50
7. all workspace TypeScript checks
8. modern engine preservation

Only after those gates pass may this document and the canonical roadmap be marked ✅. The resulting documentation head must then repeat the complete gate before PR creation.

## Next canonical Build

**Build 51 — Impact Simulation**.
