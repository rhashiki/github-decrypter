# Architecture Guardian

Build 9 introduces a fail-closed architecture policy gate for GitHub Decrypter.

## Authority stack

The Guardian treats the following as product/architecture authorities:

1. Product Constitution V1;
2. Constitutional Amendment 001 — North Star Authority;
3. North Star Manifesto;
4. North Star Roadmap Mapping;
5. Frozen V1 Scope;
6. Non-Goals V1;
7. Global Definition of Done;
8. RFC Policy.

The machine-readable policy lives at:

`architecture.guardian.json`

The executable engine lives at:

`scripts/architecture-guardian.mjs`

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
- workflows do not gain write/release authority without an explicit Guardian policy amendment;
- Build numbering remains integer and the policy stage matches the latest documented Build;
- the pre-V1 root package version tracks the active Build.

## What the Guardian cannot prove automatically

The Guardian cannot fully decide whether a feature is philosophically aligned with the North Star. That requires review.

For that reason `.github/pull_request_template.md` includes the ten North Star questions and human-authority checks. CI validates the mechanical boundary; review validates intent.

## Phase gates

The policy currently encodes roadmap gates for:

- Local daemon authority: Build 10;
- extension activation: Build 25;
- React/Vite Studio authority: Build 27;
- release authority: Build 134.

A later Build may intentionally advance or amend a gate only as part of that Build's reviewed scope. Deleting the rule because implementation conflicts with it is not an acceptable fix.

## Legacy migration inputs

`core/`, `background/`, `content/` and `runtime/` remain inherited migration inputs. Build 9 does not delete them. The important boundary is that new `apps/*` and `packages/*` code cannot create a hidden dependency on those roots.

When a later Build migrates a modern engine, the engine should be moved/adapted into its owning package/runtime boundary rather than imported permanently from the legacy root.

## Workflow policy

All workflows remain read-only at Build 9. `writePermissionAllowlist` is empty.

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

Warnings use `AGWxx` and do not fail CI unless a future policy promotes them to hard rules.

## Principle

The Architecture Guardian exists to ensure that a convenient shortcut in one Build cannot silently become the architecture of every Build that follows.
