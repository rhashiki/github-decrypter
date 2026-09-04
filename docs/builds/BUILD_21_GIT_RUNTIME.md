# Build 21 — Git Runtime

Status: **COMPLETE — VALIDATED**

## Objective

Introduce the first canonical Git execution authority for GitHub Decrypter without activating later GitHub, Studio or workflow layers.

## Delivered

- environment-neutral `@github-decrypter/git` contract (`gd-git-runtime/1`);
- local `GitRuntime` owned by `apps/local`;
- workspace-scoped status, diff, log, branch listing, merge-base and blame;
- capability-gated clone/fetch/pull/checkout/branch creation/commit/push/stash/restore;
- `GIT_WRITE` required for every Git mutation;
- `NETWORK` additionally required for clone/fetch/pull/push;
- Offline Execution `online` state required before network Git mutation;
- clone restricted to an existing empty registered workspace root;
- fixed `git` executable, argument-array execution and `shell: false`;
- bounded command output and command timeouts;
- remote URL validation with embedded credentials rejected;
- fast-forward-only pull;
- no force push, hard reset or forced branch deletion;
- metadata-only Git Event Bus events;
- daemon lifecycle, health and readiness integration;
- Architecture Guardian rules AG190–AG199;
- positive, runtime and failure-injection regressions.

## Runtime contract

The Git contract exposes normalized status/log/branch/text/mutation result types. It is environment-neutral and does not import Node/browser process APIs.

The real process authority remains exclusively in `apps/local`.

## Security decisions

Mutations are tied to the Build 15 job-bound capability model through the workspace resource:

`gd://workspace/<workspace-id>/git`

Network Git mutations require both `GIT_WRITE` and `NETWORK` and cannot bypass Build 14 connectivity state.

No Git control/query HTTP endpoint is introduced. No capability grant is created implicitly by Git Runtime.

## Phase boundaries preserved

Build 21 does not claim:

- Build 22 Human vs AI Change Tracking;
- Build 23 GitHub App;
- Build 24 GitHub Provider;
- Build 25 GitHub Chrome Extension;
- Build 109 Commit Workflow;
- Build 110 Push Workflow;
- Build 111 Pull Request Workflow;
- Build 134 release authority.

## Validation

Build 21 validation covers:

1. Architecture Guardian including Git Runtime authority;
2. the complete Build 4–21 regression chain;
3. TypeScript workspace checks;
4. a real temporary Git repository integration regression;
5. Git mutation capability tests;
6. Offline Execution network fail-closed test;
7. remote credential rejection test;
8. Git HTTP transport absence test;
9. modern-engine preservation regression.

The branch validation completed successfully before pull-request creation.

No Release, OTA, tag, Chrome Store publication, production deploy, production backend mutation or DNS mutation is authorized by this Build.
