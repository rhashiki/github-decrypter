# Preview Runtime / Vortex Browser Runtime Foundation

Build 68 establishes the bounded local browser execution foundation used by generated-app Preview.

## Ownership

The environment-neutral contract lives in `@github-decrypter/preview`.

Actual browser execution belongs to Local Runtime under `apps/local`. The canonical implementation uses a locally installed Chromium-family browser through Chrome DevTools Protocol (CDP).

No browser cloud, remote browser service or AI provider is required.

## Authority path

Mutating browser operations are not exposed as independent public methods.

They are registered as Tool Runtime handlers and therefore inherit:
- explicit Tool Runtime capability verification;
- Scope Lock for every mutation;
- exact locked scope-resource matching;
- Build-step binding;
- deny-by-default behavior.

The Preview Browser Runtime does not grant capabilities and does not create Scope Locks.

## Sessions and isolation

Each Preview session:
- launches a separate local Chromium process;
- uses an isolated temporary browser profile;
- never reuses the user's normal browser profile in Build 68;
- receives explicit desktop/tablet/mobile or bounded custom viewport dimensions;
- owns bounded tabs;
- destroys tabs, process and temporary profile during deterministic cleanup.

System browser-profile reuse remains disabled in Build 68.

## Structured page state

Read-only page state includes:
- canonical URL;
- title;
- document readiness;
- viewport;
- document dimensions and scroll position;
- accessibility tree node count;
- capture timestamp.

The implementation may execute fixed internal inspection expressions through CDP. Callers cannot inject arbitrary JavaScript through the Build 68 API.

## Visual Evidence Capture

Visual Evidence Capture is a read-only boundary separate from browser interaction authority.

Supported modes:
- viewport;
- full page;
- first matching CSS selector.

Supported formats:
- PNG;
- JPEG;
- WebP.

Evidence returns inline by default with URL, session/tab identity, viewport, dimensions, mode/selector, byte count and timestamp.

A successful screenshot is evidence only. It is not validation truth and does not grant Perception, approval or release authority.

## Transfers

Build 68 supports bounded uploads and downloads without persistent project-file writes.

Uploads accept caller-provided inline bytes, write only a temporary isolated file required by Chromium, set the authorized file input, then remove the temporary file.

Downloads are received into the isolated session directory, returned inline, then removed.

Persisting either transfer into project files remains the responsibility of ordinary filesystem tooling under its own capability and Scope Lock rules.

## Network and scope

Opening or navigating to a URL requires:
- Tool Runtime execution;
- NETWORK capability verification;
- EXECUTE capability verification;
- a locked execute candidate whose resource exactly equals the normalized `preview-url:<url>`.

Other browser mutations use their own stable explicit scope resources.

Read-only page-state and screenshot operations still require READ capability but do not mutate page state and therefore do not consume a mutation candidate.

## Security boundaries

Build 68 does not:
- reuse logged-in user browser profiles;
- extract cookies, passwords or tokens;
- accept embedded URL credentials;
- expose arbitrary script automation;
- persist captured images into the project;
- grant validation truth;
- bypass Tool Runtime;
- bypass Scope Lock;
- depend on historical `core/`, `background/` or `content/` browser implementations.

## Economics

The canonical runtime uses the customer's local browser and compute. It requires no Vortex-managed paid browser service and no Vortex-paid AI inference.
