# External Source Mining Policy

Status: ACTIVE — Build 4

GitHub Decrypter may aggressively reuse public-source ideas and permissively licensed code when that reduces duplicated engineering work without creating provider lock-in or violating the frozen V1 architecture.

## Reuse classes

- `COPY` — direct code reuse is allowed after file-level license/provenance review.
- `ADAPT` — copy compatible code and modify it to fit Decrypter contracts, naming, runtime ownership, security and UX.
- `REIMPLEMENT` — reproduce behavior/architecture with a clean implementation when upstream licensing is not compatible with our intended distribution/use.
- `REFERENCE` — architecture/behavior study only; no source-code incorporation.
- `IGNORE` — no meaningful V1 value.

## Mandatory rules

1. No upstream project may become a hidden authority over Git, jobs, security, project state, providers or release policy.
2. Every copied/adapted source must record upstream repository, commit/ref, source path, destination path and applicable license in `third-party-sources.json` before merge.
3. Per-file licensing wins over repository-level assumptions. Nested licenses, enterprise directories and generated/vendor code must be reviewed separately.
4. Required copyright/license notices must be preserved.
5. Branding, logos, product names and marketing copy are not reused as GitHub Decrypter identity assets.
6. Source licensed under incompatible/restrictive terms is `REIMPLEMENT` or `REFERENCE`, never renamed and passed off as original source.
7. External-source reuse never bypasses Scope Lock, Trust Gateway, capability security, Architecture Guardian or Build acceptance criteria.

## Current source-mining targets

| Upstream | Default strategy | High-value areas |
|---|---|---|
| `microsoft/monaco-editor` | COPY/DEPENDENCY | code editor, diff, models, providers, diagnostics integration |
| `assistant-ui/assistant-ui` | COPY/DEPENDENCY/ADAPT | chat primitives, streaming, attachments, tool-call UI, approvals |
| `continuedev/continue` | ADAPT | context providers, tool contracts, protocol ideas, MCP, model/provider abstractions, @mentions |
| `freestyle-sh/Adorable` | ADAPT | workspace shell, chat/preview UX, terminal UX, publish/rollback interaction patterns |
| `ntegrals/december` | ADAPT/REIMPLEMENT | local app-builder runtime, containers, preview, Monaco/file management |
| `SujalXplores/v0.diy` | ADAPT | chat/project UX and individually licensed agent skills/patterns |
| `crewAIInc/crewAI` | ADAPT/REIMPLEMENT | agent roles, flows, event hooks, persistence/guardrail concepts |
| `huggingface/transformers` | DEPENDENCY/ADAPT | model metadata, tokenizer/config compatibility for local AI runtime |
| `n8n-io/n8n` | REFERENCE | durable workflow semantics, retries, node registries, credentials, observability |

## V1 guardrail

Source mining is an implementation accelerator for already-frozen V1 capabilities. It is not permission to add unrelated upstream features to the roadmap.
