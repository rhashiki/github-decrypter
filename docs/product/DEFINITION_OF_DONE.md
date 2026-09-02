# GitHub Decrypter — Global Definition of Done

A Build is DONE only when every applicable item below is satisfied. Functional appearance alone is insufficient.

## Scope
- implementation matches the frozen Build scope
- no unapproved scope expansion
- no hidden sub-build
- no unrelated refactor mixed in
- Architecture Guardian reports no forbidden drift

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
- no known critical/high security issue introduced

## Data and Migration Safety
- migrations are reversible or recovery path is documented when applicable
- user data compatibility is validated
- schema/protocol versioning is explicit where applicable

## UX
- loading, success, empty, failure, permission-denied, offline, and recovery states exist where applicable
- user is not misled about completion, connectivity, model limits, or provider state
- long-running work exposes durable status rather than fake frontend progress

## Documentation
- Build document exists
- architecture/contracts are updated when changed
- operator/user-facing behavior is documented when needed
- acceptance criteria are checked with evidence

## Git/Review
- work occurs on the Build branch
- diff reviewed for scope
- PR describes the Build, risks, tests, and exclusions
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