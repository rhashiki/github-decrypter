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
