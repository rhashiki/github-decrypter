# Tool Runtime

Build 53 owns the environment-neutral runtime contract that dispatches explicitly registered tool handlers for an existing Build 52 orchestration.

## Authority

- owner package: `@github-decrypter/tools`
- owner source: `packages/tools/src/index.ts`
- schema: `gd-tool-runtime/1`
- source orchestration: `gd-build-orchestrator/1`
- mode: `BUILD`
- capability authority remains owned by Build 15

The runtime revalidates the canonical Build Orchestrator identity before accepting a tool registry. It does not create or approve Plans, Project Rules, Impact Simulations, Build orchestrations, capability grants, jobs, checkpoints, Scope Locks, or validation results.

## Dispatch contract

Each tool has an explicit id, label, required capability set, mutation declaration, and injected handler. Each invocation is bound to one canonical Build step and receives a deterministic SHA-256 invocation identity derived from the orchestration identity, step, tool descriptor, capabilities, and canonical JSON-compatible input.

Capabilities are never self-granted. A caller must inject a capability verifier owned by the existing capability-security boundary. Denial is the default: every required capability must be verified before the handler is invoked.

The invariant for Build 53 is:

`execute != mutate`

Build 53 may dispatch non-mutating handlers after capability verification. A tool explicitly declared as mutating is rejected because Build 55 Scope Lock does not exist yet. This prevents Tool Runtime from turning handler dispatch into premature mutation authority.

## Environment boundary

`@github-decrypter/tools` is environment-neutral. The package contains no direct filesystem, network, database, shell, browser, Studio, or Local Runtime transport implementation. Concrete environment adapters remain outside this package and must respect their own authorities.

Build 53 therefore keeps:

- `mutationAuthorized: false`
- `scopeIntelligence: false`
- `scopeLock: false`
- `checkpoints: false`
- `validationPipeline: false`
- `scheduling: false`
- `jobCreation: false`
- `persistence: false`
- network/filesystem/database authority disabled
- Studio and Local Runtime transport disabled

## Downstream ownership

Build 53 does not implement:

- Build 54 — Scope Intelligence
- Build 55 — Scope Lock
- Build 56 — Checkpoint Engine
- Build 57 — Validation Pipeline

No deploy, release, browser-store publication, DNS mutation, production database mutation, or other production-affecting action is authorized by this Build.
