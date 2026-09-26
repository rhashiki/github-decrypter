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

| `OpenHands/OpenHands` | ADAPT/REFERENCE | agent-server/backend abstraction, local/remote execution, automations, ACP-compatible agent interoperability |
| `langflow-ai/langflow` | ADAPT | visual workflow graphs, workflow serialization, MCP/API tool surfaces, multi-agent flow UX |
| `ollama/ollama` | DEPENDENCY/ADAPT | optional local runtime adapter, local model lifecycle/API compatibility; already aligned with Build 119 portability |
| `ripienaar/free-for-dev` | REFERENCE | free-tier discovery for optional infrastructure choices; never a runtime authority |
| `D4Vinci/Scrapling` | REFERENCE | adaptive parser relocation, crawl pause/resume, bounded concurrency, extraction ergonomics; anti-bot bypass behavior is explicitly excluded |
| `sindresorhus/awesome` | REFERENCE | discovery/curation source only; candidates still require independent license/security review |
| `Shubhamsaboo/awesome-llm-apps` | ADAPT/REFERENCE | agent/RAG examples, skill packaging patterns, narrow reusable app workflows; per-example dependencies require review |
| `nexu-io/open-design` | ADAPT | local-first design systems, portable skills/plugins, sandboxed preview, artifact export, provenance-bearing design packages |
| `punkpeye/awesome-mcp-servers` | REFERENCE | MCP discovery catalog only; no automatic trust/install and every candidate passes Plugin SDK/security review |
| `lyogavin/airllm` | DEPENDENCY/ADAPT | experimental low-VRAM layer-streaming/model-loading techniques for Build 128; evaluate latency/RAM/disk tradeoffs before adoption |
| `ayghri/i-have-adhd` | ADAPT | optional action-first communication profile for Build 108; do not infer/diagnose ADHD and do not enable by hidden profiling |
| `different-ai/openwork` | ADAPT/REFERENCE | local skills/MCP sharing, workspace/control-plane patterns and plugin distribution; exclude `ee/` from code reuse unless separately licensed |
| `zhaoxuya520/reverse-skill` | ADAPT/REFERENCE | client-neutral skill routing, structured scope/evidence workflow, regression-tested routing; offensive/security modules and nested copyleft components are not copied wholesale |
| `1jehuang/1jcode` | HOLD / VERIFY | user-supplied candidate was not reachable through current GitHub/web checks on 2026-09-26; no code or license assumptions until verified |

### Batch 2026-09-26 guardrails

- Catalog repositories are discovery inputs only; entries are never auto-installed, auto-trusted or promoted to product authority.
- `Scrapling` anti-bot/Cloudflare-bypass behavior is outside this mining scope; only resilient parsing/crawl-control patterns are relevant.
- `OpenWork` has split licensing; only MIT-eligible paths may ever be copied/adapted, while `ee/` remains reference-only unless separately licensed.
- `reverse-skill` contains nested third-party/copy-left components; routing/evidence patterns may be studied, but nested source requires per-path license review.
- `open-design` and `awesome-llm-apps` contain bundled/nested material; repository-level licensing never substitutes for per-file provenance review.
- `AirLLM` is an optimization candidate, not a promise that huge models are practical on weak hardware; latency, host RAM, disk footprint and failure behavior must be benchmarked.
- `i-have-adhd` contributes an optional communication pattern only. Vortex must not infer a medical condition from behavior or silently activate a diagnosis-labeled mode.
- `1jehuang/1jcode` stays on hold until the repository can be verified and licensed content inspected.

## V1 guardrail

Source mining is an implementation accelerator for already-frozen V1 capabilities. It is not permission to add unrelated upstream features to the roadmap.
