# Project Memory / Shared Agent Operational State — Build 66

Build 66 introduces the canonical durable **Shared Agent Operational State** for Vortex Ars AI.

Project Memory lets specialists share durable project observations without turning conversational memory into a new source of truth.

It persists seven bounded record kinds: observations, findings, tested/untested coverage, unresolved questions, reusable project facts, decisions with explicit provenance, and compiled knowledge-pack references.

Every record is workspace-scoped and source-referenced.

The environment-neutral contract lives in `packages/context/src/project-memory.ts`. Durable persistence is owned exclusively by the Local Runtime in `apps/local/src/project-memory-store.ts`, using SQLite schema migration 13 and `gd_project_memory_entries`.

Memory content is immutable after insertion. Corrections and lifecycle changes create a new record that explicitly `supersedesId` the previous revision. The store exposes no arbitrary UPDATE or DELETE operation for memory content.

Project Memory is deliberately **non-authoritative**. A memory record may point to authoritative artifacts, but it never becomes Architecture Ledger authority, Product Contract authority, Git truth, validation/test truth, capability authority, or approval authority.

Decision records require explicit decision provenance refs. Coverage records must say `tested` or `untested`; that label is operational memory and does not replace Build 57/62 validation evidence.

Queries are workspace-scoped, kind/lifecycle filterable, bounded to at most 500 records, active-revision only by default, and include superseded history only when explicitly requested.

Build 66 adds no semantic search, embeddings, provider call, AI inference, external Project Memory API, direct agent execution, network authority, Git mutation, validation authority, Architecture Ledger mutation, Product Contract mutation, Build 67 Knowledge Compiler, release, or deployment authority.

Project Memory is local SQLite state. It creates no Vortex-paid inference, cloud GPU requirement, external transport, or mandatory BYOK path.
