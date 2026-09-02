# Build 5 — GitHub Decrypter Rebrand

## Goal

Replace active predecessor identity with the canonical GitHub Decrypter identity without reactivating browser execution or prematurely implementing the Build 6+ architecture.

## Changes

- manifest name/version/description use GitHub Decrypter;
- README becomes current GitHub Decrypter product documentation;
- active changelog restarts under independent Build numbering;
- canonical storage prefix becomes `gd_`;
- canonical protocol/schema prefix becomes `gd-`;
- inherited hosted backend defaults are removed;
- old local settings key is supported only as a one-shot migration source;
- local-runtime documentation identifies the asset as GitHub Decrypter migration input;
- CI moves from the Build 4 decoupling workflow to a Build 5 identity/regression gate.

## Explicit non-changes

- no GitHub launcher implementation yet;
- no React Studio/PWA implementation yet;
- no daemon/monorepo implementation yet;
- no Release/OTA/store publication;
- no production deploy/backend/DNS mutation;
- no wholesale rename of preserved source paths whose physical migration belongs to Build 6+.

## Acceptance criteria

1. `manifest.json` identifies only GitHub Decrypter and remains inert.
2. Active README/changelog/runtime-facing documentation does not present the predecessor as the product.
3. `settings/config.js` exports `github-decrypter`, `gd_settings`, `gd_history` and `gd-*` schemas.
4. Old hosted backend URLs/defaults are empty/disabled.
5. `storage/settings-store.js` migrates `ld2_settings` once to `gd_settings` and removes the old key.
6. Historical lineage/audit/provenance may still name the predecessor where factually required.
7. Modern engines preserved by Build 4 are not deleted.
8. CI has read-only repository permissions and passes identity, decoupling, preservation and syntax checks.

## Definition of Done

Build 5 is complete only after the branch diff is reviewed, CI succeeds, the PR is mergeable and the merge occurs through a PR into `main`.
