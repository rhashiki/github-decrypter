# Build 72 — Problems & Diagnostics

Status: **IMPLEMENTED — pending CI/merge evidence**

## Goal

Aggregate runtime, browser, test, Preview and Validation evidence into bounded, deterministic, source-correlated Problems & Diagnostics without creating another telemetry collector or claiming root cause.

## Delivered

- new environment-neutral `@github-decrypter/diagnostics` package;
- normalized problem entry contract;
- runtime/browser/test/preview/validation source taxonomy;
- info/warning/error severity model;
- bounded ANSI-safe runtime/test text parser;
- file URI and cross-platform path normalization;
- file/line/column source correlation;
- deterministic deduplication with occurrence counts;
- source/file diagnostic groups;
- highest/worst severity propagation;
- unmatched diagnostics preserved;
- bounded result and dropped-entry accounting;
- Preview Bridge runtime/console/network evidence projection;
- failed/inconclusive visual capture projection;
- failed Validation criterion projection;
- Tool Runtime READ-capability gating;
- automatic task/run/scope provenance;
- no second Preview collector;
- no persistence;
- no root-cause or auto-fix authority;
- source triage for ROS diagnostics and Agent IDE;
- no external runtime dependency;
- UI deferred.

## Acceptance

Build 72 is complete only when:
- diagnostics from multiple producers normalize deterministically;
- duplicates retain occurrence/evidence information;
- source-location correlation never becomes a causation/root-cause claim;
- highest severity propagates through groups;
- unlocated diagnostics are retained;
- large text inputs are bounded;
- Preview evidence comes from the Build 70 telemetry owner;
- READ capability is required;
- mutation, auto-fix, validation and release authority remain false;
- Validation Pipeline remains the pass/fail owner;
- Error Intelligence remains owned by Build 106;
- no external source becomes a mandatory runtime dependency;
- cumulative Builds 4–72 and TypeScript remain green.

## Next

Build 73 — Code Explorer / Code Intelligence.
