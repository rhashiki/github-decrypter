# React Studio Foundation

Build 27 activates the first real GitHub Decrypter Studio application.

## Authority

The Studio is owned by `apps/studio` and is a client-only React application built with Vite. It may render local UI state and validate a public GitHub repository identity supplied through launch parameters.

It does not own Local Runtime transport, GitHub Provider operations, secrets, persistence, deployment, PWA installation or background execution.

## Runtime stack

- React 19.2.x
- React DOM 19.2.x
- Vite 8.2.x
- TypeScript
- browser client only
- no SSR
- no React Server Components

The exact Build 27 dependency versions are pinned in `apps/studio/package.json` and guarded by Architecture Guardian.

## Entry model

The Studio can start in two modes:

1. empty entry with no selected repository;
2. repository entry with exactly one `owner` and one `repo` query parameter.

The repository context is validated locally and normalized to `gd-studio-launch/1`.

Unknown parameters, duplicate parameters, missing parameters, invalid repository grammar and reserved GitHub top-level routes fail closed.

Only public repository identity is represented:

- owner;
- repository name;
- `owner/repo` full name;
- canonical `https://github.com/<owner>/<repo>` URL.

No token, installation ID, branch, secret, query fragment, provider response or Local Runtime state is accepted by the Build 27 launch contract.

## Security boundaries

Build 27 does not authorize within Studio source:

- `fetch`;
- WebSocket;
- XMLHttpRequest;
- Chrome extension APIs;
- localStorage;
- IndexedDB;
- Cache API;
- service workers;
- direct imports from `apps/local` or `apps/extension`;
- direct imports from Git/GitHub Provider authority packages;
- Local Runtime loopback transport.

The Studio remains a visual client authority with no privileged execution path.

## Phase separation

Build 27 intentionally does not implement:

- Build 28 — PWA;
- Build 29 — Unified Design System;
- Build 30 — IDE Layout;
- onboarding;
- AI providers;
- Local Runtime browser transport;
- repository mutation;
- commit, push or pull-request workflows;
- deployment or release.

The temporary foundation shell exists only to prove the React application lifecycle and trusted launch-context boundary. Later UI builds may replace its presentation without weakening the Build 27 authority model.

## Validation

Build 27 is protected by:

- Architecture Guardian AG250–AG259;
- static architecture regression;
- TypeScript compilation;
- executable repository launch-context tests;
- real `vite build`;
- negative Guardian probes;
- accumulated Builds 4–27 CI;
- modern-engine preservation regression.
