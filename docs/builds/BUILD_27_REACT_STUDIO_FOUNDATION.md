# Build 27 — React Studio Foundation

Status: **IMPLEMENTED — isolated Build 27 validation green; PR matrix pending**

## Objective

Replace the Studio placeholder with the first real React + TypeScript + Vite client application while preserving strict phase boundaries for PWA, design system, IDE layout and privileged transports.

## Delivered

- `apps/studio` version `0.0.27`;
- React 19.2.7 + React DOM 19.2.7;
- Vite 8.2.2 + React plugin;
- browser TypeScript/JSX configuration;
- real `index.html` entry;
- `createRoot` + `StrictMode` bootstrap;
- minimal foundation shell;
- Studio identity with Build 27/version/framework/bundler metadata;
- versioned repository launch schema `gd-studio-launch/1`;
- local fail-closed `owner/repo` parsing;
- reserved GitHub route rejection;
- duplicate/unknown launch parameter rejection;
- canonical public GitHub repository URL normalization;
- Architecture Guardian `studioAuthority`;
- AG250–AG259;
- Build 27 static, runtime and negative tests;
- real Vite production build in CI.

## Authority boundaries

Build 27 Studio is client-only and has no authority for:

- network requests;
- WebSocket/XMLHttpRequest;
- browser persistence;
- service worker/PWA manifest;
- Local Runtime transport;
- direct GitHub Provider access;
- direct extension access;
- direct imports from another app;
- SSR or React Server Components;
- durable/background execution.

## Deferred by roadmap

- Build 28 — PWA;
- Build 29 — Unified Design System;
- Build 30 — IDE Layout;
- Build 31 — Onboarding;
- later Local Runtime/UI transport work;
- AI, preview, agents and deployment;
- GitHub mutation workflows 109–113;
- release authority Build 134.

## Validation gate

Before merge, the Build 27 branch must pass:

1. `pnpm run guardian`;
2. `pnpm run ci` with Builds 4–27;
3. Build 27 static architecture regression;
4. Build 27 TypeScript test compilation;
5. executable launch-context runtime tests;
6. `pnpm --filter @github-decrypter/studio run build`;
7. Build 27 negative Guardian probes;
8. modern-engine preservation regression;
9. all historical PR workflows.

The isolated branch workflow has already passed items 1–8 at head `48e976148f1ceed5c78df96acefbe715bf011325`. The PR matrix remains the final merge gate because documentation synchronization commits follow that validated head.

No release, tag, production deploy, Chrome Web Store publication, Supabase production mutation or DNS mutation is authorized by this Build.
