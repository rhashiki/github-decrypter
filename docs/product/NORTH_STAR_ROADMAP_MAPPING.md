# GitHub Decrypter — North Star Roadmap Mapping

Status: **FROZEN V1 MAPPING**

Build 9 incorporates the explicit North Star directive without inventing decimal Builds and without renumbering Builds 1–134. The new product blocks are assigned to existing roadmap authorities where the responsibility naturally belongs.

This mapping is an explicit owner-authorized amendment to the V1 planning surface. It does not authorize implementation before the owning Build.

## Mapping

| North Star block | Primary owning Build(s) | Integration notes |
| --- | --- | --- |
| Adaptive User Profile | **Build 31 — Onboarding**, **Build 108 — Learning Mode** | Build 31 creates the profile and preferences foundation; Build 108 evolves adaptive knowledge/explanation behavior. |
| Agent Orchestrator | **Build 64 — Agent Orchestrator** | Existing roadmap authority remains unchanged. |
| Named Agent System | **Build 58 — Agent Runtime**, **Build 64 — Agent Orchestrator** | Build 58 defines agent identity/role metadata and authority boundaries; Build 64 coordinates them as one team. |
| Mentor Engine | **Build 108 — Learning Mode** | Learning Mode becomes the primary runtime authority for contextual Mentor behavior; it must remain optional. |
| Explain This | **Build 108 — Learning Mode**, consumed by Plan/Diff/Git/Preview surfaces | Build 108 owns the explanation engine; other surfaces expose contextual entry points without creating separate explanation engines. |
| Voice Interaction | **Build 44 — Conversation Engine**, **Build 45 — Attachment Engine** | Conversation Engine owns conversational continuity; Attachment Engine owns supported media/audio ingestion where applicable. Voice must share conversation context rather than create a second state authority. |
| Perception Engine | **Build 70 — Preview Bridge**, **Build 103 — Visual Inspector**, **Build 104 — Visual Context** | Preview Bridge provides runtime telemetry; Visual Inspector/Context create the perception and source mapping layer. |
| Explore Mode | **Build 103 — Visual Inspector** | Educational/interactive Preview selection is a mode of the Visual Inspector, not a separate product shell. |
| Visual Element Mapping | **Build 104 — Visual Context** | Owns Preview/DOM/component/source-code correlation where technically possible. |
| Interactive QA | **Build 57 — Validation Pipeline**, **Build 62 — Testing Agent** | Validation defines acceptance flow; Testing Agent can exercise supported application flows and compare behavior with the request. |
| Adaptive Explanation Engine | **Build 108 — Learning Mode** | Adapts explanation depth to the user profile and learned concepts. |

## Required acceptance extensions

The owning Builds must include these North Star requirements in their Definition of Done when reached:

### Build 31 — Onboarding
- conversational onboarding;
- technical-level preference;
- usage objective;
- learning-intent preference;
- desired explanation depth;
- initialization of an Adaptive User Profile;
- no requirement that a beginner understand implementation terminology before using the product.

### Build 44/45 — Conversation and Attachments
- text and supported voice/audio interaction share the same conversation/project context;
- voice cannot bypass Plan/Build authority, Scope Lock, approvals or security boundaries.

### Build 58/64 — Agents
- agent identity includes role, specialty, responsibilities and authority limits;
- named identities are presentation/coordination metadata, not independent security principals with implicit power;
- multiple specialists produce one coherent user experience;
- user does not need to manually route ordinary requests to a specialist.

### Build 57/62 — Validation and Testing Agent
- supported flows can be exercised behaviorally rather than accepted only because code appears correct;
- validation relates observed result to original request/acceptance criteria;
- interactive testing remains bounded by capabilities, safety policy and project scope.

### Build 70/103/104 — Preview and Perception
- Preview is a context source;
- runtime telemetry may include console, errors, network/navigation and supported DOM/component information;
- Visual Inspector can support Explore Mode;
- Visual Context attempts element → component/source mapping where technically possible;
- screenshots/computer vision complement structured runtime evidence rather than automatically replacing it.

### Build 108 — Learning Mode / Mentor
- Mentor is contextual and optional;
- explanation depth can adapt to user profile;
- the system can avoid repeatedly explaining concepts already understood while allowing the user to ask again;
- Explain This can be consumed by appropriate Plan, code, Git, error and Preview surfaces;
- no unsolicited educational interruption that materially blocks an experienced user's workflow.

## Architecture constraints

1. These mappings do not move privileged execution into the Studio.
2. The Adaptive User Profile is experience context, not a security capability source.
3. Agent personality or name never increases authority.
4. Mentor/Explain This never bypasses Plan/Build boundaries.
5. Perception/Explore Mode are read/observe capabilities unless a later approved Build explicitly transitions to an authorized mutation flow.
6. Interactive QA is constrained execution, not unrestricted browser automation.
7. Voice is another interaction channel, not another execution authority.
8. Commercial requirements remain separate from local model inference costs.
9. No Build may claim infinite tokens/context/resources.
10. The user remains final authority for actions outside already granted scope.

## Relationship with the frozen roadmap

The canonical Build sequence remains **1 → 134**. This file adds explicit acceptance responsibility to existing Builds. It does not create Build 31.1, 44.1, 103.1 or any other ad-hoc numbering.

Future ideas outside the North Star amendment continue to follow `docs/product/RFC_POLICY.md`.
