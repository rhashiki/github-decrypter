# Build 66 — Project Memory

Status: **IMPLEMENTED — pending CI/merge evidence**

## Goal

Create durable Shared Agent Operational State while preserving strict separation from canonical architecture, product, Git and validation authorities.

## Delivered

- `gd-project-memory-entry/1` environment-neutral contract;
- seven canonical memory kinds;
- explicit source references for every record;
- decision provenance requirement;
- tested/untested coverage marker;
- immutable revision/supersession model;
- bounded workspace-scoped queries;
- SQLite migration 13;
- Local Runtime `ProjectMemoryStore`;
- durable reopen test coverage;
- Architecture Guardian enforcement;
- Amendment 006 local-sovereignty preservation.

## Ownership

Contract: `@github-decrypter/context`.

Persistence: `apps/local`.

SQLite remains owned exclusively by the Local Runtime.

## Acceptance

The Build is complete only when every memory entry is workspace scoped and source referenced; decision memory without provenance is rejected; coverage memory without tested/untested state is rejected; cross-workspace supersession is rejected; superseded revisions are hidden by default but retrievable explicitly; state survives database reopen; no Vortex-paid inference path is introduced; and cumulative Builds 4–66 plus TypeScript remain green.
