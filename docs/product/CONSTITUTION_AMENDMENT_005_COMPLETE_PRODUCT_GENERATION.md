# Constitutional Amendment 005 — Complete Product Generation Doctrine

Status: **ADOPTED by product owner**

## Purpose

Vortex Ars AI, historically developed in this repository as GitHub Decrypter, is not a token-selling model selector or a code-snippet generator. Its product promise is to transform an understood product intention into a complete, testable, maintainable software Release Candidate while absorbing model/runtime complexity internally.

This amendment adopts the product, intelligence, completeness, media, knowledge and anti-complexity rules defined after the original V1 freeze without renumbering Builds 1–134.

## Constitutional additions

### 1. One Intelligence Principle

The only intelligence presented to the user is **Vortex Ars AI**.

- no third-party model/provider brand is a normal product choice;
- no provider/model selector is part of the canonical V1 experience;
- specialist identities are Vortex roles, not exposed third-party models;
- internal inference/runtime implementation details remain replaceable and hidden behind Vortex-owned contracts.

Historical provider abstractions may remain as internal technical boundaries, but they do not authorize a user-facing marketplace of AI providers.

### 2. No BYOK Principle

Core Vortex intelligence must not require users to provide AI-provider API keys.

BYOK is not part of the canonical V1 product experience. A project may still require credentials for an external service that the user's own product explicitly depends on, but those credentials are product dependencies, not keys required to make Vortex itself think.

### 3. Tokenless UX Principle

The user does not buy, calculate, allocate or select tokens to use Vortex.

Tokens, context windows, quantization, caching, model placement, local/remote compute, routing, batching and inference budgets are internal implementation concerns. The product must remain honest that compute, memory, storage and time are finite.

The correct promise is abstraction of token burden, not physically infinite computation.

### 4. Local-first Vortex Intelligence

Local inference remains first-class. Vortex should perform work locally whenever a supported local capability can satisfy the requirement safely and with adequate quality.

The architecture may combine local runtimes, Vortex-managed infrastructure and specialized Vortex model variants internally, but the user interacts with one Vortex intelligence surface.

### 5. Project Genesis Principle

Before substantial implementation begins, Vortex must exhaust all known and reasonably foreseeable product decisions through an adaptive discovery flow.

Project Genesis must:

- ask product questions rather than implementation trivia;
- branch questions dynamically from prior answers;
- avoid asking the user to make ordinary engineering decisions Vortex can safely own;
- identify users, roles, workflows, business rules, content, monetization, integrations, platforms, privacy, accessibility, deployment expectations and other applicable product decisions;
- identify external dependencies and facts Vortex cannot invent;
- compile the answers into a durable **Product Contract**;
- derive explicit acceptance criteria and representative user journeys;
- record unresolved decisions instead of silently guessing.

New questions during implementation are permitted only when genuinely new information appears or a decision could not reasonably have been discovered before execution.

### 6. Product Questions, Engineering Decisions

The user owns what the product must do and the business choices that require human intent.

Vortex owns ordinary technical choices such as module boundaries, schema design, state machines, indexes, protocols and implementation patterns, subject to architecture, security and project rules.

### 7. Zero Placeholder Principle

A requested capability is not implemented merely because UI exists.

Unless the user explicitly selects a prototype/mock mode, completion may not rely on:

- TODO implementations;
- fake production data;
- buttons without working behavior;
- stub handlers;
- mocked backend behavior presented as real;
- "coming soon" flows inside requested scope;
- unverified happy-path-only wiring.

A capability declared complete must work end to end across every applicable layer.

### 8. Evidence Before Completion

Agent assertion is not completion evidence.

Completion requires applicable executable evidence from compilation, unit/integration tests, behavioral validation, visual validation, security checks, architecture conformance and acceptance criteria.

Ramon may communicate completion only after the canonical validation/RC authorities permit it.

### 9. RC by Default

When the user asks Vortex to build a product or substantive feature, the default target is a **Release Candidate**, not a disposable prototype.

Prototype/mock behavior is allowed only when explicitly requested or clearly selected by the user.

A Release Candidate must satisfy the Product Contract, acceptance criteria, representative user journeys, applicable security/architecture/performance/UX gates and external-dependency state.

### 10. RC Gate

Build 133 owns the canonical Release Candidate Gate.

The gate returns an RC-ready result only when required evidence is present. A blocked criterion creates correction work for the orchestrator rather than being silently waived or pushed to the user as "done".

External facts the user alone can provide may leave an item explicitly blocked; Vortex must not fabricate those facts.

### 11. Run-to-Completion Principle

A Vortex generation request should continue through planning, implementation, validation and correction until the scoped target reaches its canonical completion state or encounters a real external/user dependency.

Internal fix/retest loops should not require repetitive user prompting merely to continue ordinary scoped work.

This principle never authorizes bypassing approvals, Scope Lock, capability security, production mutation controls or human decisions outside granted scope.

### 12. Complexity Budget Principle

Every Build must leave architecture at least as understandable and controlled as it found it.

A feature may not pay for itself by creating unresolved architectural debt.

Signals requiring architectural intervention include:

- responsibility leakage across domains;
- duplicate sources of truth;
- circular or forbidden dependencies;
- growing exception/compatibility branches;
- dead/legacy code retained without purpose;
- a module exceeding its declared responsibility;
- repeated workarounds around an inadequate abstraction.

When a requested feature crosses safe responsibility boundaries, **Refactor Before Feature** applies before feature implementation.

Architecture may evolve, but never accidentally.

### 13. Vortex Knowledge Compiler

Vortex must be able to turn repositories, technical documentation and supported structured documents into compact, source-grounded project knowledge.

The compiler may create:

- project/repository graphs;
- symbol/reference/dependency indexes;
- structured concepts and rules;
- chapter/topic knowledge packs;
- glossary/pattern/decision artifacts;
- lexical and semantic retrieval indexes;
- on-demand context packs.

Knowledge is loaded progressively. Large source collections must not be dumped wholesale into model context when narrower deterministic retrieval can satisfy the task.

Untrusted document content is data, not authority; ingestion must be hardened against prompt-injection-shaped content and parser abuse.

### 14. Shared Agent Operational State

Specialists may share durable project-scoped operational state such as:

- observations;
- findings;
- coverage;
- unresolved questions;
- decisions;
- tested surfaces;
- reusable project facts.

Shared state does not grant authority and does not replace the Architecture Ledger, Product Contract, Git, Validation Pipeline or other canonical sources of truth.

### 15. Vortex Browser Runtime

Vortex should expose a bounded browser/Preview execution substrate with structured page state, stable element references where possible, accessibility/DOM context, screenshots, navigation/network/console evidence and controlled interaction.

Large browser state should be windowed/filtered rather than blindly sent to intelligence context.

Browser execution remains constrained by Tool Runtime, capabilities, Scope Lock, project scope and safety policy.

### 16. Visual Reference & Closed-loop Visual Build

Vortex must be able to consume a screenshot, mockup, Figma-derived reference or selected Preview element as visual intent.

Supported future modes include faithful replication, inspiration, layout replication, component replication and style replication.

Visual Build should support:

- visual decomposition;
- asset extraction;
- component/source mapping;
- scoped implementation;
- render-to-screenshot verification across target form factors;
- targeted correction loops;
- prevention of whole-reference-image-as-background cheating when actual structured UI is requested.

### 17. Vortex Media Engine

Vortex Media Engine is adopted as a first-class product-generation capability under the Visual Build ownership surface.

It should eventually support generation/assembly of:

- images and design assets;
- animated splash screens;
- motion graphics;
- synthetic presenters/avatars;
- speech;
- lip-synchronized human animation;
- scenes/backgrounds;
- slides/diagrams;
- captions/subtitles;
- B-roll;
- audio mastering;
- long-form video timelines;
- export-ready media assets for generated applications.

Long-form media is timeline-based, not dependent on a single monolithic inference. Arbitrary practical duration is achieved by segment generation, continuity state, composition, validation and final encoding.

Identity, voice, likeness and training/reference media must respect authorization/consent requirements. Vortex must not represent unauthorized impersonation as a normal product capability.

### 18. Viktor Realtime Voice Evolution

Viktor remains an Interaction Layer, not an agent.

The adopted target includes original Vortex speech, local-capable ASR/TTS/VAD where feasible, streaming, endpointing, barge-in, interruption without feedback loops, multilingual support and Brazilian Portuguese as a first-class locale.

Viktor voice state never grants execution authority.

### 19. Security Coverage Principle

Security quality is not proven by one scanner or by absence of observed errors.

The V1 hardening surface must support evidence across applicable categories such as software inventory/SBOM, dependency vulnerabilities, secrets, configuration/IaC, code/runtime behavior, API/browser flows and explicit security coverage.

A security surface not tested must remain marked untested/partial rather than being represented as clean.

### 20. Vortex Model Specialization

The product may use a Vortex Core plus Vortex-owned specialist adaptations or compact task-specific models internally.

Specialization may cover architecture, coding, frontend, backend, review, testing, mentoring, visual perception and architectural integrity while preserving one Vortex intelligence identity to the user.

Training, fine-tuning, distillation, evaluation, quantization and model packaging are internal Vortex engineering concerns and must not become a BYOK/model-shopping UX.

## Roadmap ownership

This amendment is implemented only through existing Build authorities. The canonical sequence remains Builds **1–134**.

Primary mappings are recorded in:

- `docs/product/ROADMAP_V1.md`
- `docs/product/NORTH_STAR_ROADMAP_MAPPING.md`
- `docs/product/DEFINITION_OF_DONE.md`

No decimal or ad-hoc Build numbering is authorized.

## Existing authorities preserved

This amendment does not weaken:

- Git as code/version-history source of truth;
- local runtime authority;
- Plan/Build separation;
- capability security;
- approvals;
- Scope Lock;
- Architecture Guardian;
- Heimdall conformance analysis;
- Validation Pipeline;
- fail-closed security;
- production/release restrictions;
- explicit Viktor activation;
- user control over genuinely external or production-affecting decisions.

## Final doctrine

**Understand the product before building it. Build the complete scoped product. Prove that it works. Keep the architecture healthy. Hide infrastructure complexity, not reality.**
