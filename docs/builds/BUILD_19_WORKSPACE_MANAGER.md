# Build 19 — Workspace Manager

Status: **IMPLEMENTED ON BUILD BRANCH**

## Purpose

Create the canonical local workspace identity, registry and root-containment boundary without pulling Project Detection, Git Runtime, filesystem mutation or Multi-Workspace product orchestration into Build 19.

## Implemented

- environment-neutral `@github-decrypter/workspace` identity contract;
- opaque `gd_ws_<uuid>` workspace IDs;
- SQLite migration 9 with `gd_workspaces`;
- canonical real-path registration of existing local directories;
- idempotent registration by canonical root;
- durable display name, registration time and last-opened time;
- unregister semantics that remove registry state only;
- existing-path resolution constrained to the registered root;
- lexical and real-path containment checks against traversal and symlink escape;
- non-sensitive Event Bus events using IDs/counts rather than paths;
- daemon startup/readiness integration;
- health/readiness counts without path/name disclosure;
- Architecture Guardian Workspace boundary.

## Acceptance criteria

- [x] workspace contract remains environment-neutral;
- [x] filesystem and workspace-registry authority remains in `apps/local`;
- [x] migrations 1–8 remain historical predecessors and schema 9 owns workspace registry;
- [x] only existing directories can be registered;
- [x] canonical duplicate roots resolve to one workspace identity;
- [x] absolute and parent-traversal path escape is rejected;
- [x] real-path/symlink escape is rejected;
- [x] unregister does not delete the underlying directory;
- [x] unavailable registered roots do not make the daemon globally unhealthy;
- [x] health/readiness do not disclose registered paths or display names;
- [x] no `/v1/workspace*` control/query endpoint exists;
- [x] Build 20 Project Detection is not implemented early;
- [x] Build 21 Git Runtime is not implemented early;
- [x] Build 114 Multi-Workspace orchestration is not claimed early;
- [x] no Release, OTA, store publication, deploy or DNS mutation is performed.

## Explicit exclusions

- Project Detection — Build 20;
- Git Runtime — Build 21;
- Human vs AI Change Tracking — Build 22;
- Jobs Center — Build 47;
- Multi-Workspace — Build 114;
- workspace filesystem creation/edit/delete/copy/move;
- generic workspace HTTP/RPC transport;
- Release/OTA/store/deploy/DNS authority.

## North Star review

- local filesystem remains the working-tree authority: **yes**;
- workspace registration mutates user project files: **no**;
- browser/PWA state becomes filesystem authority: **no**;
- path resolution can silently escape the registered root: **no**;
- workspace paths are exposed through health/readiness: **no**.

## Next Build

Build 20 — Project Detection.
