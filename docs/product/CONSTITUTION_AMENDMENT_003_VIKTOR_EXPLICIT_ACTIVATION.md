# Constitutional Amendment 003 — Viktor Explicit Activation

Status: **ADOPTED BY PRODUCT OWNER — IMPLEMENTATION MAPPED TO BUILD 64**

## Purpose

The product owner requires Viktor to be activated only through an explicit user-controlled toggle in the Vortex Ars AI interface.

This amendment refines Constitutional Amendment 002 without changing Viktor's identity, agent relationship, voice profile, execution boundaries or Build ownership model.

## Constitutional activation rule

1. Viktor is **OFF by default at the beginning of each new application session**.
2. Viktor may enter an active voice session only after the user explicitly switches the visible `Viktor` toggle to `ON`.
3. The first activation that requires microphone access must request the applicable platform/browser microphone permission through the normal permission flow.
4. Switching the toggle to `OFF` must immediately stop microphone capture, end or disconnect realtime voice transport, cancel pending assistant audio playback where technically possible and release microphone/media resources.
5. Viktor must not silently reactivate because it was enabled in a previous application session.
6. Text interaction with Vortex Ars AI remains available independently of the Viktor voice toggle unless another product rule explicitly disables it.
7. Toggle state is an interaction preference, **not** a capability grant, approval transaction, Scope Lock or execution authority.
8. Enabling Viktor must never authorize file, Git, database, network, deployment or production mutation.
9. Disabling Viktor must not destroy canonical conversation history; it ends the voice/presence session while preserving the ordinary Conversation Engine state.

## Interface contract

The canonical Studio interface must expose a clearly visible Viktor activation control.

Minimum states:

- `OFF` — no active Viktor voice session and no microphone capture;
- `ON / READY` — Viktor is enabled and ready for voice interaction;
- `LISTENING` — microphone input is actively being consumed by the voice transport;
- `SPEAKING` — Viktor is producing assistant audio;
- `ERROR / UNAVAILABLE` — provider, permission or transport failure prevents normal voice operation.

The visual implementation may collapse transient states into status indicators around the same toggle, but the user must always be able to determine whether Viktor is active.

## Privacy and lifecycle invariants

`session start -> Viktor OFF`

`toggle ON -> explicit activation`

`toggle OFF -> microphone/voice transport stopped`

`application restart -> no automatic listening`

`voice activation != execution authority`

`voice deactivation != conversation deletion`

No background listening, hidden wake-word listener or silent microphone reacquisition is authorized by this amendment.

## Owning Build

The frozen V1 Build sequence remains unchanged.

**Build 64 — Agent Orchestrator** owns the first canonical Viktor activation implementation, including:

- Studio-facing Viktor toggle integration;
- per-session activation state;
- voice-session lifecycle binding;
- microphone permission handshake;
- immediate deactivation/resource release;
- human-readable availability/listening/speaking/error state;
- reuse of the canonical Conversation Engine rather than a second voice conversation authority.

Later Builds may enrich Viktor's Preview/perception/adaptive behavior, but they must consume the activation state established by Build 64 rather than inventing independent activation paths.

## Non-authority

This amendment does not authorize:

- implementation before Build 64;
- always-on listening;
- wake-word background capture;
- persistent automatic voice activation across application restarts;
- bypassing browser/OS microphone permissions;
- a second conversation or memory authority;
- capability escalation through the toggle;
- production mutation or deployment authority.

## Governance

This amendment is an explicit product-owner requirement and must be reflected in the canonical V1 roadmap and Viktor architecture documentation. Existing numbered Build gates remain mandatory.
