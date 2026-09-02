# GitHub Decrypter — RFC and Scope Change Policy

## Purpose
Prevent V1 from expanding indefinitely during implementation.

## Rule
After Build 2 is merged, frozen V1 scope may not be expanded inside an active Build.

## When an RFC is required
- new feature not listed in frozen V1 scope
- new provider not listed in frozen V1 scope
- new agent role not listed in frozen V1 scope
- new product surface or major workflow
- architectural replacement that is not required to satisfy existing acceptance criteria
- convenience improvement that materially expands implementation scope

## When an RFC is not required
- bug fix required for frozen behavior to work
- security correction
- regression correction
- missing test required by Definition of Done
- compatibility fix required by the declared support matrix
- clarification of an existing frozen requirement without expanding it
- internal implementation choice that preserves contracts and scope

## RFC Lifecycle
1. Record the idea without interrupting the active Build.
2. State motivation, user value, architecture impact, security impact, maintenance cost, and alternatives.
3. Mark target as `V1.1+` by default.
4. Evaluate only during a dedicated future planning window.
5. If accepted, allocate a new normal Build number. Never append `.1`, `B`, `hot-add`, or similar feature sub-build identifiers.

## Emergency Exception
A scope change may enter the current V1 sequence only when required to prevent a critical security issue, data-loss condition, or fundamental inability to meet an already-frozen V1 completion criterion. The exception must be documented as a correction to frozen scope, not disguised as a convenience feature.

## Anti-Scope-Creep Rule
"While we are here" is not an architectural justification.

## Build Numbering Rule
Feature development uses whole sequential Build numbers. A Build can receive corrective commits before it closes, but corrective commits do not create new feature scope and do not create sub-builds.