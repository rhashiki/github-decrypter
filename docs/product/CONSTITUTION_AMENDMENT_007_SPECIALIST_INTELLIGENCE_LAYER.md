# Constitutional Amendment 007 — Specialist Intelligence Layer

Status: **ADOPTED by product owner**

## Purpose

Vortex Ars AI must be able to use deep specialist expertise without turning every specialty into a new autonomous agent, authority principal, tool owner, or permanent context burden.

The canonical Vortex team remains the ten named specialist agents established by the existing Agent Runtime / Agent Orchestrator architecture. A new class of **Specialist Profiles** is introduced beneath those agents.

The governing separation is:

> **Agent = responsibility and authority boundary. Specialist Profile = expertise and method. Tool = execution mechanism. Capability = authorization.**

Specialist Profiles may improve how a canonical agent thinks, plans, reviews, tests, explains or executes within its already-authorized role. They do not become independent principals.

## External inspiration and provenance

The design is informed in part by the open-source repository:

- upstream: `msitarzewski/agency-agents`
- license: MIT
- inspected catalog snapshot: 2026-09-24
- observed catalog size at inspection: 321 Markdown profiles across engineering, specialized, marketing, game development, integrations, strategy, GIS, security, design, testing, project management, product and other divisions.

Vortex does **not** acquire a runtime dependency on that repository.

Build 90 may implement an importer/SDK capable of normalizing compatible open specialist catalogs. Imported profiles must retain source, version and license provenance and must pass Vortex validation before activation.

## 1. Canonical agents remain canonical

The canonical named agent roster remains:

- Ramon;
- Leonardo;
- Strachey;
- Licklider;
- Pitts;
- Weizenbaum;
- Samuel;
- Seymour;
- Fukushima;
- Heimdall.

Viktor remains the Interaction Layer and is not an agent.

Adding a Specialist Profile does not increment the canonical agent count.

A Specialist Profile may never silently become an eleventh agent. Any change to the canonical agent roster requires explicit owner-authorized architectural amendment.

## 2. Specialist Profile definition

A Specialist Profile is declarative expertise that may contain:

- identity/name for human-readable specialization;
- domain and specialty taxonomy;
- responsibilities and non-responsibilities;
- activation triggers;
- workflow/methodology;
- critical rules;
- expected deliverables;
- success/evaluation criteria;
- compatible canonical agents;
- context-cost metadata;
- required evidence patterns;
- forbidden authorities;
- source provenance;
- license provenance;
- source version/revision;
- Vortex normalization version.

The canonical future schema is conceptually:

`vortex-specialist-profile/1`

The exact runtime implementation belongs to its mapped Builds.

## 3. Specialist Profiles are non-authoritative

A Specialist Profile owns no independent:

- capability grant;
- approval;
- Scope Lock;
- filesystem authority;
- database authority;
- Git authority;
- network authority;
- Tool Runtime authority;
- validation/completion authority;
- Architecture Ledger authority;
- Product Contract authority;
- release/deployment authority;
- agent identity;
- persistent principal identity.

A specialist operates only through the canonical agent that activated it and only within that agent's existing capability/scope/tool boundaries.

## 4. On-demand activation, not context dumping

The Specialist Library may grow to hundreds or thousands of profiles.

Therefore:

- the full catalog must not be injected into ordinary model context;
- candidate selection must be bounded;
- only relevant specialist profiles are loaded for the active task;
- Context Engine / Knowledge Graph should support progressive selection and loading;
- unused specialist content should remain outside active context;
- selection must respect context/compute budgets;
- specialist loading must remain compatible with local-first execution.

The existence of a large catalog must not create a proportional Vortex-paid inference bill.

## 5. Specialist routing

Ramon remains the orchestration authority.

Specialist selection may be assisted by deterministic metadata, Knowledge Graph relationships and later semantic/local routing, but selection itself does not grant new authority.

A canonical agent may combine multiple profiles where justified, for example:

- Leonardo + Software Architect + Security Architect;
- Strachey + Minimal Change Engineer + Frontend Developer;
- Pitts + Backend Architect + Database Optimizer;
- Licklider + UI Designer + Accessibility Auditor;
- Samuel + Test Automation + API Tester + Evidence Collector;
- Weizenbaum + Code Reviewer + Reality Checker;
- Heimdall + Multi-Agent Systems Architect + AI-Generated-Code Security Auditor.

The outward product may communicate these temporary specializations as the active team, while authority still belongs to the canonical agents.

## 6. Priority methodologies adopted

The following methodologies are explicitly useful to Vortex and should be absorbed into their natural owning Builds/agents rather than copied as independent authorities.

### Workflow Architecture

Adopt:

- workflow discovery before implementation;
- workflow registry;
- happy path + branch + failure + recovery coverage;
- explicit state transitions;
- explicit handoff contracts;
- concurrency/race-condition consideration;
- observable states;
- mapping workflow → components → journeys → tests.

Primary owners: Builds 52, 59, 64, 67 and 124.

### Multi-Agent Systems Architecture

Adopt:

- hierarchical orchestration as the default topology;
- structured agent handoffs instead of raw transcript propagation;
- least-privilege specialist/tool access;
- fallback/degraded paths;
- retry limits and circuit breakers;
- checkpoint/rollback integration;
- context budgets;
- traceable agent/specialist activity;
- contradiction detection;
- bounded fan-out/fan-in;
- evaluation before release.

Primary owners: Builds 64, 66, 67, 115, 124 and 128.

### Minimal Change discipline

Adopt:

- minimum necessary diff for scoped fixes;
- no hidden "while I am here" scope expansion;
- unrelated cleanup becomes explicit follow-up;
- every changed line must map to task/acceptance/required architecture work.

This does not override **Refactor Before Feature**: when architecture requires an explicit refactor to keep boundaries sound, that refactor is legitimate scoped work rather than hidden cleanup.

Primary owners: Strachey, Weizenbaum, Heimdall; Builds 55, 60, 63, 64 and 107.

### Evidence / Reality Checking

Adopt:

- implementation claims require evidence;
- task-level QA loops;
- scan/test → fix → rescan/test;
- final integration verification against Product Contract and acceptance criteria;
- incomplete or inconclusive evidence cannot become "done";
- test evidence and observed behavior remain separate from agent self-report.

Primary owners: Builds 57, 62, 124 and 133; Samuel and Weizenbaum.

### Codebase Onboarding and LSP/Index expertise

Adopt:

- repository orientation maps;
- fact-grounded codepath tracing;
- entry-point discovery;
- definitions/references/symbol navigation;
- dependency and ownership tracing;
- explicit inspected-vs-uninspected scope;
- source-linked explanations for learners.

Primary owners: Builds 65, 73 and 108.

### Security specialist suite

Adopt specialist methods for:

- security architecture;
- AppSec;
- AI-generated code audit;
- secret/client-bundle leakage;
- authorization/RLS-style policy validation where applicable;
- prompt-injection sinks;
- identity/access boundaries;
- dependency/supply-chain review;
- penetration/security verification where authorized;
- security evidence with rescan after remediation.

Primary owner: Build 127, consuming earlier capability/validation authorities.

### Quality specialist suite

Adopt profiles/methods for:

- API testing;
- accessibility auditing;
- performance benchmarking;
- test automation;
- test-result analysis;
- evidence collection;
- reality checking;
- tool/provider evaluation.

Primary owners: Builds 62, 124, 127, 128 and 133.

## 7. Specialist provenance and licensing

External Specialist Profiles must retain machine-readable provenance.

At minimum:

- source repository/catalog;
- source path or source identifier;
- source revision/version;
- license identifier;
- attribution/notice requirement where applicable;
- import timestamp/version;
- Vortex-normalized profile revision.

Profiles with unknown, incompatible or unverified licensing may not be bundled as canonical Vortex-distributed profiles.

The Specialist Profile SDK/importer may support user-imported local profiles, but user import does not grant trust or authority.

## 8. Drift, updates and ownership

Specialist Profiles may evolve independently of the canonical agent roster.

Future catalog management should support:

- profile versioning;
- upstream comparison;
- deterministic normalization/rendering;
- a local catalog/install ledger;
- source hash + normalized/rendered hash;
- reconciliation states: `current`, `outdated`, `modified`, `removed`, `foreign`;
- local modification detection;
- drift reporting;
- backup before destructive replacement/removal;
- rollback to previous profile revision;
- conflict-aware update;
- user-visible provenance where relevant;
- signed update manifests for Vortex-distributed specialist catalogs;
- explicit opt-in network refresh rather than hidden background catalog traffic;
- Secrets Vault/keychain-class handling for any future catalog credentials;
- no arbitrary shell execution as part of specialist installation/import.

Catalog update must never silently rewrite canonical agent authority.

## 9. Core vs optional specialist inventory

Vortex Core should ship only the high-value cross-project expertise required to create and maintain software reliably.

Domain/business specialties that are valuable only for some projects — finance, healthcare, GIS, marketing, sales, game development, jurisdiction-specific compliance, platform-specific stacks and similar areas — should be installable/importable on demand through the future Specialist Profile SDK / Plugin surface rather than loaded into every project.

This prevents catalog size from becoming product complexity.

## 10. Release-blocking invariants

A Vortex RC is blocked if:

- a Specialist Profile acts as an undeclared canonical agent;
- specialist activation grants capability, approval, scope, mutation or validation authority;
- the entire specialist catalog is routinely injected into model context;
- imported bundled profiles lack required provenance/license metadata;
- specialist routing bypasses Scope Lock, Tool Runtime, capability verification, Product Contract, Architecture Guardian or canonical validation;
- Vortex-paid inference becomes mandatory merely to support Specialist Profiles.

## Roadmap ownership

No new Build number is created and Builds 1–134 are not renumbered.

Primary ownership is distributed through existing Builds:

- **Build 64 — Agent Orchestrator**: canonical-agent ownership, specialist selection/handoff model, bounded specialist-team representation;
- **Build 65 — Knowledge Graph**: specialist capability/domain/compatibility graph metadata;
- **Build 67 — Context Engine vFinal**: on-demand specialist-profile context loading and context-budget preservation;
- **Build 73 — Code Intelligence**: codebase onboarding + LSP/index specialist methods;
- **Build 90 — Plugin SDK**: Specialist Profile SDK, catalog importer, normalization, provenance, licensing, version/drift/update model;
- **Build 107 — Health Score**: detects specialist/ownership overlap, profile proliferation, responsibility leakage and drift;
- **Build 108 — Learning Mode**: mentor/explanation specialist behaviors without creating new profile authority;
- **Build 115 — Background Concurrency**: bounded parallel specialist work with durable shared state and no shared mutable authority;
- **Build 118 — Backup & Recovery**: catalog/profile backup and rollback protection before destructive profile updates/removals;
- **Build 120 — Runtime Auto Update**: signed/verified Vortex-distributed specialist catalog update manifests where such distribution exists;
- **Build 124 — CI Matrix**: specialist/agent evaluation matrix and baseline/regression evidence;
- **Build 127 — Security Audit**: specialist security coverage suite;
- **Build 128 — Performance Hardening**: specialist routing/context-cost efficiency, local-model specialization and bounded parallelism;
- **Build 133 — Release Candidate**: Evidence Collector / Reality Checker style certification against Product Contract, CI evidence and real observed behavior.

## Final doctrine

**Vortex may have ten canonical agents and thousands of specialist capabilities without having thousands of autonomous agents. Expertise scales; authority does not.**
