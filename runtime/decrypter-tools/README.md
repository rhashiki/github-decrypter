# Decrypter Tool Worker — Build 61

Build 61 adds the first backend-only coding tool plane for Decrypter AI. It is deliberately separate from model inference and from future write/execution sandboxes.

## Tools

- `workspace.list` — bounded recursive listing
- `workspace.read` — bounded UTF-8 file reads
- `workspace.grep` — bounded literal search across text files
- `lsp.diagnostics` — TypeScript/JavaScript diagnostics
- `lsp.definition` — go-to-definition
- `lsp.references` — reference lookup

The LSP worker uses `typescript-language-server 6.0.0` with `TypeScript 6.0.3`, pinned in the Dockerfile.

## Security contract

- workspace volume is mounted read-only;
- container root filesystem is read-only;
- Linux capabilities are dropped and `no-new-privileges` is enabled;
- paths are resolved inside the configured workspace root and symlink escapes are blocked;
- no arbitrary shell or command tool exists;
- no write/edit/patch tool exists in Build 61;
- worker bearer token and worker URL remain backend-only;
- `ld-tool-runtime` requires license + device + Trust Protocol;
- tool input/output content is returned ephemerally and never stored in the audit table;
- the database stores only input/output hashes, tool name, status and duration.

## Deployment

1. Prepare a trusted checkout of one project on the worker host.
2. Copy `.env.example` and set `WORKSPACE_DIR`, `DECRYPTER_WORKSPACE_ID` and a strong `DECRYPTER_TOOL_WORKER_TOKEN`.
3. Run `docker compose up -d --build` inside `runtime/decrypter-tools`.
4. Put local port 8787 behind private/authenticated HTTPS.
5. Configure backend-only `DECRYPTER_TOOL_WORKER_URL` and `DECRYPTER_TOOL_WORKER_TOKEN` in the Decrypter backend.

Build 61 does not clone repositories or mint Git credentials itself. Workspace provisioning and heavier isolated execution are separate responsibilities, preventing the read-only tool plane from silently becoming an execution sandbox.
