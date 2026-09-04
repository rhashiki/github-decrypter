# GitHub Decrypter — Repository Launcher Architecture

Build 26 turns the Build 25 Chrome extension bridge into the first user-visible GitHub entry point while preserving the constitutional rule that the extension remains lightweight.

## Scope

The Repository Launcher owns four narrowly scoped capabilities:

1. fail-closed repository detection on `https://github.com/*`;
2. a repository-only floating action button (FAB);
3. an internal `Open in GitHub Decrypter` handoff;
4. an extension-bridge connection-status surface.

It does not own the React Studio, Local Runtime transport, GitHub API access, secrets, durable jobs, Git execution or remote networking.

## Repository identity

Repository detection does not infer repositories from pathname alone.

The content script requires GitHub's canonical page metadata:

`meta[name="octolytics-dimension-repository_nwo"]`

The metadata value must contain exactly `owner/repository`, both parts must pass the restricted repository identity grammar, the owner must not be a reserved GitHub top-level route, and both parts must exactly match the first two pathname segments.

If any check fails, no repository context and no FAB are produced.

Query strings and URL fragments are excluded from bridge context.

## FAB

A single button with id `gd-repository-launcher-fab` is inserted only after canonical repository detection succeeds.

The content script uses DOM construction APIs and `textContent`; HTML/script injection primitives are prohibited. On GitHub SPA navigation the FAB is removed when the new page is not a verified repository.

Clicking the FAB sends only:

- canonical GitHub origin;
- pathname;
- owner;
- repository name;
- canonical `owner/repository` identity and GitHub repository URL.

No token, query string, fragment, DOM content or page data is included.

## Handoff

The service worker revalidates the sender, origin, pathname and repository identity. A repository identity is accepted only when the sender pathname's first two segments match the supplied owner/name.

After validation, the worker opens only the extension-owned page:

`apps/extension/browser/launcher.html`

The handoff URL contains only `owner` and `repo` parameters. The worker never opens an arbitrary external destination supplied by page content.

## Launcher page

The extension-owned launcher page validates owner/repository again and displays:

- repository identity;
- repository-detected status;
- extension bridge connection status;
- Studio status.

Connection status is a real internal handshake with the extension service worker. It does not probe the network or Local Runtime.

Build 27 owns the React Studio receiving surface. Therefore Build 26 reports Studio as not ready rather than inventing a Studio URL or transport early.

## Security boundary

Build 26 keeps all of these values false:

- browser-side network authority;
- secret authority;
- durable execution;
- context persistence;
- direct Local Runtime transport;
- external hosts;
- Studio launch.

No `fetch`, WebSocket, XHR, Chrome storage, cookies, identity, native messaging, localhost/127.0.0.1 transport or external launcher target is authorized.

## Guardian

Build 26 adds AG240–AG249 for:

- Build 26 policy activation;
- manifest/version/permission boundary;
- launcher contract;
- canonical metadata + pathname repository detection;
- safe FAB construction;
- extension-owned handoff enforcement;
- launcher page/status constraints;
- network/secret/runtime exclusion;
- machine-readable phase boundaries;
- required Build 26 artifacts.
