# Build 73 — Code Intelligence: External Source Triage

Audit date: 2026-10-08. Scope: only candidates assigned to Build 73 in the frozen research backlog.

## kraklabs/cie
- URL: https://github.com/kraklabs/cie
- License: AGPL-3.0 (repository metadata and README).
- Stack: Go, MCP, local code search/call graph.
- Classification: **REFERENCE ONLY**. No source import, vendoring, linking, runtime dependency, or license mixing.
- Ideas: source-grounded navigation, dependency graph, bounded tool responses and local indexing.
- Exclusions: AGPL source copying; adoption of an independent MCP execution authority.

## iliaal/codesage
- URL: https://github.com/iliaal/codesage
- License: MIT (repository metadata and README).
- Stack: Rust; structural graph, navigation, imports and optional semantic retrieval.
- Classification: **ADAPT — PATTERNS ONLY**.
- Ideas: deterministic initial codebase orientation, symbol/dependency navigation, source links and bounded context packs.
- Exclusions: embedding/reranking mandatory service, importing its complete Rust engine, own write authority or unverified execution-path claims.

## elastic/semantic-code-search-indexer
- URL: https://github.com/elastic/semantic-code-search-indexer
- License: NOASSERTION in GitHub repository metadata; verify individual source licenses before any reuse.
- Stack: TypeScript, Elasticsearch / semantic retrieval; upstream README warns main is unstable.
- Classification: **REFERENCE ONLY**.
- Ideas: incremental indexing and resource-bounded updates.
- Exclusions: mandatory Elasticsearch/inference, unstable remote dependency or undisclosed license inheritance.

## Build 73 decision
Implement a **local-first, AST-backed, bounded, read-only** index for TS/JS source snapshots using the TypeScript compiler library already used by the build toolchain. Results are structural facts, **not** semantic type-checking, verified call graphs, causality, binary disassembly, LSP authority, or code execution. Future incremental/LSP adapters are separate and may never bypass Tool Runtime, Workspace Manager or authorization. No third-party candidate code is copied.
