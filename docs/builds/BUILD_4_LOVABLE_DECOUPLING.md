# Build 4 — Lovable Decoupling

Status: IMPLEMENTED ON BUILD BRANCH — pending PR validation/merge

## Objective

Remove functional Lovable-specific authority from the inherited extension without deleting modern engines that belong to the frozen GitHub Decrypter V1 architecture.

## Changes

### Active extension path neutralized
- removed `lovable.dev` host permissions and content-script injection from `manifest.json`;
- removed the inherited Lovable launcher runtime;
- the extension is intentionally an inert transition shell until the GitHub-native launcher is implemented by the roadmap;
- no browser background runtime is activated by the transition manifest.

### Release / OTA authority removed
- removed `.github/RELEASE_TRIGGER`;
- removed inherited `release.yml`;
- removed all inherited v2.x/diagnostic workflows as an authority set;
- removed inherited release manifests, OTA metadata/update manager and release preflight;
- removed the old Lovable release documentation.

### Lovable project / GitSync / cloud authority removed
- removed the legacy content application shell;
- removed Lovable project creator/runtime;
- removed Lovable GitSync verifier;
- removed Lovable cloud-migrator content runtimes;
- removed inherited cloud asset/completion/migration background runtimes;
- removed inherited Lovable project background runtime;
- removed old Lovable license-key authority.

### Out-of-scope legacy removed
- removed the inherited fine-tuning/training pipeline, which is explicitly outside frozen V1 scope;
- removed Build82 canonical-UI and modern-engine tests that encoded the old Lovable launcher/package authority;
- replaced them with GitHub Decrypter Build 4 regressions.

### Modern engines preserved
The Build 4 regression explicitly preserves migration assets for local AI, tools, MCP/Trust, context, Scope, reversible operations, continuity, agents, skills, sandbox, native sessions, validation and checkpoints. They remain source/migration assets only; browser service-worker/content lifetime is not promoted to final V1 execution authority.

### External source reuse policy
Build 4 also formalizes aggressive but auditable source reuse:
- `COPY` / `ADAPT` for compatible permissively licensed source after file-level provenance review;
- `REIMPLEMENT` for useful behavior whose source license is incompatible with intended use/distribution;
- `REFERENCE` for architecture-only mining;
- provenance is recorded in `third-party-sources.json` and `docs/legal/THIRD_PARTY_PROVENANCE.md`.

Initial candidates include Transformers, Continue, CrewAI, Monaco Editor, assistant-ui, Adorable, December, v0.diy and n8n (reference-only by default due its Sustainable Use/Enterprise licensing model).

## Explicit non-actions

Build 4 does not:
- deploy or mutate Supabase infrastructure;
- turn inherited `supabase/functions/ld-*` into GitHub Decrypter backend authority;
- implement the final GitHub launcher;
- implement the Studio/PWA/local daemon prematurely;
- publish Release, OTA, Chrome Store package, deployment or DNS changes;
- rebrand every remaining identifier — systematic identity migration is Build 5.

## Regression gates

- `node scripts/test-build4-lovable-decoupling.mjs`
- `node scripts/test-build4-modern-engine-preservation.mjs`
- `.github/workflows/build4-lovable-decoupling.yml` has `contents: read` only and runs no publishing/deployment/database mutation.

## Acceptance criteria

- [x] no `lovable.dev` target remains in the active extension manifest;
- [x] inherited Lovable launcher is not active or present;
- [x] explicit Lovable project/GitSync/cloud migration authorities are removed;
- [x] inherited release/OTA authority is removed;
- [x] old product license authority is removed;
- [x] modern V1 engines remain present as migration assets;
- [x] browser background/content layers are not activated as durable execution authority;
- [x] external-source reuse/provenance policy is recorded;
- [x] regression tests prevent accidental reintroduction of the removed authorities;
- [x] no Release/OTA/store/deploy/Supabase/DNS mutation is performed.
