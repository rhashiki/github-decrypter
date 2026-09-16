# Build 57 — Validation Pipeline

Status: 🚧 IN PROGRESS — TECHNICAL GATE REQUIRED

## Objective

Create the canonical deterministic validation layer that binds a completed Build 56 checkpoint to explicit acceptance criteria and explicit observed evidence, producing a fail-closed validation verdict without creating a second execution authority.

## Canonical contract

- package: `@github-decrypter/tools`
- source: `packages/tools/src/validation.ts`
- schema: `gd-validation-pipeline/1`
- source checkpoint schema: `gd-checkpoint-engine/1`
- mode: `BUILD`
- digest: SHA-256
- verdict: `passed | failed`

## Required behavior

1. Require a canonical Build 56 checkpoint.
2. Require 1–256 explicit acceptance criteria.
3. Require exactly one explicit observed evidence record per criterion.
4. Reject duplicate, missing, unknown or non-canonical criterion/evidence bindings.
5. Evaluate only deterministic supported operators; no semantic inference or guessed acceptance.
6. Bind source checkpoint, acceptance intent, observations and per-criterion results into a deterministic SHA-256 identity.
7. Produce an immutable overall verdict.
8. Set `completionEligible=true` only when every criterion passes.
9. Fail closed when evidence is incomplete or malformed.
10. Preserve all upstream ownership and downstream Testing Agent/Preview/Viktor boundaries.

## Supported evidence kinds

- `tool-result`
- `test`
- `diagnostic`
- `preview`

## Supported operators

- `equals`
- `not-equals`
- `truthy`
- `falsy`
- `exists`
- `contains`

## North Star acceptance

Build 57 is the validation substrate for Interactive QA:

- supported behavior must be capable of being validated from observed evidence rather than accepted only because code appears correct;
- validation relates observed result to original request/acceptance criteria;
- future interactive testing remains bounded by capabilities, safety policy and project scope;
- Build 62 — Testing Agent remains the owner of supported behavioral flow execution;
- Viktor may communicate canonical validation results later but owns no validation authority and may not report completion before canonical validation succeeds.

## Explicit non-authority

Build 57 does **not** authorize:

- tool dispatch or generic command execution;
- browser/Preview automation;
- Testing Agent implementation;
- capability grants;
- filesystem/network/database authority;
- mutation or Scope Lock expansion;
- scheduling or job creation;
- persistence;
- restore/replay execution;
- Local Runtime or Studio transport;
- deployment, release, DNS, browser-store publication or production database mutation.

## Gate

The Build may be marked complete only after:

- Architecture Guardian passes;
- accumulated CI through Build 57 plus workspace TypeScript passes;
- Viktor Explicit Activation Guard passes;
- modern-engine preservation passes;
- documentation status and roadmap are then marked complete;
- the same full gate passes again on the final documentation head;
- the protected PR workflow matrix is fully green with zero failures before merge.

## Next Build

Build 58 — Agent Runtime.
