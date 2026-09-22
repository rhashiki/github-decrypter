# Project / Repository Knowledge Graph — Build 65

## Purpose

Build 65 introduces the canonical deterministic Project/Repository Knowledge Graph used by later Project Memory and Context Engine work.

The graph represents project knowledge as bounded, source-traceable relationships instead of repeatedly dumping an entire repository or document collection into model context.

## Ownership

Owner: `@github-decrypter/context`

Contract: `gd-project-knowledge-graph/1`

Query contract: `gd-project-knowledge-query/1`

## Represented knowledge

Node kinds:
- repository
- module
- file
- symbol
- document
- topic
- entity

Relationship kinds:
- contains
- imports
- depends-on
- defines
- references
- mentions
- relates-to

This is sufficient to represent repository/module/dependency structure, AST/symbol/reference relationships when an upstream extractor can provide them, and document/topic/entity relationships.

## Source traceability

Every node and every edge carries one or more source references. Build 65 stores references, not source payloads. A later compiler may derive graph inputs from code or documents, but the graph never fabricates provenance.

## Bounded retrieval

`queryProjectKnowledgeGraph` requires at least one selector and enforces hard limits for returned nodes, edges and traversal depth.

A caller cannot request an unbounded "give me the entire graph" result through the canonical query API.

Retrieval is deterministic and lexical in Build 65. Semantic embeddings, vector indexes and generated knowledge packs remain later ownership.

## Local sovereignty

The graph has no network, AI-provider, filesystem, database, Secrets Vault or persistence authority.

Construction and query are pure local computation. Build 65 cannot introduce Vortex-paid inference, remote fallback or mandatory BYOK.

## Deferred ownership

- Build 66 — Project Memory: durable Shared Agent Operational State.
- Build 67 — Context Engine vFinal / Vortex Knowledge Compiler: repository/document ingestion, parsing, semantic/lexical/structural retrieval and progressive knowledge packs.
- Later code-intelligence Builds may add richer extractors, but must emit source-grounded graph facts rather than bypassing this contract.

## Non-authority

The Knowledge Graph is not:
- Git source of truth;
- Architecture Ledger;
- Product Contract;
- Validation evidence;
- agent memory authority;
- a capability/approval/scope authority;
- an execution engine.

It is a deterministic project-knowledge representation and bounded retrieval surface.
