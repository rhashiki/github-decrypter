# Vortex Ars AI — Global Definition of Done

A Build is DONE only when every applicable item below is satisfied. Functional appearance alone is insufficient.

## Scope
- implementation matches the frozen Build scope and adopted amendments
- applicable Product Contract requirements and acceptance criteria remain traceable to the scoped change
- no unapproved scope expansion
- no hidden sub-build
- no unrelated refactor mixed in
- `pnpm run guardian` reports no forbidden architectural drift
- `architecture.guardian.json` is advanced deliberately when the current Build changes; phase gates are not disabled merely to make CI pass

## North Star
- product-affecting changes are reviewed against `docs/product/NORTH_STAR_MANIFESTO.md`
- product-affecting changes comply with adopted Amendments 005–009 where applicable
- applicable North Star questions in the PR template are answered
- user autonomy is not increased by silently removing user control
- adaptive profile/personality data never grants execution authority
- beginner accessibility does not remove advanced capability from experienced users
- local-first claims remain honest about hardware/model/context limits
- commercial communication does not imply the paid product is free merely because local inference can avoid per-token provider charges

## Complete Product Generation
- substantial new-product work has a Project Genesis/Product Contract before substantial implementation unless the user explicitly requested a prototype/spike
- foreseeable product decisions were resolved or recorded as explicit unresolved/external dependencies rather than silently guessed
- Vortex asks the user for product intent and does not offload ordinary engineering decisions merely to reduce internal reasoning
- every requested capability represented as complete works end to end across applicable UI/runtime/backend/data/integration layers
- no requested-scope TODO, fake production data, stub handler, nonfunctional control, mocked backend presented as real, or "coming soon" behavior is counted as complete unless explicit prototype behavior was authorized
- representative user journeys derived from the Product Contract are validated where applicable
- a blocked acceptance criterion remains blocked and creates correction work; it is not waived by agent assertion
- ordinary substantive build requests target Release Candidate quality by default

## One Intelligence / Tokenless UX
- canonical user-facing intelligence is Vortex Ars AI
- core Vortex intelligence works through the supported local path without requiring any external AI-provider API key
- optional BYOK may exist only as an advanced user-funded accelerator and is never required for core operation
- normal product UX does not require provider/model shopping
- users do not purchase, allocate or manage Vortex tokens as the operational unit of Vortex usage
- internal context/model/runtime routing remains replaceable implementation detail
- finite compute, memory, storage, model/context and time limits are represented honestly

## Local Sovereignty / Zero Marginal Compute
- local compute is the canonical primary execution path for Vortex intelligence
- no capability declared core depends on Vortex-managed paid AI inference or a Vortex-funded cloud GPU
- no silent paid remote fallback exists behind local inference failure
- optional external AI/media providers use user-owned credentials or directly user-funded accounts
- BYOK credentials remain inside the Secrets Vault/runtime boundary and never grant capability, scope, approval or write authority
- supported installed local capabilities have an honest offline/degraded path when their operation is inherently local
- media-generation architecture follows the same local-first/user-funded-external rule
- release evidence demonstrates that ordinary heavier usage does not create a mandatory Vortex-paid inference dependency

## Complexity Budget
- the change does not create unresolved duplicate sources of truth
- no responsibility boundary is crossed through a workaround merely to ship the feature
- forbidden/circular dependency growth is not introduced
- dead/legacy code created obsolete by the scoped change is removed when safe and in scope
- repeated compatibility branches/workarounds that reveal an inadequate abstraction trigger architectural review
- Refactor Before Feature is applied when the requested feature exceeds declared module/domain responsibility
- Architecture Guardian remains deterministic enforcement; Heimdall remains conformance analysis, not a substitute for enforcement

## Knowledge / Browser / Media Safety
- untrusted document/reference/browser content is treated as data, not instruction authority
- large source/browser/document state is narrowed/windowed when deterministic retrieval can avoid unnecessary context expansion
- browser interaction remains behind Tool Runtime, capabilities, Scope Lock and project scope
- generated likeness/voice/reference-media use respects applicable authorization/consent requirements
- long-form media generation records durable timeline/segment state and validates final composition where applicable
- generated media and compiled portable project knowledge remain ordinary project assets subject to privacy/export rules

## Engineering Intelligence / Portable Generation
- local model recommendation uses hardware/capability/evidence rather than parameter size alone where applicable
- core memory capture/search/handoff remains useful without mandatory LLM inference
- memory consolidation does not silently rewrite canonical Product Contract/Architecture/Git/Validation truth
- substantial implementation follows sufficient inspect/design/plan before mutation
- deterministic write-time checks run where appropriate and protected configuration is not weakened merely to pass
- the smallest safe existing/stdlib/native/installed solution is preferred before adding abstraction/dependency
- browser/app adapters are verified before their output is trusted
- generated-project AI agents have explicit app-level scope and never inherit Vortex host capabilities
- generated client code contains no secret AI/provider credential
- framework-neutral intent, when used, exports ordinary native target-framework code
- media recipes retain applicable provenance/model/parameter/reference facts
- external dependencies have recorded license/security/maintenance review before direct adoption
- reference-only/copyleft code is not copied/vendorized into proprietary Core without explicit approval

## Code Quality
- typecheck passes where applicable
- lint passes where applicable
- unit tests pass
- integration tests pass where applicable
- build/package validation passes
- no known critical regression remains open inside the Build scope

## Runtime and Failure Behavior
- expected success path validated
- expected error path validated
- restart/retry/idempotency behavior validated where applicable
- offline/degraded behavior validated for local/remote boundaries where applicable
- destructive replay risk explicitly handled

## Security
- capability requirements declared
- secrets are not exposed to frontend state/logs
- least privilege maintained
- destructive operations respect approval policy
- Scope Lock/Trust Gateway cannot be bypassed by the new path
- no agent name, personality, user-profile attribute or UI state grants privileged authority
- no known critical/high security issue introduced

## Data and Migration Safety
- migrations are reversible or recovery path is documented when applicable
- user data compatibility is validated
- schema/protocol versioning is explicit where applicable

## UX
- loading, success, empty, failure, permission-denied, offline, and recovery states exist where applicable
- user is not misled about completion, connectivity, model limits, or provider state
- long-running work exposes durable status rather than fake frontend progress
- explanations and learning behavior remain optional and appropriately progressive where applicable

## Documentation
- Build document exists
- architecture/contracts are updated when changed
- operator/user-facing behavior is documented when needed
- acceptance criteria are checked with evidence
- an adopted constitutional or North Star change is recorded as an explicit amendment rather than silently rewriting governance history

## Git/Review
- work occurs on the Build branch
- diff reviewed for scope
- PR describes the Build, risks, tests, and exclusions
- Architecture Guardian CI passes
- merge to `main` occurs only after validation

## RC Evidence Gate
For a Build that contributes to a product Release Candidate:
- Product Contract acceptance matrix is complete for the candidate scope
- applicable build/type/lint/unit/integration/E2E/behavioral/visual/security/architecture/performance evidence is present
- applicable Security Coverage records tested/partial/untested surfaces honestly
- applicable Architecture Guardian and Heimdall evidence is green
- unresolved user-only/external dependencies are explicit
- no Zero Placeholder violation remains
- RC-blocked work returns to correction/retest rather than being communicated as ready

## Release Gate
Completing or merging a Build, including Build 133 RC readiness, does NOT authorize:
- production deployment
- release publication
- OTA publication
- browser-store publication
- production database mutation
- production DNS mutation

Those actions require explicit authorization and the applicable release/deployment policy.

## Final Rule
If an acceptance criterion is incomplete, the Build remains open. The solution is to finish or correct the existing scoped implementation, not invent a new feature sub-build.

"Done" is an evidence-backed state, not a conversational claim.
