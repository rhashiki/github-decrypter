# Lovable Decrypter v2.6 — Local-First AI Roadmap

Status baseline: **Build 70 — Account Integration Gate** is the current integration baseline. Builds 60→69 are fully implemented and hardened; Build 70 core is implemented and the real GitHub App + Supabase OAuth owner bootstrap has been validated end-to-end. Build 70 still has explicit production-closeout items before it can be considered release-ready. Merge to `main`, OTA metadata, GitHub Release, store publication and production rollout remain separately unauthorized.

## Product invariants

1. **No paid GPU server is required.** Local inference is the default and authoritative path.
2. **No commercial token quota is required.** Technical context-window/RAM/VRAM limits still exist and are handled by Context Packs instead of provider quotas.
3. **Work must survive model/runtime interruption.** Operations are journaled and checkpointed outside the LLM.
4. **No automatic paid-AI fallback.** Remote providers are opt-in only and must never be silently selected when local inference is unavailable.
5. **Human edits outrank previous AI edits.** Manual user changes become durable context and are protected from accidental regression.
6. **Writes are fail-closed.** Read-only tools may run automatically; mutating tools require scope checks and the established approval/trust path.
7. **Hardening is executable.** Security and continuity guarantees must be represented by adversarial CI cases, not documentation alone.
8. **Project mutation requires both official account integrations.** After Decrypter login, GitHub App + authorized repository and Supabase OAuth + authorized project are mandatory and remotely revalidated before writes.
9. **External agents never become write authority.** Any current or future agent may analyze and propose, but authoritative mutation remains behind Decrypter Scope Intelligence, Human Intent, approval, Patch Engine, Continuity and Operation Journal.
10. **Provider secrets remain server-side.** GitHub private keys/installation tokens and Supabase OAuth client/refresh secrets never become durable extension state.

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

## Build 70 — Account Integration Gate 🟡 Core complete / production closeout

**Goal:** make GitHub and Supabase account authorization part of the authoritative project-mutation boundary rather than an optional UI preference.

### Implemented contracts

- After Decrypter KEY/device login, the extension requires both official integrations before project mutation.
- GitHub requires the Lovable Decrypter GitHub App to be configured, installed, connected and the current repository to be explicitly authorized/mapped.
- Supabase requires the Lovable Decrypter OAuth App to be configured, the user account connected, required scopes granted and the current Supabase project explicitly authorized/mapped.
- A blocking onboarding gate reuses the existing GitHub/Supabase integration screens; it does not ask for PATs, service-role keys or database passwords.
- Production service-worker boot installs a mandatory remote integration write guard before Guarded Commit.
- Every Git `atomicCommit`, including legacy branch/PR flows, revalidates provider state and fails closed if the account guard is missing, revoked, stale, ambiguous or mapped to a different repository.
- The extension stores only mapping metadata. GitHub installation tokens/private keys and Supabase OAuth client/refresh secrets remain server-side/Vault.
- App bootstrap is owner-only. Ordinary users only authorize their own GitHub/Supabase accounts and choose the resources they grant to the Decrypter.
- Supabase scope normalization handles providers that omit the `scope` field from token responses without weakening the required-scope contract.

### Real-world bootstrap evidence — validated

- Global **Lovable Decrypter GitHub App** registered manually and backend configuration stored.
- GitHub private key stored in Vault; the live bootstrap exposed a PKCS#1/PKCS#8 compatibility issue and the current key was normalized safely server-side.
- Real GitHub App installation reconciled successfully and an explicitly selected repository was enumerated with `contents:write`, `workflows:write` and `metadata:read`.
- Global **Lovable Decrypter Supabase OAuth App** registered manually and backend configuration stored.
- Real OAuth authorization completed successfully, refresh token persisted in Vault and the Management API returned two authorized projects.
- Required Supabase scopes are persisted canonically when the provider omits `scope` in the token response.

### Build 70 production closeout — mandatory before release

1. **Permanent GitHub key compatibility:** make `ld-github-app` accept both PKCS#1 (`RSA PRIVATE KEY`) and PKCS#8 (`PRIVATE KEY`) without requiring one-time manual normalization.
2. **OAuth/callback UX:** replace raw Edge Function HTML exposure with a stable HTTPS success/error surface that renders correctly, notifies the extension and closes/re-focuses the popup safely.
3. **Project mapping E2E:** validate Lovable project → GitHub owner/repo/branch + Supabase `projectRef` mapping from the actual extension UI.
4. **Frontend mutation E2E:** read → propose → approve → write → diff → GitSync/preview against an authorized repository.
5. **Backend mutation E2E:** read schema → propose migration/backend change → approve → apply only to the mapped authorized Supabase project.
6. **Revocation fail-closed:** revoke GitHub installation/repository access and Supabase authorization separately and prove writes become unavailable immediately.
7. **OAuth refresh rotation:** test Supabase refresh-token rotation through the production runtime and prove the newest refresh token is persisted before the old token becomes unusable.
8. **No-secret persistence proof:** explicitly test that GitHub private key/installation token, Supabase client secret/refresh token and service-role credentials never enter `chrome.storage.local` or project files.
9. **Build 70 cumulative CI:** rerun Builds 48→70 + DecrypterBench v2 + release-preflight on the final closeout SHA.

---

# Next Phase — Universal Agent Control Plane

The next phase does **not** replace the Decrypter security/runtime core. It makes the agent itself interchangeable while preserving the Decrypter as the authority layer.

```text
External / Local Agent
        ↓ proposes
Decrypter Trust Boundary
├── Context Engine v2
├── Scope Intelligence v2
├── Human Intent
├── Approval + proposal digest
├── Patch Engine / Tool Runtime
├── Continuity Engine
├── Smart Undo/Redo
└── Operation Journal
        ↓
authoritative write
```

## Build 71 — Universal Agent Runtime Registry ⏳

**Goal:** allow the Decrypter to discover, validate and orchestrate interchangeable coding-agent runtimes without giving any runtime direct authority over the real project.

Planned contracts:
- Introduce `DecrypterAgentRuntimeDef` as a data-driven runtime definition.
- Runtime discovery and availability probing.
- Version detection and compatibility policies.
- Authentication/session probes without leaking credentials into prompts or durable logs.
- Model discovery where supported.
- Capability normalization (`read`, `propose`, `diagnostics`, native sessions, browser/terminal/files, etc.).
- Stream/event normalization across heterogeneous agent outputs.
- Cancel, timeout, inactivity watchdog and first-output timeout.
- Native resume capability declaration.
- Transport support: HTTP, CLI, stdio and ACP where the host/runtime permits it.
- Prompt transport guard: argv byte budgets, Windows command-line limits, stdin/file preference, `.cmd/.bat` quoting and environment-expansion protection.

Initial adapters:
1. `decrypter-local`
2. OpenHands Agent Server
3. Codex CLI
4. OpenCode
5. Aider

**Authority rule:** an external agent may inspect an isolated context and produce a proposal/diff, but final writes always pass through Decrypter approval, Scope Intelligence, Human Intent, Patch Engine and Continuity.

## Build 72 — Portable Skills v2 ⏳

**Goal:** replace the current cloud-centric Skills routing dependency with a portable, local-first, provenance-aware Skills protocol that can also be consumed by external agent runtimes.

Target format:

```text
skill/
├── SKILL.md
├── references/
├── assets/
└── scripts/        # optional; trust-policy controlled
```

Planned contracts:
- YAML frontmatter + Markdown body.
- Local Skill registry as the default authority.
- Built-in, custom and imported Skills under one normalized schema.
- GitHub import with size limits, path traversal protection and private-network restrictions where remote retrieval exists.
- Content hash, provenance, source revision and optional signature metadata.
- Trust levels and explicit tool permissions per Skill.
- Scope-aware read/write capabilities; a Skill never expands user intent or bypasses Project Rules/guardrails.
- Per-run staging copy instead of mutating the source Skill.
- Compatibility with the broader `SKILL.md`/Agent Skills convention where safe.
- Remove mandatory Gemini/cloud routing from the current Skills Engine; remote routing remains optional, explicit and never required for local execution.
- Context budget integration with Context Engine v2.

## Build 73 — Agent Sandbox / Shadow Worktree ⏳

**Goal:** allow powerful external CLI/agent runtimes to operate without ever receiving write access to the authoritative project workspace.

Target flow:

```text
Authoritative Repository
        ↓
Shadow Worktree / isolated sandbox
        ↓
External Agent
        ↓
proposal + diff
        ↓
Decrypter imports diff
        ↓
Scope Intelligence + Human Intent
        ↓
Approval
        ↓
Patch Engine / Guarded Commit
        ↓
Authoritative Repository
```

Planned contracts:
- Per-task disposable Git worktree or equivalent isolated workspace.
- Optional container/process isolation for runtimes that require terminal/file access.
- No direct authoritative Git credentials inside the agent sandbox.
- Read-only or narrowly scoped materialization of context/secrets.
- Diff import with path canonicalization and sensitive-file filtering.
- Detect sandbox escape attempts, symlink/hardlink tricks and writes outside the staged root.
- Safe teardown and artifact retention policy.
- Existing `core/shadow-build.js` remains a validation primitive; this Build adds stronger workspace/process isolation specifically for external agents.

## Build 74 — Multi-Agent Runtime UI + Native Sessions ⏳

**Goal:** make runtime selection, health, capabilities and session continuity visible and controllable from the Decrypter UI.

Planned UI/state:
- Runtime picker: `Decrypter Local`, OpenHands, Codex CLI, OpenCode, Aider, etc.
- Runtime status and health.
- Active model where available.
- Native session identifier/state.
- Normalized capabilities.
- Last task / current task.
- Availability/degraded/unavailable reason.
- Explicit runtime switching without silently changing write authority or provider cost policy.

Native session bridge integrated with Build 67 Continuity:

```ts
NativeAgentSession {
  taskId
  runtimeId
  strategy:
    | "none"
    | "cli-resume"
    | "stream-capture"
    | "acp-session-load"
    | "remote-conversation"
  nativeSessionId
  createdAt
  lastVerifiedAt
}
```

Rules:
- Decrypter task identity remains authoritative even if the native agent session is lost.
- A native resume token/session ID is metadata, not permission to replay writes.
- Runtime switching must not duplicate prior writes or silently replay old proposals.
- Context Engine decides what context is re-materialized; native sessions do not override Context Packs.

## Build 75 — Universal Agent Bench / External-Agent Hardening ⏳

**Goal:** extend DecrypterBench from a local-agent hardening suite into a universal-agent trust-boundary benchmark before any multi-agent release.

Mandatory adversarial coverage:
- malformed/repeated invalid model JSON/actions;
- command/proposal digest mismatch;
- stale approval after Git HEAD or manual user edit;
- create/delete/rename intent outside the approved plan;
- runtime token or external-agent credential entering durable extension storage;
- sandbox/worktree escape and path traversal;
- symlink/hardlink attacks;
- external runtime disconnect/crash during read, proposal and write-adjacent phases;
- native-session resume mismatch;
- proposal replay across task/runtime/session boundaries;
- ambiguous external-agent side effects;
- prompt transport overflow/quoting/environment expansion attacks;
- external agent attempting to bypass Tool Runtime or write directly to the authoritative repo;
- cross-agent scope creep after switching runtimes;
- revoked GitHub/Supabase authorization during an active agent task;
- proof that no runtime can enable paid/remote fallback inside the local-first path without explicit user configuration.

Release condition for the Universal Agent phase: cumulative CI + DecrypterBench must prove that changing the agent changes the **brain**, never the Decrypter authority model.

## Authority model

```text
User instruction
  > explicit user manual edit / explicit approval
  > Scope Lock + Human Intent Lock
  > authoritative project state
  > current AI plan
  > historical AI output
```

The LLM or external agent is never the source of truth for task continuity. The Decrypter runtime owns operation state, tool results, checkpoints, resource mappings and change provenance.

## Release gate

The real GitHub App and Supabase OAuth App owner bootstrap is now complete, but this **does not authorize merge to `main`, OTA metadata, GitHub Release, store publication or production rollout**.

Before any v2.6 production release:
- finish every Build 70 production-closeout item;
- rerun cumulative CI on the final Build 70 SHA;
- review the final GitHub/Supabase permission surface and callback UX;
- explicitly authorize the release action.

Builds 71→75 form the next Universal Agent Control Plane phase and are independently gated; planning them here does not authorize their implementation or release.