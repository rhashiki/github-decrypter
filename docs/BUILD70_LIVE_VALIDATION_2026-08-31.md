# Build 70 — Live Validation Evidence (2026-08-31)

Branch: `v2.6-build70-account-integration-gate`

This document records production-side evidence gathered after the Build 70 cumulative CI closed green. It intentionally distinguishes backend/provider validation from browser-extension UI homologation.

## CI baseline

- Final cumulative green SHA before live probes: `d44765c9ef5dcc819d2f6683b7f9cd9f9c5d77b0`.
- Workflow: `v2.6 Build 70 · Account Integration Gate`.
- Run: `33431073548`.
- Builds 48→70, DecrypterBench v2 and `release-preflight` passed.
- `main` remained untouched.

## GitHub App production evidence

- Global GitHub App: `Lovable Decrypter`.
- Installation ID: `158035511`.
- Authorized account: `rhashiki`.
- Authorized repository used for validation: `rhashiki/lovable-decrypter-extension`.
- Effective permissions observed: `contents:write`, `workflows:write`, `metadata:read`.
- Production Edge Function `ld-github-app` is version 2 and accepts PKCS#1/PKCS#8 through the Build 70 normalizer.
- A real post-fix installation callback completed with HTTP 303 and redirected to `https://lovable.dev/?ld2_integration_callback=github&status=connected`.

### Non-destructive write probe

A one-shot backend probe used the real GitHub App installation token to:

1. resolve the Build 70 branch SHA;
2. create temporary branch `ld/build70-e2e-c06111f1`;
3. read the temporary ref back successfully;
4. delete the temporary branch;
5. verify through the GitHub connector that no branch with that name remains.

No file content, existing branch or `main` commit was changed.

## Supabase OAuth production evidence

- Global Supabase OAuth App is configured.
- Production Edge Function `ld-supabase-oauth` is version 4.
- Required scopes are persisted canonically when the provider omits the token `scope` field.
- Refresh-token rotation is persisted server-side before follow-up Management API work.
- The active OAuth connection retains the required scope set.

### Non-persistent database write probe

A one-shot backend probe used the real stored OAuth refresh token and client secret to:

1. refresh the Supabase OAuth access token;
2. persist a rotated refresh token before further API calls when rotation occurred;
3. list the authorized Management API projects;
4. verify project `kkzxxnfxgrouhkzyszxs` is authorized;
5. execute `database:write` using `CREATE TEMPORARY TABLE ... ON COMMIT DROP`.

The Edge Function completed HTTP 200 in 7.338 s. The object was temporary and cannot persist after the transaction/session.

## Callback infrastructure evidence

Controlled invalid callback probes returned HTTP 303 and redirected to:

- GitHub: `https://lovable.dev/?ld2_integration_callback=github&status=error&code=INSTALLATION_ID_REQUIRED`
- Supabase: `https://lovable.dev/?ld2_integration_callback=supabase&status=error&code=AUTH_CODE_REQUIRED`

A real GitHub success callback returned HTTP 303 with `status=connected`.

Server-to-server requests to `lovable.dev` may receive a Cloudflare browser challenge. This does not invalidate the Edge Function redirect contract; the final browser/extension rendering still requires browser-side homologation with the Build 70 content script loaded.

## Temporary helper retirement

The following historical bootstrap/test endpoints were neutralized after validation. They remain deployed only because the available connector does not expose Edge Function deletion; each now requires JWT and returns `410 ENDPOINT_RETIRED`:

- `ld-owner-key-bootstrap-temp`
- `ld-github-app-bootstrap-v2`
- `ld-supabase-oauth-bootstrap-v2`
- `ld-github-key-normalize-temp`
- `ld-github-install-reconcile-temp`
- `ld-supabase-oauth-check-temp`

## Still requiring browser/user-controlled homologation

The following are deliberately **not** claimed as complete by this document:

1. callback success/error rendering inside an actual Chrome session with the Build 70 extension loaded;
2. Lovable project → GitHub repo/branch + Supabase project mapping through the actual extension UI;
3. full frontend flow through the extension: read → propose → approve → guarded write → diff/preview;
4. full backend flow through the extension UI and approval path (provider-side OAuth write capability itself is validated above);
5. destructive revocation tests proving immediate fail-closed behavior after GitHub/Supabase authorization is removed.

No merge to `main`, OTA metadata, GitHub Release, store publication or production rollout is authorized by this validation.
