# Build 20 — Project Detection

Status: implementation branch `build/20-project-detection`.

## Objective

Add the first canonical read-only project inspection layer on top of Build 19 Workspace Manager, without entering Build 21 Git Runtime or later Preview/process-management scope.

## Implemented

- environment-neutral `gd-project-detection/1` contract in `@github-decrypter/workspace`;
- local `ProjectDetector` owned by `apps/local`;
- root-only `package.json` and lockfile inspection;
- package-manager detection for pnpm, npm, yarn and bun;
- framework-family detection for Next.js, Astro, React, Vue, Svelte, Vite and vanilla projects;
- deterministic `dev` / `start` command derivation when package manager is known;
- 1 MiB `package.json` safety limit;
- malformed JSON rejection;
- Workspace Manager symlink-containment reuse;
- metadata-only Project Detection Event Bus events;
- daemon startup/readiness/health integration;
- Architecture Guardian policy and AG180–AG189 enforcement;
- positive runtime tests plus negative Guardian failure injection.

## Deliberately not implemented

- no recursive source-tree scan;
- no filesystem mutation;
- no dependency installation;
- no child process execution;
- no network access;
- no Git command or repository state inspection;
- no database migration or persisted detection cache;
- no Project Detection control/query HTTP endpoint;
- no preview/dev-server launch;
- no extension/PWA authority;
- no Release, OTA, Chrome Store publication, production deployment, production backend mutation or DNS mutation.

## Acceptance criteria

Build 20 is acceptable only when:

1. the complete Build 4–20 regression chain passes;
2. TypeScript workspace checks pass;
3. Project Detection correctly distinguishes representative Next/pnpm, React+Vite/npm, Astro/yarn and vanilla fixtures;
4. conflicting package-manager evidence is deterministic and confidence is reduced;
5. malformed `package.json` and symlink escapes fail closed;
6. fixture files remain byte-identical after detection;
7. Project Detection events do not expose workspace paths or display names;
8. daemon readiness includes the detector without exposing a new control endpoint;
9. Architecture Guardian rejects read/write, recursive enumeration, premature network/Git authority and premature HTTP transport;
10. Build 21 remains the sole owner of Git Runtime.

## Next build

Build 21 — Git Runtime.
