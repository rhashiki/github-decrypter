# Checkpoint Engine

Build 56 introduces the canonical checkpoint proof for completed BUILD tool invocations.

## Authority

- owner package: `@github-decrypter/tools`
- source: `packages/tools/src/checkpoint.ts`
- schema: `gd-checkpoint-engine/1`
- source Build schema: `gd-build-orchestrator/1`
- source Tool Runtime schema: `gd-tool-runtime/1`
- source Scope Lock schema: `gd-scope-lock/1`
- mode: `BUILD`

## Boundary

A checkpoint is an immutable deterministic recovery anchor created only from a completed canonical Tool Runtime invocation. It binds the Build orchestration identity, Tool Runtime invocation identity, Scope Lock identity when present, exact Build step/tool/candidate access, canonical input digest, and canonical result digest.

`checkpoint != persistence`

Build 12 Durable Job Engine remains sovereign for durable job state, `checkpoint_json`, crash recovery, restart recovery and resume. Build 56 produces the canonical checkpoint value that a later runtime integration may persist through that existing authority; it does not create a second checkpoint store.

`checkpoint != mutation authority`

A checkpoint records whether the source invocation was mutation-authorized, but the checkpoint itself never grants capabilities, never grants mutation authority and never dispatches a tool.

`checkpoint != restore execution`

Build 56 establishes a safe recovery anchor only. It does not replay, restore or re-execute a tool. Any later recovery execution remains subject to the Durable Job Engine, capabilities, Scope Lock and replay/idempotency policy.

## Deterministic proof

The checkpoint identity is SHA-256 over canonical source bindings plus independent SHA-256 digests of the completed invocation input and result. This closes the Build 53 invocation identity gap intentionally: the Tool Runtime invocation digest identifies the requested invocation before handler execution, while the Checkpoint Engine additionally proves the completed result.

## Preserved ownership

- Build 12 — Durable Job Engine: persistence and durable recovery state.
- Build 15 — Capability Security: capability grants and verification authority.
- Build 52 — Build Orchestrator: approved Build structure.
- Build 53 — Tool Runtime: handler dispatch and execution.
- Build 54 — Scope Intelligence: advisory scope candidates.
- Build 55 — Scope Lock: exact mutation allowlist.
- Build 57 — Validation Pipeline: validation of outcomes after checkpointing.

## Non-authority

Build 56 adds no direct filesystem, network or database authority; no Local Runtime or Studio transport; no scheduling or job creation; no persistence; no restore/replay execution; no Validation Pipeline; and no deploy, release, DNS, browser-store or production mutation authority.