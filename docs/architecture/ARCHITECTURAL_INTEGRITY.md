# Architectural Integrity & Controlled Evolution

Status: **CANONICAL — BUILD 64**

> **Architecture may evolve, but it must never evolve accidentally.**

Build 64 makes architectural integrity a machine-readable project property rather than model memory.

## Separation of authority

- **Leonardo** — architectural design/evolution proposals.
- **Heimdall** — architectural-integrity and conformance analysis.
- **Architecture Guardian (Build 9)** — deterministic repository enforcement.
- **Ramon** — coordinates canonical specialist artifacts; does not override any of the above.

Heimdall != Architecture Guardian

Heimdall != architecture design authority

architecture conformance != behavioral validation

## Architecture Contract

gd-architecture-contract/1 is the canonical machine-readable current architecture. It records domains, responsibility ownership, dependency direction, forbidden dependencies, infrastructure boundaries and invariants.

The Contract is immutable evidence. Build 64 does not give it self-mutation or persistence authority.

## Architecture Ledger

gd-architecture-ledger/1 is canonical architectural decision memory. It stores explicit ADR-style decisions with rationale, introducing Build, affected domains, allowed/forbidden dependencies and supersession metadata.

Architecture Ledger != model memory

Heimdall consumes the Ledger but cannot silently rewrite it.

## Heimdall conformance states

gd-heimdall-conformance/1 produces: conformant, violation, architectural-change-required, or insufficient-evidence.

A dependency explicitly forbidden by the current Contract is a violation. A new/undeclared relationship, unknown domain, missing accepted ADR, or Refactor Before Feature condition yields architectural-change-required. A post-change review without Build 9 Guardian evidence yields insufficient-evidence. Guardian failure yields violation.

## Refactor Before Feature

If a requested feature would exceed the safe responsibility boundary of the current module/domain, decompose/refactor first, preserve and validate behavior, then continue the feature.

## Controlled flow

User intent -> Ramon -> Leonardo architectural analysis -> Heimdall pre-change -> Impact Simulation / Plan -> Scope Lock -> bounded specialist work -> Checkpoint / Validation -> Heimdall post-change -> deterministic Architecture Guardian -> completion evidence ready -> Viktor may communicate validated outcome.

completion evidence ready != independent completion authority

Ramon only derives whether required canonical evidence is present. Validation Pipeline and deterministic Architecture Guardian remain sovereign over their own truths.
