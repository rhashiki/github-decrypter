# Lovable Decrypter v2.6 — Local-First AI Roadmap

Status baseline: Build 66 is the current Smart Undo/Redo + Reversible Operations baseline. Build 67 — Continuity Engine is next.

## Product invariants

1. **No paid GPU server is required.** Local inference is the default and authoritative path.
2. **No commercial token quota is required.** Technical context-window/RAM/VRAM limits still exist and are handled by Context Packs instead of provider quotas.
3. **Work must survive model/runtime interruption.** Operations are journaled and checkpointed outside the LLM.
4. **No automatic paid-AI fallback.** Remote providers are opt-in only and must never be silently selected when local inference is unavailable.
5. **Human edits outrank previous AI edits.** Manual user changes become durable context and are protected from accidental regression.
6. **Writes are fail-closed.** Read-only tools may run automatically; mutating tools require scope checks and the established approval/trust path.

## Build 60 — Local Model Runtime

**Goal:** close the real local inference path with Ollama/vLLM + Qwen, health checks, worker pool, fail-closed behavior and the stable `decrypter-local` model contract.

**Current baseline:** implemented with Ollama-first runtime, authenticated OpenAI-compatible gateway, worker registration/health, zero-cost policy and executable physical-host homologation probe.

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
- Long-running autonomous loop (Build 68).

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

Scope:
- Durable operation journal.
- Step checkpoints.
- Resumable task state machine.
- Worker/model crash recovery.
- Idempotency keys for tool steps.
- Resume from last verified step rather than restarting the task.
- Compact state reconstruction for the local model.

## Build 68 — Local Agent Orchestrator + Model Router

**Goal:** sustained coding workflows using local models without a commercial token meter.

Scope:
- Small/fast model routing for classification/context work.
- Coding/reasoning model routing for hard tasks.
- Local degradation path (large → medium → small local model) based on hardware health.
- No paid fallback.
- Plan → context → tools → diagnostics → repair loop.
- Stop conditions, iteration budgets based on safety/quality rather than paid-token quotas.

## Build 69 — DecrypterBench v2 / Hardening

**Goal:** validate the complete local-first agent stack before release.

Required suites:
- Tool authorization and path traversal tests.
- Patch/merge conflict tests.
- Manual-edit preservation tests.
- Undo/redo round-trip tests.
- Runtime crash/resume tests.
- Local model outage/degradation tests.
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
