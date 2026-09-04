# GitHub Provider

Build 24 introduces the read-only GitHub Provider that sits on top of the Build 23 GitHub App authority.

## Authority

The environment-neutral contract lives in `@github-decrypter/github-provider` and uses schema `gd-github-provider/1`.

Network execution belongs only to `apps/local/src/github-provider.ts`.

The Provider does not own authentication. Every remote operation obtains a short-lived installation access token from the Build 23 GitHub App Runtime. Installation tokens are never cached or persisted by the Provider.

## Allowed operations

Build 24 deliberately exposes only:

- `repositories.list` — list repositories accessible to the selected GitHub App installation;
- `repository.get` — fetch normalized metadata for one installation-accessible repository;
- `branches.list` — list normalized branch metadata for one repository.

The transport is GET-only.

Build 24 does not introduce generic GitHub API request authority.

## Capability and connectivity boundary

Every Provider operation:

1. requires Local Runtime readiness;
2. requires Offline Execution state `online`;
3. requires job-bound `READ` and `NETWORK` capabilities for the exact Provider installation/repository resource;
4. verifies the requested installation is registered locally and active;
5. delegates installation-token creation to Build 23, preserving the GitHub App/Vault/capability boundary;
6. performs only the fixed read endpoint owned by the requested Provider operation.

`unknown` and `offline` fail closed before any Provider network request or GitHub App token exchange.

## Installation scope

Provider resources are rooted at:

`gd://github-provider/installations/<installation-id>/...`

Repository discovery is therefore bound to a concrete GitHub App installation instead of an ambient user token.

## Response normalization

Raw GitHub JSON is validated and converted into environment-neutral DTOs before being returned to callers.

Repository results normalize:

- numeric repository ID;
- node ID;
- owner/name/full name;
- private/fork/archived/disabled flags;
- nullable default branch;
- trusted `https://github.com` HTML and clone URLs;
- updated timestamp.

Branch results normalize:

- branch name;
- commit SHA;
- protected flag.

Repository identities returned by a targeted `repository.get` must match the repository that was authorized in the request.

## Persistence

Build 24 adds no database migration and no Provider cache table. Local Database remains schema 11.

The Provider does not persist:

- installation access tokens;
- repository lists;
- repository metadata responses;
- branch lists;
- raw GitHub response bodies.

If GitHub is unavailable, the Provider fails closed rather than presenting stale remote state as current.

## Event Bus

Build 24 adds metadata-only events:

- `gd.local.github-provider.ready`
- `gd.local.github-provider.operation`

Operation events include only the operation name, installation ID, outcome, item count and timestamp. They contain no installation token or raw API payload.

## Explicitly deferred authority

The following remain outside Build 24:

- Chrome Extension integration — Build 25;
- Repository Launcher — Build 26;
- Commit Workflow — Build 109;
- Push Workflow — Build 110;
- Pull Request Workflow — Build 111;
- Checks & Actions — Build 112;
- Issues Integration — Build 113;
- Release authority — Build 134.

Build 24 therefore contains no POST, PUT, PATCH or DELETE GitHub Provider operation, no blob/tree/commit/ref creation, no PR/issue mutation and no Actions mutation.

## Architecture Guardian

AG220–AG229 enforce:

- Provider policy ownership;
- environment-neutral contract boundaries;
- `READ + NETWORK` and online gates;
- GitHub App installation-token delegation;
- GET-only allowlisted read operations;
- no Provider persistence/cache tables;
- no collaboration/repository mutation authority;
- no premature Provider HTTP/RPC transport;
- daemon and Event Bus integration;
- frozen build ownership and required Build 24 artifacts.
