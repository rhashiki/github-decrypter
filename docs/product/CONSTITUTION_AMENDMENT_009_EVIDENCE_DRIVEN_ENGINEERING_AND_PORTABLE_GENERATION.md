# Constitutional Amendment 009 — Evidence-Driven Engineering & Portable Generation

Status: **ADOPTED by product owner**

## Purpose

Vortex Ars AI should absorb proven open-source engineering patterns without turning the product into a dependency collage.

This amendment establishes shared doctrine for evidence-driven local model recommendation, durable/portable low-cost memory, disciplined software execution, write-time quality gates, minimal-solution engineering, deterministic browser/app adapters, embedded agents in generated apps, framework-neutral component intent, database visual intelligence, model-agnostic Media Prompt-as-Code, optional binary analysis and license-aware open-source adoption.

No specific third-party package becomes mandatory by this amendment.

## 1. Evidence-driven local model recommendation

Vortex should answer **which supported model is best for this user's actual hardware and task**, not merely which large model might fit.

Recommendation may combine detected accelerator/GPU, VRAM or unified memory, RAM, memory bandwidth, runtime/backend support, quantization, context/KV-cache requirements, estimated speed, model quality evidence, modality/tool/structured-output capabilities, recency and evidence confidence/provenance.

Rules:

- size-only model recommendation is insufficient;
- ordinary users do not need model-shopping knowledge;
- live public catalog data is optional and core recommendation needs a cached/offline path;
- provider credentials never go to public model catalogs;
- unknown/custom local models remain usable with conservative assumptions;
- hardware what-if simulation may be offered without mutating the actual environment.

## 2. Memory is useful with zero LLM calls

Core project memory, handoff and recall must remain useful with **zero LLM calls**.

Useful patterns include deterministic capture, provenance, bounded project/session briefs, full-text/entity/link/graph retrieval, typed handoffs, contradiction flags, dedup candidates, access/use retention signals, supersession/version chains, human-readable export and optional semantic/vector enhancement.

Optional LLM consolidation may exist only as a non-authoritative enhancement. It is not required for recall and must preserve revision/source history.

Project Contract, Architecture Ledger, Git and Validation truth remain separate authorities.

Large memory is progressively retrieved instead of dumped into active context.

Tool output may be loss-bounded/structure-aware compressed before model context only when source evidence remains addressable and expandable.

## 3. Typed handoffs are first-class

A handoff between agents, workers or sessions is structured state, not a transcript dump.

It may contain project/workspace, task/objective, Product Contract references, findings, attempted/failed approaches, open questions, next action, evidence/source references, scope/capability envelope references and degraded/context state.

A handoff grants no authority.

## 4. Engineering execution discipline

For substantial implementation:

```text
understand intent
→ inspect affected system
→ resolve/design
→ concrete plan
→ smallest correct implementation
→ write-time checks
→ tests/behavior evidence
→ review
→ RC evidence
```

Project Genesis/Product Contract remain product-intent authority.

Regression-first testing, red/green TDD and systematic debugging are used where they materially improve correctness. This is evidence discipline, not ceremony.

## 5. Write-time quality gates

Quality enforcement should happen near code creation, not only after a large Build.

Applicable checks include formatter, lint, types, dead code, duplicate code, security/static analysis, async/concurrency rules, schema/config validation, Docker/IaC checks and Architecture Guardian rules.

Deterministic cheap fixes run before expensive model reasoning where safe. Violations return structured evidence. Protected quality/security configuration may not be silently weakened merely to make a check pass.

## 6. Minimal-solution ladder

Before adding implementation surface, prefer the first safe rung:

1. Does this functionality need to exist?
2. Does the project already contain it?
3. Can the language/stdlib do it?
4. Can the native platform/browser/runtime do it?
5. Can an already-installed dependency do it?
6. Can a small direct implementation do it?
7. Only then add abstraction/dependency.

This is **not code golf**. Required validation, error handling, security, accessibility, observability, maintainability and Product Contract behavior are never removed for terseness.

## 6A. Legacy isolation and single-source implementation

Modern Vortex code must not remain behaviorally coupled to obsolete implementations after ownership has moved.

Rules:

- inherited legacy roots are migration inputs, not permanent runtime dependencies;
- when a modern owner replaces a legacy implementation, the migration must cut behavioral dependency on the old owner;
- two competing implementations of the same responsibility may not remain active as co-equal sources of truth;
- compatibility shims are temporary migration mechanisms and require an explicit owner, reason and removal condition;
- once equivalence/migration evidence is complete, obsolete code is removed or quarantined outside active runtime paths;
- dead exports, unreachable branches, obsolete adapters and superseded fallback paths are removed rather than preserved "just in case";
- rollback history belongs to Git, not to commented-out or duplicated source;
- a newer implementation may consume migrated data/protocol contracts, but it may not silently delegate canonical behavior back to the legacy implementation;
- Refactor Before Feature is mandatory when a new feature would otherwise deepen legacy coupling or duplicate responsibility.

Legacy isolation is a correctness rule, not cosmetic cleanup: stale implementations may contain old business rules, security assumptions, schema expectations or side effects that silently interfere with current behavior.

## 6B. Comment hygiene

Source comments are reserved for information that the code itself cannot express clearly.

Good comments explain, when genuinely necessary:

- **why** a non-obvious choice exists;
- architectural/security invariants;
- external protocol/platform quirks;
- concurrency, ordering or recovery constraints;
- intentionally surprising behavior;
- provenance/licensing notices;
- generated-code boundaries;
- a traceable temporary limitation with an owner/removal condition.

The following are prohibited in maintained active source:

- commented-out code used as backup/history;
- comments that merely narrate the next line or restate identifiers;
- patch diaries/changelogs such as "changed this because Build X broke";
- stale implementation notes that describe behavior the code no longer has;
- decorative comment walls that add no semantic value;
- indefinite `TODO` / `FIXME` / `HACK` markers without a traceable owner/reference and removal condition;
- product/business rules existing only in comments instead of canonical contracts/tests/types;
- comments used to justify bypassing architecture, validation or security rules.

Prefer expressive names, types, contracts, tests and small functions over explanatory prose.

Comments are not canonical product truth and never override Product Contract, Architecture Ledger, schema/protocol definitions, tests or Guardian policy.

Required copyright/license notices are preserved.

## 7. Deterministic browser/app adapters

Vortex Browser Runtime may evolve from repeated raw browser operations toward reusable verified adapters for websites, logged-in user browser sessions, supported desktop/Electron surfaces, generated apps and local tools.

Preferred flow:

```text
request
→ verified deterministic adapter when available
→ bounded browser primitives when not
→ optional adapter generation/repair
→ live verification
```

Browser credentials/cookies are never copied into model context. Logged-in browser use requires explicit user authorization and session scope. Adapter drift creates repair work instead of silently returning stale data.

## 8. Embedded Agent Blueprint for generated projects

A user may ask Vortex to build a product that itself contains an AI agent/copilot.

This is a **generated-project capability**, not a new Vortex authority.

Project Genesis captures allowed workflows/actions, page reach, mutation ability, model/compute source, data visibility, memory, auth, consent/audit and degraded behavior.

Rules:

- no secret API key in generated client code;
- generated agents inherit no Vortex host capabilities;
- page content is untrusted data;
- generated-app permissions belong to that application's security model;
- embedded agent behavior must be Preview/Interactive-QA testable.

## 9. Framework-neutral component intent

Vortex may use an intermediate UI/component representation when it improves portability and closed-loop visual correction.

**Intent is framework-neutral; exported application code is native to the selected framework.**

The IR must not force lowest-common-denominator UI and must remain compatible with source/component identity mapping.

## 10. Database schema intelligence

Database Agent / Code Intelligence may provide schema graphs, tables/views, columns/types/defaults, PK/FK relationships, indexes, constraints, supported routines/triggers, migration sources, ER visualization and target-dialect planning.

A credential-minimized mode is preferred where practical:

1. Vortex generates a read-only introspection query;
2. the user executes it in their database console;
3. structured schema output is imported;
4. Database Agent operates on that representation.

## 11. Media Prompt-as-Code

Complex media prompts are versionable engineering artifacts, not disposable prose.

A recipe may record intent, model assumptions, structured subject/layout/style/camera/lighting rules, constraints, references, generation/edit mode, parameters, seed/reproducibility facts, provenance and expected visual properties.

Template/case libraries support regression and prompt evolution. Compatibility is model-specific and must not be silently assumed.

## 12. Portable document/presentation source

Generated reports, books, knowledge bases and presentations should prefer a portable, versionable source representation with reusable functions/components, layout semantics, data binding, diagrams/math where supported, print/interactive targets, live preview and permission-bounded resource access.

## 13. Optional Binary Intelligence

Binary reverse engineering is useful for advanced users, legacy projects, security review and source-missing artifacts, but is not a mandatory Core dependency.

An optional adapter such as Ghidra may run locally in isolation under explicit user authorization. Untrusted binaries are hostile input; inspection does not imply execution. Results enter Code Intelligence as evidence, not authority.

## 14. Language/toolchain extensibility

A language adapter may provide project detection, formatter/linter, compiler/typechecker, tests, LSP/indexing, dependency metadata, build/run commands and normalized diagnostics.

Gleam is a future adapter candidate, not a mandatory Vortex implementation language.

## 15. License-aware adoption

Before direct code reuse, Vortex classifies license/obligations.

Permissive MIT/Apache-style projects may be evaluated for direct reuse after security/API/maintenance review.

Strong copyleft, mixed-license distributions or community/source-available licenses with commercial derivative restrictions are reference-only by default unless separately approved.

Reference-only means concepts may be independently implemented but source is not copied/vendorized into proprietary Core by default.

## 16. Release-blocking invariants

A Release Candidate is blocked when applicable work:

- selects models solely by size while ignoring known fit/capability evidence;
- requires paid inference for core memory capture/recall;
- rewrites canonical truth through memory consolidation;
- skips necessary design/inspection to start coding immediately;
- weakens lint/security/test configuration merely to pass;
- over-engineers when a simpler safe existing/native solution satisfies the Product Contract;
- leaves a replaced legacy implementation active as a competing behavioral authority;
- adds new code that delegates canonical behavior back into inherited legacy roots after ownership migration;
- retains dead/commented-out source as rollback history instead of using Git;
- ships active source polluted by stale/narrative comments or unowned indefinite TODO/FIXME/HACK markers;
- embeds Vortex/user secrets in generated client-side agents;
- lets a generated app agent inherit Vortex capabilities;
- trusts unverified browser adapters;
- promises native target code but requires a hidden Vortex runtime;
- loses media-recipe provenance required for reproducibility;
- directly vendors reference-only/copyleft code into proprietary Core without approval.

## Roadmap ownership

No Build is added or renumbered.

- **31–32, 35–37, 119, 123, 125, 128** — hardware/model recommendation.
- **41–43, 66–67, 115, 117–118, 128** — memory lifecycle, handoffs, recall and compression.
- **39–40, 52–55, 60, 62–63, 107, 124, 133** — engineering discipline, legacy isolation, comment hygiene and quality.
- **68–70, 75, 88–92, 106** — browser/app adapters.
- **39, 60, 68–70, 90–92, 117** — generated-app Embedded Agent Blueprint.
- **60, 73, 103–105, 117, 125** — framework-neutral component intent/native output.
- **61, 65, 73, 103, 117** — database visual intelligence.
- **104–105, 124, 128** — Media Prompt-as-Code.
- **45, 69, 105, 117** — portable document/presentation source.
- **73, 90, 92, 127** — optional Binary Intelligence.
- **32, 60, 62, 73, 124–125** — language/toolchain adapters.
- **75–76, 109–113** — GitHub/terminal ergonomics.

## Final doctrine

**Use evidence before guessing, memory before re-explaining, native capability before dependency, one active owner before legacy overlap, expressive code before comment noise, deterministic tools before fragile repeated browsing, and portable intent before framework lock-in.**
