# Local AI Model Routing

## Ownership

Build 37 introduces the Local AI Model Routing authority inside `apps/local`.

The ownership split remains strict:

- Build 34 — Local AI Runtime: executes a chosen local provider/model.
- Build 35 — Local AI Installer: installs local models through trusted adapters.
- Build 36 — Model Manager: inventories, removes, updates and stores a session-only manual default selection.
- Build 37 — Model Routing: chooses a model and returns a deterministic decision.

The router does not execute, install, remove, update or configure providers/models.

## Contract

Schema: `gd-local-ai-model-routing/1`

Decision schema: `gd-local-ai-model-route-decision/1`

Operation:

- `routes.select`

A decision contains only:

- provider ID;
- model ID;
- reason (`preferred`, `default`, or `fallback`);
- number of installed candidates considered;
- deterministic/local-only invariants.

## Deterministic precedence

Routing uses this exact order:

1. a caller-provided preferred local model, when installed;
2. the Build 36 session-only manual default, when installed;
3. the first installed candidate after deterministic provider/model ordering.

A requested preferred model that is not installed fails closed. It is never silently replaced with another candidate.

If no installed local models exist, routing fails closed.

## Authorization

Routing requires `READ` on `gd://ai-model-routing/select`.

The router then calls the Model Manager with the same capability token. Therefore the caller must also possess the relevant Build 36 `READ` scopes for manager discovery, model inventory and default selection. Routing cannot bypass Model Manager authorization.

## Security boundaries

Build 37 has no authority for:

- model execution;
- model installation;
- model removal/update;
- default mutation;
- external provider routing;
- direct network transport;
- Secrets Vault access;
- filesystem/process execution;
- database persistence;
- routing persistence;
- prompt or response inspection;
- adaptive/semantic routing;
- Studio/HTTP transport.

Model IDs shaped as URLs (`://`) are rejected.

## Events

The canonical Local Runtime Event Bus emits only sanitized metadata:

- `gd.local.ai-model-routing.ready`
- `gd.local.ai-model-routing.operation`

No prompt, response, secret, credential, filesystem path or raw provider content is emitted.

## Future ownership

Conversation-level orchestration remains deferred to its roadmap owner. Build 37 provides a deterministic local decision primitive only; it does not infer task meaning or inspect conversation content.