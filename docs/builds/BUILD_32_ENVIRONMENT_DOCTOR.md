# Build 32 — Environment Doctor

Status: **IMPLEMENTED — isolated validation passed; PR matrix pending**

## Objective

Add a user-initiated, read-only Environment Doctor that checks whether the local GitHub Decrypter foundations are healthy before later privileged development workflows begin.

## Delivered

- shared `gd-environment-doctor/1` protocol contract and runtime validator;
- metadata-only Local Runtime report builder;
- `GET /v1/environment-doctor` on the existing loopback server;
- loopback-only CORS without wildcard origins or credentials;
- Studio client restricted to `127.0.0.1:43110`;
- explicit **Check Local Runtime** action with 3-second timeout;
- browser preflight for secure context and service-worker support;
- runtime checks for protocol, database, jobs, recovery, offline execution, security, workspaces and Git;
- read-only remediation guidance;
- Onboarding → Environment Doctor → Overview Studio flow;
- session-only diagnostic outcome;
- exact Studio `fetch` exception limited to `environment-doctor-client.ts`;
- Architecture Guardian AG300–AG309;
- static, runtime, dist and negative validation gates.

## Authority boundary

Environment Doctor may observe diagnostic metadata. It may not:

- grant capabilities or permissions;
- read secrets or credentials;
- expose workspace/project paths or source code;
- execute shell commands;
- install or repair software;
- mutate files or databases;
- perform external-network requests;
- persist its result in browser storage;
- provide generic Studio ↔ Local Runtime transport.

The Studio still has no generic privileged execution authority.

## Browser behavior

The Local Runtime check is deliberately user initiated. Browsers may gate loopback/local-network access behind an explicit permission flow, so Build 32 does not probe the daemon automatically during page load.

Skipping the Doctor is allowed and remains semantically distinct from a successful check.

## Deferred by roadmap

- Build 33 — AI Provider API;
- Builds 34–37 — Local AI/model runtime and routing;
- Build 47 — Jobs Center transport;
- Build 119 — Runtime Installer;
- Build 122 — production PWA packaging;
- generic privileged Studio ↔ Local Runtime operations owned by their later Builds.

## Isolated validation result

Functional head `f3990b92442240c73a1dedcbbee5a55bfc7ad447` passed the complete Build 32 push workflow before this documentation-only completion update.

Validated successfully:

1. Architecture Guardian including AG300–AG309;
2. accumulated Builds 4–32 CI;
3. forward-compatible Studio/PWA/IDE Layout/Onboarding regression gates;
4. TypeScript compilation across browser and Local Runtime workspaces;
5. protocol/report runtime validation;
6. live Local Runtime HTTP endpoint checks including loopback CORS isolation;
7. explicit Studio client request behavior with injected fetch;
8. real Vite production build and built-bundle/PWA inspection;
9. negative Guardian probes, including deterministic AG304 JSX integration protection;
10. modern-engine preservation.

The full pull-request workflow matrix remains the final merge gate.

No release, tag, production deploy, store publication, production Supabase mutation or DNS mutation is authorized by this Build.
