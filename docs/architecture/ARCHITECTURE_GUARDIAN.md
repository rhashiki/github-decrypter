# Architecture Guardian

Build 9 introduces a fail-closed architecture policy gate for GitHub Decrypter. Build 10 extends it to application-specific dependency/platform authority as the Local Runtime becomes a real Node.js process.

## Authority stack

The Guardian treats the following as product/architecture authorities:

1. Product Constitution V1;
2. Constitutional Amendment 001 — North Star Authority;
3. Constitutional Amendment 004 — Architectural Integrity & Heimdall;
4. Constitutional Amendment 005 — Complete Product Generation;
5. Constitutional Amendment 006 — Local Sovereignty & Zero Marginal Vortex Compute;
6. Constitutional Amendment 007 — Specialist Intelligence Layer;
7. North Star Manifesto;
8. Canonical V1 Roadmap;
9. North Star Roadmap Mapping;
10. Frozen V1 Scope;
11. Non-Goals V1;
12. Global Definition of Done;
13. RFC Policy.

The machine-readable policy lives at:

`architecture.guardian.json`

The core executable engine lives at:

`scripts/architecture-guardian.mjs`

Application-specific policy enforcement lives at:

`scripts/architecture-guardian-apps.mjs`

`pnpm run guardian` executes both layers.

## Heimdall and controlled architectural evolution

Constitutional Amendment 004 separates three responsibilities that must never collapse into one another:

- **Leonardo** proposes and deliberately evolves architecture;
- **Heimdall — Architecture Guardian** performs architectural-integrity/conformance analysis as the tenth canonical specialist from Build 64 onward;
- the deterministic **Architecture Guardian** remains the repository-level machine-enforced gate introduced by Build 9.

Heimdall is therefore an agent-facing architectural specialist, not a replacement for this Guardian engine and not an independent security principal.

The transition is intentionally staged:

- before Build 64, the historical Build 58 Agent Runtime revision remains canonical with nine specialists and Heimdall must not be inserted early;
- at Build 64 and later, repository policy requires the canonical runtime transition to include Heimdall as specialist number 10;
- Viktor remains outside the agent registry at every stage.

The governing invariant is:

> **Architecture may evolve, but it must never evolve accidentally.**

The future orchestration surface must preserve explicit architecture changes, Architecture Contract / Architecture Ledger consumption, Refactor Before Feature when module responsibility is exceeded, and pre-change/post-change architectural-conformance review.

## Local sovereignty and economic architecture

Constitutional Amendment 006 makes economic architecture a protected technical concern rather than a pricing note.

The Guardian requires the repository policy to preserve that:

- local compute is the canonical Vortex intelligence path;
- core intelligence has no mandatory external AI provider;
- Vortex-managed paid inference and paid fallback are forbidden for canonical core execution;
- variable commercial inference may not be subsidized by Vortex Inc. as the operating model;
- BYOK is architecturally allowed only as an optional, user-funded path;
- provider contracts keep external providers optional and user credentials user-owned;
- canonical AI/runtime source cannot introduce a pooled `VORTEX_AI_API_KEY`-style dependency.

This does not forbid ordinary remote services whose nature is remote, and it does not forbid an explicitly configured user-funded external provider. It prevents a future implementation shortcut from silently converting Vortex into a metered cloud-inference SaaS.

## Specialist Intelligence architecture

Constitutional Amendment 007 separates scalable specialist expertise from canonical agent authority.

The deterministic Guardian protects that:

- the canonical agent roster remains ten named agents unless explicitly amended;
- Viktor remains outside the agent registry;
- Specialist Profiles are not agents or principals;
- specialist profiles own no capability, approval, scope, tool, filesystem, database, Git, network, validation, architecture or release authority;
- Ramon remains the specialist-activation/orchestration owner;
- specialist selection/context must remain bounded rather than injecting the whole catalog;
- imported specialist profiles require provenance, license, version and validation metadata;
- external specialist catalogs may be imported by future owning Builds but may not become mandatory runtime dependencies;
- Specialist Intelligence remains local-first and may not require Vortex-paid inference.

This lets Vortex scale from a small canonical team to hundreds or thousands of domain methods without multiplying security principals or context cost.

## What the Guardian can enforce

The Guardian checks facts that can be proven from repository state:

- required authority documents still exist;
- North Star provenance hash remains recorded;
- principles P01–P22 remain represented;
- all 11 North Star roadmap blocks remain mapped;
- foundational apps/packages are not removed or renamed silently;
- `@github-decrypter/protocol` remains dependency-light and environment-neutral;
- `@github-decrypter/shared` remains environment-neutral and may depend only on the shared protocol at this stage;
- packages do not import applications;
- apps do not import other apps directly;
- new monorepo code does not reach directly into inherited `core/`, `background/`, `content/` or `runtime/` migration roots;
- active product surfaces do not reintroduce Lovable-specific authority endpoints;
- privileged extension, daemon and Studio authority cannot arrive before their roadmap Builds;
- guarded applications cannot silently gain undeclared internal/external dependencies;
- guarded applications cannot silently cross into a forbidden platform authority;
- workflows do not gain write/release authority without an explicit Guardian policy amendment;
- Build numbering remains integer and the policy stage matches the latest documented Build;
- the pre-V1 root package version tracks the active Build;
- Constitutional Amendment 004 remains present and mapped;
- Constitutional Amendment 006 remains present and its local-sovereignty / zero-marginal-compute invariants remain encoded;
- Constitutional Amendment 007 remains present and the ten-agent / non-authoritative Specialist Profile boundary remains encoded;
- Heimdall cannot enter the canonical registry before Build 64 and cannot be absent after the Build 64 transition;
- Viktor remains explicitly excluded from the canonical agent registry.

## Build 10 application guard

At Build 10, `@github-decrypter/local` is allowed to depend internally only on:

- `@github-decrypter/protocol`;
- `@github-decrypter/shared`.

It has no direct external runtime dependency yet; the HTTP server, lock and lifecycle use Node.js built-ins. The app guard also rejects browser authority such as `chrome.*`, `window.*`, `document.*`, `localStorage` and `indexedDB` inside `apps/local/src`.

Later Builds may explicitly amend these allowlists as their own scope introduces database, workspace, Git, tool, AI or other dependencies. The allowlist is intended to evolve deliberately, not freeze the Local Runtime at Build 10 forever.

## What the Guardian cannot prove automatically

The Guardian cannot fully decide whether a feature is philosophically aligned with the North Star. That requires review.

For that reason `.github/pull_request_template.md` includes the ten North Star questions and human-authority checks. CI validates the mechanical boundary; review validates intent.

## Phase gates

The policy currently encodes roadmap gates for:

- Local daemon authority: Build 10;
- Persistent Local Database ownership: Build 11;
- Durable Job Engine ownership: Build 12;
- Capability Security Model ownership: Build 15;
- extension activation: Build 25;
- React/Vite Studio authority: Build 27;
- release authority: Build 134.

A later Build may intentionally advance or amend a gate only as part of that Build's reviewed scope. Deleting the rule because implementation conflicts with it is not an acceptable fix.

## Legacy migration inputs

`core/`, `background/`, `content/` and `runtime/` remain inherited migration inputs. Build 10 does not delete them. The important boundary is that new `apps/*` and `packages/*` code cannot create a hidden dependency on those roots.

When a later Build migrates a modern engine, the engine should be moved/adapted into its owning package/runtime boundary rather than imported permanently from the legacy root.

## Workflow policy

All workflows remain read-only at Build 10. `writePermissionAllowlist` is empty.

A future Build requiring a write-capable CI workflow must explicitly:

1. own that authority in the roadmap;
2. update the Guardian policy;
3. document why the permission is necessary;
4. use least privilege;
5. preserve the product's explicit authorization rules for production-affecting actions.

## North Star governance

The North Star amendment does not authorize early implementation. It changes acceptance responsibility for the mapped Builds while preserving the 1–134 sequence.

Examples:

- Adaptive User Profile starts in Build 31 and gains learning adaptation in Build 108;
- voice belongs to Conversation/Attachment ownership;
- named agents belong to Agent Runtime/Orchestrator;
- Perception/Explore/Visual Mapping belong to Preview/Visual Builds;
- Interactive QA belongs to Validation/Testing Agent;
- Mentor/Explain This/Adaptive Explanation belong to Learning Mode.

See `docs/product/NORTH_STAR_ROADMAP_MAPPING.md` for the normative mapping.

## Execution

Local command:

```bash
pnpm run guardian
```

A violation produces a non-zero exit and a structured report with stable `AGxxx` codes.

Core warnings use `AGWxx` and do not fail CI unless a future policy promotes them to hard rules.

## Principle

The Architecture Guardian exists to ensure that a convenient shortcut in one Build cannot silently become the architecture of every Build that follows.
