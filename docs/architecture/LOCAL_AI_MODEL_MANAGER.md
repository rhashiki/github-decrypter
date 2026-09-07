# Local AI Model Manager

Build 36 introduces the provider-neutral local model-management authority owned by `apps/local`.

## Ownership

- Build 34 owns local AI execution.
- Build 35 owns explicit local model installation.
- Build 36 owns installed-model inventory, explicit removal/update, and manual session default selection.
- Build 37 owns automatic model routing.

The manager does not add model-management methods to the Build 34 runtime or the Build 35 installer. Provider-specific behavior remains behind construction-time local manager adapters.

## Contract

Schema: `gd-local-ai-model-manager/1`

Operations:

- `managers.list`
- `models.list`
- `models.remove`
- `models.update`
- `default.get`
- `default.set`
- `default.clear`

Supported runtime families remain provider-neutral:

- `ollama-compatible`
- `vllm-compatible`
- `custom-local`

No vendor or model family is mandatory.

## Capability boundary

Discovery requires `READ`.

Removal requires all of:

- `WRITE`
- `EXECUTE`
- `DESTRUCTIVE`

Update requires `WRITE + EXECUTE`; `NETWORK` is additionally required only when the trusted adapter declares that updating needs network access. A network-required update fails closed while the Offline Execution coordinator is not online.

Manual default selection is a local manager-state write and requires `WRITE`. Reading it requires `READ`.

## Data and persistence

Build 36 deliberately keeps manager state session-only:

- no new SQLite model-manager tables;
- no provider configuration persistence;
- no persisted installed-model inventory;
- no persisted default selection;
- no secret storage or transport;
- no filesystem or subprocess authority in the manager itself.

Installed-model inventory comes from trusted local adapters. Physical removal/update is adapter-owned; the manager applies capability, connectivity, identity and result validation around those calls.

If the currently selected default model is removed successfully, the session default is cleared.

## Safety boundaries

The manager rejects URL-shaped model IDs and external providers. It exposes no HTTP/Studio route in Build 36. Event Bus messages contain only provider/model identity, operation outcome, network requirement, changed flag and timestamps.

Build 36 does **not** perform automatic role/task/model choice. Automatic routing remains exclusively Build 37 authority.