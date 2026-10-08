# Build 73 — Code Intelligence (pre-gate implementation notes)

Status: **IN PROGRESS — foundation only; do not mark Build 73 complete or advance currentBuild without cumulative evidence**.

## Product authority
Read-only facts from the canonical registered local workspace: syntax symbols, imports, syntactic identifier occurrences, source line/column, bounded query results and source provenance. Respect Build 53 Tool Runtime READ capability and Build 19 Workspace Manager's canonical path containment. No raw Studio filesystem access.

## First implementation slice
- Environment-neutral `@github-decrypter/code-intelligence` contract and TypeScript/JavaScript AST index.
- Bounded file count, file size, aggregate bytes, query sizes and result counts.
- Deterministic file/source ordering and rejected unsupported extensions.
- No full source payload retained in results, no raw secrets, no network access.
- AST declarations vs syntactic uses explicitly distinguished.
- Imports are recorded, but no unverified dependency resolution is asserted.
- No inference, expensive semantic indexer, background daemon, binary execution, mutation, persistence or deployment.

## Next mandatory integration / gates
- Integrate the index in the local daemon with Workspace Manager `resolveExistingPath`, allowed source-file discovery, symlink/special-file rejection and Tool Runtime verified READ.
- TypeScript semantic definition/reference resolution and dependency edges (or precise unresolved status), then explicit adapter points for future LSP/languages.
- Static, runtime and negative security tests, Architecture Guardian, cumulative Builds 4–73 TypeScript/CI and PR merge evidence.
- Update `docs/product/ROADMAP_V1.md`, versions and `architecture.guardian.json` **only after** gates pass.
- Build 74 is not authorized until Build 73 is complete.

## Boundaries
Code Intelligence is evidence and navigation, not a second compiler, root-cause authority (Build 106), Validation authority (Build 57), or mutating executor. No changes to legacy Supabase are necessary for this build.


## Continuation — independent validation / strict no-automation policy (2026-10-08)

This work remains **pre-merge**, not a completed Build 73. No GitHub-hosted automation is allowed.

- Main Architecture Guardian now rejects the entire forbidden directory, even if it contains no YAML or requests no write privileges. No allowlist bypass is possible. Build 9 static regression now asserts absolute disablement rather than granting workflow-write scopes.
- Code Explorer repeat navigation refreshes the editor selection even if the source path and line/column are unchanged.
- Explicit file import refuses sensitive or malformed names *before reading contents*. Folder import refuses mixed roots even if an item from the other root is excluded, and detects duplicates across all eligible files before applying the 64-file cap.
- AST and local workspace read validation reject mixed-case sensitive directory names such as `.GIT` and `Node_Modules`, with new regression cases.
- **Observed focused evidence:** 12/12 behavioral checks of the exact committed folder helper after stripping TypeScript annotations. Checks covered allowed/disallowed paths, mixed roots, duplicate paths, file-size denial, and 64-file bound.
- **Not yet demonstrated:** complete repository dependency install, TypeScript checks, full Build 73 runtime/security tests, earlier build regression suite, or Vite production bundle. The local execution environment has Node 22/TypeScript available but cannot resolve github.com and has no mounted repository checkout. Source inspection and isolated helper tests do **not** establish passing monorepo gates.
- Acceptance remains blocked until a Node 22/pnpm host with the repository checkout runs `pnpm install --no-frozen-lockfile && pnpm run validate:server` and supplies the actual complete `reports/server-validation-73.json` result. Do not merge PR #106 or start Build 74 based on partial tests.
