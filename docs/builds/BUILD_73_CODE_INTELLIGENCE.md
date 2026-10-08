# Build 73 — Code Intelligence 

Status: **IN PROGRESS — Build 73 staged on PR branch only; main remains Build 72 until cumulative CI passes**.

## Product authority
Read-only facts from the canonical registered local workspace: syntax symbols, imports, syntactic identifier occurrences, source line/column, bounded query results and source provenance. Respect Build 53 Tool Runtime READ capability and Build 19 Workspace Manager's canonical path containment. No raw Studio filesystem access.

## First implementation slice
- Environment-neutral `@github-decrypter/code-intelligence` contract and TypeScript/JavaScript AST index.
- Bounded file count, file size, aggregate bytes, query sizes and result counts.
- Oversized symbol identifiers are omitted with a dropped-count signal; source names and call expressions cannot make responses unbounded.
- Deterministic file/source ordering and rejected unsupported extensions.
- No full source payload retained in results, no raw secrets, no network access.
- Local source reads use bounded descriptors with no-follow where supported, inode/revalidation checks and workspace containment.
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
- Static, runtime and negative security tests, Architecture Guardian, cumulative Builds 4–73 TypeScript/CI and PR merge evidence.
- Branch-local `currentBuild`/version/Guardian policy staged as 73 for CI. Mark the canonical roadmap ✅ and merge **only after** all gates pass.
- Build 74 is not authorized until Build 73 is complete.

## Boundaries
Code Intelligence is evidence and navigation, not a second compiler, root-cause authority (Build 106), Validation authority (Build 57), or mutating executor. No changes to legacy Supabase are necessary for this build.
