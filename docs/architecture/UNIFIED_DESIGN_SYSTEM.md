# Unified Design System — Build 29

## Ownership

Build 29 activates `packages/ui` as the canonical visual foundation for GitHub Decrypter.

The package owns reusable presentation primitives only:

- semantic design tokens;
- namespaced CSS variables and primitive classes;
- accessible React primitives;
- focus-visible and semantic state styling.

`apps/studio` consumes the package. The UI package never imports an application and remains environment-neutral.

## Token contract

The token schema is `gd-ui-tokens/1` and includes semantic groups for:

- canvas/surface/border/text colors;
- accent, success, warning and danger states;
- spacing;
- border radii;
- typography;
- focus and success halo shadows;
- motion durations.

Runtime TypeScript tokens and CSS variables intentionally carry the same semantic vocabulary. CSS custom properties use the `--gd-*` namespace.

## React primitives

Build 29 provides:

- `Card`;
- `Badge`;
- `Button`;
- `Stack`;
- `Status`;
- `SectionHeading`.

Primitives expose ordinary React/HTML attributes, default buttons to `type="button"`, retain explicit semantic variants and do not own application data or navigation.

## Accessibility baseline

The shared stylesheet provides a consistent `:focus-visible` treatment. Status indicators expose their text label independently from decorative dots. Disabled button state is explicit and semantic colors are not the only source of text meaning in the Studio composition.

## Studio consumption

The Studio imports `@github-decrypter/ui/styles.css` once at its browser entry and composes canonical primitives in `App.tsx`. Studio-specific CSS keeps only page composition/responsiveness and references design-system variables instead of duplicating product palette values.

## Authority boundaries

The design system has no authority for:

- network requests;
- browser or durable storage;
- filesystem access;
- Local Runtime transport;
- GitHub Provider access;
- repository/project state;
- app-to-app transport;
- extension behavior.

Build 29 also does not own IDE structure. Sidebars, activity bars, editor panes, terminals, resizers and workspace layout remain Build 30.

## Deferred authority

- Build 30 — IDE Layout;
- Build 31 — Onboarding;
- later preview/editor/tool surfaces reuse this design system when their owning Builds arrive.

No release, production deployment, browser-store publication, production Supabase mutation or DNS mutation is authorized by Build 29.
