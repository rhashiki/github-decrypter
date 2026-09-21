# Build 62 — Testing Agent

Status: IMPLEMENTATION READY — VALIDATION GATES PENDING

## Objective

Activate Samuel as the canonical Testing Agent specialization and complete the first bounded Interactive QA execution chain from Tool Runtime through Checkpoint Engine into the canonical Validation Pipeline.

## Contract

- package: `@github-decrypter/ai`
- source: `packages/ai/src/testing-agent.ts`
- schema: `gd-testing-agent/1`
- specialist: `samuel / Samuel / qa-testing`
- source Agent Runtime: Build 58
- Tool Runtime: Build 53
- Scope Lock: Build 55
- Checkpoint Engine: Build 56
- Validation Pipeline: Build 57
- mode: `BUILD`

## Required behavior

1. Require the canonical Build 58 Samuel identity.
2. Exercise exactly one explicitly registered supported flow per execution.
3. Accept only Tool Runtime `READ` and `EXECUTE` capabilities.
4. Require every `EXECUTE` tool to be declared mutating and covered by exact Scope Lock `execute` authorization.
5. Reject `WRITE`, `NETWORK`, `DATABASE_WRITE`, `GIT_WRITE`, `DESTRUCTIVE` and `SECRETS`.
6. Require one explicit acceptance criterion before executing the flow.
7. Fail before tool execution when acceptance intent/evidence metadata is malformed.
8. Create canonical Build 56 Checkpoint evidence from the completed invocation.
9. Bind the actual Tool Runtime result as observed evidence; do not fabricate or semantically infer evidence.
10. Delegate pass/fail and `completionEligible` entirely to Build 57 Validation Pipeline.
11. Produce an immutable deterministic Testing Agent result bound to invocation, checkpoint and validation identities.
12. Preserve Build 63 Review Agent, Build 64 Agent Orchestrator and later Preview ownership.

## Current evidence kinds

- `tool-result`
- `test`

## Explicit non-authority

Build 62 does not authorize unrestricted automation, generic browser automation, Preview control, direct network authority, generic source writes, database writes, Git writes, destructive actions, secrets access, capability grants, Scope Lock expansion, persistence, scheduling, deployment, release, DNS, browser-store publication or production mutation.

Samuel is not the validation authority. A completed test flow cannot become a canonical success unless the Validation Pipeline says it passes.

## Gate

The Build may be marked complete only after Architecture Guardian AG600–AG609, accumulated Builds 4–62 plus workspace TypeScript, Viktor Explicit Activation Guard and modern-engine preservation all pass on the implementation head; documentation and roadmap closure must then pass the same complete gate again.

## Next Build

Build 63 — Review Agent.
