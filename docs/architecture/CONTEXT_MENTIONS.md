# Context Mentions — Build 46

## Authority

Build 46 is owned by `@github-decrypter/chat` through `packages/chat/src/mentions.ts`.

Canonical schemas:

- `gd-context-mention/1`
- `gd-context-mention-target/1`
- `gd-context-mention-resolution/1`

## Purpose

Context Mentions binds explicit project-aware references to the same workspace, conversation and committed user-message authority established by Build 44. It resolves structured references against an explicit catalog supplied by the owning source adapters.

Supported canonical kinds are:

- `file`
- `folder`
- `repository`
- `commit`
- `branch`
- `pull-request`
- `issue`
- `database`
- `preview`
- `terminal`

These kinds implement the frozen V1 scope for project-aware mentions.

## Resolution model

Build 46 does not invent or parse a textual `@...` syntax. A caller supplies structured mention objects and a structured target catalog. Resolution is exact on the tuple `(kind, reference)`.

The resolver:

1. validates the canonical conversation;
2. requires the mention to bind to a committed `user` message in that conversation;
3. requires every catalog target to belong to the same workspace;
4. rejects duplicate catalog targets;
5. rejects duplicate mention IDs and duplicate mention references;
6. rejects any mention not present in the explicit catalog;
7. returns an immutable deterministic resolution record.

There is no fuzzy matching, implicit lookup, semantic guessing, fallback search or partial resolution.

## Source authority boundary

Context Mentions **does not read** the referenced sources. It does not read files/folders, execute Git, call GitHub, query a database, inspect Preview state or read Terminal state. The catalog is supplied by the appropriate source authority or adapter.

Therefore a successful mention resolution means only that an explicit source-authority target identity matched the requested structured reference. It does not mean the target content has been fetched, parsed, interpreted or injected into a prompt.

## Content and execution boundary

Build 46 does not materialize target content and does not automatically project a resolved target into AI-provider context. It performs no provider execution, no attachment ingestion, no persistence mutation and no Durable Job creation.

This preserves the distinction between:

- **reference identity** — owned here;
- **source reads/materialization** — owned by the relevant source/runtime authority;
- **context orchestration/final integration** — owned by later context authorities;
- **background execution/control** — **Build 47 — Jobs Center** and later execution Builds.

## Limits

- maximum mentions per resolution: 64
- maximum catalog targets: 4096
- maximum reference length: 2048 characters
- maximum label length: 256 characters

References and labels reject control characters. IDs use the canonical `gd_mention_<uuid>` format.

## Explicit non-authorities

Build 46 does **not** own:

- textual mention syntax or autocomplete UI;
- filesystem or folder reads;
- Git execution;
- GitHub API access;
- database queries;
- Preview inspection;
- Terminal reads or execution;
- attachment ingestion or payload integrity — Build 45;
- content parsing/materialization;
- automatic prompt injection;
- AI provider execution;
- Durable Job creation or controls;
- **Build 47 — Jobs Center**;
- Project Memory — Build 66;
- final Context Engine — Build 67;
- deployment, release, tag, DNS, Chrome Store, Supabase or production mutation.
