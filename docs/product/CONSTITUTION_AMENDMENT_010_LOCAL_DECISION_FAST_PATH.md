# Constitutional Amendment 010 — Local Decision Fast Path, Structured Action Spaces & Evidence Preservation

Status: **PROPOSED FOR V1 ADOPTION**

This amendment records selective lessons from ten external open-source projects reviewed on 2026-09-26. It does **not** import those projects wholesale, does not create new canonical Vortex agents, does not reopen the frozen Build sequence, and does not weaken One Intelligence, Local Sovereignty, Scope Lock, Tool Runtime, Architecture Guardian, Heimdall, RC-by-Default, or the Complexity Budget.

The rule is: **mine capabilities and engineering patterns; do not turn Vortex Ars AI into a dependency collage.**

## Source set and adoption decision

### 1. AnythingLLM — `Mintplex-Labs/anything-llm`
Reference: https://github.com/Mintplex-Labs/anything-llm

**Decision: ADAPT PATTERNS, NO RUNTIME DEPENDENCY.**

Useful patterns:
- local-first/private document chat;
- simple self-hosted operation with no mandatory vendor account;
- document ingestion + vector/RAG pipeline ergonomics;
- internal support for multiple inference backends without requiring a provider-shaped user experience.

Vortex mapping:
- reinforces Builds 34–37, 45, 65–67 and 119–128;
- Vortex keeps **One Intelligence** and does not copy AnythingLLM's provider-selection UX;
- no AnythingLLM runtime is required for core Vortex operation.

### 2. LibreChat — `danny-avila/LibreChat`
Reference: https://github.com/danny-avila/LibreChat

**Decision: ADAPT RUNTIME/EXTENSIBILITY PATTERNS, NO PRODUCT CLONE.**

Useful patterns:
- MCP tool surfaces;
- reusable Skills;
- bounded subagent runs with isolated context;
- resumable/checkpointed agent work;
- conversation branching and compacted context;
- code workspaces and tool approval boundaries.

Vortex mapping:
- validates existing Builds 44, 56, 58–64, 87–92 and 115;
- Skills map to Vortex specialist/profile/plugin concepts, not to new canonical agents;
- subagent patterns map to bounded Worker Sessions, never to a new permanent “zoo” of agents;
- Vortex UX remains its own product identity.

### 3. AutoHedge — `The-Swarm-Corporation/AutoHedge`
Reference: https://github.com/The-Swarm-Corporation/AutoHedge

**Decision: CONCEPT-ONLY REFERENCE.**

Useful pattern:
- explicit staged pipeline in which analysis precedes risk review and execution;
- structured output + logging + risk-first gating before side effects.

Vortex mapping:
- reinforces Builds 48–57 and 64;
- no trading, wallet, exchange, market-data, finance, or AutoHedge dependency enters V1.

### 4. Jev Chat Jarvis — `jev-chat/jev-chat-jarvis`
Reference: https://github.com/jev-chat/jev-chat-jarvis

**Decision: ADAPT “JUDGE BEFORE GENERATE / HUMAN OWNS FINAL ACTION”.**

Useful patterns:
- classify intent/risk before drafting;
- local-only screen/OCR handling where possible;
- read-only observation boundaries;
- suggestion before mutation;
- final irreversible action remains human-controlled in its chat-assistant use case.

Vortex mapping:
- reinforces Builds 49, 53, 57, 62 and 68–70;
- browser/tool actions remain subject to Vortex approval/scope policy;
- no app hooking, package modification or hidden background capture is introduced.

### 5. tax-doc-classifier — `kyotofin/tax-doc-classifier`
Reference: https://github.com/kyotofin/tax-doc-classifier

**Decision: ADAPT CLASSIFICATION-FIRST ARCHITECTURE, NOT IRS-SPECIFIC DATA.**

Useful patterns:
- classify before invoking a larger generative model;
- explicit confidence gates;
- criteria stored as versionable structured data;
- cheap narrow decision models for routing/classification.

Vortex mapping:
- Builds 45 and 67 may classify document/page type before expensive reasoning;
- Build 128 evaluates compact classifiers/routers as a cost and latency optimization;
- domain-specific IRS criteria/data are not imported into Vortex.

### 6. pg-jev — `realZachi/pg-jev`
Reference: https://github.com/realZachi/pg-jev

**Decision: CONCEPT-ONLY; DO NOT ADOPT THE DATABASE EXTENSION AS A CORE DEPENDENCY.**

Useful pattern:
- natural-language classify/filter/rank semantics over structured rows.

Vortex mapping:
- if useful, equivalent capability belongs in the Vortex application/provider layer under Builds 80–86;
- do not require a privileged PostgreSQL extension, `plpython3u`, or per-row remote model calls for ordinary V1 operation;
- SQL/data access remains typed, scoped, auditable and provider-portable.

### 7. Jev Ultrafast — `browser-use/jev-ultrafast`
Reference: https://github.com/browser-use/jev-ultrafast

**Decision: HIGH-PRIORITY REFERENCE FOR BUILD 68–70.**

Useful patterns:
- build a compact structured action space from observed, visible controls;
- stable element indices instead of regenerating fragile selectors each step;
- choose operation + compatible target together;
- generate free text only when the chosen operation actually requires text;
- validate freshness/occlusion before execution;
- reuse a persistent browser/CDP session instead of spawning subprocesses per action;
- prefer structured DOM/accessibility evidence over screenshot-heavy loops when screenshots add no decision value.

Vortex mapping:
- Build 68 owns structured browser action-space construction and stale-action rejection;
- Build 70 exposes stable target identity, action compatibility and execution evidence;
- Tool Runtime/Scope Lock remain the only mutation authority.

### 8. LocalSend — `localsend/localsend`
Reference: https://github.com/localsend/localsend

**Decision: OPTIONAL INTEGRATION PATTERN; NOT A CORE V1 DEPENDENCY.**

Useful pattern:
- secure local-network transfer without mandatory cloud infrastructure.

Vortex mapping:
- potential future local workspace/export handoff under Builds 114/117;
- V1 does not add a new cross-platform transfer stack merely because it exists;
- any later adoption must justify itself against native OS sharing and Complexity Budget.

### 9. ArchiveBox — `ArchiveBox/ArchiveBox`
Reference: https://github.com/ArchiveBox/ArchiveBox

**Decision: ADAPT EVIDENCE-PRESERVATION PATTERNS, NO EMBEDDED FULL ARCHIVEBOX STACK.**

Useful patterns:
- preserve web evidence in durable standard formats;
- retain source metadata and multiple representations;
- separate archival ingestion, storage and API/CLI access.

Vortex mapping:
- Builds 45, 65–67, 70, 117 and 133 may preserve provenance-bearing research/browser evidence;
- evidence snapshots should prefer portable formats and source pointers;
- Vortex should not duplicate an entire web-archiving product inside its core.

### 10. Cactus Needle / Needle 2–3 — `cactus-compute/needle`
Reference: https://github.com/cactus-compute/needle

**Decision: HIGH-PRIORITY CANDIDATE PATTERN FOR LOCAL TOOL ROUTING; IMPLEMENT BEHIND VORTEX ADAPTERS ONLY AFTER EVALUATION.**

Useful patterns:
- tiny on-device model specialized for tool calling / structured extraction rather than free-text chat;
- unsupported requests return no tool call instead of inventing a fallback action;
- calibrated confidence can gate act / confirm / escalate;
- local inference can stay offline after model/runtime acquisition;
- compact tool routers can hand difficult cases to a larger model.

Vortex mapping:
- Builds 34–37 may host a replaceable compact local decision-router adapter;
- Build 128 owns benchmark-driven evaluation, routing thresholds and fallback economics;
- no Needle/Cactus brand is exposed as Vortex authority;
- core Vortex cannot depend on a hosted TypeSafe/Cactus service or mandatory BYOK;
- adoption requires Vortex-owned tests for tool selection, argument correctness, off-topic rejection, latency, memory and failure behavior.

## V1 acceptance extensions

### Build 37 — Model Routing
A compact local router may be used for narrow classification/tool-selection work when:
1. it is replaceable behind a Vortex-owned adapter;
2. confidence/failure is explicit;
3. low-confidence work escalates to an already-authorized stronger path;
4. the user never has to select or understand the router/model;
5. a router failure cannot grant capability or bypass Scope Lock.

### Build 45 / Build 67 — Attachment + Knowledge Compiler
Before expensive generative analysis, Vortex may run cheap local/deterministic classification to identify document/page type, route parsers and select the smallest relevant knowledge pack. Classification metadata is evidence, not authority.

When browser/research content is important to later validation, Vortex may preserve provenance-bearing snapshots in portable formats rather than depending only on a transient live page.

### Build 49 / Build 53 — Decision + Tool Runtime
Prefer **judge/route before generate/act** for bounded operational decisions. Mutation still requires Tool Runtime authority, scope checks and any applicable approval transaction.

### Build 68 — Vortex Browser Runtime
The browser runtime should prefer a structured observed action space:
- visible/eligible controls only;
- stable target identity for the observed state;
- operation-specific compatible targets;
- stale-state detection before execution;
- occlusion/interactability checks where technically available;
- persistent session reuse;
- screenshots as evidence when useful, not as the mandatory control loop.

### Build 70 — Preview Bridge
Expose enough structured evidence for deterministic browser decisions and debugging:
- stable element/target references;
- operation compatibility;
- observed-state version/freshness marker;
- execution result / no-action reason;
- capture provenance where screenshots or archived evidence are produced.

### Build 128 — Performance Hardening / Model Specialization
Benchmark narrow routers/classifiers separately from generative models. At minimum measure:
- tool/route selection accuracy;
- argument extraction accuracy;
- off-topic/no-action precision;
- confidence calibration;
- cold/warm latency;
- memory footprint;
- context/tool-catalog scaling;
- fallback rate and total end-to-end cost.

A smaller/faster model is adopted only if it improves the complete Vortex workflow without hiding quality loss.

## Explicit exclusions

This amendment does **not** authorize:
- a user-facing model/provider marketplace;
- new permanent canonical agents;
- financial/trading functionality;
- privileged PostgreSQL extensions as a V1 requirement;
- automatic message sending or action without normal Vortex authority;
- invasive app hooking;
- screenshot-only browser control when structured evidence is available;
- a mandatory hosted API for narrow routing/classification;
- wholesale source-code copying merely because a repository is permissively licensed.

## Architectural rule

External projects remain **upstream research references**. Vortex may reimplement or adapt ideas only through existing owning Builds, with license/security review for any copied code, and with the smallest dependency surface that satisfies the Product Contract.

The desired result is not “more frameworks.” It is a Vortex runtime that is **faster, more local, more deterministic, easier to verify, and harder to bloat**.
