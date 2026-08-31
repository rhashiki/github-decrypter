# Lovable Decrypter v2.6 — Local-First AI Roadmap

Status baseline: Build 69 — DecrypterBench v2 / Hardening is the current homologation baseline. Builds 60→69 are implemented; release/OTA remains separately unauthorized.

## Product invariants

1. **No paid GPU server is required.** Local inference is the default and authoritative path.
2. **No commercial token quota is required.** Technical context-window/RAM/VRAM limits still exist and are handled by Context Packs instead of provider quotas.
3. **Work must survive model/runtime interruption.** Operations are journaled and checkpointed outside the LLM.
4. **No automatic paid-AI fallback.** Remote providers are opt-in only and must never be silently selected when local inference is unavailable.
5. **Human edits outrank previous AI edits.** Manual user changes become durable context and are protected from accidental regression.
6. **Writes are fail-closed.** Read-only tools may run automatically; mutating tools require scope checks and the established approval/trust path.
7. **Hardening is executable.** Security and continuity guarantees must be represented by adversarial CI cases, not documentation alone.

## Build 60 — Local Model Runtime ✅

Ollama/vLLM + Qwen, authenticated OpenAI-compatible local gateway, worker registration/health, pool contract, fail-closed zero-cost policy and physical-host homologation probe. `runtime/decrypter-local` remains outside the browser package.

## Build 61 — Tool Runtime / Coding Tools ✅

Provider-neutral Tool Registry, repository read/list/grep, patch preview/application, Git diff, capability-gated diagnostics/LSP, Operation Journal and change origins. Reads may execute automatically; writes remain fail-closed behind approval/scope.

## Build 62 — MCP Core + MCP Trust Gateway ✅

Native MCP transport with server identity, authentication, allowlists, Scope Lock, explicit write approval, one-shot write tickets and Operation Journal integration. Unknown/untrusted capabilities fail closed.

## Build 63 — Curated MCP Marketplace ✅

Controlled MCP catalog for GitHub, Supabase, code/workspace, memory/context, security and observability. Entries carry provenance, permissions, trust/write capabilities and revocation state. Browser-incompatible stdio entries remain bridge-required rather than pretending support.

## Build 64 — Context Engine v2 ✅

Budgeted minimal Context Packs from relevant code, Git history, schemas/signals, Rules, Skills, Impact Maps, docs, Operation Journal, diagnostics and recent manual edits. Raw repetitive keystrokes are not persisted or sent as context events.

## Build 65 — Scope Intelligence v2 + Human Intent ✅

Request → plan → diff comparison, unauthorized-file/action detection, broad-rewrite detection, recent user-edit protection, soft/strong Human Intent Locks and precedence `USER_EDIT > PREVIOUS_AI_EDIT`. Scope is re-evaluated immediately before writes.

## Build 66 — Smart Undo/Redo + Reversible Operations ✅

Git-reconstructed BASE / OPERATION / CURRENT states, operation inversion, three-way hunk merge, later manual-edit preservation, symmetric Redo, preview-before-write, one-shot HEAD-locked confirmation and explicit destructive replace-target/cascade modes. Conflicting manual changes are never silently discarded.

## Build 67 — Continuity Engine ✅

Durable local task/step state machine with leases, idempotency keys, checkpoints and restart recovery. Read/inference steps may resume. Writes with unknown outcome enter `verification_required`; retry requires proof from Operation Journal and/or pre-write Git HEAD. Raw prompts/model outputs/file contents are not stored in Continuity state.

## Build 68 — Local Agent Orchestrator + Model Router ✅

Browser-side local-only coding loop using `decrypter-local` directly. Default local routing is `qwen3-coder:30b → qwen2.5-coder:14b → qwen2.5-coder:7b`, with health/pressure-aware local degradation. No paid/remote fallback exists inside Local Model Router or Local Agent Orchestrator.

The loop integrates Context Engine → local inference → provider-neutral tools → exact proposal digest → explicit human write approval → fresh Scope/Human Intent evaluation → Tool Runtime + Continuity → Git diff → capability-gated diagnostics → repair iteration. Runtime token is session-only and durable orchestration state contains digests/metadata rather than raw reasoning payloads.

## Build 69 — DecrypterBench v2 / Hardening ✅

**Goal:** validate and adversarially harden the complete local-first stack before any release decision.

Implemented gates:
- Repository path traversal/canonicalization: absolute paths, URI-like paths, control characters, dot segments, empty segments, `.git` case variants and percent-encoded transformations.
- Sensitive-path blocklist regression.
- Stale blob and ambiguous patch rejection.
- Scope-creep extra-file and broad-rewrite attacks.
- Strong Human Intent lock and explicit-path authority tests.
- Smart Undo preservation when manual edits are outside the target hunk and conflict when they overlap it.
- Local-agent SHA-256 proposal tamper detection.
- MCP insecure/credential/query/fragment endpoint attacks.
- MCP write ticket exact binding and one-shot consumption.
- Continuity inference crash/resume, ambiguous-write fail-closed retry and expired write-lease recovery.
- Local model large→medium→small routing, pressure degradation and total outage with `LOCAL_MODEL_UNAVAILABLE` rather than remote/paid fallback.
- Static zero-paid/remote-fallback regression against the local runtime/router/orchestrator.
- Deterministic Lovable ↔ Local Agent ↔ GitHub ↔ Supabase integration contract plus cumulative Build 48→69 regression gates.

Build 69 also hardens the central repository path canonicalizer used by coding/write primitives. Benchmarks, tests, docs, runtime and Supabase sources remain excluded from the extension runtime package.

## Authority model

```text
User instruction
  > explicit user manual edit / explicit approval
  > Scope Lock + Human Intent Lock
  > authoritative project state
  > current AI plan
  > historical AI output
```

The LLM is never the source of truth for task continuity. The Decrypter runtime owns operation state, tool results, checkpoints and change provenance.

## Post-roadmap gate

Build 69 closes the v2.6 local-first AI implementation roadmap, but **does not authorize merge to `main`, OTA metadata, GitHub Release, store publication or production rollout**. Those remain separate release decisions after homologation evidence is reviewed.
