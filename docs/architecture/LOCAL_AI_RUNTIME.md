# Local AI Runtime — Build 34

## Purpose

Build 34 activates the neutral `@github-decrypter/ai` contract inside the Local Runtime without choosing, installing or managing a concrete model provider.

The runtime is local-first and capability-gated. It is an execution boundary, not a model manager, installer, router, conversation engine, tool runtime or agent runtime.

## Authority

Owner: `apps/local`

Contract: `@github-decrypter/ai`

Runtime schema: `gd-local-ai-runtime/1`

Operations:

- `providers.list`
- `models.list`
- `generate`

## Adapter lifecycle

Adapters are injected only when the `LocalAIRuntime` instance is constructed. There is no runtime `registerProvider` / `unregisterProvider` API and no provider configuration persistence.

Build 34 accepts only descriptors where:

- `kind === 'local'`
- `credentialMode === 'none'`

Duplicate provider IDs fail closed.

No concrete Ollama, vLLM, Qwen or other provider implementation is selected by this Build.

## Capability model

Every externally initiated runtime operation is job-bound and capability-gated.

- provider discovery requires `READ` on `gd://ai-runtime/providers`;
- model discovery requires `READ` on `gd://ai-runtime/providers/<provider>/models`;
- generation requires `EXECUTE` on `gd://ai-runtime/providers/<provider>/models/<model>`.

`READ` does not imply `EXECUTE`.

Capability tokens remain owned by the existing Capability Security authority and are never persisted by the AI runtime.

## Generation boundary

Generation receives a validated `AIProviderGenerateRequest`, resolves the requested local adapter, verifies the requested model is currently reported by that adapter, executes the adapter and validates the normalized result against the original provider/model identity.

The runtime does not automatically choose another model or provider when a request fails. That authority belongs to Build 37 — Model Routing.

## Privacy and persistence

Build 34 does not persist:

- prompts/messages;
- generated text;
- usage payloads;
- provider configuration;
- model configuration;
- adapter state.

Event Bus messages contain metadata only: operation, provider/model identifiers, outcome, item count and timestamp. Prompt/response bodies are excluded.

No Build 34 database migration or `gd_ai*` table is introduced.

## Network and secrets

The Local AI Runtime has no direct network authority and does not import or call `fetch`, WebSocket, XMLHttpRequest or external URLs.

It has no Secrets Vault authority and no `SECRETS` capability requirement. External-provider credential resolution remains outside Build 34.

## Daemon integration

`LocalRuntimeDaemon` creates the runtime after Capability Security is constructed, initializes it after Capability Security becomes ready, exposes it through the in-process `aiRuntime` getter, and shuts it down before capability grants are revoked.

Build 34 intentionally adds no `/v1/ai`, `/v1/models` or `/v1/providers` HTTP route. Studio-to-AI transport remains deferred.

## Explicitly deferred

- Build 35 — Local AI Installer;
- Build 36 — Model Manager;
- Build 37 — Model Routing;
- Build 44 — Conversation Engine;
- Build 53 — Tool Runtime;
- Build 58 — Agent Runtime.

No release, deployment, browser-store publication, DNS mutation or production Supabase mutation is authorized by this Build.
