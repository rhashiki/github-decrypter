# AI Provider API

Status: **Build 33 contract authority**

## Purpose

Build 33 defines the environment-neutral AI provider contract used by later GitHub Decrypter AI runtimes. It creates a stable boundary for local and optional external providers without activating any provider, model runtime, network request or Studio transport.

The constitutional rule remains: **Local AI is first-class; paid external AI APIs are optional providers, never requirements.**

## Owner

- Contract package: `@github-decrypter/ai`
- Privileged execution owner when activated by later Builds: `apps/local`
- Build 33 itself: **contract only**

The Studio and browser extension do not import `@github-decrypter/ai` in Build 33.

## Schemas

Build 33 introduces:

- `gd-ai-provider/1` — provider descriptor;
- `gd-ai-provider-model/1` — provider-owned model descriptor;
- `gd-ai-provider-request/1` — text-generation request;
- `gd-ai-provider-response/1` — normalized text-generation response.

All schemas are exact. Unknown fields are rejected instead of being silently forwarded.

## Provider kinds

The contract recognizes two replaceable kinds:

- `local` — first-class local provider path, no transported credentials;
- `external` — optional provider path, which may later use credentials held by the Local Runtime Secrets Vault.

Build 33 registers **no mandatory provider** and contains no provider-specific endpoint, SDK or model implementation.

## Adapter contract

An `AIProviderAdapter` exposes only:

1. immutable provider metadata;
2. `listModels()`;
3. `generate(request)`.

The adapter contract receives no capability token, database handle, filesystem handle, Secrets Vault object, HTTP headers, API key, bearer token or arbitrary endpoint configuration.

Later runtime-owned implementations are responsible for enforcing security capabilities before invoking an adapter.

## Request boundary

A generation request contains only normalized provider/model identity, ordered text messages and provider-neutral generation limits.

Build 33 does not introduce:

- tool calls;
- attachments or multimodal payloads;
- filesystem/project mutation;
- agent authority;
- conversation persistence;
- prompt intake/task compilation;
- automatic model selection or routing.

Those remain owned by later roadmap Builds.

## Response boundary

A generation response contains only:

- provider/model identity;
- normalized text;
- normalized finish reason;
- optional normalized token usage.

Raw provider responses are not part of the public contract. Provider headers, request IDs, credential metadata and arbitrary vendor payloads are not forwarded through this API.

## Secret boundary

Public request/response schemas contain no secret or credential fields. An external provider descriptor may declare `runtime-vault` as its credential mode, but actual secret resolution remains a Local Runtime responsibility when a later provider implementation is activated.

Local providers must declare credential mode `none`.

## Environment neutrality

`@github-decrypter/ai` may not contain browser APIs, Node APIs, `fetch`, WebSocket, filesystem/process authority, URLs or provider-specific network code.

## Deferred authority

Build 33 explicitly does **not** implement:

- Build 34 — Local AI Runtime;
- Build 35 — Local AI Installer;
- Build 36 — Model Manager;
- Build 37 — Model Routing;
- Build 38+ — prompt/task/context execution;
- Build 44 — Conversation Engine;
- Build 53 — Tool Runtime;
- Build 58+ — Agent Runtime and specialized agents.

No release, deploy, browser-store publication, production database mutation, DNS mutation or production Supabase mutation is authorized by this contract.
