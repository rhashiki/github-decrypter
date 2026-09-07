# Build 36 — Model Manager

Status: implementation complete; accumulated validation pending.

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

The isolated Model Manager contract/runtime validation passed before global Build 36 policy activation. Full Builds 4–36 accumulated CI and pull-request matrix remain required before merge.