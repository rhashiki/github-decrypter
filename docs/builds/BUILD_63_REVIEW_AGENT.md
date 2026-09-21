# Build 63 — Review Agent

Status: IMPLEMENTATION READY — VALIDATION GATES PENDING

## Objective

Activate Weizenbaum as the canonical Review Agent specialization and provide a deterministic advisory review artifact over canonical Coding Agent, Database Agent and Testing Agent results without creating approval, veto, validation, architecture-enforcement or mutation authority.

## Contract

- package: `@github-decrypter/ai`
- source: `packages/ai/src/review-agent.ts`
- schema: `gd-review-agent/1`
- specialist: `weizenbaum / Weizenbaum / reviewer-critic`
- source Agent Runtime: Build 58
- supported targets: `coding | database | testing`
- max findings: 256
- mode: `BUILD`
- digest: SHA-256

## Required behavior

1. Require the canonical Build 58 Weizenbaum identity.
2. Require one canonical Coding Agent, Database Agent or Testing Agent result as the review target.
3. Revalidate the canonical target before producing a report.
4. Bind the report to the source schema, id, digest, workspace and Build step.
5. Accept only explicit ordered review findings.
6. Support categories: correctness, security, architecture, maintainability and testing.
7. Support severities: info, warning, error and critical.
8. Preserve Testing Agent verdict and completion eligibility as read-only source facts.
9. Produce deterministic severity counts and `clear | findings-present` review state.
10. Keep every report advisory-only.
11. Preserve Build 9 Architecture Guardian, Build 57 Validation Pipeline and Build 64 Agent Orchestrator/Heimdall ownership.
12. Add no tool execution, mutation, capability, approval, veto or completion authority.

## Explicit non-authority

Build 63 does not execute tools, generate unrestricted semantic decisions, grant capabilities, approve or veto changes, change validation verdicts, alter `completionEligible`, enforce architecture, mutate source code, access databases, use the network, write Git, schedule jobs, persist agent state, deploy, release, mutate DNS or authorize production changes.

## Gate

The Build may be marked complete only after Architecture Guardian AG610–AG619, accumulated Builds 4–63 plus workspace TypeScript, Viktor Explicit Activation Guard and modern-engine preservation all pass on the implementation head; documentation and roadmap closure must then pass the same complete gate again.

## Next Build

Build 64 — Agent Orchestrator.
