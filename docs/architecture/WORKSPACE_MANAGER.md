# Workspace Manager

Build 19 introduces the canonical local Workspace Manager boundary for GitHub Decrypter.

## Ownership

The environment-neutral workspace identity contract lives in `@github-decrypter/workspace`. Filesystem inspection and durable workspace registration belong only to `apps/local`, because browser/PWA state is not permitted to become the filesystem or persistence authority.

The local registry is persisted in SQLite schema 9 through `gd_workspaces`.

## Workspace identity

A registered workspace has:

- opaque `gd_ws_<uuid>` identity;
- canonical real path for an existing local directory;
- display name;
- registration timestamp;
- optional last-opened timestamp.

Registration canonicalizes the root with the operating system real-path resolver before persistence. Registering the same canonical directory again is idempotent and returns the existing workspace identity.

## Path boundary

Workspace-relative path resolution is fail-closed:

1. absolute input is rejected;
2. lexical resolution must remain inside the registered root;
3. the target is resolved through `realpath`;
4. the canonical target must still remain inside the canonical workspace root.

This second containment check prevents an in-workspace symlink from silently redirecting operations outside the registered workspace.

Build 19 resolves only existing paths. Creation, editing, deletion, copying, moving and other filesystem mutation are not Workspace Manager authorities.

## Runtime lifecycle

Workspace Manager initializes after the Local Database and Audit Ledger are ready. Daemon readiness requires Workspace Manager readiness, but a previously registered directory becoming unavailable does not make the entire daemon unhealthy. Health/readiness expose only counts (`registered` and `available`) and never workspace paths or display names.

Runtime Event Bus messages use workspace IDs and timestamps/counts rather than filesystem paths.

## Explicit phase separation

Build 19 does not implement:

- framework or package-manager detection — Build 20;
- Git clone/fetch/pull/status or other Git runtime behavior — Build 21;
- human-versus-AI change tracking — Build 22;
- Jobs Center transport/control — Build 47;
- Multi-Workspace orchestration and UI — Build 114;
- generic `/v1/workspace*` HTTP/RPC control/query endpoints;
- filesystem creation or mutation;
- Release, OTA, browser-store publication, production deploy or DNS mutation.

The registry schema can durably identify more than one local root without claiming the Build 114 multi-workspace product experience early.
