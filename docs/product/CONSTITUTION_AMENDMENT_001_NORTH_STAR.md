# Constitutional Amendment 001 — North Star Authority

Status: **ADOPTED in Build 9**

## Purpose

`PRODUCT_CONSTITUTION_V1.md` froze the V1 scope and required post-freeze product ideas to follow RFC governance. After that freeze, the product owner supplied and explicitly authorized incorporation of the GitHub Decrypter North Star Manifesto.

This amendment records that authorization without rewriting or hiding the original constitutional history.

## Amendment

Effective with Build 9:

1. `docs/product/NORTH_STAR_MANIFESTO.md` becomes a co-equal product-direction authority alongside the Product Constitution for interpretation of UX, adaptive experience, agent-team behavior, Preview/perception direction and commercial positioning.
2. `docs/product/NORTH_STAR_ROADMAP_MAPPING.md` is an explicit owner-authorized V1 roadmap amendment.
3. The following capabilities are therefore accepted into the V1 planning surface without requiring a separate RFC solely for their inclusion:
   - Adaptive User Profile;
   - Agent Orchestrator;
   - Named Agent System;
   - Mentor Engine;
   - Explain This;
   - Voice Interaction;
   - Perception Engine;
   - Explore Mode;
   - Visual Element Mapping;
   - Interactive QA;
   - Adaptive Explanation Engine.
4. These capabilities must be implemented only in their mapped owning Builds. This amendment does not authorize premature implementation.
5. Existing architectural restrictions remain intact: local runtime authority, Plan/Build separation, Scope Lock, capability boundaries, fail-closed security, provider independence, Git source-of-truth, no automatic production mutation and no automatic publication.
6. Agent identity/personality never grants capability or security authority.
7. Adaptive User Profile data may influence explanation and interaction but may never grant execution capability.
8. Preview perception is observation/context until an approved Build transitions a request into an authorized Build mutation.
9. Voice is an interaction channel and cannot bypass approval or execution controls.
10. Interactive QA is constrained validation execution, not unrestricted automation.
11. The commercial model defined by the North Star is official product direction: paid monthly, semiannual, annual and lifetime options, plus a 24-hour free trial, with exact pricing/terms deferred to the commercial implementation stage.
12. Local-first must never be represented as infinite compute, infinite context, infinite tokens or a free product.

## Governance after this amendment

New ideas not covered by the Product Constitution, Frozen V1 Scope, this amendment or another explicitly adopted amendment continue to follow `RFC_POLICY.md`.

The Architecture Guardian must fail CI if this amendment, the North Star authority or its roadmap mapping disappears or contradicts machine-checkable architecture constraints.
