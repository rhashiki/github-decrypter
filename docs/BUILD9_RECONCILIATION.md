# Build 9 — Core Reconciliation

## Active after reconciliation

- Core runtime / license / GitHub / Supabase / Cloud Migrator from Builds 1–8
- Composer Bridge v3 (DOM routing)
- Skills Engine + custom Skills
- Project Rules authoritative cache
- Project Intelligence
  - Project Brain cloud sync
  - Project Rules UI
  - Explain Project
  - Impact Maps
- Local History
- Checkpoint runtime + Checkpoint UI / safe rollback

## Explicitly deferred

These files remain packaged for historical continuity but are **not booted by the manifest** in Build 9:

- `content/batch-mode.js` — Build 10 Execution Engine
- `content/queue-executor.js` — Build 10 Execution Engine
- `content/queue-project-context.js` — Build 10 Execution Engine
- `content/automatic-suggestions.js` — later Product Intelligence
- `content/composer-pro.js` — Think/Rewrite/Voice/Visual remain deferred; no command mutation is reintroduced
- `content/preview-progress-overlay.js` — Build 13 Live Operations
- `content/dom-guardian.js` — Build 11 Composer Guardian
- `content/monitor.js` — superseded by current routing state; not re-enabled
- legacy Cloud UI/runtime files superseded by the Build 6/7 migrator runtimes

## Runtime order

The manifest intentionally loads:

`content/content.js → project-intelligence.js → skill-router.js → project-rules-cache.js`

Because each layer wraps `LovableDecrypterV2.runtime`, execution enters the wrappers in reverse order:

`Project Rules → Skill Router → Project Intelligence → core execution`

Project Intelligence is observational in Build 9: it records Impact Maps without rewriting the established execution contract.

## Truth-in-UI rule

No feature may be labeled active unless it is booted and backed by an operational runtime. Queue is therefore marked for Build 10, not active.
