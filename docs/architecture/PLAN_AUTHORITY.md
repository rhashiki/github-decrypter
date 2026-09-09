# Plan Authority

Build 48 establishes the canonical PLAN authority for GitHub Decrypter.

## Constitutional role

PLAN is **runtime-enforced read-only**. It is not merely a Studio tab or presentation state. The Local Runtime must reject mutating capability requirements while a canonical Plan Authority record is active.

The Plan Authority consumes only canonical Build 39 + Build 40 artifacts:

- `gd-requirement-spec/1`
- `gd-task-graph/1`

It produces `gd-plan-authority/1`.

## Ownership

Core authority:

- package: `@github-decrypter/plan`
- source: `packages/plan/src/authority.ts`
- public entry: `@github-decrypter/plan/authority`

Runtime read-only guard:

- owner: Local Runtime
- source: `apps/local/src/plan-authority.ts`
- guard schema: `gd-plan-runtime-guard/1`

## Canonical plan

A Plan Authority record binds the Requirement Spec and Task Graph through their shared SHA-256 prompt digest and validates:

- canonical requirement identities and source ranges;
- canonical task identities and requirement binding;
- graph edge/dependency consistency;
- topological order;
- supporting requirement identities;
- Build 39/40 authority flags.

The resulting plan has its own deterministic SHA-256 authority digest and deterministic `plan-<digest-prefix>` identity.

The plan is immutable and has revision `1` in Build 48. Revision management is not introduced here.

## Approval state

Build 48 supports explicit plan state:

- `draft`
- `approved`

Approval is an explicit domain transition through `approvePlan(...)`. Approval does **not** grant Build authority.

Even an approved plan remains:

- `readOnly: true`
- `buildTransitionAuthorized: false`
- `execution: false`
- `scheduling: false`
- `toolExecution: false`

The explicit transition from an approved Plan toward Build remains gated by later roadmap authorities.

## Runtime-enforced read-only

The Local Runtime guard rejects PLAN requests that require any of these mutation-capable capabilities:

- `WRITE`
- `EXECUTE`
- `DATABASE_WRITE`
- `GIT_WRITE`
- `DESTRUCTIVE`

Read-oriented capability metadata such as `READ`, and supporting capabilities such as `NETWORK` or `SECRETS`, are not by themselves granted by Plan Authority. Existing capability security remains sovereign and later execution/tool paths must compose both policies.

The guard does not issue grants, execute tools, enqueue jobs, mutate files, run shell commands, or authorize Build.

## Explicit non-authorities

Build 48 does not implement or own:

- **Build 49 — Decision Engine**
- **Build 50 — Project Rules Engine**
- **Build 51 — Impact Simulation**
- **Build 52 — Build Orchestrator**
- **Build 53 — Tool Runtime**
- **Build 54 — Scope Intelligence**
- **Build 55 — Scope Lock**
- **Build 56 — Checkpoint Engine**
- **Build 57 — Validation Pipeline**

It also does not add Studio transport, generic Local Runtime RPC, persistence, network authority, filesystem authority, database authority, deployment, release, DNS, browser-store publication, or Supabase mutation.

## Security invariant

A PLAN record may describe future work, but describing a mutation is never equivalent to authorizing that mutation. The runtime read-only guard is the enforcement boundary until later Build authorities explicitly compose execution.
