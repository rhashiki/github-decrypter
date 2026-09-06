# Build 33 — AI Provider API

Status: **IMPLEMENTED — isolated validation passed; PR matrix pending**

## Objective

Create the provider-neutral AI contract that later Local Runtime AI implementations consume, while preserving local-first operation and preventing provider/network/secret authority from arriving before its owning Builds.

## Delivered

- `@github-decrypter/ai` version `0.0.33`;
- `gd-ai-provider/1` provider descriptor;
- `gd-ai-provider-model/1` model descriptor;
- `gd-ai-provider-request/1` text-generation request;
- `gd-ai-provider-response/1` normalized response;
- local/external provider-kind boundary;
- `none` / `runtime-vault` credential-mode declaration;
- replaceable `AIProviderAdapter` interface;
- strict provider/model identity normalization;
- exact-key validation for public contract objects;
- model-list provider ownership and duplicate protection;
- request/response provider-model correlation validation;
- Architecture Guardian AG310–AG319;
- static, runtime/type and negative Guardian validation gates.

## Authority boundary

Build 33 is **contract only**.

It does not:

- import `@github-decrypter/ai` into Studio, extension or Local Runtime;
- execute inference;
- create a Local AI process/runtime;
- contact an external AI service;
- register a concrete provider;
- read Secrets Vault values;
- persist prompts, responses, models or provider configuration;
- create a Studio ↔ AI transport;
- expose arbitrary provider request/response payloads;
- implement model installation, management or routing.

## Security properties

- unknown public fields fail closed;
- local providers cannot declare transported credentials;
- no URL/header/auth/token/secret field exists in public schemas;
- raw provider response passthrough is excluded;
- provider adapters receive only the normalized generation request;
- environment-neutral package rules remain enforced by the root Architecture Guardian.

## Roadmap ownership preserved

- Build 34 — Local AI Runtime;
- Build 35 — Local AI Installer;
- Build 36 — Model Manager;
- Build 37 — Model Routing;
- Build 44 — Conversation Engine;
- Build 53 — Tool Runtime;
- Build 58 — Agent Runtime.

## Isolated validation result

Branch head `4b707c99370d214669e4f5431159df0476c1a0eb` passed the complete Build 33 push workflow before this documentation-only completion update.

Validated successfully:

1. Architecture Guardian including AG310–AG319;
2. accumulated Builds 4–33 CI;
3. forward-compatible Studio/PWA/IDE Layout/Onboarding/Environment Doctor regression gates;
4. TypeScript compilation for `@github-decrypter/ai` and all workspaces;
5. contract runtime validation with fake local/external adapters only;
6. fail-closed rejection of unknown credential, endpoint and raw-response fields;
7. negative Guardian probes for network/provider-specific/secret/execution drift;
8. modern-engine preservation.

The full pull-request workflow matrix remains the final merge gate.

No release, tag, production deploy, browser-store publication, production Supabase mutation or DNS mutation is authorized by this Build.
