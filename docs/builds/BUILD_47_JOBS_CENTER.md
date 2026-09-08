# Build 47 — Jobs Center

Status: **IMPLEMENTATION IN PROGRESS — CI GATE NOT YET CLOSED**

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
- Build 12 and Build 32 historical gates made forward-compatible with the authorized Build 47 transport.

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

## Validation gate

The implementation must not be marked complete until:

1. Architecture Guardian is green;
2. Build 47 static/runtime/negative tests are green;
3. accumulated Builds 4–47 and workspace TypeScript are green on the exact implementation head;
4. only then the canonical roadmap may mark Build 47 ✅;
5. the exact documentation head must pass accumulated CI again before PR;
6. the PR historical workflow matrix must be fully green before protected merge.

## Next Build

**Build 48 — Plan Authority**. It must not begin before Build 47 is merged through the protected historical CI gate.
