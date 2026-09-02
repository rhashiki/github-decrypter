# Build 2 — Product Constitution & Scope Freeze

## Purpose
Freeze the GitHub Decrypter V1 product contract before implementation expands further.

## Deliverables
- `docs/product/PRODUCT_CONSTITUTION_V1.md`
- `docs/product/V1_SCOPE.md`
- `docs/product/NON_GOALS_V1.md`
- `docs/product/DEFINITION_OF_DONE.md`
- `docs/product/RFC_POLICY.md`

## Decisions Locked by This Build
- GitHub Decrypter and Lovable Decrypter remain independent products.
- Git is the source of truth for project code/versioning.
- the local filesystem is the active workspace.
- Chrome extension is a lightweight GitHub launcher/bridge.
- Studio is React + TypeScript and an installable PWA.
- privileged/heavy execution belongs to the independent local runtime.
- jobs are durable and independent of browser/chat lifecycle.
- local-first and offline-capable behavior is mandatory where operations are inherently local.
- long prompts are decomposed into structured requirements, task graphs, persistent jobs, and hierarchical context.
- raw model context/token limits remain technically finite but are abstracted from normal user workflow through orchestration and persistence.
- local AI is first-class; external AI providers are optional.
- backend, deployment, domain, AI, MCP, and plugin integrations use explicit provider/contracts rather than hard coupling.
- Supabase is first-class but optional.
- no hidden release/deploy authority is granted by completing a Build.
- V1 feature scope is frozen.
- new ideas discovered during implementation go to RFC/V1.1+ unless they are required corrections to existing frozen scope.
- feature sub-builds are prohibited.

## Excluded
- source-code rebrand
- Lovable-specific code removal
- monorepo migration
- runtime implementation
- React/PWA implementation
- new provider implementation
- any release/OTA/store publication

## Acceptance Criteria
- [x] Constitution exists and is marked frozen for V1.
- [x] V1 scope inventory exists and covers the complete agreed product surface.
- [x] Non-goals are explicit.
- [x] Global Definition of Done is explicit.
- [x] RFC/scope-change policy is explicit.
- [x] finite model context is described honestly while preserving the no-token-burden product goal.
- [x] offline, durable execution, restart recovery, and browser independence are constitutional requirements.
- [x] provider-agnostic backend/deploy/domain/AI/plugin architecture is frozen.
- [x] no implementation feature is mixed into Build 2.
- [x] no release, OTA, store publication, production deploy, production database mutation, or DNS mutation is performed.

## Next Build
Build 3 — Full Legacy Inventory.