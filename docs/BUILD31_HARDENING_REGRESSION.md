# Build 31 — Hardening + Regression

Version: `2.4.31`

Trust protocol: `2.4.21`

## Objective

Close the pre-release technical cycle with a capability registry and an additional fail-closed sentinel around the Decrypter Chat/approval surfaces, while preserving every prior Build guarantee.

## Capability Registry

Build 31 exposes `window.LovableDecrypterCapabilities` with these stable capability IDs:

- `workspace.tree`
- `workspace.file`
- `workspace.metadata`
- `workspace.download`
- `project.state_graph`
- `recovery.scan`
- `composer.mount`
- `chat.host`
- `plan.surface`
- `approval.transaction`

The registry probes already-authorized APIs only. It does not add privileged backend access or a new network path.

## Hardening Sentinel

`window.LovableDecrypterHardening` evaluates routing, connectivity, Decrypter Chat state and required capability health.

States:

- `READY`
- `BUSY`
- `LOCKED`
- `DEGRADED`

When Decrypter routing is ON, the Sentinel independently blocks likely native Lovable composer intents for Enter, send-click and form submit. It never forwards or reconstructs a prompt for Lovable.

Safe remount may call only `LovableDecrypterChat.mount()`. It does not dispatch keyboard events, click native send buttons, call `requestSubmit`, or submit forms.

Offline while Decrypter routing is ON is fail-closed (`LOCKED`). Reconnect, SPA navigation, project change, visibility restore and chat/composer state changes cause capability re-evaluation and safe remount only.

## Final fail-closed matrix

1. Enter with Decrypter ON cannot reach native Lovable send.
2. Native send click cannot submit a Decrypter command.
3. Remount while typing does not submit or replay text.
4. Extension/chat surface failure does not transfer text to Lovable.
5. Invalid/expired authorization remains blocked by existing license/trust gates; no native fallback exists.
6. DOM/SPA changes do not open an unguarded native submit path.
7. No duplicate transaction Apply is accepted.
8. Approve executes at most once per validated transaction.
9. Skip executes at most once per validated transaction.
10. Failure paths do not intentionally consume Lovable credits.

## Regression scope

The Build 31 workflow runs all repository simulation tests, including GitHub AutoSync, Supabase, Queue, Brain, Rules, Skills, Knowledge/RAG, Model Gateway, Decrypter Local, Shadow Build, Scope Lock, Live Ops, update/recovery, Project State, Recovery Doctor, Decrypter Chat and Approve/Skip Auto Repair contracts.

## Security/freeze guarantees

- no global `fetch`, XHR or `sendBeacon` monkeypatch;
- no new MutationObserver in Build 31;
- no synthetic native keyboard/send dispatch in Build 31;
- no Supabase migration or Edge Function change;
- no automatic OTA/GitHub Release publication;
- release surfaces remain frozen;
- Trust Protocol remains `2.4.21`.

Build 31 is a pre-release hardening milestone only. Official release remains a separate explicit action.