# Git Runtime

Build 21 introduces the canonical Git Runtime for GitHub Decrypter.

## Ownership

Git execution belongs to `apps/local` because Git operates against the real local working tree and may mutate repository state. The environment-neutral result contract lives in `@github-decrypter/git` as `gd-git-runtime/1`.

The runtime is workspace-scoped. Every repository operation resolves the registered root through Build 19 Workspace Manager instead of accepting an arbitrary process working directory.

## Supported primitives

Build 21 provides low-level primitives for:

- repository status, branch/head/upstream and ahead/behind state;
- working-tree and staged diff;
- commit log;
- local branch enumeration;
- merge-base;
- blame;
- clone into an empty registered workspace root;
- fetch;
- fast-forward-only pull;
- checkout and branch creation;
- commit;
- push;
- stash push/pop;
- restore.

These are runtime primitives, not the final user-facing Commit/Push/Pull Request workflows. Build 109 owns Commit Workflow, Build 110 owns Push Workflow and Build 111 owns Pull Request Workflow.

## Process boundary

Git is executed as the fixed `git` executable with argument arrays and `shell: false`.

The runtime does not accept arbitrary shell command strings and does not use `exec`, `execFile`, `spawnSync` or shell interpolation. `GIT_TERMINAL_PROMPT=0` prevents an unattended background Git operation from blocking on an interactive credential prompt.

Git stdout/stderr are bounded and every process has a timeout. Operations that exceed those limits fail closed.

## Read operations

Read-only operations do not require `GIT_WRITE` and include status, diff, log, branch listing, merge-base and blame.

Status uses Git porcelain output and returns normalized staged, unstaged, untracked and conflict path sets. Event Bus telemetry contains only the workspace ID, operation type, mutation/network flags, outcome, exit code and timestamp. It does not publish workspace filesystem roots or display names.

## Mutating operations

Every Git mutation requires an existing job-bound capability token containing `GIT_WRITE` for:

`gd://workspace/<workspace-id>/git`

The Git Runtime does not issue its own grants and cannot broaden a capability. It delegates authorization to Build 15 Capability Security.

Mutating primitives include clone, fetch, pull, checkout, branch creation, commit, push, stash and restore.

Build 21 deliberately does not implement force push, hard reset or forced branch deletion.

## Network operations

Clone, fetch, pull and push require both `GIT_WRITE` and `NETWORK` for the same workspace Git resource.

They also fail closed unless Build 14 Offline Execution currently reports `online`. A capability therefore authorizes network use but does not override connectivity policy.

Remote names are constrained to Git-safe identifiers. Clone URLs accept HTTPS, SSH or SCP-like syntax, reject embedded passwords/credentials and reject query strings/fragments. GitHub App authentication remains owned by Builds 23–24.

## Clone boundary

Clone is limited to an already registered, existing and empty workspace root. Build 21 does not create arbitrary directories outside Workspace Manager authority.

## Runtime lifecycle

Git Runtime initializes after Workspace Manager, Project Detection, Offline Execution and Capability Security are available. Startup verifies that a usable `git` executable exists. Health/readiness expose only Git availability/version and aggregate operation status.

There is no `/v1/git` control/query endpoint in Build 21. Direct browser/PWA Git control is intentionally deferred to later protocol/tool/workflow owners.

## Explicit phase separation

Build 21 does not implement:

- Human vs AI Change Tracking — Build 22;
- GitHub App authentication — Build 23;
- GitHub Provider — Build 24;
- browser extension activation — Build 25;
- final Commit Workflow — Build 109;
- final Push Workflow — Build 110;
- Pull Request Workflow — Build 111;
- Release, OTA, Chrome Store publication, production deploy or DNS mutation.
