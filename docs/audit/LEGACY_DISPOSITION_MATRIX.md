# GitHub Decrypter — Legacy Disposition Matrix

Status: **FROZEN BY BUILD 3**

Audit base:
- repository: `rhashiki/github-decrypter`
- audited `main`: `6a8d2fb579f56cce6311eeea83065396055baa53`
- audited tree: `aa4952b88d15ac030ed727d9d6fc1eb716d08146`
- inherited Lovable Decrypter fork point: `573040f891e4c7ae3627710d41a2d6c0d5b63f7b`

This matrix is the migration authority for inherited code. It does **not** delete code in Build 3. It defines what later Builds are allowed to preserve, move, rewrite, or remove.

## Disposition meanings

- `KEEP` — behavior and implementation are already sufficiently generic to remain as a source asset, subject only to naming/import changes required by the new repository structure.
- `MIGRATE` — the capability belongs in GitHub Decrypter V1, but must move behind the new Studio/local-runtime/package/provider architecture.
- `REFACTOR` — the underlying idea is useful but the current implementation has wrong ownership, coupling, lifecycle, API shape, or product assumptions and must be substantially rewritten.
- `DELETE` — the inherited implementation does not belong in the frozen GitHub Decrypter V1 architecture. Git history is the archive; dead compatibility files must not remain active.

## 1. Repository root and package identity

| Path / module | Disposition | Reason / destination |
|---|---|---|
| `.gitignore` | KEEP | Generic repository hygiene. Extend later for monorepo/runtime artifacts. |
| `GITHUB_DECRYPTER_ORIGIN.md` | KEEP | Canonical lineage record for the independent project. |
| `manifest.json` | REFACTOR | Still identifies Lovable Decrypter, targets `lovable.dev`, injects the old launcher, and carries Lovable-specific Gecko ID. Build 4 removes Lovable coupling; Build 5 completes product identity. |
| `README.md` | REFACTOR | Entirely documents the old Lovable/GitSync/Gemini-extension workflow. Must become GitHub Decrypter documentation. |
| `CHANGELOG.md` | REFACTOR | Preserve historical value only through Git history; active changelog must restart under GitHub Decrypter numbering. |
| `RELEASE.md` | DELETE | Describes inherited Lovable Decrypter release process. V1 gets a new distribution/release process later. |
| `assets/icon*.png` | REFACTOR | Current extension assets are inherited branding. Replace with GitHub Decrypter-owned identity; do not treat them as canonical V1 brand assets. |

## 2. `.github/` workflows

| Module | Disposition | Reason / destination |
|---|---|---|
| `.github/RELEASE_TRIGGER` | DELETE | Old Lovable release trigger must never authorize GitHub Decrypter publication. |
| `.github/workflows/release.yml` | DELETE | Old release authority and packaging assumptions. |
| `.github/workflows/v2.2-*` through `v2.6-*` | DELETE | Historical Lovable Decrypter Build workflows. Relevant assertions may be translated into new V1 CI, but the old workflow files themselves are not an authority. |
| old Build 60–75 validation concepts | MIGRATE | Local model, tool runtime, MCP, context, scope, undo/redo, continuity, agent orchestration, sandbox and benchmarks are valuable test intent; recreate under the new monorepo architecture. |
| old Build 76/77/78/82 Lovable/launcher emergency workflows | DELETE | They validate the old injected extension lifecycle, not the new Studio/runtime topology. |

No inherited workflow is permitted to publish a GitHub Decrypter release, OTA, store build, production deployment, database mutation, or DNS mutation.

## 3. Launcher and old injected UI

### `launcher/launcher-runtime.js` — REFACTOR

Useful concepts:
- lightweight FAB/launcher interaction;
- Shadow DOM isolation;
- extension-owned connection indicator;
- small browser-side bridge.

Must be removed/replaced:
- `window.__LD_*` authority;
- Lovable Decrypter IDs and versioning;
- Lovable integration menu item;
- side rail/panel acting as the product UI;
- injected multi-feature IDE behavior;
- any assumption that the browser page owns execution.

Target: a **small GitHub repository launcher** that opens/connects to the React PWA Studio. Heavy UI does not remain inside the content script.

## 4. `content/` inherited browser modules

### DELETE

- `content/content.js` as the old extension application shell.
- `content/lovable-project-creator.js`
- `content/lovable-project-runtime.js`
- `content/lovable-sync-verifier.js`
- `content/cloud-migrator-runtime.js`
- `content/cloud-migrator-runtime-v2.js`

Reason: GitHub Decrypter does not depend on Lovable project creation, Lovable GitSync, or Lovable Cloud migration as an internal product authority.

### MIGRATE / REFACTOR into shared protocol, Studio, or local runtime

- `agent-runtime-registry-client.js` — MIGRATE to Studio/runtime protocol client.
- `agent-sandbox-client.js` — MIGRATE to Studio/runtime protocol client.
- `context-engine-client.js` — MIGRATE.
- `continuity-runtime-client.js` — MIGRATE.
- `local-agent-orchestrator-client.js` — MIGRATE.
- `mcp-marketplace-client.js` — MIGRATE.
- `mcp-runtime-client.js` — MIGRATE.
- `native-agent-session-client.js` — MIGRATE.
- `portable-skills-client.js` — MIGRATE.
- `reversible-operations-client.js` — MIGRATE.
- `tool-runtime-client.js` — MIGRATE.
- `integration-readiness-client.js` / `integration-callback-bridge.js` — REFACTOR into provider connection contracts.
- `activity-cloud-sync.js` — REFACTOR; V1 local state is authoritative and remote sync cannot be mandatory.
- `credential-ui-guard.js` — MIGRATE security behavior to Studio + secrets capability boundaries.
- `error-intelligence-core.js` — MIGRATE to Error Intelligence.
- `project-recovery-doctor-core.js` — MIGRATE to Environment/Recovery Doctor.
- `project-state-graph-core.js` / `unified-project-state-graph.js` — MIGRATE into project knowledge/state graph.
- `skill-router.js` — MIGRATE into skills/plugin routing.
- `user-edit-context.js` — MIGRATE into human-vs-AI change tracking and transaction context.
- `live-operations.js` — REFACTOR; execution status belongs to durable local Jobs/Event Bus, not page-local browser state.

After migration, the extension content surface must contain only GitHub detection/launcher/bridge code needed by the frozen V1 scope.

## 5. `background/` inherited extension service-worker runtime

The directory currently contains useful engines but assigns them to the wrong process. GitHub Decrypter V1 constitution says privileged/heavy work belongs to the independent local runtime.

### DELETE

- `lovable-project-runtime.js`
- `cloud-assets-runtime.js`
- `cloud-complete-runtime.js`
- `cloud-migration-runtime.js`
- inherited cloud/commercial messaging paths whose only purpose is the old Lovable Decrypter hosted product

### REFACTOR

- `service-worker.js` — must cease being the application backend. Replace with a thin extension bridge.
- `service-worker-entry.js` — thin bridge/bootstrap only.
- `integration-callback-runtime.js` / `integration-readiness-runtime.js` — provider-neutral connection lifecycle.
- `update-recovery-runtime.js` — new runtime/extension updater with atomic update and rollback rules.
- `github-autosync-runtime.js` — GitHub Decrypter uses local Git as code authority; automatic remote synchronization must be redesigned around explicit Git operations/approval.
- `project-migration-runtime.js` — no generic migration authority exists in frozen V1; retain only reusable import ideas if required by workspace onboarding.

### MIGRATE to local runtime/packages

- agent runtime client/registry/sandbox
- approval runtime
- checkpoint runtime
- context engine runtime
- continuity runtime
- GitHub App runtime
- guarded commit bootstrap
- intelligence bootstrap
- knowledge client
- local agent orchestrator
- local model runtime
- MCP marketplace/runtime
- model gateway bootstrap/client
- native agent session runtime
- portable skills runtime
- project state runtime
- reversible operations runtime
- scope intelligence runtime
- Supabase OAuth runtime, but only inside the Supabase/provider boundary
- tool runtime

Browser service-worker lifetime must never own durable jobs after migration.

## 6. `core/` modern engines

These are the highest-value inherited assets. The capability set aligns strongly with the frozen V1, but most modules must move into versioned packages/local runtime rather than stay as extension-global scripts.

### KEEP as reusable implementation primitives

- `utils.js` — generic helpers, subject to dependency review.
- pure portions of `patch-engine.js` — minimal patch semantics are directly reusable if tests prove process independence.
- pure portions of `scope-lock.js` — keep invariant semantics while moving enforcement to the runtime.

`KEEP` does not mean keeping the old path forever; Build 6 may physically move them into packages.

### MIGRATE

- `agent-runtime-registry.js`
- `agent-sandbox.js`
- `approval-transaction.js`
- `checkpoint-manager.js`
- `context-engine-v2.js`
- `continuity-engine.js`
- `guarded-commit.js`
- `local-agent-approval.js`
- `local-model-router.js`
- `mcp-client.js`
- `mcp-marketplace.js`
- `mcp-protocol.js`
- `mcp-trust-gateway.js`
- `model-gateway.js`
- `native-agent-sessions.js`
- `operation-journal.js`
- `portable-skills.js`
- `regression-sentinel.js` -> Architecture Guardian inputs
- `reversible-operations.js`
- `scope-intelligence-v2.js`
- `shadow-build.js`
- `tool-runtime.js`
- `validation-gate.js`

### REFACTOR

- `account-integration-readiness.js` — provider-neutral readiness model rather than old account/product assumptions.
- `command-parser.js` — superseded by Prompt Intake + Requirement Compiler; preserve only useful parsing primitives.
- `context-builder.js` — old repository/API context model is too small for the hierarchical Context Engine.
- `decrypter-intelligence.js` — split into explicit Decision/Error/Health intelligence responsibilities rather than a catch-all authority.
- `repo-cache.js` — redesign around local filesystem/Git/object indexing, not remote-GitHub-first cache semantics.
- `response-parser.js` — move under versioned AI provider/protocol schemas; reject ad-hoc model-output authority.

## 7. `ai/`

| Module | Disposition | Target |
|---|---|---|
| `ai/gemini-agent.js` | REFACTOR | Preserve useful structured-output/attachment/provider logic, but Gemini becomes one optional `AIProvider`; no provider may be hardwired as product authority. |

## 8. `github/`

| Module | Disposition | Target |
|---|---|---|
| `github/git-adapter.js` | MIGRATE | Split local Git operations from GitHub remote/API operations. Local filesystem + Git becomes code authority; GitHub adapter becomes a remote collaboration provider. |

## 9. `runtime/decrypter-local/`

Disposition: **MIGRATE**.

Reusable assets:
- Ollama gateway logic;
- vLLM compose path;
- worker-agent pattern;
- health/homologation ideas;
- environment examples.

Required changes:
- rename ownership to GitHub Decrypter local runtime;
- integrate with the new daemon/protocol/job engine rather than extension cloud control;
- remove any hosted-control dependency;
- support installer/model-manager lifecycle instead of assuming manual Docker setup;
- keep Ollama/vLLM as replaceable runtime adapters.

## 10. `security/`

| Module | Disposition | Reason / target |
|---|---|---|
| `license.js` | DELETE | Inherited Lovable Decrypter licensing is not frozen V1 product scope. Do not make local execution depend on the old signed LD key system. |
| `mcp-oauth.js` | MIGRATE | MCP/provider authorization remains required behind Trust Gateway. |
| `trust.js` | MIGRATE | Feed capability/trust model into the V1 security layer. |
| `vault.js` | REFACTOR | Secrets remain required, but V1 must use OS/local secure storage where available and never depend on the old optional hosted Vault API. |

## 11. `settings/` and `storage/`

| Module | Disposition | Target |
|---|---|---|
| `settings/config.js` | REFACTOR | Convert inherited extension settings into versioned Studio/runtime settings. |
| `storage/settings-store.js` | MIGRATE | Move persistent settings into local DB/config with schema/versioning. |
| `storage/secret-sanitizer.js` | MIGRATE | Preserve secret-context exclusion behavior and extend it to all Context/Tool paths. |

`chrome.storage.local` may remain only for extension-local launcher preferences; it cannot be V1 project/job authority.

## 12. `supabase/` inherited internal backend

The entire inherited `supabase/` tree is **not** allowed to remain a mandatory GitHub Decrypter backend. V1 requires a local daemon/database and provider-agnostic user backends.

### Extract/MIGRATE patterns only

- `_shared/github-rsa.js` -> GitHub auth/provider implementation where applicable.
- `ld-github-app` -> GitHub provider/auth concepts.
- `ld-supabase-manager` -> Supabase provider concepts.
- `ld-supabase-oauth` -> Supabase provider connection flow.
- useful trust/validation concepts from `ld-trust-attest` -> local Trust/approval architecture.
- useful knowledge/search algorithms from `ld-knowledge-*` -> local Context/Knowledge architecture if they remain provider-independent.

### DELETE as active V1 product backend

- `ld-cloud-migrator-*`
- `ld-command`
- `ld-commercial`
- `ld-license-validate`
- `ld-mercadopago-webhook`
- `ld-messaging`
- `ld-release-feed`
- old hosted `ld-agent-runtime`, `ld-model-gateway`, `ld-project-state`, `ld-queue-skip`, `ld-local-control`, and `ld-memory-engine` as product authorities after their useful local concepts have migrated
- all inherited internal-service migrations under `supabase/migrations/**`

Important: deleting inherited internal Supabase schema later does **not** remove Supabase support. Supabase support is rebuilt as a first-class **backend provider for the user's project**, not as a mandatory backend for GitHub Decrypter itself.

## 13. `tools/`

| Module | Disposition | Target |
|---|---|---|
| `tools/supabase-tools.js` | REFACTOR | Move behind Backend Provider + Database Agent + capabilities/approval. No direct global Supabase special case. |

## 14. `benchmark/`

Disposition: **MIGRATE**.

`DecrypterBench` and universal agent benchmark ideas are useful for model routing, regression gates, agent quality and later hardening. Rename/restructure them for GitHub Decrypter and remove assumptions tied to old hosted/commercial models.

## 15. `training/decrypter-coder/`

Disposition: **DELETE from V1 active tree**.

The inherited QLoRA training pipeline is not part of frozen V1 scope. GitHub Decrypter V1 consumes local/open model runtimes and model providers; it does not need to ship an in-repository fine-tuning/training pipeline. If model training is reconsidered later, it requires an RFC and a normal future Build.

## 16. Tests

Tests are classified by the capability they protect, not by historical Build number.

### MIGRATE / rewrite as V1 regression tests

- local-model/runtime tests
- tool runtime tests
- MCP protocol/trust/marketplace tests
- context engine tests
- scope intelligence/Scope Lock tests
- smart undo/redo tests
- continuity tests
- local agent/orchestrator tests
- agent registry/sandbox/native-session tests
- benchmark tests
- security chaos tests where invariants remain applicable
- project state/recovery/user-edit tests where they can operate against local workspace/runtime abstractions

### DELETE after extracting any reusable assertion

- Lovable workspace deep-read tests
- Lovable load stability tests
- Lovable GitSync/project creation tests
- old canonical injected UI parity/purge tests
- commercial platform/MercadoPago/license tests not represented by frozen V1
- old release feed/OTA/package tests
- tests whose only contract is an inherited `ld-*` hosted backend

Historical tests are not kept merely to preserve old Build numbering. Git history remains available.

## 17. Scripts, release metadata and updates

| Path | Disposition | Reason |
|---|---|---|
| `scripts/release-preflight.mjs` | DELETE/REBUILD | New distribution topology needs a new preflight. |
| `scripts/test-build82-canonical-ui.mjs` | DELETE | Old injected UI authority. |
| `scripts/test-build82-modern-engines.mjs` | MIGRATE assertions | Useful engine checks become new package/runtime tests. |
| `release/RC25_MANIFEST.json` | DELETE | Historical Lovable release artifact. |
| `release/RC31_MANIFEST.json` | DELETE | Historical Lovable release artifact. |
| `release/homologation-v2.5.57.json` | DELETE | Historical Lovable release artifact. |
| `release/runtime-package.json` | REFACTOR | Rebuild later for new runtime installer/package topology. |
| `updates/latest.json` | DELETE | Signed old Lovable OTA feed metadata. |
| `updates/release.json` | DELETE | Old Lovable release feed metadata. |
| `updates/update-manager.js` | DELETE/REBUILD | New updater must understand extension + PWA + local runtime and atomic rollback. |

## 18. Documentation

### KEEP

- `GITHUB_DECRYPTER_ORIGIN.md`
- `docs/github-decrypter/BUILD-001-PROJECT-FORK-AND-INDEPENDENCE.md`
- `docs/builds/BUILD_2_PRODUCT_CONSTITUTION.md`
- `docs/product/**`
- Build 3 audit documents

### DELETE from active docs after migration knowledge is extracted

- inherited `docs/BUILD*.md` Lovable Decrypter Build documents
- inherited `docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md`
- inherited `docs/USER_GUIDE.md`
- inherited `docs/CHANGELOG.md`
- inherited old architecture/release notes that describe the Lovable-hosted extension as current behavior

Git history is the archival record. The active documentation tree must describe only GitHub Decrypter once migration completes.

## 19. Final architectural buckets

### Capabilities we are intentionally preserving

- patch engine
- Scope Lock / Scope Intelligence
- checkpoints
- reversible operations / smart undo-redo
- continuity
- local model routing/runtime concepts
- Tool Runtime
- MCP + Trust Gateway
- agent registry/orchestration/sandbox
- portable skills
- validation/regression concepts
- context engine / project state / project knowledge concepts
- GitHub adapter/auth concepts
- Supabase integration concepts, but only as a provider
- benchmarks and selected security tests

### Inherited authorities being eliminated

- Lovable page as product host
- Lovable GitSync as preview/update mechanism
- extension service worker as heavy backend
- content script as the IDE
- `chrome.storage.local` as durable project/job authority
- mandatory Gemini architecture
- mandatory internal Supabase/cloud backend
- old licensing/commercial/MercadoPago backend
- old release/OTA metadata and triggers
- old Build-number workflows as active CI
- old QLoRA training pipeline in V1

## Build 4 handoff rule

Build 4 may remove Lovable-specific coupling according to this matrix, but it must **not** prematurely implement later architecture. If removal would destroy a frozen V1 capability marked `KEEP`, `MIGRATE`, or `REFACTOR`, Build 4 must isolate it behind a temporary neutral boundary or defer its physical move to the assigned later Build.
