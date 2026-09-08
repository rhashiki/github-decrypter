# Build 43 — Token Abstraction Layer

Status: **IMPLEMENTATION IN PROGRESS — CI GATE NOT YET CLOSED**

## Objective

Establish a provider-neutral internal boundary for finite model context-window capacity without making normal user workflows depend on raw token budgeting and without claiming unlimited context.

## Implemented scope

- `@github-decrypter/context` advanced to Build 43
- public `@github-decrypter/context/token-abstraction` subpath
- exact `gd-context-continuation/1` source validation
- `gd-token-abstraction/1` output
- SHA-256 source digest preservation
- explicit finite model window descriptor
- reserved output capacity and derived usable input capacity
- one immutable `ctxwin-NNNN` envelope per continuation frame
- canonical carried-context identity preservation
- `metering: unmeasured`
- `fitStatus: unknown`
- `overflowDecision: deferred`
- no user-facing raw-token-budget dependency for normal workflow
- no infinite-context claim
- no tokenizer execution or fabricated token estimate
- no silent truncation
- no semantic compression or summarization
- explicit downstream orchestration requirement
- environment-neutral core
- no Studio, Extension or Local Runtime activation

## Required closure gates

Build 43 must not be marked complete until all of the following are green on the exact validated head:

1. Token Abstraction static contract.
2. Build 43 TypeScript project.
3. Token Abstraction runtime behavior.
4. Architecture Guardian AG410–AG419.
5. Guardian negative probes.
6. Accumulated Build 4–43 CI.
7. Root workspace TypeScript checks.
8. Modern-engine preservation.
9. Historical pull-request workflow matrix.
10. Protected-head merge check.

## Deferred by design

- Build 44 — Conversation Engine
- Build 45 — Attachment Engine
- Build 46 — Context Mentions
- Build 66 — Project Memory
- Build 67 — Context Engine vFinal
- actual provider/model tokenizer execution
- actual content token metering
- prompt splitting or task scheduling
- semantic summarization/compression
- context truncation
- model routing
- AI execution
- persistence/context-pack storage
- network, filesystem, database, browser or runtime transport

## Release boundary

No release, deployment, tag, DNS, Chrome Store, Supabase or production-backend mutation is part of Build 43.
