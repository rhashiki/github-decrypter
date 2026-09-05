# Onboarding & Adaptive User Profile Foundation

Build 31 introduces the first user-adaptive experience context in GitHub Decrypter.

## Contract

The profile schema is `gd-adaptive-user-profile/1` and contains four experience preferences:

- `technicalLevel`;
- `objective`;
- `learningIntent`;
- `explanationDepth`.

The profile is immutable after creation. A new onboarding completion creates a new profile value rather than mutating the previous object.

## Conversational onboarding

The Studio asks four plain-language questions in sequence:

1. current familiarity with building software;
2. primary usage objective;
3. desired learning involvement while building;
4. preferred explanation depth.

The user can move backward and can retake onboarding after completion. Beginners are never required to understand implementation terminology before using the product.

## Session-only boundary

Build 31 deliberately does **not** persist the profile in browser storage.

The Product Constitution assigns persistence to the Local Runtime. Since Build 31 does not authorize Studio-to-Local-Runtime transport, the correct boundary is an in-memory session profile. Closing/reloading the Studio resets it.

This is an explicit limitation, not an accidental omission. A later authorized runtime connection may make the profile durable without moving persistence ownership into React.

## Security boundary

The Adaptive User Profile is experience context only. It is never a source of:

- capabilities;
- permissions;
- approvals;
- Scope Lock decisions;
- tool authority;
- backend authority.

Changing a profile preference can alter wording/presentation only within the capabilities of the owning Build.

## Deferred intelligence

Build 31 does not implement adaptive learning history, concept mastery, Mentor behavior or AI-generated personalized explanations. Those remain owned by later Builds, especially Build 108 — Learning Mode.

Environment Doctor remains Build 32 and AI Provider API remains Build 33.
