# Project Detection

Build 20 introduces the canonical read-only Project Detection boundary for GitHub Decrypter.

## Ownership

Project Detection belongs to `apps/local` because it reads the real local workspace. The environment-neutral result contract lives in `@github-decrypter/workspace` as `gd-project-detection/1`.

Project Detection depends on the Build 19 Workspace Manager. It does not bypass the registered workspace root or its canonical `realpath` containment rules.

## Scope

Build 20 inspects only known files at the registered workspace root. It does not recursively walk the project tree.

It can identify:

- package manager: `pnpm`, `npm`, `yarn`, `bun` or `unknown`;
- framework/runtime family: `next`, `astro`, `react`, `vue`, `svelte`, `vite`, `vanilla` or `unknown`;
- whether a root `package.json` exists;
- the preferred root script (`dev`, falling back to `start`);
- a deterministic development command when the package manager is known;
- evidence and confidence for the result.

Package-manager evidence comes from the root `packageManager` field and known lockfiles. A declared `packageManager` is authoritative for the result, while a conflicting lockfile lowers confidence instead of being silently ignored.

Framework detection is dependency-based with deterministic precedence. `index.html` is a root-level fallback for a vanilla project.

## Safety boundary

Project Detection is strictly read-only in Build 20:

- no file creation, editing, deletion, copying, moving or permission changes;
- no child process execution;
- no Git command execution;
- no network access;
- no recursive directory enumeration;
- no database schema or project-detection persistence;
- no generic Project Detection HTTP/RPC endpoint.

`package.json` is capped at 1 MiB. Malformed JSON fails closed. A root file that resolves through a symlink outside the registered workspace is rejected by Workspace Manager containment.

## Runtime lifecycle

The detector initializes after Workspace Manager. Daemon readiness requires the Project Detection authority itself to be ready, but startup does not automatically scan registered projects.

Detection is on-demand through the local runtime authority. Health and readiness expose only aggregate detection status/counts. Event Bus messages expose workspace IDs and normalized detection metadata, not filesystem paths or display names.

## Explicit phase separation

Build 20 does not implement:

- Git status, clone, fetch, pull, diff, log or other Git Runtime behavior — Build 21;
- human-versus-AI change tracking — Build 22;
- GitHub App/provider behavior — Builds 23–24;
- browser extension activation — Build 25;
- real preview/dev-server process management — Builds 68–70;
- recursive multi-workspace discovery/orchestration — Build 114;
- Release, OTA, Chrome Store publication, production deploy or DNS mutation.
