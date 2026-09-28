# Build 71 — External Source Triage

## microsoft/edge-devtools-network-console

Source: https://github.com/microsoft/edge-devtools-network-console

Status: **AUDITED FOR BUILD 71**

License: **MIT**

Stack/activity at audit time:
- TypeScript / React monorepo;
- repository not archived;
- last code push observed: 2025-12-16;
- separates frontend from host execution through an explicit typed host protocol.

Classification: **direct-candidate — selective protocol/data-model patterns only**

### Useful for Build 71

- explicit frontend/host protocol instead of UI reaching directly into execution internals;
- request/response correlation ids;
- host-owned execution with frontend-owned presentation;
- explicit ready/init lifecycle;
- typed messages and deterministic response correlation;
- clear separation between a developer console surface and the browser/runtime authority beneath it.

### Do not adopt

- Chromium/Edge embedding assumptions;
- its API-request execution authority;
- persistence/filesystem behaviors;
- VS Code/Edge host-specific coupling;
- telemetry/collection behavior unrelated to the Vortex Product Contract;
- any UI implementation as a Build 71 dependency.

### Vortex boundary

Only narrow protocol/data-model patterns are eligible for adaptation. Browser/runtime evidence remains owned by Builds 68–70 and Tool Runtime authority remains unchanged.

---

## AminAdineh/WebConsoleCapture

Source: https://github.com/AminAdineh/WebConsoleCapture

Status: **AUDITED FOR BUILD 71**

License: **MIT**

Stack/activity at audit time:
- Python 3.10+ / PySide6;
- repository not archived;
- last code push observed: 2026-05-27;
- captures Chrome console/log events through CDP and maintains explicit diagnostics.

Classification: **reference-only**

### Useful patterns

- streaming console/event capture;
- reconnect/backoff and target re-resolution ideas;
- explicit live diagnostics counters;
- bounded preview/log buffering;
- separation of capture worker from presentation;
- event-level timestamps/severity;
- resilience after browser/navigation changes.

### Do not reuse

- Python/Qt runtime;
- OCR fallback;
- injected MutationObserver/binding surfaces;
- file logging/export as implicit Developer Console behavior;
- its own browser-launch/control path;
- any mechanism that would create a second CDP/browser authority.

### Vortex adaptation

Build 71 reuses only resilience/observability ideas. The actual event source remains the persistent bounded telemetry collector introduced by Build 70.

---

## Sakil9051/devtools-clone

Source: https://github.com/Sakil9051/devtools-clone

Status: **AUDITED FOR BUILD 71**

Observed licensing state:
- README claims MIT;
- GitHub repository metadata did not identify a license;
- no root LICENSE file was present in the inspected repository tree.

Stack/activity at audit time:
- React / Redux / Tailwind / Vite;
- repository not archived;
- last code push observed: 2024-07-02;
- uses simulated request data rather than a real browser telemetry source.

Classification: **reference-only — UI/interaction model only**

### Useful patterns

- simple filterable request list;
- selected-request detail model;
- separation of list and detail presentation;
- category filtering for network entries.

### Do not reuse

- source code while repository licensing remains ambiguous;
- simulated request pipeline;
- headers/response-body presentation, which exceeds Build 70 privacy boundaries;
- Redux/Tailwind/UI dependencies in Build 71;
- any UI work before the product-wide UI phase.

---

## Decision

Build 71 uses:
- **edge-devtools-network-console** as an MIT direct candidate for narrow host/protocol and correlation patterns;
- **WebConsoleCapture** as reference-only for resilient streaming/diagnostic concepts;
- **devtools-clone** as reference-only for list/filter/detail UX concepts, with no source reuse due licensing ambiguity and because Build 71 does not own UI.

No external source becomes a runtime dependency. Developer Console consumes only the canonical Build 70 telemetry path.
