# Build 1 — Project Fork & Independence

## Status

Implementation branch: `build/1-project-fork-independence`

## Purpose

Establish GitHub Decrypter as a product independent from Lovable Decrypter while reusing the complete source snapshot that already exists in `rhashiki/lovable-decrypter-extension`.

## Origin

- Source repository: `rhashiki/lovable-decrypter-extension`
- Source branch: `main`
- Source snapshot: Lovable Decrypter Build 82 / v2.6.82
- Source HEAD at fork point: `573040f891e4c7ae3627710d41a2d6c0d5b63f7b`
- New repository: `rhashiki/github-decrypter`
- GitHub Decrypter build numbering starts at Build 1.

## Independence Contract

1. Lovable Decrypter and GitHub Decrypter are separate products.
2. `rhashiki/lovable-decrypter-extension` remains intact and continues its own roadmap.
3. `rhashiki/github-decrypter` evolves independently from this fork point.
4. No automatic merge, synchronization, cherry-pick, release propagation, OTA propagation, or workflow propagation between the two repositories is authorized.
5. A future change may be ported between projects only as an explicit, reviewed operation.
6. GitHub Decrypter uses its own Build numbering starting at Build 1.
7. No GitHub Decrypter release, OTA publication, store publication, or production deployment is authorized by this Build.

## Snapshot Validation

The GitHub Decrypter repository contains the inherited Build 82 source tree. Existing directories and files retain the same Git object SHAs at the fork point, including the inherited core, AI, GitHub, content, launcher, workflows, tests, documentation, assets, release tooling, and manifest.

The first GitHub Decrypter-specific commit adds `GITHUB_DECRYPTER_ORIGIN.md` on top of the source fork point so the product lineage is explicit without altering the Lovable Decrypter repository.

## Build 1 Scope

### Included

- Create the independent `rhashiki/github-decrypter` repository.
- Carry forward the source snapshot needed as the technical starting point.
- Preserve useful source history and Git object lineage.
- Create an explicit origin marker.
- Create a dedicated Build 1 implementation branch.
- Formalize the independence contract.
- Validate that the original Lovable Decrypter repository is not modified by this migration.

### Excluded

- Product rebrand inside source code.
- Lovable-specific code removal.
- Monorepo restructuring.
- React/PWA Studio implementation.
- Local runtime redesign.
- GitHub-native launcher implementation.
- New AI/runtime/provider functionality.

Those items belong to later Builds in the frozen roadmap.

## Acceptance Criteria

- [x] `rhashiki/github-decrypter` exists as a separate repository.
- [x] Repository visibility is public, matching the source at fork time.
- [x] Source Build 82 tree is present in GitHub Decrypter.
- [x] Source fork point is recorded by SHA.
- [x] GitHub Decrypter-specific origin commit exists.
- [x] Build 1 branch exists.
- [x] Independence rules are documented.
- [x] No source-code rebrand or architectural migration is mixed into Build 1.
- [x] No release/OTA/store publication is performed.

## Next Build

Build 2 — Product Constitution & Scope Freeze.
