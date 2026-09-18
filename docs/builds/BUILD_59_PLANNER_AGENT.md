# Build 59 — Planner Agent

Status: IN PROGRESS

## Objective

Activate Leonardo as the canonical Planner Agent specialization while preserving Plan Authority, approval, decision, scope, execution and orchestration boundaries.

## Contract

- package: `@github-decrypter/ai`
- source: `packages/ai/src/planner-agent.ts`
- schema: `gd-planner-agent/1`
- specialist: `leonardo / Leonardo / architect`
- source Agent Runtime: Build 58
- source Plan Authority: Build 48
- required source plan status: `draft`
- deterministic SHA-256 planner brief

## Required behavior

1. Require the canonical Build 58 Agent Runtime registry.
2. Bind only the canonical Leonardo architect identity.
3. Require a canonical Build 48 Plan Authority record in `draft` state.
4. Revalidate the source Plan Authority digest and task/dependency order.
5. Mirror source tasks into immutable deterministic planner items.
6. Preserve the source plan read-only.
7. Reject approved plans.
8. Never approve, mutate, execute or transition the plan.
9. Never select/orchestrate other agents.
10. Preserve downstream ownership of Builds 60–64.

## Explicit non-authority

Build 59 does **not** authorize:

- Plan approval;
- Decision Engine authority;
- Project Rules or Impact Simulation authority;
- Build transition/orchestration;
- capability grants or approvals;
- Scope Lock or mutation;
- tool or agent execution;
- filesystem/network/database access;
- jobs, scheduling or persistence;
- Local Runtime/Studio transport;
- Agent Orchestrator;
- Viktor runtime/presence;
- deploy, release, DNS, store publication or production mutation.

## Gate

The Build may be marked complete only after:

- Architecture Guardian including AG570–AG579 passes;
- accumulated Builds 4–59 + workspace TypeScript passes;
- Viktor Explicit Activation Guard passes;
- modern-engine preservation passes;
- documentation and roadmap are marked complete only after the technical head is green;
- the same full gate passes again on the final documentation head;
- the protected PR historical workflow matrix is fully green with zero failures.

## Next Build

Build 60 — Coding Agent.
