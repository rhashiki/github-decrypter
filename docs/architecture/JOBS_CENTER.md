# Jobs Center

Build 47 adds the first user-facing operational view of durable jobs without creating a second execution authority.

## Authority model

The **Durable Job Engine from Build 12 remains sovereign** over queue persistence, dependency ordering, leases, claims, checkpoints, retries and terminal state transitions. Jobs Center is a bounded projection/control layer composed over the exact same `DurableJobEngine` instance owned by the Local Runtime.

Jobs Center does not enqueue jobs, claim work, complete/fail work, skip jobs, mutate priority, create dependencies or schedule execution. It cannot replace the Build 12 queue.

## Shared contract

`@github-decrypter/protocol` owns the environment-neutral schemas:

- `gd-jobs-center-job/1`
- `gd-jobs-center-list/1`
- `gd-jobs-center-detail/1`
- `gd-jobs-center-control-request/1`
- `gd-jobs-center-control-result/1`

The only lifecycle controls exposed to the Studio are **pause, resume, cancel and retry**. Allowed actions are derived from the current canonical Durable Job state, and the Local Runtime revalidates the action before mutation.

## Safe projection

The Studio receives operational metadata only. The projection intentionally withholds:

- job payload content;
- checkpoint content;
- result content;
- error content;
- worker identity;
- lease token.

The Studio may see boolean indicators such as `hasCheckpoint`, `hasResult`, `hasError` and `workerAssigned`, but not the underlying sensitive content.

## Local Runtime transport

Build 47 exposes a narrowly scoped loopback transport:

- `GET /v1/jobs`
- `GET /v1/jobs/:id`
- `POST /v1/jobs/:id/control`

The transport:

- is loopback-only;
- requires the canonical `X-GitHub-Decrypter-Client: gd-studio-jobs-center/1` header for non-preflight requests;
- allows CORS only for loopback Studio origins;
- does not allow credentials;
- has no generic Local Runtime request API;
- has no enqueue, skip or priority route;
- has no external network authority.

Environment Doctor remains independently read-only and keeps its own Build 32 authority.

## Studio surface

Jobs Center becomes available only after the existing Onboarding and Environment Doctor flow has been completed. The user explicitly navigates to Jobs Center. Mounting the surface performs one list read; subsequent reads occur through explicit refresh, selection or lifecycle actions. There is no interval polling, WebSocket or EventSource stream in Build 47.

The UI provides:

- queue summary;
- current state and attempts;
- dependency IDs;
- transition history;
- state-derived lifecycle controls;
- manual refresh.

## Security boundaries

Jobs Center does not grant capabilities and does not bypass Capability Security. It only invokes control operations already owned by the Durable Job Engine. No release, deployment, store, DNS, Supabase or external service mutation belongs to this Build.

## Downstream boundary

Build 47 does not implement planning or decision authority. **Build 48 — Plan Authority** owns the next roadmap stage. Jobs Center may later display jobs created by downstream authorities, but it does not define those plans or decisions itself.
