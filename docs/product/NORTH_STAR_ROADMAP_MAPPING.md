# GitHub Decrypter — North Star Roadmap Mapping

Status: **FROZEN V1 MAPPING — AMENDED BY VIKTOR INTERACTION LAYER + EXPLICIT ACTIVATION**

Build 9 incorporates the explicit North Star directive without inventing decimal Builds and without renumbering Builds 1–134. The new product blocks are assigned to existing roadmap authorities where the responsibility naturally belongs.

This mapping is an explicit owner-authorized amendment to the V1 planning surface. It does not authorize implementation before the owning Build.

## Mapping

| North Star block | Primary owning Build(s) | Integration notes |
| --- | --- | --- |
| Adaptive User Profile | **Build 31 — Onboarding**, **Build 108 — Learning Mode** | Build 31 creates the profile and preferences foundation; Build 108 evolves adaptive knowledge/explanation behavior. |
| Agent Orchestrator | **Build 64 — Agent Orchestrator** | Existing roadmap authority remains unchanged. |
| Named Agent System | **Build 58 — Agent Runtime**, **Build 64 — Agent Orchestrator** | Build 58 defines agent identity/role metadata and authority boundaries; Build 64 coordinates them as one team. |
| Viktor Interaction Layer | **Build 64 — Agent Orchestrator**, **Build 70 — Preview Bridge**, **Builds 103–105 — Visual Inspector / Visual Context / Visual Build**, **Build 108 — Learning Mode** | Viktor is the canonical human-facing voice/presence layer. Build 64 owns the visible per-session Viktor activation toggle and voice-session lifecycle; Viktor starts `OFF` on each new application session and may activate voice only after explicit user action. It reuses the completed Voice Interaction foundation from Builds 44–45, represents the coordinated agent team, gains structured Preview awareness through Build 70, contextual/deictic visual interaction through 103–105 and adaptive communication depth through 108. Viktor is not a tenth agent and owns no independent execution authority. |
| Mentor Engine | **Build 108 — Learning Mode** | Learning Mode becomes the primary runtime authority for contextual Mentor behavior; it must remain optional. |
| Explain This | **Build 108 — Learning Mode**, consumed by Plan/Diff/Git/Preview surfaces | Build 108 owns the explanation engine; other surfaces expose contextual entry points without creating separate explanation engines. |
| Voice Interaction | **Build 44 — Conversation Engine**, **Build 45 — Attachment Engine** | Conversation Engine owns conversational continuity; Attachment Engine owns supported media/audio ingestion where applicable. Voice must share conversation context rather than create a second state authority. Builds 44–45 are the existing foundation consumed by Viktor and are not reopened by Amendments 002/003. |
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
- voice cannot bypass Plan/Build authority, Scope Lock, approvals or security boundaries;
- these completed Builds remain the canonical voice/audio foundation consumed by Viktor; Amendments 002/003 do not reopen their implementation history.

### Build 58/64 — Agents and Viktor activation
- agent identity includes role, specialty, responsibilities and authority limits;
- named identities are presentation/coordination metadata, not independent security principals with implicit power;
- multiple specialists produce one coherent user experience;
- user does not need to manually route ordinary requests to a specialist;
- **Build 64 must expose Viktor as the canonical outward conversational presence of the coordinated team**;
- **Build 64 must expose one clearly visible Studio toggle labeled for Viktor activation**;
- each new application session starts with Viktor voice `OFF`;
- microphone capture/realtime voice transport may start only after an explicit user `ON` action and applicable browser/OS permission checks;
- switching Viktor `OFF` must immediately stop microphone capture, close realtime voice transport and release media resources;
- disabling Viktor must preserve canonical text/conversation history;
- no previous-session state may silently reactivate microphone listening after restart/reload;
- no hidden wake-word/background listener is authorized;
- Viktor must remain presentation/interaction infrastructure, not a tenth agent or hidden privileged principal;
- ordinary agent selection and handoff must remain internal while Viktor communicates useful progress/status in human terms.

### Build 57/62 — Validation and Testing Agent
- supported flows can be exercised behaviorally rather than accepted only because code appears correct;
- validation relates observed result to original request/acceptance criteria;
- interactive testing remains bounded by capabilities, safety policy and project scope;
- Viktor may communicate validation results but may not report completion before canonical validation succeeds.

### Build 70/103/104/105 — Preview, Perception and Viktor Visual Interaction
- Preview is a context source;
- runtime telemetry may include console, errors, network/navigation and supported DOM/component information;
- Build 70 makes structured live Preview context consumable by Viktor without creating a second Preview authority;
- Visual Inspector can support Explore Mode and user-selected visual references;
- Visual Context attempts element → component/source mapping where technically possible;
- Viktor must support contextual/deictic references such as “this button” or “that card” only when the target can be resolved safely;
- ambiguous visual references must trigger disambiguation rather than guessed mutation;
- screenshots/computer vision complement structured runtime evidence rather than automatically replacing it;
- Build 105 may consume the resolved visual context to enter the ordinary authorized Build/Scope/Tool Runtime path; Viktor itself does not mutate the project.

### Build 108 — Learning Mode / Mentor / Viktor Adaptation
- Mentor is contextual and optional;
- explanation depth can adapt to user profile;
- Viktor may adapt conversational verbosity, terminology and explanation depth to the same profile without creating a second profile authority;
- Viktor's core identity remains stable even when communication style adapts;
- the system can avoid repeatedly explaining concepts already understood while allowing the user to ask again;
- Explain This can be consumed by appropriate Plan, code, Git, error and Preview surfaces;
- no unsolicited educational interruption that materially blocks an experienced user's workflow.

## Viktor realtime voice acceptance

When the future owning implementation surface is reached, Viktor should support where technically available:

- explicit activation through the canonical visible Viktor toggle;
- `OFF` by default at each new application session;
- immediate microphone/transport shutdown when toggled `OFF`;
- no hidden background/wake-word listening;
- realistic original human-sounding speech;
- natural prosody and conversational pacing;
- low-latency streaming speech input/output;
- full-duplex sessions;
- VAD/endpointing;
- barge-in/user interruption while Viktor is speaking;
- partial/final transcript continuity in the canonical conversation;
- provider-independent voice transport;
- graceful fallback to push-to-talk or half-duplex interaction;
- Brazilian Portuguese as a first-class locale while remaining multilingual;
- no voice cloning or imitation of J.A.R.V.I.S., Paul Bettany or any other identifiable person or protected character performance.

## Architecture constraints

1. These mappings do not move privileged execution into the Studio.
2. The Adaptive User Profile is experience context, not a security capability source.
3. Agent personality or name never increases authority.
4. Viktor is not an agent and never gains authority merely because it is the user's primary communication surface.
5. The Viktor toggle controls interaction/session state only; `ON` never grants capabilities, approvals, scope or mutation authority.
6. Viktor must not listen through the microphone while the canonical toggle is `OFF`.
7. Mentor/Explain This never bypasses Plan/Build boundaries.
8. Perception/Explore Mode are read/observe capabilities unless a later approved Build explicitly transitions to an authorized mutation flow.
9. Interactive QA is constrained execution, not unrestricted browser automation.
10. Voice is another interaction channel, not another execution authority.
11. Spoken intent never upgrades capabilities, scope or approval state.
12. Commercial requirements remain separate from local model inference costs.
13. No Build may claim infinite tokens/context/resources.
14. The user remains final authority for actions outside already granted scope.

## Relationship with the frozen roadmap

The canonical Build sequence remains **1 → 134**. This file adds explicit acceptance responsibility to existing Builds. It does not create Build 31.1, 44.1, 64.1, 103.1 or any other ad-hoc numbering.

`CONSTITUTION_AMENDMENT_002_VIKTOR_INTERACTION_LAYER.md` is explicit product-owner authorization for Viktor itself.

`CONSTITUTION_AMENDMENT_003_VIKTOR_EXPLICIT_ACTIVATION.md` is explicit product-owner authorization for the visible per-session activation toggle and fail-closed voice lifecycle.

Future ideas outside the adopted constitutional amendments continue to follow `docs/product/RFC_POLICY.md`.
