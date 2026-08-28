# Build 15 — Decrypter Intelligence Core

## Goal
Move product-level reasoning and execution policy out of the current model/provider adapter and into a provider-independent Decrypter Intelligence layer.

## Runtime order
The background service worker now boots:

`Guarded Commit → Decrypter Intelligence Bootstrap → command runtime`

`background/intelligence-bootstrap.js` wraps the provider adapter before `background/service-worker.js` creates any agent instance.

## Execution Brief
Before each Plan or Build, `core/decrypter-intelligence.js` creates an `ld-intelligence/1` Execution Brief containing:

- user goal;
- primary and secondary intent;
- deterministic risk classification;
- execution strategy;
- advisory tool route;
- project constraints already assembled from Project Brain / Project Rules;
- relevant paths and branch metadata;
- routed Skill slugs when the internal Skill attachment is available;
- approved-plan file whitelist when applicable;
- validation requirements.

The provider receives the serialized Execution Brief and is explicitly treated as `executor_only`.

## Validation
Provider output is validated before returning to the existing runtime. Build 15 blocks:

- secret-file modifications such as `.env`;
- deletes without explicit delete intent;
- files outside an explicitly approved plan;
- malformed/oversized file sets.

This is defense in depth. Existing Scope Lock remains mandatory and unchanged before commit.

## Provider independence
Build 15 does **not** implement the Model Gateway. The current Gemini adapter remains the technical executor for this phase, but it no longer owns the product-level decision contract.

- Decrypter Intelligence: active in Build 15.
- Decrypter Knowledge / RAG: Build 16, inactive.
- Model Gateway: Build 17, inactive.
- Decrypter-Coder runtime: later build, inactive.

## Tool routing
Build 15 computes an advisory tool route (`github_repository`, `supabase`, `cloud_migrator`, etc.) but intentionally does not add new privileged automatic tool invocations. Existing authoritative runtimes keep their current permissions and safety contracts.

## Privacy
The persisted Intelligence summary contains intent, risk, strategy, tool-route metadata and Skill slugs. It does not persist:

- the user command;
- Project Rules text;
- Project Brain content;
- file contents;
- attachment bytes;
- Skill contents;
- API keys.

A local history of up to 60 summaries is retained for diagnostics.

## UI
The Unified Launcher surfaces `Decrypter Intelligence` as the AI/intelligence identity. Its modal shows the last intent, risk, strategy, tool route, Skills, validation state and the current provider only as the technical executor.

## Preserved contracts
Build 15 intentionally preserves the validated implementations of:

- UI shell / FAB boot isolation;
- Execution Engine and Queue recovery;
- Composer Guardian;
- Unified Launcher;
- Live Operations / Activity Center;
- Update & Recovery;
- Scope Lock and guarded commit;
- Gemini adapter implementation itself.
