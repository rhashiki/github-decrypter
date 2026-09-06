# Local AI Installer

Build 35 introduces the Local AI Installer as a separate Local Runtime authority for explicit installation of local AI models.

## Ownership

- Runtime owner: `apps/local/src/ai-installer.ts`
- Contract dependency: `@github-decrypter/ai`
- Authority schema: `gd-local-ai-installer/1`
- Build owner: 35
- Local AI Runtime remains owned by Build 34.
- Model Manager remains deferred to Build 36.
- Model Routing remains deferred to Build 37.

## Supported operations

The installer exposes only two operations:

- `installers.list`
- `models.install`

The installer accepts only construction-time adapters for local providers with `credentialMode: 'none'`.

Supported adapter families are compatibility categories, not mandatory providers:

- `ollama-compatible`
- `vllm-compatible`
- `custom-local`

No provider is mandatory and Build 35 does not contain a concrete provider-specific downloader or process implementation.

## Capability boundary

Listing installers requires `READ` on `gd://ai-installer/providers`.

Installing a model requires both:

- `WRITE`
- `EXECUTE`

When the selected adapter declares `networkRequired: true`, the same model-scoped resource additionally requires `NETWORK` and the Offline Execution coordinator must report `online` before the adapter is called.

A local/cached adapter with `networkRequired: false` may install while offline when the caller holds the required `WRITE` and `EXECUTE` grants.

## Security constraints

Build 35 intentionally does not own:

- arbitrary source URLs;
- raw download URLs or endpoints supplied by callers;
- Secrets Vault access or credential transport;
- direct `fetch`, WebSocket, XHR or EventSource transport;
- direct filesystem or child-process authority;
- installer persistence/database tables;
- provider configuration persistence;
- model state persistence;
- model removal or update;
- default-model selection;
- automatic model routing;
- external-provider installation;
- Studio/HTTP installer endpoints.

URL-shaped model identifiers containing `://` are rejected before capability authorization.

## Lifecycle

The daemon constructs the installer with the canonical Capability Security authority, Offline Execution coordinator and Local Runtime Event Bus.

Startup order:

1. Offline Execution
2. Capability Security
3. Local AI Runtime
4. Local AI Installer

The installer is shut down before the Local AI Runtime and Capability Security authorities are closed.

## Event boundary

The canonical Local Runtime Event Bus exposes only metadata events:

- `gd.local.ai-installer.ready`
- `gd.local.ai-installer.operation`

Operation metadata may include provider/model identifiers, outcome, whether network was required, whether an existing local artifact was reused and timestamp. It does not contain source URLs, credentials, provider configuration, raw payloads or persisted installer state.

## Deferred ownership

Build 36 may introduce Model Manager responsibilities such as model state, removal, update and default selection.

Build 37 may introduce automatic model selection/routing.

Those responsibilities must not be backported into the Build 35 installer.
