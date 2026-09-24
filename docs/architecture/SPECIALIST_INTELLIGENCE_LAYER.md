# Specialist Intelligence Layer

Status: **Architecture doctrine — Amendment 007**

The Specialist Intelligence Layer lets Vortex Ars AI scale expertise without scaling the number of autonomous authority principals.

## Core model

```
User / Viktor
      |
    Ramon
      |
Canonical Agent
      |
Specialist Profile(s)
      |
Tool Runtime / Capability / Scope Lock
```

A Specialist Profile changes the **method/context** used by a canonical agent. It does not change what that agent is authorized to do.

Canonical rule:

> **Agent = responsibility. Specialist = expertise. Tool = execution. Capability = authorization.**

## Future profile contract

The Build 90 SDK should normalize specialist content into a deterministic contract equivalent to:

```text
vortex-specialist-profile/1

id
name
domain
specialties[]
summary
responsibilities[]
non_responsibilities[]
critical_rules[]
workflow[]
deliverables[]
success_metrics[]
activation_triggers[]
compatible_agents[]
required_evidence[]
context_cost
forbidden_authorities[]
source:
  catalog
  repository
  path
  revision
  license
normalization:
  schema
  version
  imported_at
```

Free-form Markdown may be an import format. It is not the canonical runtime contract.

## Activation

1. Product Contract / active task defines the need.
2. Ramon decomposes the task.
3. Specialist candidate metadata is queried through the Knowledge Graph / registry.
4. Candidates incompatible with the owning canonical agent or authority boundary are removed.
5. Context Engine loads only the bounded relevant profiles.
6. The canonical agent receives specialist methods plus task evidence.
7. Tools still require Tool Runtime + capability + Scope Lock.
8. Evidence/outputs return through the ordinary agent/orchestration/validation path.
9. Specialist context can be released when the task ends.

The catalog itself is never dumped wholesale into context.

## Specialist-team representation

A user may be shown temporary team composition such as:

```
Leonardo — Architect
  ↳ Software Architecture
  ↳ Security Architecture

Pitts — Backend / Core
  ↳ Backend Architecture
  ↳ Database Optimization

Samuel — Testing
  ↳ API Testing
  ↳ Accessibility
  ↳ Evidence Collection
```

This is a representation of loaded expertise. It is not a claim that each profile is a separate process, model, principal or paid inference call.

## Priority Vortex profile families

### Architecture / orchestration
- Workflow Architect
- Multi-Agent Systems Architect
- Software Architect
- Minimal Change Engineer
- Code Reviewer
- Tool Evaluator

### Code intelligence
- Codebase Onboarding Engineer
- LSP / Index Engineer
- Codebase Archaeology
- Search / Relevance Engineer
- Technical Writer

### Engineering
- Frontend
- Backend
- Mobile
- Desktop
- Database Optimization / Reliability
- Realtime Collaboration
- DevOps / SRE
- Identity & Access
- Internationalization
- Payments / Billing
- Data Engineering
- Media / Streaming where applicable

### Testing / evidence
- Test Automation
- API Testing
- Accessibility Audit
- Performance Benchmarking
- Test Result Analysis
- Evidence Collection
- Reality Checking

### Security
- Security Architecture
- AppSec
- AI-Generated Code Security Audit
- Secrets / Credential Security
- Identity / Access Security
- Threat / Detection / Incident expertise where applicable

### UX / product
- UX Architecture
- UI Design
- UX Research
- Inclusive / Accessibility design
- Product / workflow / feedback synthesis

## Upstream catalog strategy

The open-source `msitarzewski/agency-agents` catalog is an eligible import/reference source because it is MIT-licensed.

Vortex should not:

- depend on the upstream GitHub repository at runtime;
- load its whole catalog into every project;
- treat imported prose as capability/authority declarations;
- preserve tool-specific commands literally when they conflict with Vortex architecture;
- allow an upstream profile to bypass Vortex governance.

Vortex should:

- normalize useful methods into Vortex profile schema;
- retain source/license/revision provenance;
- validate fields and strip unsupported authority/tool assumptions;
- preserve only useful methodology, deliverables, triggers and evaluation criteria;
- support future update/diff/drift workflows;
- maintain a local ledger with source and normalized/rendered hashes;
- reconcile installed profiles as current/outdated/modified/removed/foreign;
- back up local modifications before destructive catalog operations;
- verify signed manifests for Vortex-distributed catalog updates;
- keep catalog network refresh explicit/opt-in;
- avoid arbitrary shell execution during profile installation/import;
- keep domain-specific catalogs optional.

## Methodology mapping adopted from useful upstream patterns

### Workflow Architect
Absorb workflow registry, branches/failure/recovery, handoff contracts, observable states, concurrency and test mapping.

### Agents Orchestrator
Absorb phased pipelines, explicit handoffs, dev↔QA loops, retry ceilings and quality gates, while keeping Ramon and existing Vortex authorities sovereign.

### Multi-Agent Systems Architect
Absorb hierarchy-first topology, structured handoffs, least privilege, context budgets, fallbacks/circuit breakers, traceability and eval-driven release.

### Minimal Change Engineer
Absorb minimum-diff discipline and explicit separation of follow-up work. Refactor Before Feature remains valid where architecture requires it.

### Codebase Onboarding / LSP
Absorb factual code-path mapping, entry-point discovery, inspected-scope honesty, symbol/reference intelligence and source-linked explanations.

### Evidence Collector / Reality Checker
Absorb evidence-first claims, task-level proof, final integration verification, rescan/retest after changes and conservative completion claims.

### Security profiles
Absorb concrete exploit/evidence/fix loops, secret handling, authorization checks, prompt-injection boundaries and post-fix rescan.

## Context and cost

Specialist profiles are ideal for local-first Vortex because multiple specialties do not require multiple heavyweight models.

One local model/runtime can apply multiple bounded specialist contexts.

Performance work in Build 128 should optimize:

- profile selection quality;
- number of simultaneously loaded profiles;
- compressed profile representations;
- deterministic metadata filtering before model use;
- context reuse/cache;
- model specialization where useful;
- parallelism limits.

## Non-authority

Specialist profiles never become hidden shortcuts around:

- Product Contract;
- Architecture Contract / Ledger;
- Scope Lock;
- capabilities;
- Tool Runtime;
- Approval Transactions;
- Git Runtime;
- Validation Pipeline;
- RC Gate;
- Amendment 006 local-sovereignty economics.
