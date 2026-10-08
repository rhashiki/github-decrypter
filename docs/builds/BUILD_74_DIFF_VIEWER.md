# Build 74 — Diff Viewer

**Status: STAGED IN `build/74-diff-viewer` — not accepted, not merged.** Build 73 must pass its independent server validation first. Build 74 is branched from Build 73's candidate HEAD, not from `main`.

## Product capability

A user-initiated, browser-only **Diff Viewer** in the Vortex Ars Studio workbench:

- Two explicitly supplied text sources; paste directly or choose local text/source files through a browser file picker.
- Bounded, deterministic longest-common-subsequence (LCS) line comparison, with CRLF/LF normalization and exact final-newline awareness.
- Unified change groups, context controls (0/3/6/12), line numbers, insert/delete color distinction, no-change feedback, and a textual unified preview.
- Explicit indication when the maximum number of displayed hunks is reached. No incomplete preview can be presented as a complete patch.
- Responsive UI with accessible form labels, keyboard controls and noninteractive read-only diff rows.

## Security and scope

The feature **does not** access the GitHub repository, fetch remote content, read the workspace without user selection, apply patches, write files, mutate databases, spawn commands, or persist data. It cannot commit or deploy. Local file selection is explicit and held in React session memory.

Both sides are capped at 100,000 characters and 800 lines each. Diff computations are bounded by those limits; the displayed hunk cap is 64. File reads are restricted to manually chosen text/code assets with an additional 400 KB pre-read cap. The `architecture.guardian.json` Diff Viewer authority policy forbids privilege escalation.

This Build 74 is the honest **local text comparison** slice. Connecting repository change history or Tool Runtime patch authority requires a separate, explicitly scoped and verified later extension, never an implicit expansion of this feature.

## Validation

- Run `pnpm run check:build74` in a Node 22 checkout to execute the static authority guard, real TypeScript regression tests, and Architecture Guardian.
- Run `pnpm run validate:server` in a **clean local/server checkout** after installing dependencies, to cover historical Builds 4–74, TypeScript for Studio/local/intelligence, and the Vite production bundle.
- Server receipts must record the exact Git commit and clean tracked tree. Reports are not authoritative for a different commit.
- **No GitHub Actions**, workflows, jobs, runners or dispatch mechanisms of any kind.
- A successful isolated test of a helper does **not** count as the full monorepo gate.
- Keep Build 73 PR #106 and the Build 74 PR as drafts until the full server checks pass in order. No merge until then.


## Implementation checkpoint — 2026-10-08

The branch contains the complete bounded local Diff Viewer UI, the pure deterministic comparison model, CSS, architecture gate and permanent Build 74 regression tests. The existing Build 73 historical gate was adjusted to remain active when the root version advances to Build 74, without weakening its read-only authority.

**Executed focused evidence, not full acceptance:**
- 448 assertions of the actual committed Build 74 test file passed against the committed model transformed by TypeScript type erasure for isolated JavaScript execution.
- The committed static Build 74 assertion script passed against the fetched branch file set.
- The Build 74 Architecture Guardian passed against those same fetched files with no errors.
- 14 additional focused behavioral cases of the model passed. The committed suite now includes 200 deterministic randomized reconstruction checks and one 800-line stress case.

**Still required before acceptance:** local/server installation, actual TypeScript compilation of the entire monorepo, real `pnpm run ci` historical regressions through Build 74 and Studio Vite build. The current container cannot resolve GitHub DNS or fetch package registry dependencies, so no claim of a passing final acceptance suite has been made.
