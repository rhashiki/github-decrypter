# Build 61 — Database Agent

Status: 🚧 IMPLEMENTATION COMPLETE — ACCUMULATED CI GATE PENDING

## Objective

Activate Pitts as the canonical Database Agent specialization without creating direct database, provider, secrets, filesystem, shell or production mutation authority.

## Contract

- package: `@github-decrypter/ai`
- source: `packages/ai/src/database-agent.ts`
- schema: `gd-database-agent/1`
- specialist: `pitts / Pitts / backend-computational-core`
- source Agent Runtime: Build 58
- Build Orchestrator: Build 52
- Tool Runtime: Build 53
- Scope Lock: Build 55
- mode: `BUILD`
- digest: SHA-256

## Required behavior

1. Require the canonical Build 58 Agent Runtime registry.
2. Bind only the canonical Pitts backend-computational-core identity.
3. Delegate every operation to canonical Build 53 Tool Runtime.
4. Allow only `READ` and `DATABASE_WRITE` capability classes.
5. Require `DATABASE_WRITE` tools to declare mutation explicitly.
6. Require exact Scope Lock `write` authorization before `DATABASE_WRITE`.
7. Preserve injected capability verification and deny-by-default behavior.
8. Reject generic `WRITE`, `EXECUTE`, `NETWORK`, `GIT_WRITE`, `DESTRUCTIVE` and `SECRETS`.
9. Bind Tool Runtime invocation/completion digests into an immutable deterministic result.
10. Preserve Builds 62–64 and backend-provider ownership.

## Explicit non-authority

Build 61 does not connect directly to any database, configure providers, access secrets, execute shell commands, mutate files, write Git, grant capabilities, approve scope, create checkpoints, validate behavior, select agents, orchestrate the team, schedule jobs, persist agent state, deploy, release, mutate DNS or authorize production database changes.

## Gate

The Build may be marked complete only after Architecture Guardian AG590–AG599, accumulated Builds 4–61 plus workspace TypeScript, Viktor Explicit Activation Guard and modern-engine preservation all pass on the implementation head; documentation and roadmap closure must then pass the same gate again.

## Next Build

Build 62 — Testing Agent.
