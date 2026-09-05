# Build 30 — IDE Layout

Status: **IMPLEMENTED — pending validation**

## Objective

Activate the structural IDE/workbench layout authority reserved by the V1 roadmap while preserving all later feature and privileged runtime boundaries.

Build 30 turns the React Studio from a foundation screen into a responsive workbench shell. It does not make later panels operational.

## Delivered

- IDE layout schema `gd-ide-layout/1`;
- reusable environment-neutral workbench primitives in `@github-decrypter/ui`;
- six canonical regions: top bar, activity rail, primary sidebar, editor/workspace region, bottom panel and status bar;
- responsive CSS Grid workbench with narrow-screen sidebar overlay;
- in-memory sidebar and panel collapse controls with accessible state/controls;
- Studio workbench composition preserving repository launch-context handling;
- roadmap-reserved labels for Developer Console, Problems & Diagnostics, Code Explorer, Terminal and Git Panel;
- Build 30 Studio/UI version identity and PWA shell cache advancement;
- machine-readable `ideLayoutAuthority`;
- Architecture Guardian AG280–AG289;
- static, runtime, built-bundle and negative validation gates.

## Authority boundaries

Build 30 remains structural only. It does not authorize:

- Onboarding or Adaptive User Profile collection — Build 31;
- Environment Doctor — Build 32;
- AI provider/model/prompt execution — Builds 33+;
- Developer Console behavior — Build 71;
- Problems & Diagnostics behavior — Build 72;
- Code Explorer or source-file loading — Build 73;
- Terminal process execution — Build 75;
- Git Panel behavior — Build 76;
- generic filesystem access;
- direct Local Runtime transport;
- direct GitHub Provider access;
- generic network requests;
- browser persistence of layout/project state;
- deployment, release, store publication or DNS mutation.

## State model

Sidebar and bottom-panel visibility use React in-memory state only. Build 30 does not use `localStorage`, `sessionStorage`, IndexedDB or a database for layout state.

## PWA relationship

Build 28 remains the owner of installability and offline app-shell behavior. Build 30 only advances the bounded same-origin Studio shell cache to version 30 so the new workbench assets are included.

## Validation plan

The Build is considered complete only after all of the following pass on the Build 30 branch and again in the pull-request matrix:

1. Architecture Guardian including AG280–AG289;
2. accumulated Builds 4–30 CI;
3. historical Build 29 prematurity regression in phase-aware mode;
4. TypeScript compilation for UI and Studio;
5. executable workbench primitive runtime tests;
6. real Vite production build;
7. built CSS/JavaScript workbench inspection;
8. PWA shell inspection for Build 30 assets;
9. Build 30 negative Guardian probes;
10. modern-engine preservation.

No release, tag, production deploy, Chrome Web Store publication, production Supabase mutation or DNS mutation is authorized by this Build.
