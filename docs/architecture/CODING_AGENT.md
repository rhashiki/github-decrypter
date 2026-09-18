# Coding Agent

Build 60 activates Strachey as the canonical implementation specialization for the Named Agent System while preserving existing BUILD security authorities.

## Authority

- owner package: @github-decrypter/ai
- source: packages/ai/src/coding-agent.ts
- schema: gd-coding-agent/1
- canonical specialist: Strachey
- source Agent Runtime: Build 58
- execution substrate: Tool Runtime Build 53
- mutation boundary: Scope Lock Build 55
- mode: BUILD

## Boundary

Coding Agent != Tool Runtime

Strachey does not implement a second dispatcher, capability verifier, filesystem API, shell runtime or mutation engine. Every tool action is delegated to the canonical Tool Runtime, which remains deny-by-default and sovereign for capability verification. WRITE and EXECUTE actions remain subject to exact Scope Lock proof.

Coding Agent != Database Agent

Build 60 explicitly blocks DATABASE_WRITE. Database specialization and database mutation ownership remain Build 61. It also blocks GIT_WRITE, DESTRUCTIVE and SECRETS so coding identity cannot silently inherit later Git/release or privileged authority.

Coding Agent != Agent Orchestrator

Build 60 binds only Strachey. It does not select other agents, coordinate the team, hand off work, expose Viktor or make agent-routing decisions. Team coordination remains Build 64.

## Restricted coding capability envelope

The Coding Agent may delegate only READ, WRITE, EXECUTE and NETWORK capabilities to Tool Runtime. The Tool Runtime still decides whether each requested capability is granted. A mutating WRITE or EXECUTE tool must be explicitly declared mutating and must carry the exact Scope Lock candidate required by Tool Runtime.

Completed Coding Agent records bind Strachey, the Build orchestration, Scope Lock when applicable, Tool Runtime invocation/completion digests and a deterministic SHA-256 coding digest. Checkpoint and behavioral validation remain owned by Builds 56 and 57; Testing Agent remains Build 62.
