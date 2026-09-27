# Build 70 — Preview Bridge

Status: **IMPLEMENTED — pending CI/merge evidence**

## Goal

Expose structured browser/runtime evidence for adapter verification and generated-app QA without creating another browser-control authority.

## Delivered

- Preview Bridge schemas and capability catalog;
- bounded persistent per-tab CDP telemetry;
- privacy-minimized network metadata;
- query-value redaction;
- console/runtime-error evidence;
- explicit dropped-entry accounting;
- bounded flattened-DOM structural evidence;
- automatic Tool Runtime task/run provenance;
- capture reports with status, viewport/scale/mode/selector/dimensions/format/bytes/failure metadata;
- explicit success/failed/inconclusive capture states;
- evidence data omitted from bridge reports to avoid duplicating large image payloads;
- read-only Tool Runtime registration;
- Build 70 source triage:
  - `vitalysim/browser-bridge` — MIT direct candidate for narrow telemetry patterns;
  - `0xpolarzero/electrobun-browser-tools` — reference-only, no declared license observed.

## Privacy boundary

Build 70 does not collect request/response bodies, headers, cookies or browser storage through Preview Bridge. Network query values are redacted.

## Acceptance

Build 70 is complete only when:
- telemetry survives across an active Preview tab and remains bounded;
- request updates remain correctly correlated after redirects and evictions;
- dropped telemetry is explicit;
- DOM evidence is bounded;
- provenance is derived from Tool Runtime context;
- capture reports distinguish success, failure and inconclusive evidence;
- read tools cannot mutate browser state;
- no second browser runtime or public unsafe-evaluate path is introduced;
- unlicensed reference code is not copied;
- cumulative Builds 4–70 and TypeScript remain green.

## Next

Build 71 — Developer Console.
