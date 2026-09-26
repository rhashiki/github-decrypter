# Build 68 — Preview Runtime / Vortex Browser Runtime Foundation

Status: **IMPLEMENTED — pending CI/merge evidence**

## Goal

Provide a real local, isolated, capability-gated browser runtime for generated-app Preview without expanding the Studio UI.

## Delivered

- `@github-decrypter/preview` Build 68 contracts;
- bounded URL, selector, viewport, timeout and inline-data normalization;
- local Chromium/Chrome discovery;
- isolated temporary Chromium profile per session;
- Chrome DevTools Protocol connection without browser-cloud dependency;
- session and tab lifecycle;
- deterministic process/profile cleanup;
- bounded URL navigation;
- structured page-state evidence;
- accessibility-node count;
- viewport/full-page/selector screenshots;
- PNG/JPEG/WebP inline Visual Evidence;
- read-only visual evidence boundary;
- temporary inline upload support;
- temporary inline download support;
- Tool Runtime registrations for every browser operation;
- capability verification;
- exact Scope Lock resource binding for all browser mutations;
- Local Runtime lifecycle integration;
- no system-profile reuse;
- no credential extraction;
- no arbitrary caller-supplied JavaScript execution;
- no project filesystem writes;
- no mandatory remote browser or paid inference.

## Acceptance

Build 68 is complete only when browser mutation cannot execute without Tool Runtime + exact Scope Lock + capabilities; read-only capture remains separate from interaction authority; session/tab cleanup is deterministic; transfers leave no persistent project files; URLs reject embedded credentials and unsupported schemes; Chromium is local; the default production adapter is CDP-based; CI can validate behavior with an injected deterministic fake adapter without weakening the production path; cumulative Builds 4–68 and TypeScript remain green.

## Next

Build 69 — Live Preview.
