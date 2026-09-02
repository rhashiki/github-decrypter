# GitHub Decrypter — Build 3 Risk Register & Migration Handoff

Audit base: `6a8d2fb579f56cce6311eeea83065396055baa53`

This register converts the legacy inventory into execution constraints for the next Builds. Build 3 does not perform the removals itself.

## Severity model

- **P0** — can publish, mutate, leak, or create product-authority drift if accidentally triggered.
- **P1** — can break a frozen V1 capability or preserve the wrong runtime authority.
- **P2** — creates maintainability/confusion/compatibility debt but is not immediately destructive.

## P0 — inherited release workflow remains present

`.github/workflows/release.yml` is still an inherited Lovable Decrypter release workflow. It has `contents: write`, can create/update GitHub Releases, push release metadata to `main`, and call the inherited signed OTA bridge. Its automatic triggers are tags matching `v*` and changes to `.github/RELEASE_TRIGGER` on `main`; it also supports manual `workflow_dispatch`.

### Control until Build 4

- do not create `v*` tags;
- do not modify `.github/RELEASE_TRIGGER`;
- do not manually dispatch inherited release workflows;
- Build 4 must neutralize/remove inherited release/OTA authority before any GitHub Decrypter release/tag work begins.

No Build merge by itself authorizes publication.

## P0 — inherited hosted backend authority

The repository contains a complete old `supabase/functions/ld-*` backend plus internal migrations for licensing, commercial/payment flow, command execution, cloud migration, knowledge, model gateway, project state, release feed and other Lovable Decrypter services.

### Risk

Reusing these wholesale would violate the frozen local-first/provider-agnostic constitution and could preserve hidden production dependencies.

### Control

- do not deploy inherited Supabase functions/migrations as GitHub Decrypter infrastructure;
- extract only explicitly listed reusable patterns;
- user-project Supabase support must be implemented through the later Backend Provider contract.

## P1 — heavy execution currently modeled inside extension background/content layers

Modern capabilities exist in `background/` and `content/`, but the V1 architecture requires jobs, tools, Git, local AI, persistence, secrets and recovery to live in the independent local runtime.

### Risk

A superficial rename could preserve Chrome service-worker lifetime as execution authority, reintroducing browser closure/interruption failures.

### Control

- Build 4 removes Lovable-specific coupling without declaring the old service worker the final architecture;
- Build 6+ physically restructures into the monorepo/packages/runtime topology;
- durable job ownership must never migrate into React/PWA or extension state.

## P1 — useful modern engines can be accidentally deleted with legacy code

The inherited tree contains valuable Scope Lock, Scope Intelligence, patching, checkpoints, reversible operations, continuity, Tool Runtime, MCP/Trust, agent orchestration/sandbox, context, validation, GitHub and local-model logic.

### Control

- no path classified `KEEP`, `MIGRATE`, or `REFACTOR` may be deleted without an explicit replacement/migration destination;
- Build 4 must use the disposition matrix and machine-readable rules;
- if a Lovable-specific wrapper contains a reusable invariant, extract the invariant before removal.

## P1 — Git authority is currently mixed with GitHub API/GitSync assumptions

Inherited code and documentation were designed around remote GitHub writes followed by Lovable GitSync.

### Control

- local filesystem + local Git become active code authority;
- GitHub becomes remote collaboration provider;
- GitSync assumptions are deleted rather than renamed.

## P1 — old storage authority

The inherited product uses `chrome.storage.local` and optional cloud/Vault patterns for settings/cache.

### Control

- extension storage may retain launcher-local preferences only;
- project state, jobs, transactions, memory and durable settings move to local runtime persistence;
- secrets move to the V1 Secrets Vault/OS secure storage design.

## P1 — inherited identifiers and namespaces

Current code contains `LD`, `lovable-decrypter`, Lovable host permissions, old storage keys, old function names, old release identifiers and Lovable-specific product IDs.

### Control

Build 4 removes functional Lovable coupling. Build 5 performs the systematic GitHub Decrypter identity migration. Compatibility aliases may exist only where a documented one-time migration requires them.

## P1 — provider hard-coupling

`ai/gemini-agent.js`, Supabase-specific tools, and multiple integration runtimes encode provider-specific assumptions.

### Control

- do not promote these modules directly into shared core;
- migrate behavior through AI/Backend/Integration provider contracts;
- Gemini and Supabase remain optional providers.

## P2 — old documentation and Build numbering can mislead implementation

The repository still contains Lovable Decrypter Build 9–82 documentation, workflows and tests.

### Control

- Git history remains the archive;
- active documentation ultimately contains only GitHub Decrypter architecture and Build numbering;
- old Build filenames do not define GitHub Decrypter roadmap order.

## P2 — inherited training pipeline is outside V1

`training/decrypter-coder/` contains a QLoRA/fine-tuning pipeline.

### Control

Do not spend V1 implementation time maintaining it. Remove it from the active V1 tree during legacy cleanup. Any future training/fine-tuning product work requires RFC/V1.1+.

## Build 4 priority order

1. Neutralize Lovable runtime targeting and inherited release/OTA hazards.
2. Remove explicit Lovable page/project/GitSync/cloud-migrator authorities.
3. Reduce extension runtime toward launcher/bridge responsibility without implementing the final Studio/runtime architecture prematurely.
4. Preserve modern engines according to `KEEP`/`MIGRATE`/`REFACTOR` classification.
5. Ensure no removal activates or deploys inherited Supabase infrastructure.
6. Add regression checks proving Lovable-specific authorities cannot re-enter the active extension path.

## Hard stop conditions

Build 4 must stop rather than improvise if:
- removal requires deleting a frozen V1 capability with no preserved implementation/replacement path;
- a workflow would publish a release/OTA or mutate production;
- a change would deploy inherited Supabase schema/functions;
- a new feature not in frozen V1 scope becomes necessary;
- the change would make the extension/PWA the durable execution owner.

In those cases, correct the planned migration path or record an RFC; do not create a feature sub-build.
