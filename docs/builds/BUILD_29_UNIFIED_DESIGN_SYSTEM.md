# Build 29 — Unified Design System

Status: **IMPLEMENTED — validation pending**

## Objective

Activate the existing `@github-decrypter/ui` workspace package as the canonical reusable visual system and migrate the Studio foundation to consume it without introducing IDE layout or privileged runtime authority.

## Delivered

- `@github-decrypter/ui` version `0.0.29`;
- design-token schema `gd-ui-tokens/1`;
- semantic color, spacing, radius, typography, shadow and motion tokens;
- matching `--gd-*` CSS custom properties;
- canonical dark theme foundation;
- accessible focus-visible treatment;
- React primitives: Card, Badge, Button, Stack, Status and SectionHeading;
- environment-neutral UI package boundary;
- Studio dependency on `@github-decrypter/ui`;
- Studio migration from duplicated hardcoded palette values to semantic tokens;
- versioned PWA shell cache advanced with the Studio build;
- machine-readable `designSystemAuthority`;
- Architecture Guardian AG270–AG279;
- Build 29 static, runtime, built-CSS and negative tests.

## Authority boundaries

Build 29 does not authorize:

- IDE/workspace layout;
- sidebar/editor/terminal/activity-bar structure;
- generic network requests;
- browser/project persistence;
- filesystem access;
- GitHub Provider access;
- Local Runtime transport;
- extension behavior;
- deployment or release authority.

## Deferred by roadmap

- Build 30 — IDE Layout;
- Build 31 — Onboarding;
- later functional panels and tools remain owned by their numbered Builds.

## Validation gate

Before merge, the Build 29 branch must pass:

1. `pnpm run guardian` including AG270–AG279;
2. accumulated Builds 4–29 CI;
3. Build 27 and 28 historical regressions in forward-compatible mode;
4. Build 29 static architecture regression;
5. UI/Studio TypeScript compilation;
6. executable primitive/token runtime tests;
7. real Vite production build;
8. bundled design-system CSS inspection;
9. Build 29 negative Guardian probes;
10. modern-engine preservation;
11. all historical PR workflows.

No release, tag, production deploy, Chrome Web Store publication, production Supabase mutation or DNS mutation is authorized by this Build.
