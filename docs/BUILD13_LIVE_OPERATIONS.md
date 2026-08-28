# Build 13 — Live Operations / Activity Center

## Goal
Expose a persistent, truthful operational timeline for Decrypter executions without inventing progress, percentages, token usage or costs.

## Runtime capture
`content/live-operations.js` is loaded after Build 12 and wraps the already composed runtime. It observes:

- `LD2_PLAN_ONLY`
- `LD2_PLAN_PREPARE`
- `LD2_BUILD_EXECUTE`
- `LD2_PLAN_APPROVE`
- `LD2_PLAN_APPLY`

It never changes the user command or execution scope.

## Real signals only
The operation timeline uses existing `LD2_PROGRESS` messages from the service worker plus observed runtime start/result/error transitions. No timers manufacture stages or percentages.

Recorded metadata can include:

- request id and source;
- Plan / Shadow / Build / Apply mode;
- model configured at execution start;
- repository and branch;
- Project Rules count;
- Skills selected by the real Skill Router;
- attachment names/types/sizes only (never attachment data);
- files returned by the execution plan;
- dependencies and warnings;
- confirmed commit SHA/branch/URL when available;
- actual duration;
- provider token/cost telemetry only when explicitly returned by the runtime/provider.

## Persistence
Activity metadata is stored in `chrome.storage.local` under `ld2_activity_history_v1`, capped at 200 operations. File contents, API keys, attachment bytes and prompt-internal Skill contents are not stored in this history.

A previously `running` operation found after extension/page restart is marked `interrupted`; the Activity Center never claims that an unobserved execution completed.

## Shadow Build correlation
`LD2_PLAN_PREPARE` records the returned bundle id. A later `LD2_PLAN_APPLY` is correlated to the same activity entry, so preparation and Apply remain one audit trail.

## Truth in UI
- RAG/Decrypter Knowledge is shown as **Build 16 · inactive**.
- Token/cost fields show **not reported** unless the provider/runtime supplied real values.
- There is no synthetic progress bar.
- Build 13 does not enable future model-gateway or Decrypter-Coder capabilities.

## Compatibility
Build 13 preserves:

- Build 9 UI boot/fault isolation;
- Build 10 Execution Engine;
- Build 11 Composer Guardian;
- Build 12 Unified Launcher.
