# Build 37 — Model Routing

Status: implementation complete; isolated validation green on the Cortex-synchronized final functional head. PR matrix and merge remain the final gates.

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

The final functional head `c6cdd8f61f839c79d81b330c91acda71333ee80c`, synchronized with the current `main` Cortex map, passed:

- Architecture Guardian through AG350–AG359;
- accumulated Builds 4–37 regression;
- TypeScript workspaces;
- executable deterministic routing behavior;
- preferred → manual default → sorted fallback precedence;
- composed `READ` capability checks;
- fail-closed empty/missing/URL-shaped selection cases;
- sanitized events and zero routing persistence;
- hardened negative probes, including forbidden authority declarations;
- modern-engine preservation.

The PR matrix and protected merge remain required before Build 37 is considered incorporated into `main`.