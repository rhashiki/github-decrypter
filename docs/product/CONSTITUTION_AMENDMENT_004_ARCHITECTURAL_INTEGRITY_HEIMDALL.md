# Constitutional Amendment 004 — Architectural Integrity & Heimdall

Status: **ADOPTED BY PRODUCT OWNER — IMPLEMENTATION MAPPED TO BUILD 64**

## Purpose

The product owner requires architectural integrity and controlled evolution to become a structural property of Vortex Ars AI rather than a best-effort convention or a behavior that depends on model memory.

The governing principle is:

> **Architecture may evolve, but it must never evolve accidentally.**

This amendment adopts **Heimdall — Architecture Guardian** as the tenth canonical specialist agent and defines the architectural-integrity contract that future orchestration must preserve.

## Constitutional definition

1. **Heimdall is the tenth canonical specialist agent of Vortex Ars AI.**
2. Heimdall owns architectural-integrity and architectural-conformance analysis, not architectural design authority.
3. Leonardo remains the architecture/design specialist responsible for proposing and evolving architecture deliberately.
4. The deterministic **Architecture Guardian introduced by Build 9 remains the machine-enforced architectural gate**. Heimdall does not replace it and cannot override it.
5. Ramon remains the orchestration authority. Heimdall does not independently route, schedule or execute implementation work.
6. Agent identity never grants capabilities, approvals, Scope Lock expansion, mutation authority, filesystem/network/database authority or production authority.
7. Architectural decisions must be represented in project state and repository authorities; preserving architecture must never depend on an agent remembering a prior conversation.
8. Relevant architectural change must be explicit, reviewable, attributable and justified before implementation may silently rely on it as precedent.
9. A feature that exceeds the safe responsibility boundary of its target module must trigger **Refactor Before Feature** rather than silently increasing architectural debt.
10. Code that compiles or passes behavioral tests is not architecturally correct when it violates the accepted architecture contract.

## Viktor clarification

Earlier authorities state that Viktor is “not a tenth agent”. After this amendment, that sentence is interpreted by its intended security meaning:

> **Viktor is not an agent and is never counted in the canonical specialist-agent registry.**

The earlier wording does not reserve ordinal slot 10. Heimdall is the tenth canonical specialist. Viktor remains the non-agent Interaction Layer defined by Constitutional Amendments 002 and 003.

## Controlled architectural evolution

Before a relevant change enters implementation, Vortex Ars AI must be capable of determining:

- where the responsibility belongs;
- what domains/modules the change may affect;
- whether the existing architecture safely accommodates the responsibility;
- whether the change is a local extension, a cross-cutting change, a new domain/module, or an architectural change;
- whether decomposition/refactoring is required before the requested feature.

Implementing agents must not change architecture silently merely because an existing file or module is convenient.

The intended flow is:

```text
User intent
  -> Ramon
  -> Leonardo architectural analysis
  -> Heimdall pre-change conformance review
  -> Impact Simulation
  -> approved plan
  -> Scope Lock
  -> bounded implementation
  -> Checkpoint
  -> Validation Pipeline
  -> Heimdall post-change conformance review
  -> deterministic Architecture Guardian
  -> canonical completion eligibility
```

Build ownership and runtime policy may refine the exact orchestration sequence, but they may not remove the separation between architectural design, architectural conformance and deterministic enforcement.

## Architecture Contract

Vortex Ars AI must evolve toward a canonical, machine-readable **Architecture Contract** representing at minimum, where applicable:

- domain/module ownership;
- allowed dependency direction;
- forbidden cross-domain access;
- infrastructure-access boundaries;
- contracts between domains;
- architectural invariants;
- accepted architectural exceptions;
- protected ownership boundaries.

An implementation may not bypass a declared boundary merely because the resulting code works.

Example:

```text
Editor
  -> Project Service
  -> Backend Provider
  -> Supabase
```

If the accepted architecture forbids direct infrastructure access, this remains non-conformant:

```text
Editor
  -> Supabase
```

even when compilation and behavioral tests succeed.

## Architecture Ledger

Architecturally relevant decisions must be persistable as an **Architecture Ledger**, using durable ADR-style records or an equivalent canonical machine-readable representation.

A record should be able to identify:

- decision identity;
- accepted status;
- rationale;
- introducing Build/change;
- affected domain/module;
- allowed dependencies;
- forbidden dependencies;
- superseding decision when applicable.

The Ledger is project authority, not agent memory.

Heimdall may consume and evaluate Ledger records. Heimdall may not silently rewrite accepted architectural decisions.

## Refactor Before Feature

When a requested feature would push an existing module beyond acceptable architectural boundaries, Vortex Ars AI must prefer:

1. explicit decomposition/refactor;
2. preservation and validation of existing behavior;
3. architectural conformance verification;
4. only then implementation of the new feature.

Signals may include responsibility accumulation, dependency fan-out, excessive coupling, excessive complexity, duplicated ownership or violation of a declared domain boundary.

Thresholds and machine-detectable signals must be explicit rather than inferred as hidden personality preferences.

## Heimdall responsibilities

Heimdall may:

- inspect plans, diffs and relevant project architecture;
- consume Architecture Contract and Architecture Ledger records;
- compare a proposed or completed change with architectural invariants;
- identify forbidden dependency direction or ownership drift;
- identify when an architectural change must be explicit before feature implementation;
- recommend decomposition or Refactor Before Feature;
- produce canonical architectural-conformance evidence for orchestration;
- prevent completion eligibility when deterministic architectural policy reports a violation.

Heimdall may not:

- grant capabilities;
- approve protected actions;
- expand Scope Lock;
- mutate project files on its own authority;
- execute arbitrary tools;
- rewrite architecture silently;
- override Leonardo by silently redesigning the system;
- override the deterministic Architecture Guardian;
- override behavioral Validation Pipeline results;
- deploy, release, publish, mutate DNS or mutate production.

## Relationship to behavioral validation

Architectural conformance and behavioral validation are separate truths.

```text
Validation Pipeline
  -> behavioral truth

Heimdall + Architecture Guardian
  -> architectural conformance truth
```

Neither one alone proves complete correctness.

A later canonical completion authority may compose evidence such as:

- Scope conformance;
- capability/security conformance;
- Checkpoint evidence;
- behavioral Validation Pipeline result;
- architectural conformance.

Viktor may communicate that composed outcome but owns none of those authorities.

## Agent Runtime migration

Build 58 historically and correctly established Agent Runtime revision 1 with exactly nine canonical specialists. This amendment does **not** rewrite that completed Build.

Until Build 64 is reached:

- `gd-agent-runtime/1` remains canonical;
- `AGENT_RUNTIME_COUNT = 9` remains correct;
- Heimdall must not be inserted prematurely into the Build 58 registry.

**Build 64 — Agent Orchestrator** owns the explicit roster transition required by this amendment. Build 64 must:

- introduce Heimdall into the canonical team as specialist number 10;
- perform an explicit Agent Runtime revision/migration rather than silently changing Build 58 history;
- preserve Viktor outside the agent registry;
- preserve all security/capability boundaries;
- integrate Heimdall into pre-change and post-change architectural review;
- consume the deterministic Build 9 Architecture Guardian rather than replacing it;
- establish the canonical integration surface for Architecture Contract and Architecture Ledger data used by Heimdall.

## Machine-enforcement requirement

The Architecture Guardian must protect this amendment from disappearing or being implemented early.

Before Build 64 it must fail closed if Heimdall is silently inserted into the Build 58 runtime registry.

At Build 64 and later it must fail closed if the canonical agent-team contract does not include Heimdall as the tenth specialist or if Viktor is represented as an agent.

This transition must be machine-enforced in repository policy, not left to model memory.

## Governance

No decimal or ad-hoc Build is created. The frozen sequence remains 1–134.

This amendment is explicit product-owner authorization to add Architectural Integrity & Controlled Evolution and Heimdall to V1 through existing authorities. Implementation must occur only in the mapped owning Build and ordinary Build gates remain mandatory.
