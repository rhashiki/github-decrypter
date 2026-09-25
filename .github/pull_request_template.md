## Build / Change

- Build:
- Scope authority:
- Related acceptance criteria:

## Architecture Guardian

- [ ] `pnpm run guardian` passes.
- [ ] This change does not move privileged execution into Studio/browser state.
- [ ] This change does not bypass shared protocol, Event Bus, Scope Lock, capability or approval boundaries.
- [ ] New dependencies stay inside the owning module boundary.
- [ ] This change does not make core Vortex depend on Vortex-paid AI inference, a Vortex-funded cloud GPU, or mandatory BYOK.
- [ ] Any optional external AI/media provider is user-funded and credentialed through the approved local Secrets Vault/runtime boundary.
- [ ] This change does not create a new canonical agent when a non-authoritative Specialist Profile would satisfy the need.
- [ ] Specialist Profiles introduced/changed here grant no independent capability, scope, approval, tool, mutation, validation, architecture or release authority.
- [ ] Imported/bundled Specialist Profiles retain source/version/license provenance and are loaded on demand rather than as full-catalog context.
- [ ] Model/provider/runtime changes preserve One Intelligence and do not grant provider identity product/agent authority.
- [ ] Parent/worker context limits derive from the model actually executing the work; fallback does not blindly retry an unfittable context.
- [ ] New background/parallel work has bounded fan-out, queues, cancellation and compute/tool admission.
- [ ] Dangerous-operation confirmation labels/descriptions are host-owned canonical metadata, not caller/model/plugin text.
- [ ] Plugin/extension access is permission + scope + consent + runtime-enforcement bounded, with default-deny egress where applicable.
- [ ] PI-Desktop LGPL source has not been copied/vendorized into Vortex Core without explicit legal/architecture approval.
- [ ] Local model recommendation (if changed) uses hardware/capability/evidence rather than model size alone.
- [ ] Memory/consolidation changes preserve canonical truth separation and a zero-LLM core recall path.
- [ ] Minimal Solution Ladder was considered before introducing new abstraction/dependency.
- [ ] Write-time lint/security/test configuration is not weakened merely to make generated code pass.
- [ ] This change does not leave a superseded legacy implementation active as a competing source of behavior.
- [ ] New modern code does not create a permanent dependency on inherited legacy roots; temporary shims have an owner/reason/removal condition.
- [ ] No commented-out code is retained as rollback/history; Git is used for history.
- [ ] Comments add non-obvious why/invariant/provenance value rather than narrating code or recording patch history.
- [ ] TODO/FIXME/HACK markers introduced here are traceable, temporary and have a clear removal condition.
- [ ] Generated-app agents/browser adapters have explicit project/session scope and do not inherit Vortex host authority.
- [ ] Generated client code contains no provider/model secret.
- [ ] New external code dependencies include recorded license/security/maintenance review.
- [ ] No Release, OTA, store publication, production deploy, production database mutation or DNS mutation is implied by completing this change.

## North Star review

For product-affecting changes, answer the applicable questions. `N/A` is acceptable when the change is purely internal/technical, but should be explicit.

1. Does this move GitHub Decrypter closer to its mission?
2. Does it make it easier to transform intention into software?
3. Does it improve the team's ability to understand the user?
4. Does it improve understanding of the project?
5. Does it increase autonomy without removing user control?
6. Does it work for different technical skill levels?
7. Does it help build, understand, test or learn?
8. Does it preserve local compute as the canonical Vortex intelligence path?
9. Does it avoid creating a Vortex-paid variable inference dependency?
10. If it adds external AI/media compute, is it optional, user-funded and non-authoritative?
11. Does it avoid unnecessary third-party dependency?
12. If specialist expertise is involved, does it preserve canonical-agent authority and bounded context loading?
13. Does it have a clear justification within the commercial product?

## Human authority

- [ ] Actions outside already granted authority require explicit user approval.
- [ ] Agent identity/personality does not imply extra capability.
- [ ] Adaptive profile data does not grant security authority.

## Validation

Describe tests, diagnostics, scope checks and any manual validation performed.
