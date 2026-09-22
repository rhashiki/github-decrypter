# Constitutional Amendment 006 — Local Sovereignty & Zero Marginal Vortex Compute

Status: **ADOPTED by product owner**

## Purpose

Vortex Ars AI is a commercial software product, not a metered inference resale service.

The canonical economic and architectural model is that the user's own machine performs the compute required for Vortex intelligence, agents, code analysis, builds, validation and supported media generation whenever those capabilities can be executed locally.

The product may have ordinary fixed or operational business costs such as domains, payment processing, distribution, signing, licensing, account services, legal/accounting work and minimal control-plane infrastructure. Those costs do not authorize Vortex Inc. to subsidize or meter mandatory AI inference as a variable cost proportional to user activity.

This amendment restores and makes explicit the original local-first economic intent.

## Supersession

This amendment **supersedes Section 2 — No BYOK Principle** of Constitutional Amendment 005 and **narrows Section 4 — Local-first Vortex Intelligence**.

The One Intelligence Principle, Tokenless UX Principle and all authority/safety constraints of Amendment 005 remain in force.

BYOK is permitted only as an optional, advanced, user-funded external-compute path. It must never be required for the Vortex core experience and must never convert the canonical product into a provider/model marketplace.

## Constitutional additions

### 1. Local Compute Sovereignty

The canonical Vortex execution path is local.

After required local components are installed, core Vortex capabilities must not depend on Vortex-managed paid AI inference to remain functional.

This applies, where technically supported, to:

- Vortex Core inference;
- named specialist agents;
- repository understanding and retrieval;
- embeddings and project knowledge indexes;
- planning and requirement compilation;
- code generation and review;
- tests, builds and validation;
- speech recognition and speech synthesis;
- image/visual analysis;
- generated media assembly and encoding;
- project memory and operational state.

Remote services that are inherently remote — such as GitHub, external deployment targets, payment processors, account/license services or user-selected third-party APIs — remain remote by nature. Their existence does not authorize mandatory remote Vortex intelligence.

### 2. Zero Marginal Vortex Compute

The target marginal AI-compute cost to Vortex Inc. per additional unit of ordinary user activity is **zero or effectively zero**.

A user working for two hours or two hundred hours must not create a corresponding mandatory Vortex-paid inference bill.

The Vortex business model sells software, orchestration, specialist behavior, architecture, updates and product capability. It does not sell internally subsidized tokens as the required unit of product operation.

Vortex-managed paid inference, paid GPU fallback, paid image generation, paid voice generation or paid video generation may not become a hidden mandatory dependency of the core product.

### 3. Optional BYOK

A user may voluntarily connect a supported external AI provider using credentials that belong to that user.

BYOK:

- is optional;
- is disabled by default unless the user explicitly configures it;
- is not required to activate or use core Vortex intelligence;
- is paid directly by the user to the chosen provider wherever provider billing permits;
- must use the Local Runtime / Secrets Vault boundary for credential handling;
- must not expose credentials to ordinary frontend state, logs, prompts or agent memory;
- must not grant capability, scope, write or approval authority;
- may accelerate or extend supported workflows but must not silently replace the local canonical path.

Provider identity may appear only where necessary for transparent configuration, credentials, capability or billing information. Specialist identities remain Vortex roles.

### 4. No Vortex-paid AI fallback

Vortex must fail honestly, degrade locally, queue work, recommend a compatible local runtime/model, or offer an explicitly user-funded external option before it uses Vortex Inc.-funded commercial inference.

There is no silent fallback from local compute to a Vortex-paid provider.

There is no hidden pooled commercial API key whose consumption grows with customer usage.

There is no mandatory Vortex cloud GPU path for ordinary core intelligence.

### 5. Local-first media economics

The Vortex Media Engine follows the same rule.

Long-form video, avatar rendering, image generation, speech, lip synchronization, compositing and encoding should use local compute whenever the supported hardware/runtime can perform the work.

A user may optionally select a third-party media service with their own credentials or directly funded account. Vortex Inc. does not make paid third-party media inference a required dependency of the canonical Media Engine.

### 6. Offline continuity

Already-installed local capabilities should remain usable when Vortex-managed services are unavailable, except for operations whose nature is inherently remote.

Temporary unavailability of licensing/account infrastructure must not be designed to destroy local project data or invalidate ordinary project files. Licensing policy may enforce commercial entitlement, but local project ownership and exportability remain protected by the existing Exit Path principles.

### 7. One Intelligence remains

Optional BYOK does not repeal the One Intelligence Principle.

The user works with **Vortex Ars AI** and its specialist roles. External models are implementation resources or optional accelerators, not replacement product identities and not independent authorities.

### 8. No token-selling UX

Optional external providers do not authorize a Vortex token economy.

Vortex must not require users to buy Vortex inference credits, allocate token budgets among agents, or understand provider token accounting to use the canonical product.

Where a user explicitly configures an external provider, transparent provider-side usage/cost information may be shown as an advanced operational fact.

### 9. Release-blocking invariant

A Release Candidate is blocked if any capability declared core requires:

- a Vortex-owned paid AI API key;
- a Vortex-paid commercial inference account;
- a Vortex-funded cloud GPU;
- mandatory third-party AI billing paid by Vortex Inc.;
- a hidden remote inference fallback that cannot be disabled;
- user BYOK merely to make core Vortex intelligence function.

The implementation must be corrected before the capability can be represented as canonical V1 core behavior.

## Machine-enforced doctrine

Architecture Guardian must preserve at least these invariants:

- local compute is the canonical primary execution path;
- core Vortex intelligence requires no external AI provider;
- Vortex-managed paid inference is forbidden as a mandatory fallback;
- Vortex-subsidized variable inference is forbidden as the product's operating model;
- BYOK is allowed but optional and user-funded;
- external AI providers remain optional;
- no mandatory AI provider may be selected in the provider contract;
- local capabilities preserve offline execution where their operation is inherently local.

Future changes may evolve implementation details, but weakening these economic invariants requires an explicit owner-authorized constitutional amendment. A convenient implementation shortcut is not sufficient.

## Roadmap ownership

No new Build number is created.

This doctrine is implemented through existing authorities:

- **Build 16 — Secrets Vault**: credential protection for optional BYOK;
- **Builds 33–37 — AI Provider / Local AI / Model Routing**: local canonical inference and optional external-provider contract boundaries;
- **Build 64+ — Agent Orchestration**: agents consume the canonical Vortex intelligence without acquiring provider authority;
- **Build 116 — Privacy Controls**: local/external data-flow visibility and consent;
- **Build 119 — Runtime Installer**: supported local intelligence/runtime packaging;
- **Build 123 — Unified Installation Experience**: local Vortex works without BYOK; optional advanced external acceleration may be configured without becoming a setup requirement;
- **Build 125 — Compatibility Matrix**: honest local hardware capability tiers;
- **Build 128 — Performance Hardening**: local inference efficiency, model specialization, quantization, caching and routing;
- **Build 133 — Release Candidate Gate**: rejects mandatory Vortex-paid inference dependencies in core scope.

## Existing authorities preserved

This amendment does not weaken:

- Git/local workspace ownership;
- capability security;
- Secrets Vault;
- approvals;
- Scope Lock;
- Human Intent;
- Tool Runtime;
- Architecture Guardian;
- Heimdall;
- Validation Pipeline;
- agent authority boundaries;
- production/release restrictions;
- Project Genesis;
- Zero Placeholder;
- Evidence Before Completion;
- RC by Default;
- Complexity Budget;
- user control over genuinely external or production-affecting decisions.

## Final doctrine

**The customer supplies the compute for Vortex intelligence. Vortex Inc. supplies the software, architecture and evolution. Core usage must not create a mandatory Vortex-paid inference bill.**
