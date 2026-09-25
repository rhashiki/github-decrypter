# PI-Desktop — Vortex Ars Adoption Record

Status: **Accepted as an architectural/reference source**

Upstream: `https://github.com/vastsa/PI-Desktop`

Inspection date: **2026-09-25**

Observed release line: **0.15.x Early Preview**

Observed upstream license: **LGPL-3.0**

## Decision

Vortex adopts useful architectural patterns, not PI-Desktop source code.

No direct runtime dependency is introduced by this record.

Any direct reuse/linking/modification of LGPL-covered PI-Desktop implementation requires separate legal and architecture review.

The Pi packages used underneath PI-Desktop are separate candidates and are **not** approved or rejected here; they require independent repository/license/API/performance evaluation.

## High-value patterns adopted

### Local/model portability

- model/runtime replaceability;
- normalized provider/model abstraction;
- local runtimes such as Ollama and OpenAI-compatible local gateways;
- capability metadata separate from transport implementation;
- custom/unknown local model fallback with conservative assumptions;
- no product dependence on one model vendor.

### Context engineering

- context budget derived from the model actually executing the work;
- shared parent/worker budget rules;
- compaction before hard overflow;
- degraded-but-explicit continuation before terminal context failure;
- resumed worker seed bounded to current model budget;
- fallback candidates checked for fit before use.

### Multi-agent execution

- temporary subagent/delegate for bounded work;
- durable Worker Session for substantial independent work;
- independent inspectable worker context;
- bounded fan-out;
- parent-scoped coordination;
- structured result return;
- recovery of interrupted work.

### Runtime safety

- tool concurrency/admission budgets by class/session;
- serialized mutation pressure;
- bounded queues;
- cancellation propagation;
- rate braking;
- failure/retry limits;
- supervised background services.

### Plugin platform

- plugins can contribute tools, skills, UI surfaces, MCP, services and other bounded features;
- manifest-declared permissions;
- filesystem scopes;
- network-domain allowlists;
- consent for elevated reach;
- permission diff on upgrade;
- audit trail;
- lifecycle cleanup.

### Dangerous-operation consent

Especially adopted:

> Human-facing dangerous-operation labels must come from the trusted host's canonical operation catalog, never from model/plugin/transcript text.

This prevents prompt-injected or malicious callers from presenting a destructive action as something harmless.

## Useful patterns deliberately adapted, not copied

- PI-Desktop's visible provider marketplace is not the Vortex default UX because Vortex follows One Intelligence.
- Worker Sessions do not become new canonical agents.
- Plugin permissions do not replace Vortex Capability + Scope Lock + Approval.
- PI-Desktop session orchestration does not replace Ramon.
- PI-Desktop project memory does not replace Vortex Project Memory/Product Contract.
- Electron is not adopted as an architectural requirement.
- models.dev is not adopted as a mandatory external dependency; Vortex may use its own signed/bundled capability metadata and trusted local discovery.

## Roadmap impact

Patterns are distributed to existing Build owners rather than creating a new Build:

- 33–37: local provider/model boundaries;
- 44: persistent session continuity;
- 53: Tool Runtime authority compatibility;
- 64: orchestration boundary;
- 90: plugin SDK/sandbox;
- 115: Worker Sessions;
- 118: recovery/checkpoints;
- 119/123: local runtime installation UX;
- 124: regression matrix;
- 125: compatibility matrix;
- 127: security audit;
- 128: context/compute efficiency;
- 133: RC enforcement.
