# Developer Console

Build 71 adds a bounded read-only Developer Console projection over the canonical Preview Bridge telemetry.

## Ownership

The environment-neutral contracts live in `@github-decrypter/preview`.

Runtime execution lives in Local Runtime at `apps/local/src/developer-console-runtime.ts`.

Developer Console does **not** own:
- browser/CDP execution;
- telemetry collection;
- Problems & Diagnostics aggregation;
- source correlation/root-cause analysis;
- mutation, validation, release or architecture authority.

Those responsibilities remain with the owning Builds.

## Data source

Developer Console reuses the persistent per-tab collector introduced by Build 70.

No second CDP connection, event collector, request tracker or browser runtime is created by Build 71.

The source set is:
- console events;
- privacy-minimized network metadata;
- runtime errors.

## Query model

Developer Console exposes two read-only Tool Runtime tools:
- bounded query;
- summary.

Queries support:
- source filtering;
- console/network severity filtering;
- HTTP method filtering;
- HTTP status range filtering;
- bounded text matching;
- monotonic `afterSequence` cursor;
- ascending/descending result order;
- hard result limit of 256.

Cursor semantics are intended for polling/tailing without replaying the entire telemetry buffer.

## Privacy

Build 71 preserves the Build 70 privacy boundary.

Developer Console never adds:
- request headers;
- response headers;
- request bodies;
- response bodies;
- cookies;
- browser storage;
- embedded credentials.

Network query values remain redacted by the Build 70 collector.

## Host / presentation separation

The Developer Console runtime returns typed data only.

Presentation is intentionally deferred. Build 71 does not implement or redesign the Studio UI.

This follows the host/frontend separation pattern reviewed in `microsoft/edge-devtools-network-console` while keeping Vortex Tool Runtime as the only execution boundary.

## Provenance

Every query/summary inherits provenance from the verified Tool Runtime context:
- workspace;
- orchestration id/digest;
- build step;
- task;
- requirement;
- invocation/run id;
- Scope Lock id/digest when present.

Caller-supplied provenance is not accepted.

## External source decisions

### microsoft/edge-devtools-network-console
MIT direct candidate for narrow host/protocol and request-correlation patterns only.

### AminAdineh/WebConsoleCapture
MIT reference-only for resilient streaming/reconnect/diagnostic concepts. No Python/Qt/OCR/runtime adoption.

### Sakil9051/devtools-clone
Reference-only for list/filter/detail UX concepts. README claims MIT, but inspected repository metadata/root tree did not provide a verifiable license file; no source reuse.

## Authority

Developer Console:
- requires READ capability through Tool Runtime;
- never requests mutation authorization;
- uses Scope Lock only as provenance context;
- is non-persistent;
- cannot drive the browser;
- cannot declare diagnostics/root cause;
- cannot declare validation or release truth.
