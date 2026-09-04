# Build 23 — GitHub App

Status: implementation branch. Build completion requires Architecture Guardian, Builds 4–23 regression, TypeScript validation and merge to `main`.

## Purpose

Build 23 introduces the GitHub App trust and authentication foundation without activating the GitHub Provider (Build 24), Chrome Extension (Build 25), repository workflows, release authority or production deployment.

## Contract

`@github-decrypter/github-app` owns the environment-neutral `gd-github-app/1` contract for:

- GitHub App configuration metadata;
- installation metadata;
- RS256 App JWT results;
- short-lived installation access tokens;
- webhook verification results.

The contract contains no Node, browser, filesystem or network implementation.

## Local authority

`apps/local/src/github-app-runtime.ts` owns secret-bearing and network-capable execution.

### Secrets

The GitHub App private key and webhook secret are stored only through Build 16 Secrets Vault resources:

- `gd://secret/github-app/private-key`
- `gd://secret/github-app/webhook-secret`

Plaintext private keys and webhook secrets are never written to GitHub App metadata tables.

### App JWT

App authentication uses RS256. JWTs are created only in memory, include a short backdated `iat` clock-skew allowance and a maximum 600-second claim window, and are returned as `persistable: false`.

### Installation token

Installation access-token creation:

- fails closed unless Offline Execution reports `online`;
- requires job-bound `NETWORK` authority for the installation token resource;
- requires `READ` for App configuration and `SECRETS` through Secrets Vault for the private key;
- calls only the GitHub App installation-token exchange endpoint in this build;
- accepts only a short-lived expiration window;
- never persists the returned token.

Build 23 does not provide general repository, pull request, issue or Git operations through GitHub APIs. Those belong to later builds.

### Webhooks

Webhook verification:

- operates on the raw request body supplied by the caller;
- uses HMAC-SHA256;
- compares the expected and supplied digest in constant time;
- requires the webhook secret through Secrets Vault;
- records only delivery ID, event name and verification time after a valid signature;
- marks repeated delivery IDs as duplicates;
- never persists webhook payload/body content.

No generic GitHub webhook HTTP endpoint is exposed by the Local Runtime in Build 23.

## Persistence

Local Database schema 11 adds:

- `gd_github_app_config`
- `gd_github_app_installations`
- `gd_github_webhook_deliveries`

The schema intentionally contains no private-key, webhook-secret, JWT, installation-token or payload/body columns.

## Capability boundary

GitHub App operations remain job-bound and deny-by-default through existing Build 15/16 authorities:

- `READ` — App/install metadata reads;
- `DATABASE_WRITE` — config/install/replay metadata writes;
- `NETWORK` — installation-token exchange;
- `SECRETS` — enforced by Secrets Vault for private key and webhook secret access.

## Daemon lifecycle

The GitHub App Runtime is instantiated by the Local Runtime daemon and initialized only after Offline Execution, Capability Security and Secrets Vault are ready. It is shut down before Secrets Vault teardown.

Its Event Bus events are metadata-only:

- `gd.local.github-app.ready`
- `gd.local.github-app.configured`
- `gd.local.github-app.installation.changed`
- `gd.local.github-app.installation-token.created`
- `gd.local.github-app.webhook.verified`

No event contains private keys, webhook secrets, JWTs, installation tokens or webhook payloads.

## Architecture Guardian

Build 23 introduces AG210–AG219 covering:

- authority/policy validity;
- environment-neutral contract;
- schema 11 secret-free metadata;
- Vault/capability boundaries;
- RS256 JWT rules;
- ephemeral installation tokens and offline fail-closed behavior;
- raw-body HMAC-SHA256/replay metadata rules;
- prohibition of premature Provider/HTTP surfaces;
- daemon/lifecycle integration;
- frozen roadmap boundaries and required artifacts.

## Explicit exclusions

Build 23 does **not** activate:

- Build 24 — GitHub Provider;
- Build 25 — GitHub Chrome Extension;
- Build 26 — Repository Launcher;
- Build 109 — Commit Workflow;
- Build 110 — Push Workflow;
- Build 111 — Pull Request Workflow;
- Build 112 — Checks & Actions;
- Build 113 — Issues Integration;
- Build 134 — release authority.

No tag, release, OTA, Chrome Store publication, production deployment, production Supabase mutation or DNS mutation is authorized by this build.
