# Build 3 — Full Legacy Inventory

## Purpose

Create the authoritative migration inventory for every inherited Lovable Decrypter area before any destructive cleanup begins.

Build 3 is an audit/documentation Build. It does not remove source modules, deploy infrastructure, publish releases, or implement later V1 architecture.

## Audit baseline

- Repository: `rhashiki/github-decrypter`
- Base branch: `main`
- Base commit: `6a8d2fb579f56cce6311eeea83065396055baa53`
- Base Git tree: `aa4952b88d15ac030ed727d9d6fc1eb716d08146`
- Original Lovable Decrypter fork point: `573040f891e4c7ae3627710d41a2d6c0d5b63f7b`
- Build branch: `build/3-full-legacy-inventory`

## Method

1. Resolve the exact `main` commit/tree after Build 2.
2. Retrieve the repository Git tree recursively. GitHub returned `truncated: false`, establishing a complete path inventory for the audited tree.
3. Inspect every top-level product area and the important nested runtime/backend/test trees.
4. Inspect the current extension manifest, README and canonical launcher source to identify active Lovable runtime authority.
5. Inspect local runtime, security, storage, GitHub, benchmark, training, release/update, test and Supabase backend structures.
6. Compare inherited capabilities against the frozen V1 scope and Product Constitution.
7. Assign a disposition: `KEEP`, `MIGRATE`, `REFACTOR`, or `DELETE`.
8. Encode the decisions in both human-readable and machine-readable forms.
9. Record migration risks and hard stop conditions for Build 4.

## Audited top-level areas

- `.github/`
- `ai/`
- `assets/`
- `background/`
- `benchmark/`
- `content/`
- `core/`
- `docs/`
- `github/`
- `launcher/`
- `release/`
- `runtime/`
- `scripts/`
- `security/`
- `settings/`
- `storage/`
- `supabase/`
- `tests/`
- `tools/`
- `training/`
- `updates/`
- root manifest, README, changelog, release and origin files

## Deliverables

- `docs/audit/LEGACY_DISPOSITION_MATRIX.md`
- `docs/audit/legacy-disposition-rules.json`
- `docs/audit/BUILD3_RISK_REGISTER.md`
- `docs/builds/BUILD_3_FULL_LEGACY_INVENTORY.md`

## Principal findings

### 1. Active shipped surface is still Lovable-specific

`manifest.json` still names Lovable Decrypter, grants Lovable host permissions and injects `launcher/launcher-runtime.js` only on Lovable domains. The launcher itself uses `LD`/Lovable identifiers and provides a large injected product UI.

Disposition: `REFACTOR` in the Build 4/5 migration sequence.

### 2. Modern engine value is substantial

The inherited `core/`, `background/`, runtime and test trees already contain useful implementations/concepts for patching, Scope Lock, Scope Intelligence, checkpoints, continuity, reversible operations, Tool Runtime, MCP/Trust, agents, local models, validation, context, project state, GitHub and security.

These are not discarded with the Lovable shell. They are classified mainly `KEEP`, `MIGRATE`, or `REFACTOR` and become inputs to later V1 Builds.

### 3. Runtime ownership is wrong for the new constitution

Many heavy engines currently live in extension background/content layers. GitHub Decrypter requires durable execution in an independent local runtime.

Disposition: migrate heavy engines out of browser lifecycle; reduce the extension to GitHub launcher/bridge responsibility.

### 4. Old mandatory hosted backend must not become GitHub Decrypter infrastructure

The inherited `supabase/` tree includes a full `ld-*` service backend, migrations, commercial/licensing/release/cloud-migration functions and hosted runtime/state systems.

Disposition: extract explicitly useful provider-independent/provider-specific patterns, then delete the old internal backend authority. Supabase is later rebuilt as a first-class optional backend provider for the user's project.

### 5. Inherited release authority is a live migration hazard

The old release workflow can write releases/release metadata and invoke the signed legacy OTA bridge when triggered. Build 4 must neutralize it before any GitHub Decrypter tag/release work.

Until then: no `v*` tags, no `.github/RELEASE_TRIGGER` modification, and no manual dispatch of inherited release workflows.

### 6. Old training pipeline is outside V1

The in-repository QLoRA/fine-tuning pipeline is useful history but not frozen V1 product scope.

Disposition: `DELETE` from active V1 tree; future training work requires RFC.

## Capability preservation map

The following inherited capability families are protected from accidental deletion:

- patching
- Scope Lock / Scope Intelligence
- checkpoints and operation journal
- reversible operations / smart undo-redo
- continuity/recovery concepts
- local model runtime/routing
- Tool Runtime
- MCP Core / Trust Gateway / marketplace concepts
- agent registry/orchestration/sandbox/native sessions
- portable skills
- validation/regression/security invariants
- Context Engine / project state / knowledge concepts
- GitHub adapter/auth concepts
- Supabase provider concepts
- benchmark infrastructure

Their current file location is not permanent; their capability disposition is.

## Authorities explicitly scheduled for elimination

- Lovable domains as product host
- Lovable project creation/runtime/GitSync
- Lovable Cloud migration as internal product function
- injected side-rail/panel as the primary IDE
- extension service worker as heavy/durable backend
- page/content state as job authority
- mandatory Gemini agent architecture
- mandatory internal Supabase/cloud backend
- inherited LD licensing/commercial/MercadoPago/release-feed system
- inherited OTA/release metadata and triggers
- historical Lovable Build workflows as active CI
- historical Lovable docs as active product documentation
- QLoRA training pipeline as V1 product code

## Acceptance criteria

- [x] Audit is pinned to an exact `main` commit and Git tree.
- [x] Recursive Git tree was obtained without truncation.
- [x] Every top-level inherited repository area is covered by the disposition model.
- [x] Lovable-specific active manifest/launcher authority is identified.
- [x] Browser content/background runtime ownership is classified.
- [x] Modern reusable engine families are protected from accidental deletion.
- [x] Local runtime prototype is classified.
- [x] Git/GitHub architecture is classified.
- [x] Gemini/AI provider inheritance is classified.
- [x] Security/settings/storage inheritance is classified.
- [x] Full inherited Supabase internal backend is classified.
- [x] Tests/workflows/release/update/training/docs inheritance is classified.
- [x] Human-readable disposition matrix exists.
- [x] Machine-readable disposition rules exist with fail-safe `REVIEW` default.
- [x] Migration risk register and Build 4 hard stops exist.
- [x] No source implementation is deleted by Build 3.
- [x] No release, OTA, browser-store publication, production deployment, database deployment, or DNS mutation is performed.

## Build 4 entry condition

Build 4 — Lovable Decoupling may begin only using this audit as its removal authority. A path not safely resolved by the matrix/rules defaults to `REVIEW`, never automatic deletion.

## Next Build

**Build 4 — Lovable Decoupling**
