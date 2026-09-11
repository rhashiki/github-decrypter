# Scope Intelligence

Build 54 introduces the canonical V1 scope-analysis authority in `@github-decrypter/scope`.

## Contract

- schema: `gd-scope-intelligence/1`
- mode: `BUILD`
- source: canonical `gd-build-orchestrator/1`
- deterministic SHA-256 identity
- workspace-scoped and immutable
- explicit candidate declarations only
- structural coverage analysis only
- no semantic resource discovery
- advisory-only output

The engine receives a canonical Build 52 orchestration plus caller-declared scope candidates. Each candidate explicitly declares a key, Build step, opaque resource, access intent (`read`, `write`, or `execute`) and rationale.

Scope Intelligence normalizes those declarations and computes deterministic structural facts:

- which Build steps have at least one declared candidate;
- which Build steps remain uncovered;
- which candidates explicitly declare write intent;
- which candidates explicitly declare execute intent.

These are observations about declared scope data. They are not permissions.

## Boundary with Scope Lock

Build 54 answers: **what scope has been explicitly proposed and how does it cover the Build plan?**

Build 55 answers: **what scope is actually locked and therefore eligible to constrain mutation?**

The distinction is constitutional:

`scope intelligence != scope lock`

`declared write intent != mutation authority`

`candidate != capability grant`

`coverage != approval`

Build 54 therefore sets `scopeIntelligence: true` while preserving `scopeLock: false`, `scopeLocked: false`, `mutationAuthorized: false` and `capabilityGrantAuthority: false`.

## Environment neutrality

The package performs no filesystem inspection, network discovery, database inspection or process execution. Resource strings are opaque caller-provided identifiers. Build 54 does not infer that a value such as `file:src/App.tsx` exists or is writable.

No Studio or Local Runtime transport is introduced in this Build.

## Deferred ownership

- Build 55 — Scope Lock
- Build 56 — Checkpoint Engine
- Build 57 — Validation Pipeline

Build 54 also does not create jobs, persistence, scheduling, capability grants or direct Tool Runtime execution.
