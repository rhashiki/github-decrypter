# Lovable Decrypter v2.6 — Local-First AI Roadmap

Status baseline: Build 68 is the current Local Agent Orchestrator + Model Router baseline. Build 69 — DecrypterBench v2 / Hardening is next.

## Product invariants

1. **No paid GPU server is required.** Local inference is the default and authoritative path.
2. **No commercial token quota is required.** Technical context-window/RAM/VRAM limits still exist and are handled by Context Packs instead of provider quotas.
3. **Work must survive model/runtime interruption.** Operations are journaled and checkpointed outside the LLM.
4. **No automatic paid-AI fallback.** Remote providers are opt-in only and must never be silently selected when local inference is unavailable.
5. **Human edits outrank previous AI edits.** Manual user changes become durable context and are protected from accidental regression.
6. **Writes are fail-closed.** Read-only tools may run automatically; mutating tools require scope checks and the established approval/trust path.

## Build 60 — Local Model Runtime

**Goal:** close the real local inference path with Ollama/vLLM + Qwen, health checks, worker pool, fail-closed behavior and the stable `decrypter-local` model contract.

**Current baseline:** implemented with Ollama-first runtime, authenticated OpenAI-compatible gateway, worker registration/health, zero-cost policy and executable physical-host homologation probe. Build 68 extends this contract with multiple configurable local model tiers while keeping `runtime/decrypter-local` outside the browser package.

## Build 61 — Tool Runtime / Coding Tools

**Goal:** give Decrypter AI a controlled, provider-neutral tool bus.

Scope:
- Tool Registry and typed request/result envelopes.
- Repository file read.
- File listing with glob-style matching.
- Text search/grep.
- Patch preview and safe patch application primitives.
- Git diff/status primitives.
- Diagnostics adapter contract.
- LSP adapter contract (capability-gated; no fake LSP when unavailable).
- Operation Journal foundation for every tool invocation.
- Change origin metadata: `ai`, `user`, `undo`, `redo`, `tool`, `formatter`, `lsp`, `git`, `external`.
- Read tools can execute without write approval; write tools are fail-closed and must pass Scope Lock/approval.

Non-goals:
- MCP transport itself (Build 62).
- Smart semantic undo/redo UI (Build 66).

## Build 62 — MCP Core + MCP Trust Gateway

**Goal:** native MCP support without giving arbitrary servers implicit authority.

Scope:
- MCP client/transport abstraction.
- Authentication and server identity.
- Per-tool permissions and allowlist.
- Scope Lock enforcement.
- Explicit approval before writes/destructive actions.
- Audit trail mapped into the Operation Journal.
- Fail-closed behavior for unknown/untrusted MCP capabilities.

## Build 63 — Curated MCP Marketplace

**Goal:** controlled catalog of approved MCP integrations.

Initial categories:
- GitHub.
- Supabase.
- Code/workspace.
- Memory/context.
- Security.
- Observability.

Every catalog entry includes provenance, requested permissions, trust level, write capabilities and revocation state.

## Build 64 — Context Engine v2

**Goal:** create the smallest useful Context Pack for each task instead of relying on huge prompts.

Sources:
- Relevant code and symbols.
- Git history/diff.
- Supabase schemas where applicable.
- Rules and Skills.
- Impact Maps.
- Project documentation.
- Operation Journal summaries.
- Recent manual user edits.
- Previous failures/diagnostics relevant to the current task.

Manual edits are committed into context after debounce/coalescing as `USER_EDIT_COMMITTED` events. Raw repetitive keystrokes are not sent to the model.

## Build 65 — Scope Intelligence v2 + Human Intent

**Goal:** compare request → plan → tool calls → diff and stop scope creep.

Scope:
- Detect unauthorized files/regions/actions.
- Compare planned and actual modifications.
- Detect accidental reversal of recent user edits.
- Human Intent Locks: `soft` and `strong`.
- Default precedence: `USER_EDIT > PREVIOUS_AI_EDIT`.
- Require explicit user authority to overwrite protected manual intent when it is not required by the current request.

## Build 66 — Smart Undo/Redo + Reversible Operations

**Goal:** move from snapshot undo to operation-based inversion.

**Current baseline:** implemented with Git-reconstructed `BASE / OPERATION / CURRENT` states, exact operation inversion, three-way hunk merge, default preservation of later manual edits, symmetric Redo, preview-before-write, one-shot HEAD-locked confirmation tickets, approved-agent history bridge, and explicit destructive `replace-target` / `cascade` paths. Conflicting manual changes are never silently discarded. Cascade restores the whole branch tree to the snapshot before the target operation and is intentionally separated by a destructive warning/confirmation.

When a target AI operation has later user edits, offer safe choices such as:
- Undo only the AI operation while preserving later user edits.
- Three-way merge and preserve manual intent.
- Undo the AI operation and all later dependent changes (explicit destructive warning).
- Review proposed result/hunks before applying.
- Cancel.

Redo uses the symmetric policy. Conflicting manual changes are never silently discarded.

Core components:
- ChangeTracker.
- OperationJournal.
- PatchEngine.
- UserEditDetector.
- ThreeWayMerge.
- ConflictResolver.
- UndoEngine / RedoEngine.
- ContextBridge.

## Build 67 — Continuity Engine

**Goal:** make work independent of one LLM request/process lifetime.

**Current baseline:** implemented as a durable local task/step state machine in the Decrypter runtime. Every resumable step has an idempotency key, bounded attempts and a lease. Service-worker/browser restarts recover expired leases. Read/inference steps can resume from the last verified step. A write whose outcome becomes unknown is moved to `verification_required` and cannot be repeated until the runtime proves either that the operation already completed or that no write happened.

Write crash verification uses two independent signals:
- Operation Journal correlation by `taskId + idempotencyKey` to recover a confirmed `operationId` / `commitSha`.
- A pre-write Git HEAD checkpoint. If no successful journal entry exists and HEAD is unchanged, the write is proven absent and retry becomes safe. If HEAD changed without conclusive correlation, the engine remains fail-closed.

Scope:
- Durable operation journal integration.
- Step checkpoints.
- Resumable task state machine.
- Worker/model crash recovery.
- Idempotency keys for tool steps.
- Resume from last verified step rather than restarting the task.
- Compact state reconstruction for the local model.
- One-minute lease recovery alarm plus recovery on service-worker/browser startup.
- No raw prompt, raw model-output or raw file-content persistence in the Continuity state.

## Build 68 — Local Agent Orchestrator + Model Router

**Goal:** sustained coding workflows using local models without a commercial token meter.

**Current baseline:** implemented as a browser-side local-only orchestration layer that can call the authenticated `decrypter-local` loopback runtime directly. It no longer requires a paid model provider or a backend inference request to execute the local agent loop.

Scope implemented:
- Direct authenticated loopback inference through `decrypter-local`.
- Session-only local runtime token; no durable token persistence.
- Configurable local model tiers with default degradation `large → medium → small`.
- Local model discovery and health/pressure-aware routing.
- No paid fallback and no remote fallback inside Local Model Router / Local Agent Orchestrator.
- Context Engine v2 before reasoning.
- Provider-neutral read tools executed automatically.
- Strict one-action-per-turn local agent contract.
- Exact proposal-digest binding before any mutating tool.
- Human approval required for every write proposed by the local agent.
- Fresh Scope Intelligence v2 + Human Intent evaluation at approval time.
- Tool Runtime + Build 67 idempotency for protected writes.
- Git diff verification after confirmed writes.
- Capability-gated diagnostics; unavailable diagnostics are reported rather than fabricated.
- Repair iterations with a bounded maximum, independent of commercial token billing.
- Durable orchestration metadata/digests plus ephemeral in-session reasoning state. After the ephemeral state disappears, rehydration requires the original user command and verifies its digest before continuing.

Default local tiers:
- Large coding/reasoning: `qwen3-coder:30b`.
- Medium coding: `qwen2.5-coder:14b`.
- Small routing/lightweight work: `qwen2.5-coder:7b`.

The Local Agent never gains implicit write authority from a plan. A proposed write is normalized and hashed; the user approves that exact digest, and the runtime re-evaluates current Git state, Scope Intelligence and Human Intent before creating a short-lived transaction for the Tool Runtime.

## Build 69 — DecrypterBench v2 / Hardening

**Goal:** validate the complete local-first agent stack before release.

Required suites:
- Tool authorization and path traversal tests.
- Patch/merge conflict tests.
- Manual-edit preservation tests.
- Undo/redo round-trip tests.
- Runtime crash/resume tests.
- Local model outage/degradation tests.
- Model-router adversarial and pressure tests.
- Local-agent proposal-digest tamper tests.
- MCP trust/permission tests.
- Scope-creep adversarial tests.
- No-paid-fallback regression tests.
- End-to-end Lovable ↔ GitHub ↔ Supabase project workflows.

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
