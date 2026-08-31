# Lovable Decrypter v2.6 — Local-First AI Roadmap

Status baseline: Build 71 — Universal Agent Runtime Registry is the current engineering baseline. Builds 60→71 are implemented with cumulative CI green. Build 70 provider-side validation is complete; the final Chrome homologation is intentionally deferred until Builds 71→75 are complete. Merge to `main`, OTA metadata, GitHub Release, store publication and production rollout remain separately unauthorized.

## Product invariants

1. **No paid GPU server is required.** Local inference remains the default path.
2. **No commercial token quota is required.** Context budgeting handles technical limits without making a paid provider mandatory.
3. **Work must survive model/runtime interruption.** Continuity and checkpoints remain outside model reasoning.
4. **No automatic paid-AI fallback.** Remote providers remain explicit opt-in only.
5. **Human edits outrank previous AI edits.** `USER_EDIT > AI_EDIT`; Human Intent and Scope Intelligence remain authoritative.
6. Writes are fail-closed behind approval, Tool Runtime, Continuity, Account Integration Gate and Guarded Commit.
7. GitHub App + authorized repository and Supabase OAuth + authorized project are required for project mutation.
8. External agents can analyze and propose but never become authoritative writers.
9. Provider/runtime credentials are server-side or session-only and are not durable project state.
10. Security claims require executable adversarial CI; final browser/provider tests are cumulative after Build 75.

## Build 60 — Local Model Runtime ✅

Ollama/vLLM + Qwen local runtime, health/pool contract, local-only routing and zero paid/remote fallback.

## Build 61 — Tool Runtime / Coding Tools ✅

Provider-neutral repository/file tools, patch engine, grep/glob, Git diff, diagnostics/LSP gates and Operation Journal.

## Build 62 — MCP Core + MCP Trust Gateway ✅

MCP authentication, allowlists, Scope Lock, explicit write approval, one-shot tickets and Operation Journal integration. MCP baseline: 2026-07-28.

## Build 63 — Curated MCP Marketplace ✅

Controlled MCP catalog with provenance, permissions, trust/write capabilities and revocation state.

## Build 64 — Context Engine v2 ✅

Budgeted Context Packs from code, Git history, schemas/signals, Rules, Skills, Impact Maps, docs, diagnostics and recent manual edits.

## Build 65 — Scope Intelligence v2 + Human Intent ✅

Request → plan → diff checks, unauthorized-file/action detection, broad rewrite detection and user-edit protection. `USER_EDIT > AI_EDIT`.

## Build 66 — Smart Undo/Redo + Reversible Operations ✅

Three-way preservation of later user edits, symmetric Redo, one-shot HEAD-locked confirmation and explicit destructive modes.

## Build 67 — Continuity Engine ✅

Durable tasks/steps with leases, idempotency keys and checkpoints. Ambiguous writes require verification before retry.

## Build 68 — Local Agent Orchestrator + Model Router ✅

Local coding loop with model degradation, proposal digest, approval, Scope Intelligence, Tool Runtime, Continuity, diff and diagnostics/repair.

## Build 69 — DecrypterBench v2 / Hardening ✅

Adversarial gates cover repository path safety, stale/ambiguous patches, scope creep, Human Intent, Undo/Redo conflicts, proposal tampering, MCP trust, Continuity and zero-cost policy. This roadmap does not authorize merge to `main`.

## Build 70 — Account Integration Gate ✅

Technical closeout completed. Mandatory GitHub App + Supabase OAuth readiness, project mappings, remote write revalidation, GitHub key-format compatibility, callback bridge, canonical Supabase scopes, safe refresh rotation and no-secret durable settings are implemented. Builds 48→70 + DecrypterBench v2 + release-preflight are green.

Live provider validation also passed: real GitHub installation/repository permissions, post-fix success callback, isolated temporary-branch write/delete probe, real Supabase OAuth project discovery and a non-persistent database write probe. Evidence is recorded in `docs/BUILD70_LIVE_VALIDATION_2026-08-31.md`.

The remaining Build 70 browser checks are deferred to the final cumulative homologation after Build 75: actual extension callback rendering, mapping UI, approved frontend/backend mutation and deliberate provider revocation/fail-closed checks.

# Universal Agent Control Plane

External/local runtimes propose changes. The Decrypter remains the authority through Context Engine v2, Scope Intelligence v2, Human Intent, approval/proposal digest, Tool Runtime, Continuity, Smart Undo/Redo, Account Integration Gate and Operation Journal.

## Build 71 — Universal Agent Runtime Registry ✅

Implemented and cumulatively green. Registry schema: `ld-agent-runtime-registry/1`.

Initial adapters:
- `decrypter-local`
- OpenHands Agent Server
- Codex CLI
- OpenCode
- Aider

Contracts:
- normalized runtime definitions, capabilities, versions and events;
- every runtime reports `writeAuthority:false` and remains proposal-only;
- safe direct HTTP/loopback probing where the browser can connect;
- process-oriented transports are explicitly bridge-required;
- runtime auth/endpoints are session-only;
- prompt delivery prefers stdin/file and enforces bounded argument transport;
- first-output, inactivity and total timeout watchdogs;
- existing Build 58 server Agent Runtime remains background-only and compatible;
- cumulative Builds 48→71, DecrypterBench v2 and release-preflight passed on workflow run `33435295443`.

## Build 72 — Portable Skills v2 ⏳ NEXT

Goal: portable, local-first, provenance-aware Skills usable by local and external agents.

Target package:
- `SKILL.md`
- optional `references/`
- optional `assets/`
- optional trust-controlled `scripts/`

Required contracts: YAML frontmatter + Markdown body; local Skill registry default authority; built-in/custom/imported normalization; hashes/provenance/source revision; bounded safe imports; explicit trust/tool permissions; Skills never expand user intent or bypass Rules/Scope Intelligence; immutable source plus per-run staging; optional remote routing only; Context Engine v2 budget integration.

## Build 73 — Agent Sandbox / Shadow Worktree ⏳

Disposable isolated workspace for external agents, no authoritative project credentials inside the sandbox, canonical diff import, sensitive-file filtering, escape/link defenses, controlled teardown and authoritative Decrypter write path.

## Build 74 — Multi-Agent Runtime UI + Native Sessions ⏳

Runtime picker, health/model/capabilities, native-session metadata and explicit switching. Decrypter task identity remains authoritative and switching runtimes cannot replay old writes or stale approvals.

## Build 75 — Universal Agent Bench / External-Agent Hardening ⏳

Final adversarial phase for malformed actions, digest mismatch, stale approvals, unauthorized file actions, credential persistence, sandbox escape, runtime crashes, session mismatch/replay, prompt transport abuse, Tool Runtime bypass, cross-agent scope creep, provider revocation during active work and zero paid/remote fallback.

## Final cumulative homologation after Build 75

Run the user-controlled Chrome/provider suite once Builds 71→75 are cumulatively green: callback UI, project mapping, approved frontend mutation, approved backend mutation, runtime/session behavior, GitHub revocation fail-closed, Supabase revocation fail-closed and final secret/storage inspection.

## Release gate

No build in this roadmap authorizes merge to `main`, OTA metadata, GitHub Release, store publication or production rollout. Release requires Builds 71→75 green, final browser/provider homologation and separate explicit user authorization.
