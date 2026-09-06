# Build 34 — Local AI Runtime

Status: **IMPLEMENTED — validation pending**

## Objective

Activate the Build 33 provider-neutral AI contract inside the Local Runtime with capability-gated local execution, while preserving later ownership for provider installation, model management, routing, conversations, tools and agents.

## Delivered

- `apps/local` version `0.0.34`;
- `@github-decrypter/ai` activated only as a Local Runtime dependency;
- `gd-local-ai-runtime/1` runtime authority;
- construction-time local adapter registry;
- local-provider discovery;
- local-model discovery;
- local generation execution;
- exact provider/model response correlation validation;
- `READ` capability gating for provider/model discovery;
- `EXECUTE` capability gating for generation;
- sanitized `gd.local.ai-runtime.ready` and `gd.local.ai-runtime.operation` events;
- daemon initialization/shutdown integration;
- Architecture Guardian AG320–AG329;
- static, runtime/type and negative Guardian validation gates.

## Build 34 boundary

Build 34 intentionally does **not** provide:

- a concrete Ollama/vLLM/Qwen/vendor adapter;
- external-provider execution;
- network authority;
- Secrets Vault access;
- provider or model persistence;
- prompt or generated-response persistence;
- dynamic provider registration;
- model download/installation;
- model removal/update/default selection;
- automatic provider/model routing;
- Studio AI HTTP transport;
- conversation, tool or agent execution.

## Capability resources

- `READ gd://ai-runtime/providers`
- `READ gd://ai-runtime/providers/<provider>/models`
- `EXECUTE gd://ai-runtime/providers/<provider>/models/<model>`

The runtime remains deny-by-default through Build 15 Capability Security. `READ` does not imply `EXECUTE`.

## Runtime privacy

AI Event Bus payloads include only provider/model identifiers and operational metadata. Prompt/message text and generated response text are excluded.

No database migration or AI persistence table is introduced in Build 34.

## Roadmap ownership preserved

- Build 35 — Local AI Installer;
- Build 36 — Model Manager;
- Build 37 — Model Routing;
- Build 44 — Conversation Engine;
- Build 53 — Tool Runtime;
- Build 58 — Agent Runtime.

## Validation plan

Before merge, Build 34 must pass:

1. Architecture Guardian including AG320–AG329;
2. accumulated Builds 4–34 CI;
3. forward-compatible Build 33 contract-only regression gates;
4. TypeScript compilation across Local Runtime and AI contract;
5. fake-local-adapter execution validation;
6. external-provider rejection validation;
7. READ-vs-EXECUTE authorization separation;
8. prompt/response Event Bus leakage checks;
9. absence of Build 34 AI persistence tables;
10. negative Guardian probes for network/provider-manager/external-execution drift;
11. modern-engine preservation;
12. full historical pull-request workflow matrix.

No release, tag, production deploy, browser-store publication, production Supabase mutation or DNS mutation is authorized by this Build.
