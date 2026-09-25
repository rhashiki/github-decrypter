# Iris — Vortex Ars Adoption Record

Status: **Direct integration candidate**

Upstream: `https://github.com/brijr/iris`

Inspection date: **2026-09-25**

Observed package: `iris-screenshot 0.4.1`

License: **MIT**

Implementation: Rust 2024; Chrome/Chromium-family browser via CDP; local stdio MCP server.

## What is useful

Iris deliberately acts as a camera rather than a browser automation framework.

Useful implementation patterns:

- one-shot CLI and persistent MCP modes;
- viewport, full-page and selector capture;
- padding around selector targets;
- desktop/iPhone/iPad presets and custom viewport;
- dark-mode emulation;
- PNG/JPEG/WebP;
- JSON structured result metadata;
- inline MCP image return;
- optional output path rather than mandatory filesystem write;
- one persistent Chrome process in MCP mode;
- bounded concurrent captures;
- timeout per page;
- smart visual settling;
- full-page lazy-load scrolling;
- full-page scale fallback when Chrome texture limits are exceeded;
- failed captures remain explicit failures;
- deterministic local benchmarking guidance.

## Vortex adoption decision

Adopt the **Visual Evidence Capture** architecture now.

Evaluate Iris itself as a future adapter for Builds 68–70 rather than making it a mandatory Vortex dependency today.

The Vortex-owned interface must keep capture separate from browser interaction authority.

## Security adaptations required

Before direct integration:

- all URLs must pass Vortex Browser Runtime/network scope;
- private-network reach must not be implicitly expanded;
- optional output paths must pass filesystem capability/scope;
- MCP/adapter invocation remains local and capability-gated;
- internal page evaluation is restricted to rendering/capture mechanics;
- capture concurrency is bounded by Compute/Tool Budget;
- screenshot evidence receives task/run provenance;
- captured page content remains untrusted data.

## Roadmap

- Build 62: screenshot evidence may feed Testing Agent.
- Build 68: Preview/Browser Runtime owns camera adapter boundary.
- Build 69: live preview form-factor capture.
- Build 70: structured visual metadata/Preview Bridge integration.
- Build 124: deterministic visual regression/evidence matrix.
- Build 128: persistent-browser capture performance and concurrency tuning.
- Build 133: RC visual evidence must distinguish success/failure/inconclusive capture.
