# GitHub Chrome Extension

Build 25 activates the lightweight Manifest V3 Chrome extension shell that was intentionally inert since Build 5.

## Constitutional role

The extension is a launcher/bridge, never the heavy execution environment.

Build 25 creates only the browser-side foundation required for later GitHub repository launch flows. Repository detection, the FAB, `Open in GitHub Decrypter`, Studio launch and connection UX remain Build 26+ authorities.

## Manifest boundary

The root `manifest.json` is Manifest V3 and is scoped only to:

`https://github.com/*`

Build 25 requests no optional Chrome permissions.

The only activated browser components are:

- service worker: `apps/extension/browser/service-worker.js`
- content script: `apps/extension/browser/content-script.js`

The content script runs at `document_idle` only on the canonical GitHub web origin.

## Bridge contract

`apps/extension/src/index.ts` defines schema:

`gd-extension-bridge/1`

Build 25 message types:

- `gd.extension.hello`
- `gd.extension.page-context`

The page-context message contains only:

- canonical origin;
- pathname;
- observation timestamp.

Query strings and fragments are deliberately excluded. Build 25 does not interpret the pathname as repository owner/name.

## Trust boundary

The service worker accepts bridge messages only when:

- `sender.id` equals the current extension runtime ID;
- `sender.url` parses successfully;
- sender protocol is HTTPS;
- sender hostname is exactly `github.com`;
- sender URL has no embedded credentials;
- message schema is `gd-extension-bridge/1`;
- page-context origin/pathname exactly match the sender URL.

Malformed, cross-origin or mismatched messages are ignored.

## GitHub SPA navigation

The content script emits context on initial load and responds to GitHub/Turbo navigation using `turbo:load`, plus browser history/hash navigation signals.

Repeated observations of the same pathname are deduplicated within the content-script lifetime.

## Statelessness and privacy

Build 25 does not persist page context. The service worker validates a page-context message, updates only the Chrome action title for that tab, then discards the context.

There is no:

- `chrome.storage` use;
- localStorage/IndexedDB use;
- repository-context database/cache;
- query-string persistence;
- GitHub token or secret access.

## No network authority

Build 25 browser code contains no `fetch`, XMLHttpRequest or WebSocket transport and does not contact GitHub APIs, Studio or Local Runtime directly.

GitHub API authority remains in Build 23/24 Local Runtime components.

## No launcher authority yet

Build 25 does not:

- detect repository owner/name;
- inject a FAB or other DOM UI;
- open tabs/windows;
- launch the Studio;
- implement `Open in GitHub Decrypter`;
- clone or import repositories;
- call GitHub Provider operations;
- create commits, pushes, pull requests, checks or issues.

Repository Launcher is Build 26.

## Architecture Guardian

AG230–AG239 enforce:

- machine-readable Build 25 authority;
- exact MV3 manifest boundary and GitHub-only host scope;
- versioned bridge contract;
- no network, secret or persistence authority;
- no injected launcher/UI before Build 26;
- sender/origin/path trust validation;
- no repository detection before Build 26;
- browser bridge lifecycle invariants;
- frozen Build 25 phase gates;
- presence of Build 25 tests/docs/workflow.
