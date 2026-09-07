# Build 36 — Model Manager

Status: implementation and isolated/accumulated branch validation complete; pull-request matrix pending.

## Delivered

- provider-neutral `LocalAIModelManager` in `apps/local`;
- local manager adapter contract using `@github-decrypter/ai` model descriptors;
- installed-model inventory;
- capability-gated model removal with mandatory `DESTRUCTIVE`;
- capability-gated model update with conditional `NETWORK`;
- Offline Execution fail-closed handling for network-required updates;
- manual session-only default model selection/get/clear;
- automatic default clearing when the selected model is removed;
- URL-shaped model-ID rejection;
- sanitized Event Bus ready/operation events;
- daemon startup/shutdown integration;
- Local Runtime 0.0.36 identity;
- Architecture Guardian AG340–AG349;
- static, runtime and negative-Guardian tests.

## Explicitly deferred

- automatic model routing and role-based selection — Build 37;
- provider-specific implementation and mandatory vendor choice;
- Studio/HTTP model-management transport;
- model/default persistence;
- secrets authority;
- direct filesystem/process authority;
- external-provider management.

## Validation

The isolated Model Manager contract/runtime validation passed before global Build 36 policy activation.

The accumulated Build 36 push workflow passed on functional head `6d3b71f816433ba2021f77e2659c1ea1118029ec`, including:

- Architecture Guardian through AG349;
- Builds 4–36 accumulated regression;
- TypeScript workspace validation;
- Model Manager static/runtime/negative coverage;
- modern-engine preservation.

The pull-request matrix against `main` remains the final merge gate.