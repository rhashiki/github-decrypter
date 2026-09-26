# External Repository Candidates — Build-Gated Backlog

This file is the canonical backlog of external GitHub sources that may accelerate future Vortex Ars AI builds.

## Operating rule

**Do not audit this backlog wholesale.**

When the owning build starts:

1. Read only the candidate group for that build (plus any explicitly cross-linked candidate).
2. Inspect repository health, license, activity, architecture, language, security posture and implementation fit.
3. Classify each candidate as one of:
   - `direct`
   - `adapter`
   - `optional-tool`
   - `reference-only`
   - `reject`
4. Record exactly what can be reused and what must not be reused.
5. Prefer mature evidence over invention from scratch when reuse is architecturally safe.
6. Keep Vortex authority boundaries, local-first economics, licensing discipline, security rules and replacement strategy intact.
7. Update this file after the owning build triage.

All entries below start as **PENDING_TRIAGE**. A build tag is a routing hint supplied during planning; the owning build must revalidate the final architectural placement before adoption.

## Triage record format

For each reviewed source, replace `PENDING_TRIAGE` with a short record containing:

- status
- license
- activity/maintenance
- adoption class
- useful subsystem(s)
- excluded subsystem(s)
- security/license notes
- Vortex architectural boundary
- replacement/removal strategy
- decision evidence

---

## Build 69 — Live Preview

- **PENDING_TRIAGE** — https://github.com/Dheeraj-Kumar-089/flowent

## Build 70 — Preview Bridge

- **PENDING_TRIAGE** — https://github.com/vitalysim/browser-bridge
- **PENDING_TRIAGE** — https://github.com/0xpolarzero/electrobun-browser-tools

## Build 71 — Developer Console

- **PENDING_TRIAGE** — https://github.com/microsoft/edge-devtools-network-console
- **PENDING_TRIAGE** — https://github.com/AminAdineh/WebConsoleCapture
- **PENDING_TRIAGE** — https://github.com/Sakil9051/devtools-clone

## Build 72 — Problems & Diagnostics

- **PENDING_TRIAGE / ORG DISCOVERY** — https://github.com/ros/
- **PENDING_TRIAGE** — https://github.com/dreamsxin/agent-ide/

## Build 73 — Code Intelligence

- **PENDING_TRIAGE** — https://github.com/kraklabs/cie
- **PENDING_TRIAGE** — https://github.com/iliaal/codesage
- **PENDING_TRIAGE** — https://github.com/elastic/semantic-code-search-indexer

## Build 74 — Diff Viewer

- **PENDING_TRIAGE** — https://github.com/sourcegear/diffmerge
- **PENDING_TRIAGE** — https://github.com/nunomaduro/collision
- **PENDING_TRIAGE / TOPIC DISCOVERY** — https://github.com/topics/diff-tool?l=rust

## Build 75 — Terminal

- **PENDING_TRIAGE** — https://github.com/plmbr/webterm
- **PENDING_TRIAGE** — https://github.com/yutianxiao6/web-terminal-gateway
- **PENDING_TRIAGE** — https://github.com/vercel-labs/wterm

## Build 76 — Git Panel

- **PENDING_TRIAGE** — https://github.com/gitui-org/gitui
- **PENDING_TRIAGE** — https://github.com/kitlangton/ghui
- **PENDING_TRIAGE** — https://github.com/mrtrizer/UnityGitUI
- **PENDING_TRIAGE** — https://github.com/gohyuhan/gitti

## Build 77 — Transaction Ledger / Event-Sourced History

- **PENDING_TRIAGE** — https://github.com/HARRIFIED/Event-sourced-core-banking
- **PENDING_TRIAGE** — https://github.com/yashhjaggi1998/EventSourcing-Banking
- **PENDING_TRIAGE** — https://github.com/elixir-fintech/double_entry_ledger

## Builds 78–79 — Intelligent Undo / Redo

- **PENDING_TRIAGE / ISSUE REFERENCE** — https://github.com/marcelusfernandes/marvinz/issues/454
- **PENDING_TRIAGE** — https://github.com/mutativejs/travels
- **PENDING_TRIAGE** — https://github.com/elixir-fintech/double_entry_ledger

## Build 80 — Backend Provider Contract

- **PENDING_TRIAGE** — https://github.com/LordMoMA/Hexagonal-Architecture
- **PENDING_TRIAGE** — https://github.com/justifiedcode/hexagonal-architecture-pattern

## Build 86 — Custom Backend Adapter

- **PENDING_TRIAGE** — https://github.com/fabius-lovato/hexagonal-architecture-backend-service
- **PENDING_TRIAGE** — https://github.com/zitelli/Hexagonal-Architecture

## Build 87 — MCP Core

- **PENDING_TRIAGE / ORG REPOSITORY INDEX** — https://github.com/orgs/modelcontextprotocol/repositories
- **PENDING_TRIAGE** — https://github.com/modelcontextprotocol/servers
- **PENDING_TRIAGE / ORG DISCOVERY** — https://github.com/modelcontextprotocol
- **PENDING_TRIAGE / ORG DISCOVERY** — https://github.com/mcp

## Build 88 — MCP Trust Gateway

- **PENDING_TRIAGE** — https://github.com/microsoft/mcp-gateway
- **PENDING_TRIAGE** — https://github.com/lasso-security/mcp-gateway
- **PENDING_TRIAGE / ORG DISCOVERY** — https://github.com/mcp

## Build 89 — MCP / Plugin Marketplace

- **PENDING_TRIAGE** — https://github.com/Mearman/marketplace
- **PENDING_TRIAGE** — https://github.com/ai-plugin-marketplace/template

## Build 90 — Plugin SDK / Architecture

- **PENDING_TRIAGE / TOPIC DISCOVERY** — https://github.com/topics/plugin-architecture?l=typescript
- **PENDING_TRIAGE** — https://github.com/ai-plugin-marketplace/template

## Build 92 — Plugin Sandbox

- **PENDING_TRIAGE** — https://github.com/ForbesLindesay/secure-javascript-sandbox
- **PENDING_TRIAGE** — https://github.com/zeitlines/zeitlines
- **PENDING_TRIAGE** — https://github.com/theMachineClay/skillsandbox

## Build 93 — Deployment Contract

- **PENDING_TRIAGE** — https://github.com/pgoud161/cloud-devops-multi-cloud-deployment
- **PENDING_TRIAGE** — https://github.com/Tch-22zero5/Multi-Cloud-Projects
- **PENDING_TRIAGE** — https://github.com/chanakaudaya/solution-architecture-patterns/

## Build 94 — Deployment Orchestration

- **PENDING_TRIAGE** — https://github.com/open-edge-platform/app-orch-deployment

## Builds 99–102 — Domains / DNS / Deployment Routing

- **PENDING_TRIAGE** — https://github.com/getnamingo/plexdns
- **PENDING_TRIAGE** — https://github.com/oso95/domain-suite-mcp
- **PENDING_TRIAGE** — https://github.com/Kuadrant/multicluster-gateway-controller
- **PENDING_TRIAGE** — https://github.com/open-edge-platform/app-orch-deployment

## Build 103 — Visual Inspector / Element-to-Source

- **PENDING_TRIAGE** — https://github.com/amit-kap/dom-inspect/
- **PENDING_TRIAGE** — https://github.com/mabdinasira/react-native-element-inspector
- **PENDING_TRIAGE** — https://github.com/shaojie-li/web-source-inspect
- **PENDING_TRIAGE** — https://github.com/itayadler/dom-element-to-component-source

## Build 104 — Screenshot / UI Decomposition

- **PENDING_TRIAGE** — https://github.com/WCF900905/screenshot-to-design-system
- **PENDING_TRIAGE** — https://github.com/luongnv89/sleek-ui/

## Build 105 — Visual Build / Canvas Editing

- **PENDING_TRIAGE** — https://github.com/vishanurag/Canvas-Editor
- **PENDING_TRIAGE** — https://github.com/SiteEditor/editor
- **PENDING_TRIAGE** — https://github.com/liuzi6612/micro-design-editor
- **PENDING_TRIAGE** — https://github.com/echovl/react-design-editor

## Build 106 — Presentation / Artifact Generation Candidates

- **PENDING_TRIAGE** — https://github.com/sunbigfly/ppt-agent-skills
- **PENDING_TRIAGE** — https://github.com/leonid20000/odin-slides
- **PENDING_TRIAGE** — https://github.com/docmee/aippt-api-python-demo
- **PENDING_TRIAGE** — https://github.com/addsumtech/slides_maker
- **PENDING_TRIAGE** — https://github.com/martin226/slideitin

## Build 107 — Code / Architecture Health

- **PENDING_TRIAGE** — https://github.com/ajaywadhara/java-doctor
- **PENDING_TRIAGE** — https://github.com/helabenkhalfallah/code-health-meter
- **PENDING_TRIAGE / MARKETPLACE ACTION** — https://github.com/marketplace/actions/archicore-code-architecture-analysis

## Build 108 — Adaptive Tutor / Learning Mode

- **PENDING_TRIAGE** — https://github.com/RzayevTaleh01/intelligent-tutor-system
- **PENDING_TRIAGE** — https://github.com/CAHLR/OATutor
- **PENDING_TRIAGE** — https://github.com/ArnaudGuiovanna/tutor-mcp
- **PENDING_TRIAGE** — https://github.com/adityasarade/Agentic_AI_Tutor
- **PENDING_TRIAGE** — https://github.com/ai-boost/awesome-prompts

## Build 112 — Checks / GitHub Actions

- **PENDING_TRIAGE** — https://github.com/actions/runner-images

## Build 114 — Multi-Workspace / Agent Workspace Management

- **PENDING_TRIAGE** — https://github.com/agent-of-empires/agent-of-empires
- **PENDING_TRIAGE** — https://github.com/coplane/par
- **PENDING_TRIAGE** — https://github.com/gabriel-r-machado/compazio
- **PENDING_TRIAGE** — https://github.com/NakiriYuuzu/Yuuzu-IDE
- **PENDING_TRIAGE** — https://github.com/Witchwarren2344/dsh-mnemosyne-memory

## Build 115 — Durable Workflow / Concurrency

- **PENDING_TRIAGE / ORG DISCOVERY** — https://github.com/durable-workflow
- **PENDING_TRIAGE** — https://github.com/bitroot/coflux
- **PENDING_TRIAGE** — https://github.com/RickWong/rigid_workflow

## Build 117 — Privacy / PII / Workflow Candidates

> Build tag preserved exactly as supplied. Owning-build fit must be revalidated during triage.

- **PENDING_TRIAGE** — https://github.com/RickWong/rigid_workflow
- **PENDING_TRIAGE** — https://github.com/philterd/phileas-python
- **PENDING_TRIAGE** — https://github.com/martinmaurice24/pii-leak-detector
- **PENDING_TRIAGE** — https://github.com/muhammadwaqasmbd/pii-redaction-middleware
- **PENDING_TRIAGE** — https://github.com/One-Million-Lines/privacy-pii-redactor

## Build 119 — Local AI Runtime / Runtime Installation

- **PENDING_TRIAGE** — https://github.com/mudler/localai
- **PENDING_TRIAGE** — https://github.com/Simoon-F/envora
- **PENDING_TRIAGE / URL SPLIT TO VERIFY** — https://github.com/Future-Element/pinset
- **PENDING_TRIAGE / URL SPLIT TO VERIFY** — https://github.com/lm-webui/lm-webui
- **PENDING_TRIAGE** — https://github.com/pure-linux/tinyolet
- **PENDING_TRIAGE** — https://github.com/johnymontana/local-ai-setup
- **PENDING_TRIAGE** — https://github.com/vllm-project/vllm

## Build 120 — Runtime Auto Update

- **PENDING_TRIAGE** — https://github.com/ever-co/ever-gauzy
- **PENDING_TRIAGE** — https://github.com/danilevy1212/self-updater
- **PENDING_TRIAGE** — https://github.com/doyensec/ElectronSafeUpdater

## Build 121 — Extension Packaging

- **PENDING_TRIAGE** — https://github.com/plasmohq/plasmo
- **PENDING_TRIAGE** — https://github.com/turbostarter/extro
- **PENDING_TRIAGE** — https://github.com/wxt-dev/wxt

## Build 123 — Unified Installation / Runtime Bootstrap

- **PENDING_TRIAGE** — https://github.com/dotnet/runtime
- **PENDING_TRIAGE** — https://github.com/microsoft/winget-pkgs
- **PENDING_TRIAGE** — https://github.com/dotnet/core
- **PENDING_TRIAGE** — https://github.com/RickStrahl/DotnetDesktopRuntimeInstaller

## Build 125 — Compatibility Matrix / Hardware-Model Fit

- **PENDING_TRIAGE** — https://github.com/AlexsJones/llmfit
- **PENDING_TRIAGE** — https://github.com/signerless/llm-checker
- **PENDING_TRIAGE** — https://github.com/MrXujiang/ai-detector

## Build 127 — Security Audit / Scanning

- **PENDING_TRIAGE** — https://github.com/projectdiscovery/nuclei
- **PENDING_TRIAGE** — https://github.com/NVIDIA/SkillSpector
- **PENDING_TRIAGE** — https://github.com/CISOfy/lynis
- **PENDING_TRIAGE** — https://github.com/future-architect/vuls
- **PENDING_TRIAGE** — https://github.com/advanced-security/secret-scanning-tools

## Build 128 — Performance / Benchmark Hardening

- **PENDING_TRIAGE** — https://github.com/git-pkgs/testing
- **PENDING_TRIAGE** — https://github.com/strands-labs/benchmark-harnesses
- **PENDING_TRIAGE** — https://github.com/harness/harness-performance-tool
- **PENDING_TRIAGE** — https://github.com/Linaro/benchmark_harness

## Build 132 — Zero Placeholder / Completeness Sweep

- **PENDING_TRIAGE** — https://github.com/djinn-soul/CytoScnPy
- **PENDING_TRIAGE** — https://github.com/simplecore-inc/coregraph
- **PENDING_TRIAGE** — https://github.com/hyperpolymath/pons-asinorum
- **PENDING_TRIAGE** — https://github.com/curiouslearner/devkit
- **PENDING_TRIAGE** — https://github.com/indiser/DeadHunt
- **PENDING_TRIAGE** — https://github.com/hasinhayder/PromptFiller
- **PENDING_TRIAGE** — https://github.com/QwenLM/qwen-code
- **PENDING_TRIAGE** — https://github.com/wppoland/hidden-text-detector

## Build 133 — RC Evidence / Qualification Candidates

- **PENDING_TRIAGE** — https://github.com/zhiweio/EagleRAG
- **PENDING_TRIAGE** — https://github.com/honua-io/honua-evidence
- **PENDING_TRIAGE** — https://github.com/clay-good/nisify
- **PENDING_TRIAGE** — https://github.com/maxmoran23/analyst-toolkit

---

## Input normalization notes

No repository above was audited while creating this backlog.

Only obvious list cleanup was performed:

- duplicated blocks and repeated URLs were deduplicated inside the same build group;
- the malformed Build 88 entry was interpreted as two intended candidates:
  - `microsoft/mcp-gateway`
  - `lasso-security/mcp-gateway`
- the malformed Build 119 concatenation was split provisionally into:
  - `Future-Element/pinset`
  - `lm-webui/lm-webui`
  Both remain explicitly marked **URL SPLIT TO VERIFY**.
- `http://github.com/amit-kap/dom-inspect/` was normalized to HTTPS.
- organization, topic, marketplace and issue URLs were preserved as discovery/reference candidates rather than pretending they are repositories.

## Deferred triage policy

The presence of a source in this file does **not** mean it is trusted, compatible, maintained, legally reusable or architecturally appropriate.

Triage is intentionally deferred until the owning build so that Vortex does not spend time auditing unrelated repositories in bulk and so each decision can be evaluated against the exact architecture and contracts that exist at that point in the roadmap.
