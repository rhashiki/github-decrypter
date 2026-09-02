# GitHub Decrypter Monorepo Foundation

Build 6 establishes the physical repository topology only. It does not implement the later Studio, daemon, protocol, Git runtime, AI provider, preview or agent features.

## Workspace manager

- pnpm workspaces are the canonical JavaScript/TypeScript workspace mechanism.
- the repository root owns the shared TypeScript compiler policy.
- Node.js 22+ is the baseline for development/CI during the pre-V1 Builds.

## Applications

```text
apps/
  studio/      future React + TypeScript + Vite PWA visual authority
  extension/   future lightweight Chrome MV3 GitHub launcher/bridge
  local/       future durable local runtime/daemon authority
```

At Build 6 these are intentionally dependency-free TypeScript placeholders. Their presence defines ownership boundaries; it does not activate features scheduled for later Builds.

## Domain packages

```text
packages/
  ui/
  protocol/
  shared/
  git/
  workspace/
  chat/
  plan/
  build/
  preview/
  context/
  tools/
  scope/
  ai/
```

Each package has a unique `@github-decrypter/*` identity and a TypeScript boundary. Build 6 does not move inherited engines into these packages yet. Migration happens only when the owning roadmap Build introduces or refactors that domain.

## Legacy migration quarantine

The inherited top-level `core/`, `background/`, `content/`, `runtime/` and related source trees remain migration inputs. They are not the final topology and they are not reactivated by Build 6.

Rules:

1. New apps may not directly bind themselves to inherited browser/runtime roots merely to make a demo work.
2. A legacy engine moves only with an explicit destination and owning Build.
3. Browser service-worker/content lifetime never becomes durable execution authority.
4. The monorepo skeleton must stay compilable before features are layered on top.
5. Third-party code reuse follows the provenance/source-mining policy already frozen in Build 4.

## Build ownership sequence

- Build 7: Shared Protocol starts filling `packages/protocol`.
- Build 8: Central Event Bus introduces the event contract/topology.
- Build 9: Architecture Guardian enforces architecture boundaries.
- Build 10+: `apps/local` becomes the durable runtime authority.
- Build 25+: `apps/extension` receives GitHub launcher behavior.
- Build 27+: `apps/studio` receives React/Vite Studio behavior.

Until those Builds land, placeholder packages must not impersonate those capabilities.
