# External Source Triage — 2026-09-26 — Batch 2

Status: **RECORDED — NO RUNTIME IMPORTS**

This audit records the repositories supplied for Vortex Ars AI source mining. It maps useful patterns onto already-owned V1 Builds without creating new Build numbers or promoting any upstream into hidden authority.

## Decisions

| Source | Decision | Vortex mapping | What is useful | Explicit boundary |
| --- | --- | --- | --- | --- |
| `OpenHands/OpenHands` | ADAPT / REFERENCE | 64, 115, 118, 124 | multi-backend agent control, local/remote execution, automations, ACP-style interoperability | Vortex keeps its own agents, Tool Runtime, capabilities and durable-job authority |
| `langflow-ai/langflow` | ADAPT | 90, 115, 117, 124 | visual workflow graphs, serializable flows, MCP/API exposure, interactive flow testing | no second workflow authority beside Vortex Task Graph / Build Orchestrator |
| `ollama/ollama` | OPTIONAL DEPENDENCY / ADAPT | 35–37, 119, 123, 125, 128 | local model serving/lifecycle and stable REST integration | one supported runtime family, never the user-facing Vortex identity and never mandatory |
| `ripienaar/free-for-dev` | REFERENCE | 123, 125 | cost-aware discovery of optional developer infrastructure | catalog only; free-tier terms must be revalidated before recommendation/use |
| `D4Vinci/Scrapling` | REFERENCE | 68–70, 124 | adaptive extraction, parser relocation after page drift, crawl pause/resume, concurrency controls | anti-bot/Cloudflare-bypass behavior is outside adoption scope |
| `sindresorhus/awesome` | REFERENCE | 90 | broad discovery source for future mining | no automatic trust, vendoring or install from list membership |
| `Shubhamsaboo/awesome-llm-apps` | ADAPT / REFERENCE | 60, 67, 90, 117 | agent/RAG examples, skill packaging, reusable workflow patterns | examples are mined individually; nested dependencies/licenses still require review |
| `nexu-io/open-design` | HIGH-VALUE ADAPT | 90, 103–105, 117 | design-system packages, portable skills/plugins, local-first artifact generation, sandboxed preview, provenance | Vortex preserves its own design authority and checks bundled licenses per path |
| `punkpeye/awesome-mcp-servers` | REFERENCE | 90, 124, 127 | MCP ecosystem discovery | discovery never equals trust; install requires manifest/security/license review |
| `lyogavin/airllm` | EXPERIMENTAL DEPENDENCY / ADAPT | 119, 125, 128 | layer-streamed inference and low-VRAM model loading | benchmark full-system cost: latency, RAM, disk, thermals, stability and model-specific constraints |
| `ayghri/i-have-adhd` | ADAPT | 31, 108 | action-first, low-friction response shaping and persistent presentation preferences | generic optional communication profile only; no ADHD inference, diagnosis or silent activation |
| `different-ai/openwork` | ADAPT / REFERENCE | 90, 115, 117, 119, 123 | shareable skills/MCPs, local workspace patterns, plugin distribution/control-plane concepts | code reuse limited to MIT-eligible paths; `ee/` remains separately licensed |
| `zhaoxuya520/reverse-skill` | ADAPT / REFERENCE | 90, 124, 127 | deterministic skill routing, scope-first workflow, evidence journals, routing regression suites | no wholesale offensive tooling; nested GPL/AGPL/third-party components require separate review |
| `1jehuang/1jcode` | HOLD | none yet | unknown | repository could not be verified through current GitHub/web access; no assumptions or reuse |

## Highest-value implications

1. **Local runtime portability gets stronger without changing product identity.** Ollama is already named as a supported runtime-family direction in Build 119; AirLLM becomes an experimental optimization candidate for hardware-constrained systems, not a default.
2. **Plugin/Skill architecture gains concrete upstream references.** OpenDesign, OpenWork, Langflow, Awesome MCP Servers and reverse-skill provide useful packaging, routing and workflow patterns for Build 90 while Vortex remains the authority.
3. **Visual generation can borrow proven package concepts.** OpenDesign is especially relevant to Builds 103–105: design systems as portable packages, provenance, sandboxed preview and real artifact exports fit the existing Visual/Media roadmap.
4. **Agent execution should remain Vortex-native.** OpenHands is useful primarily for backend-switching and agent-server/automation patterns; it does not replace Ramon, the canonical agent roster, durable jobs, Scope Lock or Tool Runtime.
5. **Catalogs stay catalogs.** `awesome`, `free-for-dev`, `awesome-mcp-servers` and the example library in `awesome-llm-apps` are research inputs, never supply-chain shortcuts.

## No roadmap expansion required

Every useful capability in this batch already has an owning Build. This batch therefore does **not** create a constitutional amendment, does not renumber the 1–134 roadmap and does not add implementation work ahead of its owning Build.

No runtime dependency, external service, paid API, cloud requirement, model-provider UX or production mutation is introduced by this audit.
