# Build 12 — Unified Launcher

## Goal
Replace the fragmented visible UI with one Matrix/glassmorphism launcher while preserving validated feature handlers.

## Visible launcher
Status:
- License
- Decrypter AI / current model bridge
- GitHub
- Supabase
- Composer Guardian
- Lovable project

Principal:
- Editor Direct
- Project Brain
- Skills
- Queue

Project:
- GitHub
- Supabase
- Cloud Migrator
- Export ZIP
- New Project

Intelligence:
- Project Rules
- Explain Project
- Impact Maps
- History

System:
- Diagnostics
- Settings
- Update
- Repair Lovable (truthfully deferred to Build 14)

## Compatibility strategy
The Build 10/11 Control Center remains mounted but visually hidden. The Unified Launcher delegates to its already-validated handlers. This is deliberate fault isolation: Build 12 changes the product shell without rewriting stable GitHub, Supabase, migration, Skills, Brain, queue or update flows.

## Safety
- UI Shell Bootstrap remains first in the manifest.
- No global network monkeypatch is introduced.
- Unified Launcher uses bounded mounting and event-driven refresh; it does not add a global MutationObserver.
- Composer Guardian remains authoritative for ON/OFF and FAB health.
- Repair Lovable is not implemented early and is labeled Build 14.
- Mobile uses a near-fullscreen launcher; desktop stays compact.
