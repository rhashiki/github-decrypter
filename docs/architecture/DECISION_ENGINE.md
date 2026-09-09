# Decision Engine

Build 49 adds the Decision Engine inside the runtime-enforced read-only PLAN boundary.

## Purpose

The Decision Engine records a meaningful architectural choice between explicit alternatives before Plan approval. It does not infer hidden alternatives, automatically score options, apply project rules, simulate impact, authorize BUILD, or execute tools.

Canonical schema: `gd-decision-engine/1`.

Canonical owner: `@github-decrypter/plan`, source `packages/plan/src/decision.ts`.

## Source boundary

The engine accepts only a canonical Build 48 `gd-plan-authority/1` record whose status is still `draft`. The source Plan identity and SHA-256 authority digest are revalidated against canonical Plan material before a decision can be resolved.

A Decision Engine input contains exactly:

- `plan`
- `question`
- `alternatives`
- `selectedAlternativeOrdinal`
- `rationale`

At least two and at most 32 alternatives must be declared. Each alternative has a stable ordinal identity, label, summary, and one or more declared tradeoffs. Alternative labels are unique.

## Decision semantics

Selection is declared by the caller. The engine does not pretend to perform semantic inference or automatic scoring. Planner/agent/user reasoning may prepare the alternatives and rationale in later orchestration, but the Build 49 engine itself is deterministic validation plus immutable decision recording.

The result binds:

- source Plan ID and digest;
- decision question;
- all explicit alternatives and tradeoffs;
- selected alternative;
- rationale;
- deterministic SHA-256 decision digest.

The returned record is deeply immutable and remains in `PLAN` mode.

## Read-only invariant

Build 49 preserves the Build 48 runtime-enforced read-only PLAN contract. It adds no Local Runtime transport, capability grant, filesystem/database authority, scheduler, job creation, tool execution, or persistence.

A resolved decision does **not** authorize the Plan-to-Build transition. `buildTransitionAuthorized` remains `false`.

## Deferred ownership

The following remain explicitly outside Build 49:

- Build 50 — Project Rules
- Build 51 — Impact Simulation
- Build 52 — Build Orchestrator
- Build 53 — Tool Runtime
- Build 54 — Scope Intelligence
- Build 55 — Scope Lock
- Build 56 — Checkpoint Engine
- Build 57 — Validation Pipeline

No deployment, release, production database mutation, DNS mutation, or other production-affecting operation is authorized by completing this Build.
