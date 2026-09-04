# Build 24 — GitHub Provider

Status: implementation branch. Build completion requires Architecture Guardian, Builds 4–24 regression, TypeScript validation and merge to `main`.

## Purpose

Build 24 introduces the installation-scoped, read-only GitHub Provider on top of Build 23 GitHub App authentication without activating the Chrome Extension, Repository Launcher or later GitHub collaboration workflows.

## Contract

`@github-decrypter/github-provider` owns the environment-neutral `gd-github-provider/1` contract.

Allowed operations are frozen to:

- `repositories.list`
- `repository.get`
- `branches.list`

The contract contains no Node, browser, filesystem or network implementation.

## Local Provider authority

`apps/local/src/github-provider.ts` owns Provider transport.

Every operation:

- requires `online` connectivity;
- requires job-bound `READ` and `NETWORK` capability claims for the Provider resource;
- verifies the selected GitHub App installation exists locally and is active;
- delegates short-lived installation token creation to Build 23;
- performs a fixed GET-only GitHub API request;
- validates and normalizes the response before returning it.

The Provider does not expose a generic request method.

## GitHub App boundary

Build 24 does not duplicate JWT signing, private-key access, installation-token exchange or Secrets Vault access. Those remain Build 23 authorities.

Installation tokens are consumed in memory for a single Provider operation and are neither cached nor persisted by the Provider.

## Read endpoints

Build 24 uses only the read surfaces needed for its three operations:

- installation repository discovery;
- repository metadata;
- repository branch listing.

No repository or collaboration mutation is authorized.

## Persistence

Build 24 adds no database migration. Local Database remains schema 11.

There is no `gd_github_provider*` table and no Provider response cache. Repository/branch responses and installation access tokens are not persisted.

## Runtime integration

The GitHub Provider is instantiated by the Local Runtime daemon after the GitHub App Runtime. It initializes only after Capability Security, Offline Execution and GitHub App are ready, and it shuts down before the GitHub App Runtime.

Metadata-only Event Bus events:

- `gd.local.github-provider.ready`
- `gd.local.github-provider.operation`

## Architecture Guardian

Build 24 introduces AG220–AG229 covering:

- machine-readable authority ownership;
- environment-neutral contract;
- `READ + NETWORK` and online requirements;
- active-installation verification and Build 23 token delegation;
- GET-only read endpoint allowlist;
- no Provider persistence/cache tables;
- no blob/tree/commit/ref/PR/issue/Actions mutation authority;
- no generic GitHub request API;
- no premature Provider HTTP/RPC transport;
- daemon/lifecycle integration and required Build 24 artifacts.

The Build 14 outbound-network Guardian is extended narrowly so only the Build 24 Provider's capability-gated GET transport is recognized as authorized. Automatic/generic outbound probes remain prohibited.

## Validation target

Build 24 must prove:

- repository discovery pagination and normalized repository DTOs;
- nullable default branch support for empty repositories;
- normalized branch names and commit SHAs;
- installation scoping;
- Build 23 installation-token authority remains intact;
- installation tokens are ephemeral and not persisted;
- no Provider response persistence;
- offline rejection occurs before any network use;
- invalid capabilities and unknown installations fail before Provider transport;
- untrusted repository URLs fail closed;
- Guardian failure injection for Build 24 boundaries;
- full Builds 4–24 regression and TypeScript workspace checks.

## Explicit exclusions

Build 24 does **not** activate:

- Build 25 — GitHub Chrome Extension;
- Build 26 — Repository Launcher;
- Build 109 — Commit Workflow;
- Build 110 — Push Workflow;
- Build 111 — Pull Request Workflow;
- Build 112 — Checks & Actions;
- Build 113 — Issues Integration;
- Build 134 — release authority.

No tag, release, OTA, Chrome Store publication, production deployment, production Supabase mutation or DNS mutation is authorized by this build.
