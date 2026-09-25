# Project Memory Lifecycle & Portable Handoffs

Status: **Acceptance extension for Builds 41–43 / 66–67 / 115 / 117–118 / 128**

Vortex already owns durable Project Memory and Context Engine authority. This document evolves lifecycle behavior without rewriting those historical boundaries.

## Principles

- zero-LLM capture/search/handoff remains viable;
- durable memory is project/workspace scoped;
- derived facts retain provenance;
- retrieval is bounded;
- handoffs are typed;
- maintenance uses supersession/versioning rather than silent destructive rewrite;
- semantic/LLM enhancement is optional;
- Product Contract/Architecture/Git/Validation truth remains separate.

## Conceptual tiers

1. Active task context.
2. Project operational memory.
3. Source-grounded knowledge/index.
4. Portable Markdown/JSON archive/export.

These are storage/retrieval tiers, not different authorities.

## Handoff protocol

A durable handoff has id, workspace/project, sender/owner, intended receiver or claimable pool, objective, current state, Product Contract refs, relevant memory/source refs, attempted approaches, known failures, open questions, next action, evidence requirements and claimed/completed state.

Claim semantics should avoid duplicate work unless explicit parallelism is requested.

## Maintenance

Deterministic maintenance may detect near duplicates, flag contradictions, score access/use recency, propose supersession, compact cold episodic detail into durable facts while retaining revision/source history and rebuild derived indexes.

LLM-assisted consolidation is optional/off by default unless explicitly enabled.

## Tool-output compression

Large tool output may be converted into bounded structured summaries before ordinary context injection when safe. Preserve source pointers, actionable IDs/errors/warnings and on-demand expansion. Mark lossy compression and never elevate the summary above original evidence.
