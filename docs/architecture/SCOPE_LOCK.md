# Scope Lock — Build 55

Build 55 introduces the canonical Scope Lock authority for BUILD mode.

## Authority

`@github-decrypter/scope` owns the deterministic lock contract in `packages/scope/src/lock.ts`.

The lock consumes only:

- a canonical Build 52 orchestration (`gd-build-orchestrator/1`);
- a canonical Build 54 Scope Intelligence record (`gd-scope-intelligence/1`);
- an explicit caller-provided list of candidate IDs already present in that Scope Intelligence record.

It emits `gd-scope-lock/1` and binds the exact candidate allowlist, affected Build steps, write candidates and execute candidates with deterministic SHA-256 identity.

## Security model

**scope lock != capability grant**

A Scope Lock proves only that a previously analyzed candidate is inside the explicit BUILD mutation boundary. It does not create, approve or bypass a capability.

A mutating Tool Runtime invocation is eligible only when all of the following are true:

1. the runtime receives a canonical Scope Lock bound to the same orchestration;
2. the requested candidate is explicitly locked;
3. the candidate belongs to the requested Build step;
4. the requested mutation access exactly matches the candidate (`write` or `execute`);
5. every capability declared by the tool is independently approved by the injected capability verifier.

Without a canonical lock, mutating tools remain blocked. Without a required capability, the handler is not dispatched. The lock itself remains `capabilityGrantAuthority: false` and `mutationAuthorized: false`; invocation-level authorization is produced only by Tool Runtime after both boundaries pass.

## Determinism and immutability

- explicit candidate IDs only;
- no semantic inference;
- no automatic scope expansion;
- canonical source revalidation;
- deterministic source-order normalization;
- immutable lock record;
- deterministic SHA-256 lock identity;
- workspace binding inherited from the canonical orchestration.

## Non-authority

Build 55 does not introduce direct filesystem, network or database authority. It does not persist locks, schedule jobs, create checkpoints, validate outputs, add Local Runtime transport, add Studio transport, deploy, release, publish, mutate production infrastructure or alter DNS.

Build 56 — Checkpoint Engine remains the sole next owner of checkpoints.

Build 57 — Validation Pipeline remains the sole owner of validation.
