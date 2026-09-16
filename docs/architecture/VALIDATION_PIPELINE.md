# Validation Pipeline

Build 57 introduces the canonical deterministic validation authority for completed BUILD outcomes.

## Authority

- owner package: `@github-decrypter/tools`
- source: `packages/tools/src/validation.ts`
- schema: `gd-validation-pipeline/1`
- source checkpoint schema: `gd-checkpoint-engine/1`
- mode: `BUILD`
- Testing Agent consumer: Build 62

## Boundary

Validation occurs only after a canonical Build 56 checkpoint has bound a completed Tool Runtime invocation and its result.

`validation != tool execution`

Build 57 does not dispatch tools, run browsers, start Preview, execute tests, mutate files or grant capabilities. It consumes explicit observed evidence produced by authorized runtime surfaces and deterministically evaluates that evidence against explicit acceptance criteria.

`validation != agent authority`

Build 62 Testing Agent may later exercise supported application flows and submit observed evidence to this validation authority. Build 57 does not create an agent, agent identity, autonomous routing or unrestricted automation.

`validation != completion claim without proof`

The pipeline is fail-closed. Every declared acceptance criterion requires exactly one observed evidence record. `completionEligible` is true only when every canonical criterion passes. A failed or incomplete validation cannot become an accepted completion merely because code appears correct.

## Behavioral validation substrate

Each criterion has:

- a deterministic sequential id;
- an explicit human-readable acceptance statement;
- one supported deterministic expectation operator;
- an optional expected JSON-compatible value when the operator requires one.

Each observation has:

- an exact criterion binding;
- a bounded evidence kind (`tool-result`, `test`, `diagnostic`, `preview`);
- a source reference;
- the observed JSON-compatible value.

The pipeline evaluates supported operators (`equals`, `not-equals`, `truthy`, `falsy`, `exists`, `contains`) without semantic guessing. It produces immutable per-criterion results, counts, an overall `passed|failed` verdict and a SHA-256 identity bound to the source checkpoint, acceptance intent and observed evidence.

## Interactive QA North Star

Build 57 is the canonical validation substrate for Interactive QA. It establishes the acceptance flow and proof format now; later Builds may produce richer behavioral evidence without replacing this authority.

- Build 62 Testing Agent may exercise supported flows within capabilities, safety policy and project scope.
- Preview/Perception Builds may provide supported observed evidence.
- Viktor may later communicate canonical validation results but owns no validation authority and may not report completion before canonical validation succeeds.

## Preserved ownership

- Build 12 — Durable Job Engine: persistence/recovery.
- Build 15 — Capability Security: grants and verification.
- Build 52 — Build Orchestrator: approved Build structure.
- Build 53 — Tool Runtime: handler dispatch/execution.
- Build 54 — Scope Intelligence: advisory scope candidates.
- Build 55 — Scope Lock: exact mutation allowlist.
- Build 56 — Checkpoint Engine: completed invocation/result proof.
- Build 62 — Testing Agent: supported behavioral flow execution.

## Non-authority

Build 57 adds no direct filesystem, network or database authority; no tool dispatch; no external flow execution; no mutation authority; no capability grants; no scheduling/job creation; no persistence; no restore/replay execution; no Local Runtime/Studio transport; and no deploy, release, DNS, browser-store or production mutation authority.