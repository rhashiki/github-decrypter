# Build 48 — Plan Authority

Status: **IMPLEMENTATION IN PROGRESS — CI GATE NOT YET CLOSED**

## Purpose

Establish the canonical Plan Authority and enforce the constitutional rule that PLAN is read-only at the Local Runtime boundary.

## Implemented

- canonical `gd-plan-authority/1` contract in `@github-decrypter/plan`;
- exact Build 39 Requirement Spec + Build 40 Task Graph input binding;
- canonical source validation for requirements, task identities, dependencies, edges and topological order;
- deterministic SHA-256 Plan Authority digest and plan identity;
- immutable plan records;
- explicit `draft` and `approved` plan states;
- explicit approval that does not grant Build authority;
- Local Runtime `gd-plan-runtime-guard/1` read-only enforcement;
- mutation-capability rejection for WRITE, EXECUTE, DATABASE_WRITE, GIT_WRITE and DESTRUCTIVE;
- no enqueue, scheduler, tool execution or capability-grant authority;
- Build 48 Architecture Guardian AG460–AG469;
- static, runtime and negative-guardian tests.

## Read-only invariant

Both draft and approved plans remain read-only.

Approval does not enable:

- Build transition;
- Decision Engine;
- project rules;
- impact simulation;
- Build Orchestrator;
- Tool Runtime;
- Scope Intelligence or Scope Lock;
- checkpoints;
- validation execution;
- scheduling or execution.

## Explicit downstream ownership

Build 48 preserves:

- Build 49 — Decision Engine
- Build 50 — Project Rules Engine
- Build 51 — Impact Simulation
- Build 52 — Build Orchestrator
- Build 53 — Tool Runtime
- Build 54 — Scope Intelligence
- Build 55 — Scope Lock
- Build 56 — Checkpoint Engine
- Build 57 — Validation Pipeline

## Explicit exclusions

No generic Local Runtime RPC, Studio Plan surface, filesystem mutation, database mutation, network authority, job creation, agent execution, deployment, release, browser-store publication, DNS change or Supabase mutation is introduced by Build 48.

## Validation gate

The implementation must not be marked complete until:

1. Architecture Guardian AG460–AG469 is green;
2. Build 48 static/runtime/negative tests are green;
3. accumulated Builds 4–48 and workspace TypeScript are green on the exact implementation head;
4. only then the canonical roadmap may mark Build 48 ✅;
5. the exact documentation head must pass accumulated CI again before PR;
6. the complete historical PR workflow matrix must be green before protected-head merge.

## Next Build

**Build 49 — Decision Engine**. It must not begin before Build 48 is merged through the historical CI gate.
