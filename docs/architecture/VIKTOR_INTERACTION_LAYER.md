# Viktor Interaction Layer

Status: **CANONICAL ARCHITECTURE — IMPLEMENTATION DEFERRED TO MAPPED BUILDS**

## Role

Viktor is the canonical real-time communication surface between the user and Vortex Ars AI.

Viktor is **not an agent** and is **not an execution authority**. It is a conversational presence layer that binds voice, text, project context, Preview context and coordinated agent output into one coherent user experience.

## Core topology

```text
User
  │
  ├─ explicit Viktor toggle
  │      OFF -> no voice session / no microphone capture
  │      ON  -> voice session may start after permission checks
  │
  ├─ voice / text / interruption
  ▼
Viktor Interaction Layer
  │
  ▼
Canonical Conversation Context
  │
  ▼
Prompt Intake / Requirements / Plan
  │
  ▼
Agent Orchestrator
  │
  ├─ specialist agents
  └─ reviewer / testing / perception paths
  │
  ▼
Build Orchestrator
  │
  ▼
Scope + Capability Gates
  │
  ▼
Tool Runtime
  │
  ▼
Validation
  │
  ▼
Preview / Result
  │
  ▼
Viktor communicates outcome to user
```

## Canonical boundaries

### Viktor may

- receive streaming voice or text;
- maintain conversational turn-taking through the canonical Conversation Engine;
- expose partial speech/transcript state;
- allow interruption/barge-in where the active voice adapter supports it;
- translate natural user requests into the existing intake/planning flow;
- receive structured state from the Agent Orchestrator;
- receive Preview/perception context from the canonical Preview stack;
- communicate progress, questions, warnings and validated results;
- adapt explanation depth through the Learning Mode authority.

### Viktor may not

- grant capabilities;
- authorize itself to mutate files, network, Git or databases;
- skip Plan, Scope Lock, approval or validation requirements;
- directly execute tools outside Tool Runtime;
- create an independent memory authority;
- claim that an unvalidated change succeeded;
- impersonate J.A.R.V.I.S. or clone an identifiable performer's voice.

## Explicit activation contract

Viktor voice/presence is opt-in per application session.

The Studio must expose one clearly visible `Viktor` toggle. The canonical lifecycle is:

```text
application/session start
→ Viktor OFF
→ user toggles Viktor ON
→ microphone permission handshake if required
→ READY / LISTENING / SPEAKING
→ user toggles Viktor OFF
→ capture stops immediately
→ realtime voice transport closes
→ microphone/media resources are released
```

Canonical rules:

- `OFF` is the default at the beginning of each new application session;
- Viktor must never begin microphone capture before an explicit `ON` action;
- previous-session state must not silently reactivate listening after restart/reload;
- the first activation that requires microphone access uses the normal browser/OS permission flow;
- switching `OFF` stops microphone capture and voice transport immediately and cancels assistant audio playback where technically possible;
- disabling Viktor does not delete canonical conversation history;
- text chat remains independent of the Viktor voice toggle;
- no hidden wake-word listener, background listening or silent microphone reacquisition is authorized.

The UI may represent transient runtime state around the same toggle, using states such as:

- `OFF`;
- `ON / READY`;
- `LISTENING`;
- `SPEAKING`;
- `ERROR / UNAVAILABLE`.

These are presentation/session states, not security capabilities.

## Voice transport

The voice transport must be provider-neutral behind a Vortex-owned adapter contract.

A compatible implementation may support speech-to-speech realtime transport or separate streaming STT + LLM + TTS. The product contract must not require one vendor.

Expected transport features:

- streaming PCM/Opus or provider-supported realtime audio;
- session lifecycle;
- VAD/endpointing;
- partial and final transcript events;
- incremental assistant audio;
- barge-in/cancel response;
- reconnect/recovery handling;
- text fallback;
- push-to-talk fallback.

## Viktor Voice Profile

The public voice should feel like a real person rather than a synthetic command assistant.

Target characteristics:

- original identity;
- natural breathing-room and pauses;
- conversational cadence;
- calm, controlled confidence;
- restrained warmth;
- low-to-mid register where available;
- minimal exaggerated emotion;
- language-aware pronunciation;
- Brazilian Portuguese quality treated as first-class;
- no direct acoustic or performance imitation of J.A.R.V.I.S./Paul Bettany or another identifiable person.

Voice-provider settings are implementation details. The persistent product identity is `Viktor`, not a provider voice name.

## Conversational state model

Viktor must consume the same canonical conversation/project state used by text chat. Voice is another transport for the same conversation.

Conceptual events:

```text
viktor.session.opened
viktor.input.started
viktor.input.partial
viktor.input.final
viktor.response.started
viktor.response.delta
viktor.response.interrupted
viktor.response.completed
viktor.context.preview.updated
viktor.agent.status
viktor.validation.result
viktor.session.closed
```

These event names are architectural examples until their owning Build freezes a schema; this document does not reserve runtime namespace authority ahead of that Build.

## Preview-aware conversation

The Preview stack must supply structured context rather than relying only on screenshots.

Preferred evidence order:

1. explicit selected element/context;
2. DOM/component/source mapping;
3. runtime navigation/state metadata;
4. console/network/runtime telemetry;
5. screenshot/computer-vision evidence as complementary context.

This supports deictic language such as:

- “this button”;
- “that card on the right”;
- “the menu I just clicked”;
- “make this look like the publish action”.

If the reference is ambiguous, Viktor must ask for disambiguation or require a selection rather than guessing a mutation target.

## Execution conversation

Viktor may make the workflow feel continuous while preserving internal gates.

Example state progression:

```text
User request
→ understood intent
→ plan/scope prepared
→ specialist work running
→ validation running
→ validated result
→ Viktor reports completion
```

If a user interrupts during planning or execution, cancellation/replanning behavior must be handled by the owning orchestration/runtime authorities. Viktor itself does not invent cancellation authority.

## Agent-team presentation

The user normally talks only to Viktor. Internal specialist selection is handled by Agent Orchestrator.

Viktor may expose useful team reasoning at a summary level, for example:

- architecture impact discovered;
- frontend specialist involved;
- backend dependency identified;
- testing found a regression;
- reviewer rejected an unsafe or inconsistent approach.

The user may still explicitly address a named specialist if later UX supports it, but this is not required for ordinary use.

## Build ownership

- Builds 44–45: existing conversation/audio foundation, reused without reopening them.
- Build 64: Viktor becomes the canonical outward presence of the coordinated agent team and owns the first canonical Studio activation toggle/session-lifecycle integration.
- Build 70: Preview Bridge makes structured live application context available to Viktor.
- Build 103: selection/exploration context.
- Build 104: visual element/source mapping.
- Build 105: conversational visual mutation path under normal Build/Scope controls.
- Build 108: adaptive explanation and communication depth.

Validation evidence comes from Build 57/62 and may be spoken by Viktor only after the underlying authority reports it.

## Invariants

`voice != authority`

`Viktor != agent`

`conversation != permission`

`toggle ON != capability grant`

`toggle OFF -> no microphone capture`

`new session -> Viktor OFF`

`voice deactivation != conversation deletion`

`perception != mutation`

`agent status != validated completion`

`natural UX != bypassed governance`
