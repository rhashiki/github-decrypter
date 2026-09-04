# Build 25 — GitHub Chrome Extension

Status: implementation branch. Completion requires Architecture Guardian, Builds 4–25 regression, TypeScript/browser-runtime validation and merge to `main`.

## Purpose

Activate the lightweight Chrome Extension layer authorized by the Product Constitution without prematurely activating Build 26 Repository Launcher or Build 27 Studio.

## Delivered boundary

- Manifest V3 root extension package at version `0.0.25`;
- exact host scope `https://github.com/*`;
- no optional Chrome permissions;
- lightweight service worker;
- GitHub content script;
- versioned `gd-extension-bridge/1` internal bridge;
- page-context observation limited to canonical origin, pathname and timestamp;
- GitHub/Turbo navigation awareness;
- trusted sender/origin/path verification;
- stateless service-worker handling;
- Chrome action title indicates bridge activity without launching anything.

## No network or execution authority

Build 25 adds no browser-side `fetch`, XMLHttpRequest, WebSocket, Local Runtime transport, GitHub API transport, secret access or durable execution.

GitHub App and Provider network authority remain in the Local Runtime.

## Privacy

The extension does not persist page context and does not use `chrome.storage`, localStorage or IndexedDB.

Query strings and fragments are not included in page-context messages.

## Explicitly deferred to Build 26+

Build 25 does not implement:

- repository owner/name detection;
- repository FAB/UI injection;
- `Open in GitHub Decrypter`;
- opening Studio tabs/windows;
- repository launcher/import behavior;
- GitHub Provider calls from the extension;
- direct Local Runtime transport;
- commit/push/PR/Checks/Issues workflows.

## Architecture Guardian

AG230–AG239 guard the Build 25 browser boundary, exact manifest scope, stateless bridge, no network/storage/secret authority, no DOM launcher, no repository detection and phase ownership.

The historical Build 5 inert-manifest regression is made phase-aware: the shell must be inert before Build 25, while post-Build-25 hosts must remain within the machine-readable extension allowlist.

Build 24 regression is also made forward-compatible while keeping GitHub Provider authority pinned to Build 24.

## Validation target

Build 25 must prove:

- canonical GitHub pages emit only bridge schema/origin/path/timestamp;
- query and fragment data are excluded;
- duplicate same-path observations are suppressed;
- Turbo/history navigation updates context;
- service worker accepts only trusted extension messages from exact `https://github.com` senders;
- sender/message path mismatch fails closed;
- hello response advertises no Repository Launcher, network or durable-execution authority;
- no browser network/storage/secret/DOM-launcher authority exists;
- Guardian negative injections fail as expected;
- full Builds 4–25 regression and workspace TypeScript checks pass.

## Safety

No Release, OTA, Chrome Web Store publication, production deployment, production backend/Supabase mutation or DNS mutation is authorized by this Build.
