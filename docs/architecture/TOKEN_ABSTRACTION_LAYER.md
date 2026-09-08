# Token Abstraction Layer

Build 43 introduces the canonical finite-window boundary owned by `@github-decrypter/context`.

## Purpose

The layer exists so normal GitHub Decrypter workflows do not depend on user-facing raw token budgeting while the product still handles **finite model context windows** honestly.

It consumes the immutable Build 42 `gd-context-continuation/1` plan plus an explicit model-window descriptor and produces `gd-token-abstraction/1`.

## Input boundary

The exact input is:

- `continuation`: canonical Build 42 Context Continuation output.
- `window.contextWindowTokens`: finite model context-window capacity supplied as internal model metadata.
- `window.reservedOutputTokens`: internal capacity reserved for model output.

Both token values must be safe integers, and output reservation must be smaller than total context capacity.

## Output boundary

The output preserves the Build 42 source digest and creates one immutable `ctxwin-NNNN` envelope per continuation frame.

Each envelope carries:

- continuation frame identity;
- task/context identity;
- canonical carried context IDs;
- total model context-window capacity;
- reserved output capacity;
- usable input capacity;
- `metering: unmeasured`;
- `fitStatus: unknown`;
- `overflowDecision: deferred`.

The raw capacity values are an internal implementation boundary. They are not a normal user-facing workflow requirement.

## Honesty rule

Build 43 does **not** execute a tokenizer and does not estimate how many tokens the actual context content consumes. Therefore it cannot claim that any frame fits in a model window.

Until real provider/model metering is available at an authorized later boundary:

- fit remains `unknown`;
- overflow decisions remain deferred;
- no context is silently truncated;
- no context is automatically summarized or compressed;
- no infinite-context claim is permitted.

This is deliberate. A known finite capacity is not the same thing as measured content usage.

## Orchestration rule

`orchestrationRequired: true` means downstream systems must respect the finite-window envelope instead of assuming unlimited context. It does not authorize Build 43 to schedule tasks, split prompts, summarize context, choose models, or execute AI.

## Non-authority

Build 43 has no authority over:

- model/provider tokenizer execution;
- content token estimation;
- semantic summarization or compression;
- silent truncation;
- model routing;
- AI generation;
- task execution or scheduling;
- attachments or mentions;
- conversation history;
- project memory or context-pack persistence;
- network, filesystem, database, browser, Studio, Extension or Local Runtime transport.

## Downstream ownership

- **Build 44 — Conversation Engine** consumes this finite-window boundary when conversation authority becomes active.
- **Build 45 — Attachment Engine** owns attachment ingestion.
- **Build 46 — Context Mentions** owns mention resolution.
- **Build 66 — Project Memory** owns persistent project memory.
- **Build 67 — Context Engine vFinal** owns the later integrated context system.

Build 43 must not implement any of those authorities early.
