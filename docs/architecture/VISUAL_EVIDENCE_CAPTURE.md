# Visual Evidence Capture

Status: **Architecture doctrine — Amendment 009**

## Purpose

The Vortex needs eyes, but the camera should not also become the hands.

Visual Evidence Capture is a narrow local capability for obtaining deterministic screenshots from rendered pages/apps and returning pixels plus structured metadata to Perception, Testing, Validation and Review.

## Authority separation

```text
Vortex Browser Runtime / Preview Runtime
  owns allowed interaction/navigation
               |
               v
         rendered state
               |
               v
Visual Evidence Capture
  owns screenshot production only
               |
               v
Perception / Testing / Evidence
```

The camera does not own:

- clicking;
- typing;
- forms;
- arbitrary page scripting for product actions;
- authentication;
- Browser Runtime scope;
- validation truth;
- release truth.

Internal rendering scripts used strictly to wait/measure/capture do not become general browser automation authority.

## Capture modes

Canonical target modes:

- viewport;
- full page;
- first selector match with bounded padding.

Canonical presentation controls may include:

- viewport dimensions/presets;
- device scale;
- color scheme;
- format;
- bounded additional settle delay;
- wait-for selector;
- timeout.

## Visual settling

A screenshot is not trustworthy if it races the UI.

Before capture, the implementation should account for the requested mode and wait, within bounded time, for relevant:

- fonts;
- visible/near-visible images;
- finite animations/transitions;
- at least stable rendered frames;
- lazy-loaded content exposed by full-page or element scrolling.

Infinite animation is not a reason to wait forever.

## Evidence metadata

Each capture should expose structured facts such as:

- status;
- preview/url identity;
- mode;
- selector/padding when applicable;
- CSS dimensions;
- viewport/device scale;
- image format;
- byte size;
- capture/task/run identity;
- failure reason when unsuccessful.

Evidence consumers should not infer success merely from a file existing.

## Storage

Inline/in-memory evidence is preferred for agent loops.

Writing an image file is optional and must pass Vortex filesystem/capability/scope rules.

A camera adapter cannot choose arbitrary durable output paths outside granted scope.

## Runtime efficiency

A long-lived capture service may reuse one local Chrome-family process and create bounded concurrent tabs/pages.

Build 128 should benchmark:

- cold first capture;
- warm median/p95;
- memory overhead;
- concurrent capture limits;
- full-page/retina fallbacks.

## Network security

Preview localhost/loopback capture is expected.

External URLs remain governed by the Browser Runtime/network policy.

Visual Capture does not gain unrestricted private-network/egress authority simply by accepting a URL.

## Candidate implementation

`brijr/iris` is an MIT-licensed direct integration candidate because it provides:

- a small Rust binary;
- Chrome DevTools Protocol rendering through installed Chrome-family browsers;
- viewport/full-page/selector capture;
- visual settling;
- inline MCP image output;
- structured metadata;
- persistent browser reuse in MCP mode;
- bounded concurrency.

Direct adoption still requires Vortex security/API/maintenance review. The architectural contract remains Vortex-owned even if Iris is used as one adapter.
