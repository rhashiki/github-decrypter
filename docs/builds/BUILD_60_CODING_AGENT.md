# Build 60 — Coding Agent

Status: ✅ IMPLEMENTATION COMPLETE — ACCUMULATED CI GREEN

## Objective

Activate Strachey as the canonical Coding Agent specialization and allow bounded implementation execution only through the existing Tool Runtime, capabilities and Scope Lock authorities.

## Contract

- package: @github-decrypter/ai
- source: packages/ai/src/coding-agent.ts
- schema: gd-coding-agent/1
- specialist: strachey / Strachey / builder-programmer
- source Agent Runtime: Build 58
- Build Orchestrator: Build 52
- Tool Runtime: Build 53
- Scope Lock: Build 55
- mode: BUILD
- digest: SHA-256

## Required behavior

1. Require the canonical Build 58 Agent Runtime registry.
2. Bind only the canonical Strachey builder-programmer identity.
3. Delegate every execution to canonical Build 53 Tool Runtime.
4. Preserve Tool Runtime deny-by-default capability verification.
5. Preserve Scope Lock for every WRITE or EXECUTE mutation.
6. Allow only READ, WRITE, EXECUTE and NETWORK capability classes.
7. Reject DATABASE_WRITE, GIT_WRITE, DESTRUCTIVE and SECRETS capability classes.
8. Reject a WRITE or EXECUTE tool falsely declared non-mutating.
9. Bind the completed Tool Runtime invocation and completion digests into an immutable Coding Agent record.
10. Preserve Build 61–64 ownership and all Checkpoint/Validation ownership.

## Explicit non-authority

Build 60 does not grant capabilities, approve scope, implement database mutation, own Git writes, own destructive operations, access secrets directly, create checkpoints, perform behavioral validation, select agents, orchestrate the team, schedule jobs, persist state, introduce Studio/Local transport, deploy or release.

## Gate

The Build may be marked complete only after Architecture Guardian AG580–AG589, accumulated Builds 4–60 plus workspace TypeScript, Viktor Explicit Activation Guard and modern-engine preservation all pass on the implementation head; documentation and roadmap closure must then pass the same gate again.

## Next Build

Build 61 — Database Agent.
