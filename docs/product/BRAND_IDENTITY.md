# GitHub Decrypter — Identity Contract

Status: **FROZEN BY BUILD 5**

## Canonical product identity

- Product: `GitHub Decrypter`
- Repository: `rhashiki/github-decrypter`
- Product id: `github-decrypter`
- Pre-V1 extension version for Build 5: `0.0.5`
- Storage prefix: `gd_`
- Protocol/schema prefix: `gd-`
- Local runtime display name: `GitHub Decrypter Local Runtime`

## Authority rules

The following are not permitted as active product authority after Build 5:

- predecessor product branding in manifest/README/settings/runtime-facing docs;
- `lovable.dev` host targeting;
- predecessor repository URLs as live update/configuration sources;
- `ld-vault`, `ld-release-feed`, `ld-store` or any inherited hosted backend as defaults;
- predecessor license keys as an execution gate;
- old storage/schema namespaces as the canonical write target.

## One-shot compatibility

Build 5 may read `ld2_settings` exactly as a migration source. When found, values are normalized/sanitized, written to `gd_settings`, and the old key is removed.

Compatibility identifiers inside preserved source assets may remain only when changing them prematurely would break the source asset before its scheduled migration. They must be documented as compatibility identifiers and may not appear as the end-user product identity.

## Historical references

The predecessor name may remain in lineage, audit, migration and provenance documents where removing it would make the historical record inaccurate. Historical reference is not product authority.

## No implicit release authority

Identity/version changes do not authorize a Release, OTA, Chrome Store submission, production deployment, backend mutation or DNS mutation.
