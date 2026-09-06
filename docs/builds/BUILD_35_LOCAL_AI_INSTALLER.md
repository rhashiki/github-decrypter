# Build 35 — Local AI Installer

## Status

Implementation complete on `build/35-local-ai-installer`; final accumulated CI and protected merge are required before the Build is considered complete on `main`.

## Objective

Introduce a capability-gated Local AI Installer that can install local model artifacts through trusted construction-time adapters without absorbing Model Manager or Model Routing responsibilities.

## Delivered

- `apps/local/src/ai-installer.ts`
- schema `gd-local-ai-installer/1`
- result schema `gd-local-ai-install-result/1`
- operations `installers.list` and `models.install`
- compatibility families: Ollama-compatible, vLLM-compatible and custom-local
- local-provider-only adapter validation
- model identifier normalization and URL-shaped identifier rejection
- `READ` gate for installer discovery
- `WRITE + EXECUTE` gate for installation
- conditional `NETWORK` gate for adapters that need network access
- fail-closed offline behavior before network-required adapter execution
- offline-capable cached/local adapter path
- sanitized Local Runtime Event Bus integration
- daemon lifecycle integration
- Local Runtime identity/version `0.0.35`
- `localAIInstallerAuthority` in `architecture.guardian.json`
- Architecture Guardian AG330–AG339
- static, TypeScript, runtime and negative Guardian tests
- forward-compatible Build 34 identity assertions while preserving Build 34 authority boundaries

## Explicit non-goals

Build 35 does not implement:

- concrete provider download/process adapters;
- external provider installation;
- arbitrary download URLs;
- Secrets Vault or credential handling;
- direct filesystem/process authority;
- model state persistence;
- remove/update/default-model workflows;
- model routing;
- Studio installer UI/HTTP transport;
- release, deployment, Chrome Store, DNS or production backend changes.

## Ownership boundaries

- Build 34: Local AI Runtime execution/discovery
- Build 35: explicit local installation authority
- Build 36: Model Manager
- Build 37: Model Routing

## Validation gates

The Build is mergeable only after:

1. Architecture Guardian passes.
2. Build 4–35 accumulated regression passes.
3. Build 35 static contract test passes.
4. Build 35 TypeScript test compilation passes.
5. Build 35 runtime behavior test passes.
6. Build 35 Guardian negative tests pass.
7. Workspace typecheck passes.
8. Modern engine preservation passes.
9. All pull-request workflows on the validated head are green.
