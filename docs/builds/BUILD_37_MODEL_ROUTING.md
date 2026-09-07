# Build 37 — Model Routing

Status: implementation in progress; isolated routing core validation passed before full phase activation.

## Goal

Introduce deterministic local model routing without moving installation, management, execution, persistence or provider-specific authority into the router.

## Implemented

- `gd-local-ai-model-routing/1` runtime authority.
- `gd-local-ai-model-route-decision/1` decision contract.
- `routes.select` operation.
- precedence: explicit preferred model → manual Build 36 default → deterministic sorted fallback.
- fail-closed behavior for missing preferred/default candidates and empty installed inventory.
- composed `READ` authorization across routing and Model Manager resources.
- URL-shaped model ID rejection.
- sanitized canonical Event Bus events.
- daemon lifecycle integration after Model Manager.
- no HTTP/Studio transport.
- no routing persistence.
- no prompt inspection or adaptive routing.

## Ownership preserved

- Build 34 remains the execution owner and keeps `automaticRouting:false`.
- Build 35 remains the installation owner and keeps `automaticRouting:false`.
- Build 36 remains the management/manual-default owner and keeps `automaticRouting:false`.
- Build 37 alone owns deterministic route selection.

## Validation

The isolated routing workflow passed static contract validation, TypeScript compilation, executable routing behavior, Build 36 regression preservation, and modern-engine preservation before full Build 37 policy activation.

Full Architecture Guardian AG350–AG359, accumulated Builds 4–37 CI, PR matrix and merge remain required before this Build is considered complete.