# External Repository Adoption Batch — 2026-09-25

Status: **Reviewed and mapped into Vortex Ars AI**

| Repository | Observed license / constraint | Decision | Useful adoption |
| --- | --- | --- | --- |
| `lobehub/lobe-chat` (user alias `osp/lobe-chat`) | LobeHub Community License / Apache-based with commercial derivative restriction | **REFERENCE ONLY** | conversation/knowledge/plugin UX, multimodal interaction, progressive settings |
| `BuilderIO/mitosis` (user alias `osp.fyi/mitosis`) | MIT | **DIRECT CANDIDATE** | framework-neutral component IR, native framework emitters, design-system portability |
| `NationalSecurityAgency/ghidra` | Apache-2.0 main framework; mixed bundled components and separate GPL helpers | **OPTIONAL TOOL** | sandboxed/headless Binary Intelligence |
| `gleam-lang/gleam` | Apache-2.0 | **LANGUAGE ADAPTER** | detection, compiler/test/LSP integration |
| `deductive-ai/MemGPT` | Apache-2.0 | **METHOD / REFERENCE** | memory tiers, archival recall, context pressure, checkpoint ideas |
| `freestylefly/awesome-gpt-image-2` | MIT | **DIRECT/METHOD CANDIDATE** | Prompt-as-Code, recipes, case/regression library, provenance |
| `chartdb/chartdb` | AGPL-3.0 | **REFERENCE ONLY** | schema graph UX, credential-minimized introspection, dialect migration visualization |
| `jackwener/OpenCLI` | Apache-2.0 | **DIRECT CANDIDATE** | deterministic browser/app adapters, logged-in browser bridge, author/verify/autofix |
| `alibaba/page-agent` | MIT | **DIRECT CANDIDATE for generated projects** | in-page DOM agent, generated-app copilot blueprint, multi-page/MCP patterns |
| `Andyyyy64/whichllm` | MIT | **DIRECT CANDIDATE** | hardware detection, fit/speed/benchmark-ranked local model selection |
| `obra/superpowers` | MIT | **METHOD / PROFILE** | spec/design/plan discipline, systematic debugging, TDD, subagent execution |
| `dlvhdr/gh-dash` | MIT | **UX / DIRECT PATTERN CANDIDATE** | GitHub keyboard workflows, sections/filter/preview/action ergonomics |
| `tinyhumansai/openhuman` | GPL-3.0 | **REFERENCE ONLY** | Memory Tree, durable workflows, tool-output compression, local-first orchestration |
| `akitaonrails/ai-memory` | MIT | **DIRECT/METHOD CANDIDATE** | typed cross-agent handoffs, zero-LLM recall, Markdown portability, contradiction/dedup/retention |
| `iamgio/quarkdown` | GPL-3.0 | **REFERENCE ONLY** | portable multi-target document source, live preview, reusable functions, resource permissions |
| `alexfazio/plankton` | MIT | **METHOD / COMPONENT CANDIDATE** | write-time quality gates, structured violations, protected config |
| `DietrichGebert/ponytail` | MIT | **METHOD / PROFILE** | minimal-solution ladder, native/stdlib/existing dependency before new abstraction |

## Primary mapping

### whichllm
Builds **32, 35–37, 119, 123, 125, 128**: hardware autodetection, VRAM/RAM/bandwidth fit, context/KV overhead, speed estimates, evidence confidence, recency and hardware simulation. Normal UX still hides model shopping.

### ai-memory + MemGPT + OpenHuman
Builds **41–43, 66–67, 115, 117–118, 128**: memory tiers, zero-LLM path, bounded briefs, typed handoffs, source-grounded retrieval, portable export, contradiction/dedup/access signals, optional consolidation and tool-output compression. No second memory authority.

### Superpowers + Plankton + Ponytail
Builds **39–40, 52–53, 60, 62–63, 107, 124, 133**: spec before coding, executable plans, regression/TDD where useful, systematic debugging, write-time gates, protected quality config, minimal-solution ladder, final evidence review. Harness-specific Claude behavior is not architecture.

### OpenCLI
Builds **68–70, 75, 88–92, 106**: deterministic adapters above browser primitives, adapter generation/verification/autofix, logged-in user browser without exporting credentials, DOM extraction and authorized API/network-response extraction.

### PageAgent
Builds **39, 60, 68–70, 90–92, 117**: Embedded Agent Blueprint for Vortex-generated apps, current-page DOM/text agent, optional multi-page behavior and local/user-funded model compatibility. Production client secrets are forbidden.

### Mitosis
Builds **60, 73, 103–105, 117, 125**: evaluate framework-neutral component intent, native React/Vue/Svelte/Solid/etc. emitters, design-system portability and Figma/component pipeline concepts. No requirement to make Mitosis Vortex's own UI framework.

### ChartDB
Builds **61, 65, 73, 103, 117**: independently implement schema graph visualization, structured schema JSON, user-run read-only introspection query and dialect-aware migration planning. AGPL code remains reference-only.

### awesome-gpt-image-2
Builds **104–105, 124, 128**: Prompt-as-Code, reusable templates, documented cases, model/version/parameter provenance and visual recipe regression. No dependency on paid GPT Image.

### Quarkdown
Builds **45, 69, 105, 117**: independently adopt one portable source for print/web/presentation, reusable document components, live preview and secure resource permission concepts. GPL source remains reference-only.

### Ghidra
Builds **73, 90, 92, 127**: optional headless binary analysis feeding normalized symbols/functions/strings/xrefs/decompilation evidence into Code Intelligence. Keep isolated/opt-in and review packaging licenses.

### Gleam
Builds **32, 60, 62, 73, 124–125**: future language adapter candidate for detection/formatter/compiler/tests/LSP/dependency/build metadata.

### gh-dash
Builds **75–76, 109–113**: GitHub developer-experience reference for fast keyboard navigation, configurable sections, filters, preview and contextual actions.

### LobeChat
Builds **44, 89–92, 108**: reference conversation organization, plugin/agent discoverability, knowledge surfaces and progressive configuration. Current commercial derivative restrictions mean no proprietary Core source reuse without separate licensing.

## Direct dependency rule

Before any candidate becomes a dependency, its owning Build records exact version, license/NOTICE obligations, transitive license/security risk, maintenance posture, binary/native requirements and why Vortex-native implementation is not preferable.
