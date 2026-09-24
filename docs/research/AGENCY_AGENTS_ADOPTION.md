# Agency Agents — Vortex Ars Adoption Record

Status: **Accepted as an external specialist-methodology source**

Upstream: `https://github.com/msitarzewski/agency-agents`

License: **MIT**

Inspection date: **2026-09-24**

Observed at inspection: **321 Markdown profiles**. Major divisions included engineering (64), specialized (59), marketing (36), game development (21), integrations (18), strategy (16), GIS (13), security (12), design (10), testing (9), sales (9), project management (7), paid media (7), academic (6), spatial computing (6), support (6), finance (5), product (5), healthcare (3), research and examples/supporting materials.

## Adoption decision

Vortex does not vendor the full catalog into canonical agent prompts.

The useful pattern is adopted as a **Specialist Intelligence Layer** beneath the existing canonical agents.

## High-priority methodology sources inspected

The following upstream profiles directly informed Amendment 007 and future acceptance:

- `specialized/agents-orchestrator.md`
- `specialized/specialized-workflow-architect.md`
- `specialized/lsp-index-engineer.md`
- `engineering/engineering-multi-agent-systems-architect.md`
- `engineering/engineering-minimal-change-engineer.md`
- `engineering/engineering-codebase-onboarding-engineer.md`
- `engineering/engineering-code-reviewer.md`
- `engineering/engineering-database-optimizer.md`
- `engineering/engineering-identity-access-engineer.md`
- `engineering/engineering-search-relevance-engineer.md`
- `testing/testing-reality-checker.md`
- `testing/testing-evidence-collector.md`
- `testing/testing-test-automation-engineer.md`
- `testing/testing-accessibility-auditor.md`
- `testing/testing-performance-benchmarker.md`
- `testing/testing-tool-evaluator.md`
- `security/security-architect.md`
- `security/security-ai-generated-code-auditor.md`

## What Vortex takes

- deep role specialization;
- critical-rule sections;
- repeatable workflows;
- concrete deliverables;
- success/evaluation metrics;
- activation/use-case metadata;
- evidence-first QA;
- workflow completeness;
- least-privilege multi-agent design;
- bounded retry/fallback patterns;
- factual codebase onboarding;
- security-specific review methods;
- minimum-diff discipline;
- performance/accessibility/API specialist testing;
- install/version/drift concepts for future catalog management.

## What Vortex does not take

- one autonomous principal per Markdown file;
- tool-specific commands as canonical Vortex authority;
- hard-coded assumptions about Claude/Cursor/Codex/Aider/etc.;
- upstream agent names as new Vortex canonical agents;
- claims such as "production ready" without Vortex evidence;
- external-provider cost assumptions that violate Amendment 006;
- full-catalog context injection;
- arbitrary external tool/network/filesystem access;
- domain profiles bundled into Vortex Core when they are only useful to niche projects.

## Future Build 90 importer

The future Specialist Profile SDK/importer should be able to:

1. ingest compatible source Markdown/catalog metadata;
2. identify source/version/license;
3. parse identity, mission, rules, workflow, deliverables, metrics and triggers;
4. discard/translate tool-specific instructions that conflict with Vortex architecture;
5. map allowed Vortex canonical agents;
6. declare forbidden authorities;
7. estimate context cost;
8. normalize to `vortex-specialist-profile/1`;
9. validate and sign/hash the normalized representation;
10. compare/update later upstream revisions without silently overwriting local modifications.

## Distribution note

Any upstream material substantially copied into a distributed Vortex profile must preserve applicable MIT copyright/license notice requirements.

This record does not require Vortex to distribute upstream source content. It records provenance and the architectural adoption decision.
