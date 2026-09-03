# Offline Execution

Build 14 makes offline work a first-class Local Runtime scheduling concern without granting premature outbound-network authority.

## Authority

`apps/local/src/offline-execution.ts` owns connectivity-aware scheduling. SQLite remains the durable state authority.

Schema 4 adds:

- `gd_connectivity_state` — one durable `unknown | online | offline` observation;
- `gd_connectivity_events` — connectivity transition history;
- `gd_job_network_requirements` — explicit network-required job classification and network-blocked state.

Jobs without a network-requirement row are local-safe by default.

## Fail-closed connectivity

`unknown` is treated like unavailable for network-required jobs. Local jobs remain runnable.

Build 14 deliberately does **not** probe the internet. Connectivity observations are supplied through the in-process coordinator API by future adapters/providers. Automatic `fetch`, DNS, socket or HTTP probes are blocked by the Architecture Guardian.

## Scheduling semantics

When connectivity is `offline` or `unknown`:

- queued network-required jobs become `waiting`;
- their wait is persisted;
- local queued jobs remain claimable;
- network-required jobs do not consume another attempt merely by waiting.

When connectivity becomes `online`:

- only jobs waiting specifically for network are returned to `queued`;
- generic `waiting` jobs are not touched;
- normal Durable Job Engine ordering and DAG rules resume.

A running network-dependent worker uses `waitForNetwork()` cooperatively when its external dependency becomes unavailable. Build 14 does not forcibly terminate arbitrary running code.

## Restart behavior

Connectivity state and network waits survive daemon/database restart. Crash & Power Recovery runs first; Offline Execution then reconciles the recovered queue before readiness.

## Health and readiness

Health exposes only non-sensitive state:

- connectivity;
- waiting-for-network count;
- local queued count;
- whether local execution remains available;
- `automaticNetworkProbe: false`.

A daemon may be fully ready while offline. Network availability is not a prerequisite for local execution.

## Explicit non-goals

Build 14 does not implement:

- Capability Security — Build 15;
- Secrets Vault — Build 16;
- Approval Transactions — Build 17;
- external provider adapters;
- GitHub/network API clients;
- Tool Runtime;
- background agent workers;
- Jobs Center/job-control HTTP;
- deploy, Release, OTA, store publication or DNS mutation.
