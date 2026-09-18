# Planner Agent

Build 59 activates the canonical planning specialization for the Named Agent System without replacing Plan Authority.

## Authority

- owner package: `@github-decrypter/ai`
- source: `packages/ai/src/planner-agent.ts`
- schema: `gd-planner-agent/1`
- canonical specialist: Leonardo
- source Agent Runtime schema: `gd-agent-runtime/1`
- source Plan Authority schema: `gd-plan-authority/1`
- mode: `PLAN`

## Boundary

`Planner Agent != Plan Authority`

Build 48 remains the sole owner of canonical Plan Authority records and approval transition. Build 59 consumes only a canonical **draft** Plan Authority record and produces an immutable planning brief. It cannot approve a plan, change plan status, authorize BUILD or rewrite the source plan.

`Planner Agent != Decision Engine`

The Planner Agent does not make or own Build 49 decisions, Project Rules, Impact Simulation or Build Orchestration. It preserves all of those downstream authorities.

`Planner Agent != agent orchestration`

Leonardo is bound deterministically to the architect identity from Build 58. Build 59 does not select among agents, route work, coordinate the team or present Viktor. Ramon/team coordination remains Build 64.

## Planning brief

The canonical brief mirrors the exact ordered Plan Authority tasks as planner items and binds:

- Leonardo's canonical identity;
- the source draft plan id and SHA-256 authority digest;
- exact task/requirement ids;
- exact dependency order;
- immutable deterministic brief identity.

No semantic inference is performed by the Build 59 contract. Rich model-generated planning assistance can be layered later only through existing provider/runtime controls without replacing this canonical boundary.

## Preserved ownership

- Build 48 — Plan Authority and approval.
- Build 49 — Decision Engine.
- Build 50 — Project Rules.
- Build 51 — Impact Simulation.
- Build 52 — Build Orchestrator.
- Build 58 — canonical Named Agent registry.
- Build 60 — Coding Agent.
- Build 61 — Database Agent.
- Build 62 — Testing Agent.
- Build 63 — Review Agent.
- Build 64 — Agent Orchestrator and Viktor outward team presence.

## Non-authority

Build 59 adds no capability grants, approvals, Scope Lock authority, mutation authority, tools, filesystem/network/database authority, scheduling, jobs, persistence, Studio transport, Local Runtime transport, agent selection, team orchestration, deployment, release, DNS, publication or production mutation authority.
