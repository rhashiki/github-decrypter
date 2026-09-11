# Build 55 — Scope Lock

Status: IMPLEMENTATION IN PROGRESS — CI GATE NOT YET CLOSED

## Objective

Introduce a deterministic, explicit Scope Lock over canonical Build 54 scope candidates and integrate that proof with the Build 53 Tool Runtime without turning Scope Lock into a capability-grant authority.

## Contract

- owner: `@github-decrypter/scope`
- source: `packages/scope/src/lock.ts`
- schema: `gd-scope-lock/1`
- source Scope schema: `gd-scope-intelligence/1`
- source Build schema: `gd-build-orchestrator/1`
- mode: `BUILD`
- deterministic SHA-256 identity
- exact caller-selected candidate allowlist
- canonical source-order normalization
- exact Build-step and access binding
- mutation access kinds: `write`, `execute`
- immutable result
- no automatic expansion or semantic inference

## Tool Runtime integration

Build 55 extends the existing `@github-decrypter/tools` runtime rather than creating a parallel executor.

- non-mutating Build 53 behavior remains backward-compatible;
- mutating tools remain blocked when no canonical Scope Lock is supplied;
- mutating invocation requires an explicit locked candidate ID and matching mutation access;
- all declared tool capabilities are still independently verified before handler dispatch;
- invocation-level `mutationAuthorized: true` exists only after both Scope Lock and capability verification succeed;
- Scope Lock itself keeps `capabilityGrantAuthority: false` and `mutationAuthorized: false`.

## Explicit non-authority

Build 55 does not own or activate:

- capability grants;
- direct filesystem/network/database authority;
- persistence or scheduling;
- Checkpoint Engine — Build 56;
- Validation Pipeline — Build 57;
- Local Runtime or Studio transport;
- deployment/release/DNS/browser-store/production mutation authority.

## Validation gate

Before this Build can be marked complete it must pass:

- Architecture Guardian including AG530–AG539;
- static Build 55 contract test;
- TypeScript compile/runtime coverage;
- negative Guardian probes;
- accumulated Builds 4–55 CI;
- workspace TypeScript checks;
- modern-engine preservation;
- Viktor Explicit Activation Guard.

## Next owner

Build 56 — Checkpoint Engine.
