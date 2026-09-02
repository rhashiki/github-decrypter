# GitHub Decrypter — Frozen V1 Scope

Status: FROZEN

This document defines what belongs to GitHub Decrypter V1.0. The roadmap may split these capabilities into Builds, but may not silently expand them.

## Product Foundation
- independent GitHub Decrypter repository and Build numbering
- product constitution, architecture rules, non-goals, RFC process, Definition of Done
- monorepo foundation
- versioned shared protocol
- central event bus
- Architecture Guardian

## Local Runtime
- independent local daemon/runtime
- local persistent database
- durable background Job Engine
- checkpoints, crash recovery, restart recovery, and offline continuation
- process lifecycle, health checks, logs, IPC/HTTP/WebSocket boundaries
- capability security and approval transactions
- secrets vault
- audit ledger

## Workspace and Git
- local workspace manager
- project/framework/package-manager detection
- local Git runtime: clone, fetch, pull, status, diff, branch, checkout, log, stash, restore, commit, push, merge-base, blame
- distinction between AI, human, and external changes where needed for safe transaction handling

## GitHub Integration
- GitHub App/authentication model
- GitHub provider/adapter
- repositories, branches, commits, issues, pull requests, checks, Actions, metadata, and workflow visibility needed by the Studio
- lightweight Chrome extension
- repository detection, FAB, launcher, connection status, and Open in GitHub Decrypter flow

## Studio
- React + TypeScript Studio
- installable PWA
- unified design system
- IDE-style resizable layout
- onboarding and Environment Doctor
- Chat, Plan, Build, Jobs, Preview, Code, Diff, Console, Problems, Terminal, and Git panels

## AI
- provider contract
- local AI first-class support
- Ollama/vLLM-compatible local runtime path
- Qwen-family coding model support in the planned local architecture
- local model installer/manager
- hardware-aware model guidance
- model routing by role
- optional external AI providers through adapters

## Large Prompt and Context Architecture
- full prompt intake
- requirement compiler
- structured specification
- task graph/DAG compiler
- persistent job/task queue
- hierarchical context engine
- context continuation between tasks
- project memory and context packs
- no user-facing dependence on raw token budgeting for normal workflow
- honest handling of finite model context windows through orchestration rather than false infinite-context claims

## Chat and Attachments
- persistent conversations independent from job lifecycle
- attachments including images, documents, code, logs, screenshots, structured data, and supported media
- project-aware mentions such as file, folder, repository, commit, branch, PR, issue, database, preview, and terminal context
- Jobs Center with queue/running/paused/waiting/failed/completed states and safe controls

## Plan and Decision Flow
- runtime-enforced read-only PLAN
- Decision Engine for meaningful architectural alternatives
- project rules/constitution per workspace
- impact simulation before approved execution when applicable
- explicit transition from approved Plan to Build

## Build and Tools
- Build Orchestrator
- tool runtime: read, write, patch, grep, glob, Git, controlled terminal, tests, LSP, diagnostics
- Scope Intelligence
- Scope Lock
- checkpoints
- validation pipeline

## Agents
- specialized Planner, Coding, Database, Testing, and Review agents
- Agent Runtime and Agent Orchestrator
- all agents remain subject to tools, capabilities, scope, Trust Gateway, and approval policies

## Project Knowledge
- Knowledge Graph
- persistent project memory
- context engine integrating code, Git, rules, memory, diagnostics, preview, database context, task state, and project history

## Preview and Developer Experience
- local Preview Runtime
- framework-aware dev-server startup
- live preview/HMR
- Preview Bridge
- console/runtime/network error capture where technically available and safe
- Problems & Diagnostics panel
- Code Explorer
- Diff Viewer
- controlled Terminal
- Git panel

## Transactions and Undo/Redo
- AI Transaction Ledger
- patch-aware intelligent undo
- patch-aware intelligent redo
- conflict-aware preservation of later human edits

## Backend Providers
- backend provider contract covering supported capabilities such as database, auth, storage, functions, migrations, secrets, and realtime
- Supabase first-class provider
- generic PostgreSQL provider
- Firebase provider
- Appwrite provider
- Convex provider
- custom backend adapter contract

## MCP and Plugins
- MCP Core
- MCP Trust Gateway
- curated MCP marketplace/catalog model
- Plugin SDK
- public Studio API
- plugin sandbox and permission boundaries

## Deployment
- deployment provider contract
- Vercel provider
- Netlify provider
- Cloudflare provider
- GitHub Pages provider
- Deployment Hub
- environments, status, logs, previews, production deploy flow, and rollback where provider APIs support them

## Domains
- domain provider contract
- connect existing domain
- assisted verification, DNS, SSL status, and deployment mapping
- domain purchase integration through external registrars/providers
- DNS automation with preview/approval when provider API supports it

## Visual Development
- Visual Inspector in Preview
- selected element/component context
- source/component mapping where technically possible
- Visual Build workflow from selection to patch to live preview

## Additional Intelligence
- Error Intelligence
- project Health Score
- opt-in Learning Mode that suggests improvements without silently changing code

## GitHub Collaboration Workflow
- review and commit flow
- push flow
- PR creation/update flow
- Checks and Actions visibility
- Issues -> Plan/Job/Build/PR workflow

## Multi-project and Background Work
- multiple workspaces
- independent per-project memory, rules, providers, runtime state, preview, jobs, and permissions
- supported background concurrency without coupling execution to the active browser tab

## Privacy and Portability
- privacy controls
- clearly identifiable 100% Local mode for capabilities that can operate locally
- telemetry opt-in
- export/exit path for portable Decrypter state
- internal-state backup/recovery

## Distribution and Hardening
- local runtime installer
- safe runtime auto-update and rollback
- extension packaging
- production PWA packaging
- unified installation/onboarding experience
- CI fixtures and compatibility matrix
- failure injection
- security audit
- performance hardening
- internal alpha, dogfooding, closed beta, stabilization, release candidate, V1 release gate

## V1 Completion Criterion
V1 is not complete until the end-to-end workflow works: GitHub repository -> Open in GitHub Decrypter -> local workspace -> large request -> requirement/task compilation -> Plan -> approved Build -> tool/agent execution -> live Preview -> validation -> diff -> commit -> push -> PR -> optional backend/deploy/domain workflows, with eligible local jobs able to survive browser closure and recover from interruption.