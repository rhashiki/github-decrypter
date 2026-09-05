# IDE Layout — Build 30

Build 30 gives the React Studio authority to present a structural IDE workbench. It does not give the Studio authority to execute privileged tools, read project files, persist workspace state or activate later feature panels.

## Ownership

- concrete composition owner: `apps/studio`;
- reusable layout primitives: `@github-decrypter/ui`;
- machine schema: `gd-ide-layout/1`;
- minimum Build: 30.

`@github-decrypter/ui` remains environment-neutral. It owns layout primitives and reusable CSS, not repository, runtime, network or storage behavior.

## Canonical regions

The Build 30 workbench contains six structural regions:

1. **Top bar** — product/workspace identity and layout controls;
2. **Activity rail** — structural navigation surface;
3. **Primary sidebar** — workspace context and roadmap-reserved surfaces;
4. **Editor/workspace region** — primary content surface with tab strip;
5. **Bottom panel** — structural container for later console/problems/terminal capabilities;
6. **Status bar** — concise shell/build/connectivity-boundary status.

The sidebar and bottom panel may be shown or hidden in memory. Build 30 does not persist those preferences.

## Responsive behavior

The workbench uses CSS Grid on larger displays. On narrow displays the primary sidebar becomes an overlay surface while the activity rail, editor, panel and status bar preserve the same structural authority.

This responsive behavior is presentation only. It does not introduce a mobile-specific runtime or storage authority.

## Deferred operational surfaces

Build 30 may label the following destinations only as roadmap-reserved structural surfaces:

- Developer Console — Build 71;
- Problems & Diagnostics — Build 72;
- Code Explorer — Build 73;
- Terminal — Build 75;
- Git Panel — Build 76.

Those surfaces are not operational in Build 30. The workbench must not simulate their backend behavior or import an implementation early.

## Explicit non-authorities

Build 30 does not authorize:

- onboarding/profile collection — Build 31;
- Environment Doctor — Build 32;
- AI providers or Prompt Intake — Builds 33+;
- filesystem reads/writes;
- Local Runtime transport;
- direct GitHub Provider access;
- generic network calls;
- browser persistence of layout/project state;
- editor engine or source-file loading;
- terminal execution;
- Git operations through the Studio;
- deployment, release, store publication or DNS mutation.

## State model

Layout visibility uses React in-memory state only. `localStorage`, `sessionStorage`, IndexedDB and database persistence are outside this Build.

## PWA relationship

Build 28 remains the owner of installability/offline app-shell behavior. Build 30 only advances the versioned shell cache so the new workbench assets are included in the same bounded same-origin PWA cache.

## Security boundary

The Studio remains a client-only browser surface with no privileged authority. Build 30 changes presentation and structural interaction only; all existing Capability Security, Workspace, Git and GitHub Provider boundaries remain unchanged.
