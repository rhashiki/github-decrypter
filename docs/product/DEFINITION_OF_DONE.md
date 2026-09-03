# GitHub Decrypter — Global Definition of Done

A Build is DONE only when every applicable item below is satisfied. Functional appearance alone is insufficient.

## Scope
- implementation matches the frozen Build scope and adopted amendments
- no unapproved scope expansion
- no hidden sub-build
- no unrelated refactor mixed in
- `pnpm run guardian` reports no forbidden architectural drift
- `architecture.guardian.json` is advanced deliberately when the current Build changes; phase gates are not disabled merely to make CI pass

## North Star
- product-affecting changes are reviewed against `docs/product/NORTH_STAR_MANIFESTO.md`
- applicable North Star questions in the PR template are answered
- user autonomy is not increased by silently removing user control
- adaptive profile/personality data never grants execution authority
- beginner accessibility does not remove advanced capability from experienced users
- local-first claims remain honest about hardware/model/context limits
- commercial communication does not imply the paid product is free merely because local inference can avoid per-token provider charges

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

## Release Gate
Completing or merging a Build does NOT authorize:
- production deployment
- release publication
- OTA publication
- browser-store publication
- production database mutation
- production DNS mutation

Those actions require explicit authorization and the applicable release/deployment policy.

## Final Rule
If an acceptance criterion is incomplete, the Build remains open. The solution is to finish or correct the existing scoped implementation, not invent a new feature sub-build.
