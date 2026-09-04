# Build 28 — PWA

Status: **IMPLEMENTED — validation pending**

## Objective

Make the React Studio installable and give it a bounded offline application shell without granting generic browser storage, Provider, Local Runtime, hosting or production packaging authority.

## Delivered

- Studio/root version `0.0.28`;
- Web App Manifest;
- 192×192 and 512×512 install icons;
- service-worker registration helper;
- Vite-owned service-worker generation;
- generated shell inventory based on actual hashed build assets;
- same-origin GET-only interception;
- network-first navigation with offline `index.html` fallback;
- cache-first known shell assets;
- cache cleanup restricted to `gd-studio-shell-*`;
- fail-contained service-worker registration;
- machine-readable PWA authority in `architecture.guardian.json`;
- Architecture Guardian AG260–AG269;
- Build 28 static, runtime, dist and negative tests.

## Authority boundaries

Build 28 does not authorize:

- generic external network requests;
- GitHub Provider direct access from Studio;
- Local Runtime transport;
- repository/project data persistence;
- token/secret persistence;
- generic localStorage or IndexedDB use;
- cross-origin service-worker interception;
- production hosting;
- production PWA packaging;
- release/deploy/DNS/store publication.

Cache Storage is authorized only for the versioned same-origin Studio app shell.

## Deferred by roadmap

- Build 29 — Unified Design System;
- Build 30 — IDE Layout;
- Build 31 — Onboarding;
- Build 122 — PWA Production Packaging;
- Build 134 — GitHub Decrypter V1.0 / release authority.

## Validation gate

Before merge, the Build 28 branch must pass:

1. `pnpm run guardian` including AG260–AG269;
2. accumulated Builds 4–28 CI;
3. Build 27 historical regressions in forward-compatible mode;
4. Build 28 static architecture regression;
5. Build 28 TypeScript/runtime registration regression;
6. real `vite build`;
7. built `dist` manifest/service-worker/icon inspection;
8. Build 28 negative Guardian probes;
9. modern-engine preservation;
10. all historical PR workflows.

No release, tag, production deploy, Chrome Web Store publication, Supabase production mutation or DNS mutation is authorized by this Build.
