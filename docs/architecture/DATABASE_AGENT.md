# Database Agent

Build 61 activates Pitts as the canonical backend/data specialization while preserving the existing Tool Runtime, capability, Scope Lock and database authority boundaries.

## Authority

- owner package: `@github-decrypter/ai`
- source: `packages/ai/src/database-agent.ts`
- schema: `gd-database-agent/1`
- canonical specialist: Pitts
- source Agent Runtime: Build 58
- execution substrate: Tool Runtime Build 53
- mutation boundary: Scope Lock Build 55
- mode: `BUILD`

## Boundary

`Database Agent != database authority`

Pitts never opens SQLite, PostgreSQL, Supabase or any other database directly. Build 11 remains the owner of the local database engine boundary, and later backend-provider builds remain the owners of provider-specific contracts. Build 61 only delegates database work through Tool Runtime.

`Database Agent != Coding Agent`

The Database Agent may delegate only `READ` and `DATABASE_WRITE`. It cannot use generic `WRITE`, `EXECUTE`, `NETWORK`, `GIT_WRITE`, `DESTRUCTIVE` or `SECRETS`. Source-code/filesystem implementation remains the Coding Agent boundary established by Build 60.

`Database Agent != production database mutation authority`

A `DATABASE_WRITE` request is still deny-by-default. It requires the canonical capability verifier and an exact Scope Lock candidate with `write` access. Build completion never authorizes production mutation by itself.

`Database Agent != Agent Orchestrator`

Pitts does not select agents, route work, coordinate the team, expose Viktor or perform handoffs. Team coordination remains Build 64.

## Deterministic record

Every completed Database Agent record binds Pitts, Build orchestration identity, Scope Lock when mutation occurs, Tool Runtime invocation/completion digests and a deterministic SHA-256 Database Agent digest. Testing, review and completion validation remain separate downstream authorities.
