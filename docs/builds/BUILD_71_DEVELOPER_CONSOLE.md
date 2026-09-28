# Build 71 — Developer Console

Status: **IMPLEMENTED — pending CI/merge evidence**

## Goal

Expose the canonical Preview Bridge telemetry as a bounded, filterable, cursor-based Developer Console data surface without introducing another browser or telemetry authority.

## Delivered

- Developer Console contract in `@github-decrypter/preview`;
- read-only Local Runtime Developer Console projection;
- console/network/runtime-error normalized timeline;
- source filtering;
- level filtering;
- HTTP method filtering;
- status-range filtering;
- bounded text matching;
- monotonic `afterSequence` cursor for tail/poll flows;
- ascending/descending ordering;
- hard 256-entry query limit;
- summary endpoint;
- explicit dropped telemetry counters;
- automatic Tool Runtime provenance;
- no headers, bodies, cookies, storage or credentials;
- no persistence;
- no second CDP/event collector;
- no Developer Console UI work;
- Build 71 external source triage.

## Acceptance

Build 71 is complete only when:
- Developer Console consumes the Build 70 telemetry source rather than creating a new collector;
- queries remain bounded;
- cursor tailing is deterministic;
- filters cannot expand privacy boundaries;
- READ capability is required;
- no mutation authority is accepted;
- provenance comes from Tool Runtime context;
- no UI implementation is introduced;
- no Build 72 diagnostics/root-cause authority is claimed;
- cumulative Builds 4–71 and TypeScript remain green.

## Next

Build 72 — Problems & Diagnostics.
