# Preview Bridge

Build 70 adds a structured, bounded, read-only telemetry substrate over the canonical Build 68 Browser Runtime and Build 69 Live Preview.

## External reconnaissance

### vitalysim/browser-bridge
- license: MIT;
- classification: direct-candidate for narrow telemetry patterns only.

Useful patterns adopted conceptually:
- bounded telemetry rings;
- request-id correlation;
- structured truncation/drop accounting;
- inspection surfaces separated from mutation.

Explicitly not adopted:
- user's real logged-in browser profile;
- cookies/storage/headers/body capture;
- arbitrary JavaScript/CDP evaluation;
- MCP/browser authority;
- web-security fuzzing/replay features.

### 0xpolarzero/electrobun-browser-tools
- license: not declared in inspected repository/package metadata;
- classification: reference-only.

Useful architecture:
- inspection-first protocol;
- explicit capability catalog;
- read/write/unsafe command classification;
- structured DOM/layout/network/log/error evidence.

No source code is copied while license remains undeclared.

## Runtime ownership

Preview Bridge is not a browser executor.

Browser interaction remains owned by Build 68. Live Preview remains owned by Build 69.

Build 70 only:
- subscribes to browser events already occurring in an authorized Preview tab;
- reads bounded DOM structure;
- produces privacy-minimized telemetry snapshots;
- produces structured capture reports;
- binds evidence automatically to Tool Runtime task/run provenance.

## Persistent per-tab telemetry

A persistent CDP client is attached to each Preview tab created by the canonical Browser Runtime.

The collector observes:
- request start/response/finish/failure metadata;
- console events;
- runtime exceptions.

No request/response bodies, cookies, storage values or headers are collected by the Build 70 bridge.

Network URL query **values** are redacted while query keys remain available for debugging.

Telemetry is held in bounded in-memory rings:
- network: 128;
- console: 128;
- runtime errors: 64.

Dropped-entry counts are explicit evidence. Silent eviction is forbidden.

## DOM evidence

DOM evidence uses CDP `DOM.getFlattenedDocument`, not arbitrary caller JavaScript.

The bridge reports bounded structural counts:
- total nodes;
- elements;
- interactive elements;
- form controls;
- iframes;
- shadow roots.

The maximum flattened node count is 20,000 and truncation is explicit.

## Capabilities

The Preview Bridge declares machine-readable capabilities.

Allowed:
- page-state read;
- DOM structure read;
- accessibility summary read;
- network metadata read;
- console/error read;
- capture metadata read.

Forbidden:
- request/response headers;
- request/response bodies;
- cookies;
- local/session storage;
- unsafe evaluate;
- browser interaction;
- mutation authority.

## Capture report

The bridge can ask the existing Live Preview runtime for a bounded settled capture.

The returned bridge report intentionally omits image bytes. It carries:
- status: success / failed / inconclusive;
- Live Preview id and generation;
- desktop/tablet/mobile form factor;
- light/dark state;
- viewport and device scale factor;
- capture mode;
- selector;
- dimensions;
- format;
- byte size;
- settling result;
- structured failure code/message;
- whether inline evidence exists.

`inconclusive` means the camera could not establish usable settled evidence; it is never promoted to validation success.

## Provenance

Provenance is derived from the verified Tool Runtime execution context, never accepted as caller-authored metadata.

Every bridge result carries:
- workspace;
- orchestration id/digest;
- build step;
- source task;
- requirement;
- invocation/run id;
- Scope Lock id/digest when present.

## Authority

Both Build 70 tools are READ-only.

Preview Bridge has no interaction, mutation, capability-grant, validation, release, architecture, persistence, filesystem or AI authority.

The Scope Lock may be recorded as provenance for read evidence, but Build 70 performs no scoped mutation.
