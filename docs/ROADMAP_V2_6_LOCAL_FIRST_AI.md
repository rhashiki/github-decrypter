# Lovable Decrypter v2.6 — Local-First AI Roadmap

Status baseline: Build 70 — Account Integration Gate is the current post-hardening baseline. Builds 60→70 are implemented; release/OTA remains separately unauthorized.

## Product invariants

1. **No paid GPU server is required.** Local inference is the default and authoritative path.
2. **No commercial token quota is required.** Technical context-window/RAM/VRAM limits still exist and are handled by Context Packs instead of provider quotas.
3. **Work must survive model/runtime interruption.** Operations are journaled and checkpointed outside the LLM.
4. **No automatic paid-AI fallback.** Remote providers are opt-in only and must never be silently selected when local inference is unavailable.
5. **Human edits outrank previous AI edits.** Manual user changes become durable context and are protected from accidental regression.
6. **Writes are fail-closed.** Read-only tools may run automatically; mutating tools require scope checks and the established approval/trust path.
7. **Hardening is executable.** Security and continuity guarantees must be represented by adversarial CI cases, not documentation alone.
8. **Project mutation requires both official account integrations.** After Decrypter login, GitHub App + authorized repository and Supabase OAuth + authorized project are mandatory and remotely revalidated before writes.

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

Implemented adversarial gates for path traversal, stale/ambiguous patches, Scope/Human Intent attacks, Smart Undo conflicts, proposal tampering, MCP trust/tickets, Continuity recovery, local model degradation/outage and zero paid/remote fallback. Build 69 closed the original local-first AI roadmap and remains the cumulative hardening baseline.

## Build 70 — Account Integration Gate ✅

**Goal:** make GitHub and Supabase account authorization part of the authoritative project-mutation boundary rather than an optional UI preference.

Implemented contracts:
- After Decrypter KEY/device login, the extension requires both official integrations before project mutation.
- GitHub requires the Lovable Decrypter GitHub App to be configured, installed, connected and the current repository to be explicitly authorized/mapped.
- Supabase requires the Lovable Decrypter OAuth App to be configured, the user account connected, required scopes granted and the current Supabase project explicitly authorized/mapped.
- A blocking onboarding gate reuses the existing GitHub/Supabase integration screens; it does not ask for PATs, service-role keys or database passwords.
- Production service-worker boot installs a mandatory remote integration write guard before Guarded Commit.
- Every Git `atomicCommit`, including legacy branch/PR flows, revalidates provider state and fails closed if the account guard is missing, revoked, stale, ambiguous or mapped to a different repository.
- The extension stores only mapping metadata. GitHub installation tokens/private keys and Supabase OAuth client/refresh secrets remain server-side/Vault.
- App bootstrap remains owner-only; ordinary users only authorize their own GitHub/Supabase accounts and choose resources they grant to the Decrypter.

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

Build 70 extends the homologated v2.6 baseline but **does not authorize merge to `main`, OTA metadata, GitHub Release, store publication or production rollout**. Those remain separate release decisions after homologation evidence and the one-time external GitHub App / Supabase OAuth App bootstrap are reviewed.
