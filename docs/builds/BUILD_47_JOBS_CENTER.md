# Build 47 — Jobs Center

Status: **✅ IMPLEMENTATION COMPLETE — ACCUMULATED CI GREEN**

## Purpose

Expose a safe, inspectable and user-controlled Jobs Center over the existing Durable Job Engine without duplicating scheduling or exposing sensitive job internals.

## Implemented

- shared Jobs Center protocol schemas and runtime guards;
- safe Local Runtime projection of durable job metadata;
- list and detail views;
- dependency IDs and transition history;
- state-derived controls limited to pause, resume, cancel and retry;
- explicit exclusion of enqueue, skip and priority mutation;
- composition over the same Build 12 `DurableJobEngine` instance;
- loopback-only `/v1/jobs` transport;
- canonical Studio client header;
- loopback-only CORS without credentials;
- Studio Jobs Center client with response validation;
- Studio Jobs Center workbench surface;
- explicit navigation after Onboarding + Environment Doctor;
- manual refresh without interval polling;
- Build 47 Architecture Guardian AG450–AG459;
- static, runtime and negative-guardian tests;
- historical gates in Builds 12–15, 32 and 46 made forward-compatible with the authorized Build 47 transport while preserving their original pre-Build-47 prohibitions.

## Safe projection

The Jobs Center does not expose:

- payload content;
- checkpoint content;
- result content;
- error content;
- worker identity;
- lease token.

It exposes only bounded operational metadata and boolean presence indicators.

## Durable Job sovereignty

The Build 12 Durable Job Engine remains the sole queue/scheduler authority. Jobs Center does not own enqueue, claim, completion, failure, skip, priority, dependency creation or scheduling.

## Transport boundary

Authorized endpoints:

- `GET /v1/jobs`
- `GET /v1/jobs/:id`
- `POST /v1/jobs/:id/control`

Authorized controls: **pause, resume, cancel and retry**.

The transport is loopback-only, credentials-free, protected by a canonical Studio client header and is not a generic Local Runtime API.

## Explicit exclusions

Build 47 does not implement:

- Plan Authority;
- Decision Engine;
- new job scheduling semantics;
- generic Local Runtime RPC;
- payload/result inspection;
- background polling or streaming;
- release/deploy/store/DNS/Supabase mutation.

## Validation record

Validated implementation head:

`bb2834cdd0f3f1338ecce3a02c11e30a0e9b9749`

On that exact head:

1. Architecture Guardian — ✅
2. Build 47 static/runtime/negative tests — ✅
3. accumulated Builds 4–47 — ✅
4. workspace TypeScript — ✅
5. modern engine preservation — ✅

The completion documentation and canonical roadmap are intentionally committed only after this implementation gate. Their exact final head must pass the same accumulated CI before the PR is opened.

## Closure gate

Build 47 is not merged until:

1. the canonical roadmap marks Build 47 ✅;
2. the exact completion-documentation head passes accumulated Builds 4–47 and modern engine preservation;
3. the PR historical workflow matrix is fully green;
4. the protected merge uses the exact validated PR head.

## Next Build

**Build 48 — Plan Authority**. It must not begin before Build 47 is merged through the protected historical CI gate.
