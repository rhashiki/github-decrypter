# Capability Security Model

Build 15 establishes the first privileged-execution security boundary for GitHub Decrypter.

## Authority

Capability Security is owned by `apps/local`. Studio, the browser extension, models and future tool providers are consumers of authorization decisions; they are not grant authorities.

The model is deny-by-default. Possessing a job ID, being a model, running inside the Studio, or being connected to the Local Runtime does not imply permission.

## Canonical capabilities

- `READ`
- `WRITE`
- `EXECUTE`
- `NETWORK`
- `DATABASE_WRITE`
- `GIT_WRITE`
- `DESTRUCTIVE`
- `SECRETS`

Capabilities do not imply one another. For example, `WRITE` does not imply `READ`, and `DESTRUCTIVE` does not imply `WRITE`. An operation that requires multiple authorities must request every required capability.

## Resource scopes

Every claim combines a capability with a canonical `gd://` resource and one match mode:

- `exact` — only the exact resource matches;
- `prefix` — the resource itself and descendants below the explicit prefix match.

Examples of resource namespaces that later Builds may use include `gd://workspace/...`, `gd://network/...`, `gd://database/...`, `gd://git/...`, `gd://secret/...` and `gd://runtime/...`.

Build 15 does not assign provider-specific semantics to those resources. The owning future provider/tool must translate its operation into explicit capability requirements before privileged execution.

Wildcards are not accepted. Query strings, fragments and embedded credentials are not accepted in resource scopes.

## Grants and tokens

A grant is bound to exactly one durable job and contains one or more explicit claims.

The authority returns an opaque token with 256 bits of randomness. Only its SHA-256 hash is persisted in SQLite. The plaintext token is never written to the Local Database, health payloads or Event Bus events.

Grant metadata is stored in:

- `gd_capability_grants`;
- `gd_capability_claims`.

Grants have explicit expiry and may be revoked. Build 15 limits a grant to at most 24 hours.

## Restart behavior before Secrets Vault

Build 15 deliberately does not persist plaintext capability tokens or a master signing/encryption secret.

Therefore grants are process-bound. On startup, the Local Runtime revokes any still-active grant issued by a different process instance. Graceful shutdown also revokes grants issued by the current process.

This is intentionally fail-closed. Build 16 may add secure continuity through the Secrets Vault; Build 15 does not simulate that continuity by storing a secret insecurely.

## Authorization

An authorization request contains:

- the durable job ID;
- one or more capability/resource requirements;
- the opaque token presented separately.

Authorization succeeds only when all of the following are true:

1. the token is well formed and resolves to a stored hash;
2. the grant belongs to the current Local Runtime process;
3. the grant belongs to the requested durable job;
4. the grant has not been revoked;
5. the grant has not expired;
6. the durable job is not terminal;
7. every requested capability/resource requirement is matched by an explicit claim.

Otherwise authorization is denied.

## Offline Execution relationship

`NETWORK` means an operation is authorized to use network capability. It does not mean connectivity exists.

Build 14 remains the authority for connectivity and network waiting. A network operation therefore needs both:

- authorization from Capability Security; and
- an available network condition from Offline Execution.

Neither bypasses the other.

## Transport boundary

Build 15 does not expose an HTTP/RPC endpoint for issuing, revoking or authorizing capability grants. `/healthz` and `/readyz` expose only non-sensitive readiness/count information.

Grant transport remains internal until the appropriate approval/control Builds establish the user-authorized path.

## Deferred authorities

- Build 16 — Secrets Vault;
- Build 17 — Approval Transactions;
- Build 18 — Audit Ledger;
- Build 47 — Jobs Center / job-control transport;
- later Tool, Git, GitHub, database, MCP and deployment Builds consume this boundary rather than bypassing it.

## Security invariants

- deny by default;
- no implicit capability inheritance;
- job-bound grants;
- explicit scoped resources;
- bounded expiry;
- revocation support;
- terminal jobs cannot retain executable authority;
- plaintext capability tokens are never persisted;
- restart fails closed before Secrets Vault continuity exists;
- no frontend/model self-grant path;
- no external grant endpoint in Build 15.
