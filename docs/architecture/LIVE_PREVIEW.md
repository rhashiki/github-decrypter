# Live Preview

Build 69 turns the Build 68 browser foundation into a long-running Preview session without creating a second browser runtime.

## Source reconnaissance

`Dheeraj-Kumar-089/flowent` was reviewed only for Build 69. It is classified **reference-only** because no repository license was declared at audit time and its Kubernetes/AWS/Redis/S3 architecture conflicts with Vortex local sovereignty.

Useful patterns retained conceptually:
- stable Preview target URL;
- native dev-server HMR rather than host-forced reload;
- explicit health probing before ready state;
- keepalive/resume behavior;
- bounded recovery after target/browser loss.

No Flowent code is copied or required at runtime.

## Runtime ownership

The canonical browser authority remains Build 68:
- `apps/local/src/preview-browser-adapter.ts` owns Chromium/CDP;
- `apps/local/src/preview-browser-runtime.ts` owns browser-session lifecycle and Tool Runtime registration;
- `apps/local/src/live-preview-runtime.ts` only orchestrates that existing browser authority.

Live Preview cannot create a second browser executor or expose the raw CDP adapter.

## Stable target and HMR

A Live Preview has an explicit stable normalized target URL.

Ordinary source changes are expected to flow through the target development server's native HMR when available. Vortex does not force a full reload after every source mutation.

Explicit refresh and recovery remain available through Tool Runtime.

## Readiness and health

A Live Preview is not declared ready merely because Chromium opened a tab.

Readiness requires bounded visual settling over structured page state.

A read-only health probe checks the current page state and can mark the session degraded without mutating browser state.

## Long-running sessions

A Live Preview record keeps:
- stable Live Preview id;
- browser session and tab identity;
- target URL;
- generation;
- explicit refresh count;
- bounded recovery count;
- active form factor and viewport;
- active color scheme;
- last healthy and last settled timestamps.

The Browser Runtime process/profile remain alive across ordinary probe, capture, form-factor and color-scheme operations.

## Form factors

Canonical form factors are deterministic:
- desktop: 1440 × 900;
- tablet: 1024 × 1366;
- mobile: 390 × 844.

Changing form factor uses CDP device metrics on the existing browser tab rather than creating a new browser generation.

## Color scheme

Light/dark Preview uses CDP `prefers-color-scheme` emulation on the existing tab.

A Live Preview capture must match the active color scheme.

## Visual settling

Before Live Preview evidence is captured, page state is sampled under a bounded policy.

Default policy:
- maximum wait: 3000 ms;
- sample interval: 150 ms;
- required identical stable samples: 3.

A stable sample requires `document.readyState === "complete"` and an unchanged structured state signature across consecutive samples.

If settling fails, capture returns no Visual Evidence. Failure is not treated as success.

## Recovery

Recovery is explicit, scoped and bounded to 3 attempts.

Recovery:
1. starts a replacement isolated Browser Runtime session with the same viewport;
2. opens the same stable target;
3. reapplies color scheme;
4. waits for bounded settling;
5. only then swaps the Live Preview generation and closes the previous session.

A failed replacement does not deliberately destroy the previous browser session.

## Authority

Start/refresh/recovery require:
- Tool Runtime;
- EXECUTE capability;
- NETWORK capability;
- exact locked `live-preview-target:<id>:<url>` scope.

Stop/form-factor/color mutations require:
- Tool Runtime;
- EXECUTE capability;
- exact locked `live-preview-session:<id>` scope.

Probe/capture require READ capability and perform no browser mutation beyond read-only capture behavior already authorized by Build 68.

Live Preview has no validation, release, capability-grant, filesystem, architecture or AI authority.
