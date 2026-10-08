# Build 73 — Code Intelligence 

Status: **IN PROGRESS — Build 73 staged on PR branch only; main remains Build 72 until independent server-side validation passes**.

## Product authority
Read-only facts from the canonical registered local workspace: syntax symbols, imports, syntactic identifier occurrences, source line/column, bounded query results and source provenance. Respect Build 53 Tool Runtime READ capability and Build 19 Workspace Manager's canonical path containment. No raw Studio filesystem access.

## First implementation slice
- Environment-neutral `@github-decrypter/code-intelligence` contract and TypeScript/JavaScript AST index.
- Bounded file count, file size, aggregate bytes, query sizes and result counts.
- Oversized symbol identifiers are omitted with a dropped-count signal; source names and call expressions cannot make responses unbounded.
- Deterministic file/source ordering and rejected unsupported extensions.
- No full source payload retained in results, no raw secrets, no network access.
- Local source reads use bounded descriptors with no-follow where supported, inode/revalidation checks and workspace containment.
- Context verification binds READ to **workspace identity, source orchestration ID/digest, locked Scope Lock ID/digest** before any file is read; mismatches fail closed.
- AST declarations vs syntactic uses explicitly distinguished.
- On-demand TypeScript semantic definitions/references resolved with an in-memory compiler host restricted to indexed files (no OS filesystem access, no libs, no writes, no external module resolution).
- Missing/unknown symbol binding remains `unresolved` rather than producing a guessed link.
- Bounded syntax-grounded dependency edges between **already supplied/indexed** local sources; unresolved imports remain explicitly unresolved.
- Graph never claims semantic/type-correct import binding or fetches dependencies.
- Imports are recorded, but no unverified dependency resolution is asserted.
- No inference, expensive semantic indexer, background daemon, binary execution, mutation, persistence or deployment.

## Next mandatory integration / gates
- Connect the approved local Tool Runtime registration to a user-facing Code Explorer surface through an explicitly scoped future transport; current direct workspace-file selection remains headless.
- Extend beyond TypeScript/JavaScript through explicit future language/LSP adapters; maintain honest unresolved status for external packages and unsupported files.
- Static, runtime and negative security tests, Architecture Guardian, cumulative Builds 4–73 TypeScript/server validation and PR merge evidence.
- Branch-local `currentBuild`/version/Guardian policy staged as 73 for independent validation. Mark the canonical roadmap ✅ and merge **only after** all gates pass.
- Build 74 is not authorized until Build 73 is complete.

## Codebase onboarding (bounded)
Entry-point hints use filename conventions and inbound edges among only supplied files; missing imports remain unresolved. Every hint explicitly reports `executionVerified: false`. The product must not claim to know a runtime execution path without later verified execution evidence.

## Studio integration (staged)
The Studio now has an interactive **local scratchpad** Code Explorer after onboarding. Users paste source, explicitly import selected TS/JS files, or choose a local folder in the browser (up to 64 source files, bounded); AST analysis and semantic navigation operate in the browser with no network or persistence. Folder selection preserves relative paths for local import resolution, excludes secret/vendor directories, and leaves each file on the user's device. It is not automatic GitHub or Local Runtime repository access. Secure workspace file transport is pending.

The Local Runtime daemon composes the Code Intelligence registration with canonical Tool Runtime preview/diagnostics tools using a supplied Scope Lock, without new HTTP endpoints or grants.

## Boundaries
Code Intelligence is evidence and navigation, not a second compiler, root-cause authority (Build 106), Validation authority (Build 57), or mutating executor. No changes to legacy Supabase are necessary for this build.

## Server-side validation (no GitHub Actions)
The repository prohibits `.github/workflows` and workflow-write authority. Validate with `pnpm install --no-frozen-lockfile && pnpm run validate:server` in a Node 22/pnpm server or isolated checkout; use `pnpm run validate:build73` for focused Build 73 verification. No CI event trigger, workflow dispatch, or GitHub-hosted runner is needed.

Semantic search and reference result links position the source editor caret at the grounded line/column. This navigation remains browser-only and uses only the explicitly loaded source set.


## Validation provenance gate (Build 73 continuation)

The independent Node/pnpm validator now emits `gd-server-validation/2` with the exact `sourceCommit`, commit-stability evidence and clean tracked-source-tree checks before and after the suite. It fails closed if the suite fails, the Git checkout is unavailable, the commit changes during validation, or tracked source files differ from the tested commit.

The additional validator logic passed four isolated behavioral scenarios (success, dirty checkout, commit drift, and failed test command). This is **not** proof that the Build 73 full monorepo suite, Studio bundle, or historical regressions passed.

The dependency graph also resolves indexed TypeScript sources from runtime-style JS import paths, including `.mjs` → `.mts`, without claiming external module resolution. Truncated import specifiers are explicitly marked and never converted into edges, preventing false-positive source links.

**Release state remains blocked:** PR #106 must stay draft until `pnpm run validate:server` passes in a clean Node 22/pnpm Git checkout at the exact proposed merge SHA, yielding `reports/server-validation-73.json`. This is a server/local process only and uses no hosted automation. Build 74 remains unauthorized.
