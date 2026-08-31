# Lovable Decrypter v2.6 — Local-First AI Roadmap

Status baseline: Build 75 — Universal Agent Bench / External-Agent Hardening is the current engineering baseline. Builds 60→75 are implemented with cumulative CI green. The Universal Agent Control Plane automated phase is complete. Build 70 provider-side validation is complete; the remaining gate is the final cumulative Chrome/provider homologation. Merge to `main`, OTA metadata, GitHub Release, store publication and production rollout remain separately unauthorized.

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
10. Security claims require executable adversarial CI plus final browser/provider homologation.

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

Adversarial gates cover repository path safety, path traversal, stale/ambiguous patches, scope creep, Human Intent, Undo/Redo conflicts, proposal tampering, MCP trust, Continuity and zero-cost policy. This roadmap does not authorize merge to `main`.

## Build 70 — Account Integration Gate ✅

Mandatory GitHub App + Supabase OAuth readiness, project mappings, remote write revalidation, GitHub key-format compatibility, callback bridge, canonical Supabase scopes, safe refresh rotation and no-secret durable settings are implemented. Live provider validation covered real GitHub permissions, temporary-branch create/delete and real Supabase OAuth database-write capability. Browser homologation remains part of the final cumulative test.

## Build 71 — Universal Agent Runtime Registry ✅

Registry `ld-agent-runtime-registry/1` supports `decrypter-local`, OpenHands Agent Server, Codex CLI, OpenCode and Aider. Every runtime is proposal-only (`writeAuthority:false`), process transports are bridge-required, HTTP/loopback probes are bounded, credentials are session-only, prompt transport is guarded and watchdogs cover first output/inactivity/total timeout. Final cumulative run: `33435818371`.

## Build 72 — Portable Skills v2 ✅

Portable `SKILL.md` packages are local-first with provenance/hash, bounded imports, path traversal/private-network defenses, immutable per-run staging and local routing (`portable-local-v2`). Legacy/cloud catalogs remain optional synchronization sources. Skills cannot expand user intent or gain write authority. Final cumulative run: `33439609216`.

## Build 73 — Agent Sandbox / Shadow Worktree ✅

Sandbox identity binds `taskId + runtimeId + baseHeadSha`; materialization rejects path traversal, `.git`, environment/credential files, secret key formats, symlinks, hardlinks, junctions and special files. External runtimes receive no authoritative GitHub/Supabase credentials. Imported diffs are canonicalized, bounded and digest-bound, and require fresh Scope Intelligence/Human Intent before write. Physical worktree creation remains honestly `bridge-required` under MV3. Final cumulative run: `33440231905`.

## Build 74 — Multi-Agent Runtime UI + Native Sessions ✅

Explicit runtime picker, health/model/capability state and native-session continuity metadata are implemented. Decrypter/Continuity `taskId` remains authoritative. Proposals bind digest + generation; runtime switching increments generation, clears the old proposal and invalidates prior approval. Task/runtime/session/generation mismatch and replay fail closed. Session state remains in `chrome.storage.session`; `replayAllowed:false`, `replayAuthority:false` and `writeAuthority:false`. Final promoted cumulative run: `33443366826`.

## Build 75 — Universal Agent Bench / External-Agent Hardening ✅

Schema: `ld-universal-agent-bench/1`.

The final automated adversarial suite exercises the real Builds 65→74 components. Final corrected benchmark result: **24/24 probes passed**.

Covered gates:
- malformed agent actions;
- sandbox path traversal and sensitive-path escape;
- symlink/hardlink/special-file attacks;
- stale base HEAD and stale approvals;
- cross-agent runtime mismatch;
- sandbox authority tampering / Tool Runtime bypass attempts;
- proposal digest mismatch;
- native-session generation mismatch and replay prevention;
- closed/crashed session resume rejection;
- unauthorized create/update/delete/rename and out-of-plan changes;
- `USER_EDIT > AI_EDIT` Human Intent locks;
- durable credential sanitization;
- Windows command/environment-expansion prompt transport attacks and prompt size bounds;
- external runtime event normalization without raw reasoning;
- all registered adapters remain proposal-only and non-authoritative;
- GitHub account/repository revocation fail-closed simulation;
- Supabase OAuth/scope revocation fail-closed simulation;
- real Local Model Router proof of `zeroCostApi:true`, `paidFallbackAllowed:false`, `remoteFallbackAllowed:false`.

Cumulative Builds 48→75, DecrypterBench v2, Universal Agent Bench and release-preflight passed on workflow run `33444039786` before this roadmap promotion.

## Final cumulative homologation — NEXT GATE

Run the user-controlled Chrome/provider suite on the final Build 75 branch:
- callback UI for GitHub and Supabase;
- Lovable project → GitHub repo + Supabase project mapping;
- runtime picker, probe/health and native-session UI;
- runtime switching with visible invalidation of previous approval/proposal;
- approved frontend mutation through agent → sandbox → diff → approval → authoritative Decrypter write;
- approved backend mutation through the Supabase OAuth mapping;
- GitHub revocation during active use → immediate fail-closed;
- Supabase revocation/scope loss during active use → immediate fail-closed;
- `chrome.storage.local` / `chrome.storage.session` inspection for credential leakage;
- final confirmation that external agents never bypass Scope Intelligence, Human Intent, Tool Runtime, Account Integration Gate or Guarded Commit.

## Release gate

No build in this roadmap authorizes merge to `main`, OTA metadata, GitHub Release, store publication or production rollout. Release requires the final browser/provider homologation above and separate explicit user authorization.
