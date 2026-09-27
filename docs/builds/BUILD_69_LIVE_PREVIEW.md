# Build 69 — Live Preview

Status: **IMPLEMENTED — pending CI/merge evidence**

## Goal

Keep generated-app Preview alive as a stable, recoverable local browser session across deterministic desktop/tablet/mobile and light/dark states, while preserving native dev-server HMR.

## Delivered

- canonical Live Preview contract in `@github-decrypter/preview`;
- stable Live Preview ids and target URLs;
- target-dev-server-owned native HMR policy;
- long-running Browser Runtime sessions;
- evidence-based readiness;
- read-only health probe;
- explicit refresh;
- bounded replacement-session recovery;
- recovery generations and counters;
- desktop/tablet/mobile viewport switching on the existing tab;
- light/dark media emulation on the existing tab;
- bounded structured visual settling;
- screenshot capture only after settling;
- Tool Runtime + Scope Lock gating for all mutations;
- exact target/session resource binding;
- no second browser executor;
- no cloud browser or paid inference requirement;
- Build 69 Flowent triage recorded as reference-only.

## Acceptance

Build 69 is complete only when:
- a Live Preview can remain active across repeated probe/capture operations;
- ordinary source changes do not require a host-forced reload contract;
- refresh is explicit and counted;
- recovery is bounded and creates a new browser generation;
- failed replacement cannot silently become healthy truth;
- desktop/tablet/mobile operate deterministically on the live tab;
- light/dark state is deterministic;
- capture is blocked when bounded settling does not succeed;
- all browser mutations remain Tool Runtime + Scope Lock gated;
- Flowent remains reference-only and contributes no code/runtime dependency;
- cumulative Builds 4–69 and TypeScript remain green.

## Next

Build 70 — Preview Bridge.
