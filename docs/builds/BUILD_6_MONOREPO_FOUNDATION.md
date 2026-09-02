# Build 6 — Monorepo Foundation

## Objective

Create the canonical pnpm + TypeScript monorepo topology that all later GitHub Decrypter Builds will target, without prematurely implementing later roadmap features.

## Delivered

- root `package.json`, `pnpm-workspace.yaml`, `.npmrc` and `tsconfig.base.json`;
- `apps/studio`, `apps/extension`, `apps/local` ownership boundaries;
- 13 domain packages under `packages/`;
- strict TypeScript check across every workspace;
- architecture documentation for migration/quarantine boundaries;
- regression test preventing Build 6 placeholders from silently becoming later feature authority;
- CI that carries forward Build 4 decoupling, Build 5 identity and modern-engine preservation checks.

## Explicitly not delivered

- React or Vite Studio runtime;
- Chrome launcher/repository detection;
- local daemon/process manager;
- Shared Protocol implementation;
- Event Bus;
- Git runtime;
- migrations of inherited Tool/MCP/Context/Scope/agent engines.

Those remain owned by their frozen roadmap Builds.

## Definition of Done

- exactly three application workspaces exist: Studio, Extension and Local;
- exactly thirteen initial domain packages exist with canonical `@github-decrypter/*` names;
- all workspaces inherit the strict root TypeScript policy and type-check;
- application/package placeholders contain no runtime dependencies;
- inherited modern engines remain available as migration inputs;
- Build 4 and Build 5 regressions remain green;
- the inert extension manifest remains inert;
- no Release, OTA, store publication, deployment, backend production mutation or DNS operation occurs.
