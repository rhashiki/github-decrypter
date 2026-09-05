# Build 31 — Onboarding / Adaptive User Profile Foundation

Status: **IMPLEMENTED — validation pending**

## Objective

Activate the North Star onboarding responsibility and initialize a first Adaptive User Profile without granting the Studio persistence, security or execution authority that belongs elsewhere.

## Delivered

- profile schema `gd-adaptive-user-profile/1`;
- required preferences: technical level, usage objective, learning intent and explanation depth;
- plain-language conversational four-step onboarding;
- technical-level choices for zero experience, enthusiast, basics, experienced, recent graduate and current student;
- immutable profile creation and deterministic experience-summary derivation;
- Studio workbench integration with Onboarding → Overview transition;
- session-only profile status and explicit retake control;
- presentation adaptation for explanation and learning style;
- Build 31 Studio identity and PWA shell cache advancement;
- machine-readable `adaptiveProfileAuthority`;
- Architecture Guardian AG290–AG299;
- static, runtime, built-bundle and negative validation gates.

## Constitutional persistence boundary

The Product Constitution assigns persistence to the Local Runtime. Build 31 therefore does not use `localStorage`, `sessionStorage`, IndexedDB or a browser database for the profile.

The profile is initialized in React memory for the active Studio session only. This means a reload resets onboarding. Durable profile persistence is intentionally deferred until a later Build owns a safe Studio ↔ Local Runtime connection.

## Security boundary

Profile values are experience context and can never grant or modify:

- capabilities;
- permissions;
- approvals;
- Scope Lock;
- tool execution authority;
- secrets access;
- backend/provider authority.

## Deferred by roadmap

- Build 32 — Environment Doctor;
- Build 33 — AI Provider API;
- Build 108 — Learning Mode, Mentor Engine and adaptive explanation evolution;
- durable profile persistence through an authorized Local Runtime boundary;
- release/deploy/store/DNS authority.

## Validation plan

Before merge, Build 31 must pass:

1. Architecture Guardian including AG290–AG299;
2. accumulated Builds 4–31 CI;
3. historical Build 30 regression in forward-compatible mode;
4. TypeScript/browser workspace compilation;
5. executable profile and onboarding render tests;
6. real Vite production build;
7. built JS/CSS/PWA inspection;
8. negative Guardian probes;
9. modern-engine preservation;
10. the full historical PR workflow matrix.

No release, tag, production deploy, Chrome Web Store publication, production Supabase mutation or DNS mutation is authorized by this Build.
