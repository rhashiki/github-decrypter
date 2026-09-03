## Build / Change

- Build:
- Scope authority:
- Related acceptance criteria:

## Architecture Guardian

- [ ] `pnpm run guardian` passes.
- [ ] This change does not move privileged execution into Studio/browser state.
- [ ] This change does not bypass shared protocol, Event Bus, Scope Lock, capability or approval boundaries.
- [ ] New dependencies stay inside the owning module boundary.
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
8. Does it respect local-first where technically reasonable?
9. Does it avoid unnecessary third-party dependency?
10. Does it have a clear justification within the commercial product?

## Human authority

- [ ] Actions outside already granted authority require explicit user approval.
- [ ] Agent identity/personality does not imply extra capability.
- [ ] Adaptive profile data does not grant security authority.

## Validation

Describe tests, diagnostics, scope checks and any manual validation performed.
