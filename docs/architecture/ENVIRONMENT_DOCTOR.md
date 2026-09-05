# Environment Doctor Architecture

Build 32 introduces the first narrowly authorized Studio → Local Runtime diagnostic bridge.

## Purpose

Environment Doctor answers one question before privileged development work begins: is the local GitHub Decrypter environment healthy enough to continue, and if not, what should the user check?

It is diagnostic only. It is not an installer, repair engine, shell, package manager, AI runtime or generic RPC transport.

## Contract

The shared environment-neutral protocol contract is `gd-environment-doctor/1` in `@github-decrypter/protocol`.

A report contains:

- Local Runtime product/build/version and non-secret platform metadata;
- runtime/protocol state;
- database integrity status;
- durable job readiness;
- crash-recovery health;
- offline-execution state;
- security-boundary readiness;
- workspace availability summary;
- Git availability;
- pass/warning/fail/unknown counts.

The response never carries secrets, tokens, credentials, project source, workspace paths or database paths.

## Runtime endpoint

The Local Runtime exposes `GET /v1/environment-doctor` on its existing loopback HTTP server.

The endpoint is:

- GET/OPTIONS only;
- read-only;
- metadata-only;
- not capability-granting;
- not credentialed;
- not persistent;
- not available as a generic request tunnel.

Cross-origin access is accepted only from loopback Studio origins. Wildcard CORS and credentialed CORS are forbidden.

## Studio client

The only Studio source allowed to perform a direct fetch is `apps/studio/src/environment-doctor-client.ts`.

The client:

- targets `http://127.0.0.1:43110/v1/environment-doctor`;
- requests the loopback address space when supported;
- omits credentials;
- disables HTTP cache use;
- rejects redirects;
- has a 3-second timeout;
- validates the response against the shared contract.

The request is never made during module load, initial render or a background timer. The user explicitly starts it by pressing **Check Local Runtime**.

## User flow

The Build 32 Studio foundation is:

`Onboarding → Environment Doctor → Overview`

The user may continue without checking. Skipping the Doctor is not treated as a successful diagnosis.

Doctor state is session-only and does not grant or revoke capabilities.

## Result semantics

- **pass** — the capability is healthy;
- **warning** — local work can still be valid but attention may be useful, such as being offline or having no workspace registered;
- **fail** — a required local foundation is unavailable;
- **unknown** — the Doctor cannot establish the state safely.

Offline connectivity is not a failure by itself because offline-capable local work is a constitutional requirement.

## Deferred authority

Build 32 does not authorize:

- automatic repair or installation;
- arbitrary shell/process execution;
- filesystem mutation;
- AI provider/model detection or installation;
- generic Studio ↔ Local Runtime RPC;
- production PWA hosting policy;
- release, deploy, store, DNS or production backend mutation.
