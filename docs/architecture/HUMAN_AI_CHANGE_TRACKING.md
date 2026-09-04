# Human vs AI Change Tracking

Build 22 introduces the canonical local authority for attributing uncommitted workspace changes as `human`, `ai`, `mixed` or `unknown`.

## Ownership

The environment-neutral attribution contract lives in `@github-decrypter/git` as `gd-change-tracking/1`. The real observation, hashing, persistence and authorization authority belongs to `apps/local` because it operates on the registered local workspace and Build 21 Git Runtime.

## Core rule: explicit attribution, never guessing

Build 22 does not infer authorship from coding style, commit author, model output, timestamps or heuristics.

A path can be attributed to AI only when it changes inside an explicit AI change session. An AI session is bound to:

- one registered workspace;
- one durable non-terminal job;
- one Local Runtime process instance;
- a `WRITE` capability scoped to `gd://workspace/<workspace-id>/files`;
- a deterministic baseline snapshot captured before the authorized AI work.

A path is attributed to human only through an explicit human observation boundary. If the runtime sees a dirty state that cannot be reconciled with a trusted prior observation, the origin is `unknown` rather than guessed.

If AI changes a path already carrying trusted human attribution, the path becomes `mixed`. The inverse also produces `mixed`.

## State model

Change origins:

- `human` — changed across an explicit human observation boundary;
- `ai` — changed across a successfully completed authorized AI session from a clean/non-human baseline;
- `mixed` — both trusted human and trusted AI activity contributed to the current dirty path;
- `unknown` — the current path state cannot be proven from an explicit trusted boundary.

AI session states:

- `active`;
- `completed`;
- `cancelled`;
- `invalidated`.

Only one AI session may be active per workspace in Build 22. This intentionally avoids overlapping writers with ambiguous attribution before later agent/concurrency phases own a richer model.

## Persistence

SQLite schema 10 adds:

- `gd_change_sessions` — durable AI session metadata and baseline digest;
- `gd_change_path_events` — append-style path attribution observations.

The tracker persists paths, state digests, origin metadata, session/job IDs and timestamps. It does not persist project source contents, complete diffs, patches or model responses.

A baseline contains only per-path digests and Git-state flags. The baseline itself has a SHA-256 digest which is verified before a session can complete.

## State digest

For each dirty path the Local Runtime derives a SHA-256 state digest from metadata that includes:

- normalized workspace-relative path;
- staged/unstaged/untracked/conflicted flags;
- SHA-256 of the current file state when a regular file exists;
- SHA-256 of the working-tree diff;
- SHA-256 of the staged diff.

The digest lets the runtime verify that persisted attribution still describes the current dirty state without storing source contents in the attribution tables.

## Fail-closed behavior

The origin becomes or remains `unknown` when evidence is insufficient. Examples include:

- an unexplained dirty path present before an AI session starts;
- a current digest that does not match the last trusted attribution event;
- a cancelled AI session that changed files;
- a process restart while an AI session is active;
- a stale-process session;
- a corrupted baseline digest.

A terminal durable job cannot start or complete AI attribution. A wrong job or missing/invalid capability cannot complete a session.

## Filesystem safety

The Change Tracker is an observer, not a file editor. It may read Git status/diffs and hash existing files inside Workspace Manager containment. It does not create, edit, delete, rename, copy, chmod or otherwise mutate workspace files.

Build 22 attribution is path-level. It deliberately does not claim hunk-level attribution.

## Runtime lifecycle

The authority initializes after Build 21 Git Runtime and Capability Security are ready. Daemon readiness requires Change Tracking readiness.

Active sessions from a different Local Runtime process are invalidated on startup. Active sessions owned by the current process are invalidated during shutdown if they were not explicitly completed.

Health/readiness expose aggregate counts only. Event Bus messages expose workspace/session/job IDs, counts and timestamps; they do not expose file contents, diffs, absolute workspace paths or model prompts/responses.

## Explicit phase separation

Build 22 does not implement:

- GitHub App — Build 23;
- GitHub Provider — Build 24;
- GitHub Chrome Extension activation — Build 25;
- agent runtime or coding-agent ownership — Builds 58 and 60;
- Git Panel UI — Build 76;
- Transaction Ledger UI — Build 77;
- Commit Workflow — Build 109;
- Push Workflow — Build 110;
- Pull Request Workflow — Build 111;
- generic change-tracking HTTP/RPC transport;
- Release, OTA, store publication, production deployment or DNS mutation.
