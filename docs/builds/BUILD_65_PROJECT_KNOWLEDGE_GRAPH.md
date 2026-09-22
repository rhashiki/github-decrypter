# Build 65 — Project / Repository Knowledge Graph

Status: IMPLEMENTED — pending CI promotion

## Goal

Create the canonical deterministic knowledge graph for repositories and supported document relationships without adding persistence, model inference or Build 66/67 authority.

## Delivered

- `gd-project-knowledge-graph/1`;
- repository/module/file/symbol/document/topic/entity nodes;
- contains/imports/depends-on/defines/references/mentions/relates-to edges;
- source references on every node and edge;
- canonical ordering and duplicate/dangling-edge rejection;
- bounded deterministic lexical graph query;
- bounded traversal depth and output size;
- explicit prohibition of unbounded graph dumps;
- environment-neutral `@github-decrypter/context` ownership.

## Acceptance

- graph output is identical for equivalent reordered input;
- unknown/dangling nodes and duplicate edges fail closed;
- source references remain traceable in query output;
- symbol/reference and document/topic/entity relationships are representable;
- canonical query requires an explicit selector;
- query result is bounded by node/edge/depth limits;
- no network, filesystem, database, model/provider or persistence authority exists;
- Project Memory remains false until Build 66;
- Knowledge Compiler remains false until Build 67;
- Architecture Guardian and cumulative Builds 4–65 pass.

## Local sovereignty

Build 65 performs only local deterministic computation. It does not call AI APIs, remote inference or cloud storage and does not require BYOK.

## No Release

Completion of Build 65 does not authorize release, deployment, production mutation or Build 66 implementation.
