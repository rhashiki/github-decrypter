# Build 26 — Repository Launcher

Status: implementation branch. Completion requires Architecture Guardian, Builds 4–26 regression, TypeScript/browser runtime validation and merge to `main`.

## Purpose

Build 26 completes the GitHub-side entry flow before the React Studio begins in Build 27.

It evolves the Build 25 lightweight Chrome bridge with:

- canonical repository detection;
- repository-only FAB;
- `Open in GitHub Decrypter` message flow;
- extension-owned repository launcher page;
- internal extension bridge connection status.

## Detection

Repository identity is accepted only when GitHub's `octolytics-dimension-repository_nwo` metadata agrees exactly with the first two pathname segments. Reserved top-level GitHub routes and invalid repository parts fail closed.

Query strings and fragments never enter the repository context.

## User entry point

Verified repository pages receive one `GD` FAB with an accessible `Open in GitHub Decrypter` label. SPA navigation re-evaluates repository identity and removes the FAB when context is no longer a verified repository.

## Handoff

The service worker validates the extension sender, canonical GitHub origin, exact sender pathname and repository owner/name before opening anything.

The only launch destination in Build 26 is the extension-owned `apps/extension/browser/launcher.html` page. Only public repository owner/name are carried in its query parameters.

The launcher page performs another repository grammar check and handshakes with the service worker to show the extension bridge status.

## Deliberate Build 27 boundary

Build 26 does not create or pretend to create the React Studio. The launcher reports `studioReady: false` and states that the receiving Studio surface belongs to Build 27.

No arbitrary Studio URL, localhost endpoint or direct Local Runtime transport is introduced early.

## Security

The extension remains:

- network-authority free;
- secret-authority free;
- storage/context-persistence free;
- durable-execution free;
- restricted to `https://github.com/*`;
- unable to directly contact the Local Runtime;
- unable to launch external hosts.

The FAB uses safe DOM construction and never uses `innerHTML`, `insertAdjacentHTML`, `document.write`, `eval` or dynamic code construction.

## Architecture Guardian

AG240–AG249 freeze the Repository Launcher boundary and reject:

- pathname-only/weak repository identity;
- GitHub query/hash leakage;
- unsafe FAB injection;
- arbitrary/external tab launch;
- launcher network or storage access;
- Studio activation before Build 27;
- missing Build 26 artifacts.

## Tests

Build 26 validates:

- repository identity helper behavior;
- canonical metadata/path matching;
- false-positive rejection;
- FAB creation and click message;
- query/hash exclusion;
- service-worker repository revalidation;
- extension-owned handoff URL and parameter set;
- invalid/mismatched repository rejection;
- launcher-page service-worker trust;
- bridge connection status;
- Guardian failure injection.

## Explicit exclusions

Build 26 does **not** activate:

- Build 27 — React Studio Foundation;
- Build 28 — PWA;
- Build 109 — Commit Workflow;
- Build 110 — Push Workflow;
- Build 111 — Pull Request Workflow;
- Build 112 — Checks & Actions;
- Build 113 — Issues Integration;
- Build 134 — release authority.

No Release, OTA, Chrome Web Store publication, production deployment, production Supabase/backend mutation or DNS mutation is authorized by this build.
