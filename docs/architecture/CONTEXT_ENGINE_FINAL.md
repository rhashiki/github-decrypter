# Context Engine vFinal — Build 67

Build 67 is the canonical integration point for **Project Genesis**, the durable **Product Contract**, the **Vortex Knowledge Compiler**, and bounded task-specific context assembly.

## Product Genesis

Substantial product work begins with adaptive discovery of product decisions rather than implementation trivia. The canonical question catalog covers users/roles, workflows, business rules, content, monetization, integrations, platforms, authentication, privacy, accessibility, deployment, operations and external dependencies.

Questions branch from prior answers. Required unresolved questions make the Product Contract `blocked`; Vortex must not silently guess them. Ordinary engineering decisions remain Vortex-owned.

## Product Contract

`gd-product-contract/1` is authoritative product intent.

It stores:

- answered product decisions with source references;
- derived acceptance criteria;
- representative user journeys;
- unresolved product decisions;
- declared external dependencies/facts;
- revision provenance.

The Local Runtime persists immutable Product Contract revisions in SQLite schema 14. A later revision must supersede the immediately prior revision. The store exposes no arbitrary Product Contract UPDATE/DELETE API.

An external dependency may block RC without blocking ordinary implementation. A genuinely unresolved required product decision blocks substantial build work.

## Knowledge Compiler

The compiler accepts **already materialized** source content. It does not acquire filesystem, Git, GitHub or network authority merely to ingest knowledge.

Supported source forms in Build 67:

- repository code;
- repository documentation;
- technical/plain-text documents;
- structured JSON;
- structured CSV.

Parsing is bounded and sanitized. ANSI/control noise is removed, structured inputs have depth/row/column limits, and content is split into bounded chunks.

Prompt-injection-shaped text is recorded as source data. It never becomes system, developer, architecture, capability, approval, scope or Product Contract authority.

## Retrieval

Retrieval is progressive:

1. lexical narrowing;
2. optional Build 65 Knowledge Graph structural expansion/boost;
3. a bounded shortlist (maximum 24 candidates);
4. optional **local-model semantic reranking**;
5. bounded on-demand Knowledge Pack.

There is no fake semantic-search claim. If no supported local model is available, retrieval remains lexical/structural and explicitly reports that semantic reranking was unavailable.

Semantic reranking uses the existing Local AI Runtime/Model Routing boundary and therefore inherits capability gating and Amendment 006 local sovereignty. Build 67 creates no Vortex-paid inference fallback and requires no external provider.

## Final Context

`gd-final-context/1` loads only evidence relevant to the active task, up to the declared context bound.

Authority is explicit:

- Product Contract → authoritative product intent;
- repository/document knowledge → source data;
- Project Memory → non-authoritative operational memory.

The rendered model context reiterates that quoted repository/document content is data and cannot override canonical authority.

## Local Runtime

The Local Runtime owns:

- Product Contract persistence;
- Project Memory persistence from Build 66;
- composition of Knowledge Compiler retrieval;
- optional local semantic reranking;
- final context assembly.

Build 67 adds no generic Context Engine HTTP/RPC endpoint.

## Local sovereignty

Build 67 is local-first:

- no Vortex-paid inference;
- no mandatory BYOK;
- no cloud vector database;
- no mandatory remote embeddings;
- no direct Context Engine network authority;
- no direct Context Engine filesystem authority;
- semantic compute uses the user's supported local model when available.

## Non-authority

Build 67 does not grant Context Engine:

- capability issuance;
- approval authority;
- Git mutation;
- Architecture Ledger mutation;
- validation truth;
- agent authority;
- Tool Runtime bypass;
- Scope Lock bypass;
- Preview/browser execution;
- deployment/release authority.

Build 68 owns Preview Runtime.
