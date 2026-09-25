# Constitutional Amendment 008 — Local Agent Runtime Portability & Compute Governance

Status: **ADOPTED by product owner**

## Purpose

Vortex Ars AI must remain local-first, model-agnostic internally, resource-bounded, recoverable and safe when running long-lived or parallel agent work on ordinary user hardware.

This amendment extends Amendment 006 (Local Sovereignty) and Amendment 007 (Specialist Intelligence) with explicit rules for:

- universal local-runtime/provider portability;
- model capability metadata and local discovery;
- model-window-aware context budgets;
- bounded automatic compaction/degradation;
- durable and inspectable worker execution;
- tool/compute concurrency budgets;
- plugin/extension permission scoping;
- host-owned dangerous-operation confirmation;
- crash/restart recovery;
- provider/runtime regression testing.

The user continues to interact with **Vortex Ars AI**. Models/providers remain implementation resources, not product identities or independent authorities.

## External architectural reference

This amendment was informed in part by the public repository:

- upstream: `vastsa/PI-Desktop`
- inspected: 2026-09-25
- upstream license observed: **LGPL-3.0**
- upstream role: architectural/reference source only

No PI-Desktop source code is incorporated into the Vortex Core by this amendment.

Direct vendoring, copying or modification of LGPL-covered PI-Desktop code inside a proprietary Vortex distribution requires separate legal/license review and an architecture decision that preserves all applicable obligations.

The lower-level Pi ecosystem used by PI-Desktop is a separate candidate for future technical/license evaluation. This amendment does not approve or require any Pi package dependency.

## 1. One Intelligence, portable execution

The Vortex product identity remains independent of the model/runtime used underneath it.

Canonical rules:

- the default user experience is Vortex Ars AI, not a provider marketplace;
- provider/model selection is internal unless the user opens an advanced configuration surface;
- no local provider/model becomes architectural authority;
- switching a runtime/model must not alter Product Contract, agent identity, capability, Scope Lock, approval, validation or Architecture Guardian authority;
- optional user-funded external providers remain governed by Amendment 006.

## 2. Universal local-runtime boundary

Vortex must be able to evolve toward a protocol-neutral local inference boundary.

Initial compatibility targets include, where technically viable:

- Ollama-compatible local endpoints;
- OpenAI-compatible local endpoints;
- vLLM-compatible endpoints;
- LM Studio through compatible local APIs;
- LocalAI through compatible local APIs;
- LiteLLM/local gateways through compatible local APIs;
- future custom local adapters that satisfy Vortex capability/security contracts.

No listed runtime is mandatory.

Runtime/provider adapters remain replaceable construction-time or controlled-runtime components behind the existing Local AI Runtime / Model Manager / Model Routing authorities.

## 3. Model capability metadata

Vortex should maintain provider-independent model capability metadata sufficient for routing and safety, including where available:

- model id/family;
- context window;
- output limit;
- reasoning/thinking support;
- tool-call support;
- structured-output support;
- input/output modalities;
- local hardware/runtime compatibility;
- quantization/runtime requirements;
- known health/status.

A local bundled/signed metadata snapshot may be supplemented by explicit user-triggered refresh or trusted runtime discovery.

Provider credentials must never be sent to a public metadata/catalog service.

Unknown/custom local models may remain usable with conservative defaults and explicit advanced overrides rather than being blocked solely because metadata is absent.

## 4. Context budget follows the resolved model

Every agent/worker/delegate execution must derive its context safety budget from the model/runtime actually selected for that execution.

Required principles:

- one shared budget formula/authority must be used wherever possible to prevent parent/worker drift;
- hard context limit reserves room for request/output headroom;
- automatic compaction occurs before the provider/runtime hard limit;
- a worker uses its own resolved model window, not the parent model's window;
- resumed work is seeded within the worker's current budget;
- context overflow degrades honestly before terminal failure where safe;
- degradation is observable and may not be represented as a complete/full-context result;
- model fallback is checked for context fit before a request is attempted;
- a fallback that cannot fit the active context is skipped and recorded rather than attempted blindly.

Exact thresholds may be tuned by Build 128 using evidence; the doctrine is the safety behavior, not a permanently frozen percentage.

## 5. Durable worker sessions

Build 115 may implement durable Worker Sessions for substantial parallel work.

Worker Sessions must be:

- project/workspace scoped;
- parent/orchestration scoped;
- independently inspectable;
- bounded in fan-out;
- independently context-budgeted;
- recoverable after interruption where possible;
- explicit about degraded/failed state;
- able to report bounded results back to Ramon/parent orchestration;
- unable to widen their inherited authority.

A Worker Session is execution state, not a new canonical agent.

Specialist Profiles remain methods/context and do not become workers automatically.

## 6. Structured handoffs

Agent/worker handoffs should transmit structured task state instead of blindly replaying entire transcripts.

Where applicable, a handoff should carry:

- task/objective;
- Product Contract / acceptance references;
- relevant bounded context;
- required evidence;
- capability/scope envelope;
- source/provenance references;
- prior result/degraded state;
- retry/fallback history.

This preserves context budgets and makes orchestration auditable.

## 7. Tool and compute budgets

Capability authorization answers **whether** an operation may occur. Compute/tool budgets additionally answer **how much may run concurrently**.

Future runtime execution must support bounded admission control appropriate to the platform, including separate ceilings for classes such as:

- total active work;
- model/GPU inference;
- CPU-heavy jobs;
- shell/process execution;
- reads;
- mutations/writes;
- browser jobs;
- plugin/service work;
- worker sessions.

At minimum:

- queues are bounded;
- saturation does not create unbounded process spawning;
- mutation concurrency within one project/session is serialized or otherwise proven safe;
- destructive/high-impact loops are rate-braked;
- timeout/cancellation propagates to child work;
- budget state is observable for diagnostics.

Resource budgets grant no capability. They can only delay, narrow or refuse already-authorized work.

## 8. Host-owned dangerous confirmations

Dangerous-operation confirmation text is a security boundary.

The host/runtime must render the canonical operation identity and trusted description.

A model, plugin, Specialist Profile, repository document, transcript or other untrusted caller may not choose the human-facing label for a dangerous operation.

Example doctrine:

`canonical operation id → host-owned description → arguments preview → Allow / Deny`

not:

`model/plugin supplied description → confirmation`

Dismissal, timeout or malformed consent response fails closed.

This applies to destructive file/project/session operations, permission elevation and other high-impact actions owned by existing approval/capability authorities.

## 9. Plugin/extension security model

Build 90 must treat plugins/extensions as untrusted until explicitly authorized.

The future plugin manifest/security model should support:

- declared permissions;
- declared filesystem scopes;
- declared network egress domains;
- explicit high-risk permissions for prompt/system injection, executable agent extensions, local MCP/process launch and desktop control;
- deny-by-default network egress;
- host-side realpath/symlink escape checks;
- protected host/secrets paths;
- per-plugin data roots;
- consent when requested access exceeds standing scope;
- auditable tool invocations;
- bounded timeouts and rate limits;
- permission-diff confirmation on plugin upgrade;
- cancellation/disable/crash cleanup of resident services/sockets/subscriptions;
- no direct access to Secrets Vault plaintext.

A permission name is not sufficient to widen reach. Permission + scope + consent + runtime enforcement must agree.

## 10. Plugin contributions

The Plugin SDK may support multiple contribution surfaces without forcing them into Vortex Core:

- agent tools;
- skills;
- Specialist Profiles;
- panels/views/widgets;
- themes;
- commands;
- MCP servers;
- resident/background services;
- constrained message-bus topics;
- optional provider/runtime adapters.

A plugin may package a substantial workflow/product surface, but it never bypasses Vortex capability/security/authority boundaries.

## 11. Recovery and inflight checkpoints

Long-lived work should survive ordinary interruption where technically possible.

Build 118 should include:

- durable execution checkpoints for recoverable work;
- explicit inflight/settled/cancelled/failed state;
- recovery without replaying already-committed mutations;
- correlation between worker/tool invocation and checkpoint state;
- bounded transcript/context restoration;
- stale/abandoned worker cleanup;
- recovery evidence for CI.

A recovered operation must revalidate current capability/scope/authority before resuming mutation.

## 12. Provider/runtime resilience

Local and optional external model execution should use bounded reliability mechanisms:

- finite retries;
- backoff;
- cancellation;
- model/runtime health state;
- explicit failure classification;
- fallback only when compatible;
- no silent Vortex-paid remote fallback;
- progress/diagnostic visibility.

Infinite retries or silent provider switching are forbidden.

## 13. Security and secrets

Provider/runtime secrets remain owned by the Secrets Vault boundary.

A provider adapter receives only the credential/material necessary for the authorized request.

Credentials must not be persisted in:

- model metadata;
- transcripts;
- Project Memory;
- Specialist Profiles;
- logs;
- ordinary frontend state;
- plugin data.

## 14. Release-blocking invariants

A Release Candidate is blocked if:

- core Vortex requires a Vortex-paid inference provider;
- local model/runtime selection changes canonical authority;
- parent and worker context budgets can drift without a shared policy;
- a worker can run unbounded context/process/tool fan-out;
- fallback blindly retries a context that provably cannot fit;
- dangerous confirmation labels can be supplied by the untrusted caller;
- plugin network/filesystem reach exceeds declared/granted scope;
- plugin upgrades silently add permissions;
- recoverable work can replay committed destructive mutation without idempotency/revalidation;
- secrets leak into metadata, logs, prompts, plugin state or transcripts;
- LGPL-covered PI-Desktop implementation is copied/vendorized into proprietary Vortex Core without explicit legal/architecture approval.

## Roadmap ownership

No Build is added or renumbered.

- **Builds 33–37** — provider/local runtime/model management/routing boundaries; future universal local adapters and capability metadata.
- **Build 44** — persistent conversation/session continuity; must remain compatible with recoverable execution.
- **Build 53** — canonical Tool Runtime authority remains; downstream execution layers add bounded tool admission without weakening capability/scope.
- **Build 64** — Ramon owns orchestration; worker/specialist delegation never widens authority.
- **Build 90** — Plugin SDK permission/scope/consent/audit model and contribution surfaces.
- **Build 115** — durable Worker Sessions, bounded fan-out/fan-in and structured handoffs.
- **Build 118** — inflight checkpoints/recovery and no mutation replay.
- **Build 119** — supported local runtime/adapter packaging.
- **Build 123** — unified local setup with no mandatory provider selection.
- **Build 124** — provider/worker/recovery/permission regression matrix.
- **Build 125** — runtime/model/hardware compatibility matrix.
- **Build 127** — plugin/runtime/security boundary audit.
- **Build 128** — context budgets, compaction, provider routing, compute/tool budgets and performance tuning.
- **Build 133** — RC gate enforces host-owned confirmations, bounded runtime behavior and local-sovereignty invariants.

## Final doctrine

**Models are replaceable. Authority is not. Context, workers, tools and compute are bounded. Dangerous intent is described by the host, not by the caller. Local execution remains the canonical economic path.**
