# Build 14 — Update & Recovery

## Goal
Provide a truthful, signed update/recovery layer for Lovable Decrypter without pretending an unpacked/manual Chrome installation can silently replace its own code.

## Signed update chain
`ld-release-feed` v4 is the authoritative signer for release metadata.

Release payloads include:
- channel (`stable` or `beta`);
- version;
- HTTPS GitHub release URL;
- SHA-256;
- release notes;
- signed LD2 envelope.

The extension verifies the LD2 signature before accepting a candidate. `downloadUpdate()` then fetches the package bytes, rejects packages over 20 MB, computes SHA-256 locally and downloads only the bytes whose digest matches the signed payload. There is no fallback to an unverified package.

## Channels
- **Stable:** signed feed plus browser-native update when Chrome reports `update_available`.
- **Beta:** signed package workflow only.

The selected channel is stored separately under `ld2_update_channel_v1`.

## Manual installation truth
A manually loaded/unpacked extension cannot use JavaScript to silently install an arbitrary ZIP as its replacement. For this deployment mode the Update Center downloads a verified package and clearly reports that installation/reload is external to the package download.

## Recovery snapshot
Before a package is downloaded or a native update is staged, Build 14 records a recovery snapshot containing:
- current version;
- selected channel;
- candidate release metadata;
- current tab id when available;
- Vault settings-backup result;
- previous signed release metadata when the current version already exists in the release feed.

No license secret or settings payload is copied into the recovery record.

## Rollback
The feed supports exact-version lookup with `?channel=<channel>&version=<version>`. Rollback obtains a freshly signed manifest for the previous version and verifies the package SHA before download.

For manual/unpacked Chrome installations rollback requires manual reinstall of the verified previous package. Build 14 does not claim silent browser downgrade support.

## Post-update health check
After a browser update, the background runtime marks health as pending and starts a two-minute watchdog. The content runtime reports real module presence after page boot.

Critical checks:
- UI shell/FAB visible;
- Unified Launcher loaded;
- Composer Guardian loaded;
- Execution Engine loaded.

Additional checks include Live Operations, Activity Center and Update & Recovery. If no report arrives, health becomes failed instead of silently claiming success.

## Repair Lovable
Repair is explicit and level-based:
1. **Decrypter cache** — repository cache, pending plans and extension Cache Storage. Preserves KEY, settings and Activity history.
2. **Lovable Cache Storage** — only Cache Storage available for the current origin.
3. **Lovable Service Workers** — only registrations whose scope has the current Lovable origin; explicit confirmation required.
4. **Lovable IndexedDB** — origin databases; explicit confirmation required and may require login again.
5. **Reload** — page reload without deleting data.
6. **Full repair** — combines the destructive levels and requires a second click within ten seconds.

Nothing destructive runs automatically on extension boot.

## Supabase compatibility check
The Supabase changelog was reviewed before deployment. Build 14 uses the existing hosted Edge Function model and `supabase-js@2`; no relevant breaking change requires a code migration for this release-feed update. `ld-release-feed` v4 is deployed with the existing public-read/custom-signature model (`verify_jwt=false`) because it returns only signed public release metadata and performs no client-authorized writes.

## Compatibility preserved
Build 14 keeps the validated UI boot, Execution Engine, Composer Guardian, Unified Launcher and Live Operations architecture. The Build 12 diagnostic was changed only to stop falsely labelling Repair as a future feature once Build 14 is loaded.
