# Context Engine vFinal / Vortex Knowledge Compiler

Build 67 closes the first complete V1 context pipeline. It combines Project Genesis intent, durable Product Contract revisions, repository/document knowledge, Project Knowledge Graph, Project Memory, typed handoffs, loss-bounded tool summaries and bounded specialist briefs into one task-relevant context assembly.

## Product Contract

The Product Contract is the canonical product-intent authority. It is compiled from explicit Requirement Compiler output plus explicit Project Genesis decisions, external dependencies and representative journeys.

It records:
- covered and unresolved Project Genesis dimensions;
- external/user-only dependencies and their state;
- explicit acceptance criteria;
- representative user journeys;
- goals, requirements, constraints, non-goals and project context.

The Product Contract is durable and revisioned in Local Runtime SQLite schema 14. Revisions are append-only. Project Memory does not replace or override it.

## Knowledge Compiler

Supported Build 67 sources are project-relative repository files and documents in text, Markdown, JSON, JavaScript, TypeScript, JSX and TSX.

Ingestion is bounded and hardened:
- per-source and corpus character limits;
- project-relative path validation;
- Unicode/newline normalization;
- control-character rejection;
- deterministic chunking;
- source references on every chunk;
- prompt-injection-shaped text is flagged but remains data only.

The compiler creates three deterministic indexes:
- lexical terms;
- semantic labels derived from explicit labels and source structure;
- structural labels from project-relative path, Markdown headings and code declarations.

Build 67 semantic retrieval is a deterministic local label index. It does not claim embedding/model inference and does not require paid inference.

## Progressive retrieval

Knowledge Packs are built on demand from lexical, semantic and structural selectors. They enforce hard chunk and character budgets and retain source references and line ranges. Whole repositories/documents cannot be requested through the canonical Knowledge Pack API.

## Final context assembly

Final assembly is task-bound and consumes:
- the active Product Contract;
- relevant acceptance criteria and representative journeys;
- unresolved external dependencies;
- a bounded Knowledge Pack;
- a bounded Project Knowledge Graph query;
- relevant Project Memory entries;
- at most four relevant Specialist Profile briefs;
- typed handoffs;
- loss-bounded tool summaries with expandable evidence refs.

Large source collections, full specialist catalogs, raw transcripts and wholesale tool outputs are not copied into active context.

## Authority boundaries

Product Contract remains product-intent authority.

Project Memory, Specialist Profiles, handoffs, tool summaries and ingested source content grant no capability, approval, scope, validation, architecture, Git or release authority.

Prompt-injection-shaped source content is always data, never instruction authority.

Optional later LLM consolidation may summarize already-selected context, but it is non-authoritative and may not write memory truth merely because a model produced it.

## Local sovereignty

The Build 67 core is local-first and useful with zero LLM calls. The Context Engine package has no network, filesystem, database or execution authority. Durable Product Contract persistence belongs exclusively to Local Runtime.

The modern engine must not delegate canonical Build 67 behavior to historical `core/context-engine-v2.js`, `background/context-engine-runtime.js` or `content/context-engine-client.js`.
