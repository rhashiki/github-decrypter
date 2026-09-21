# Testing Agent

Build 62 activates Samuel as the canonical QA/testing specialization for bounded Interactive QA while preserving Tool Runtime, Checkpoint Engine and Validation Pipeline sovereignty.

## Authority

- owner package: `@github-decrypter/ai`
- source: `packages/ai/src/testing-agent.ts`
- schema: `gd-testing-agent/1`
- canonical specialist: Samuel / `qa-testing`
- source Agent Runtime: Build 58
- execution substrate: Tool Runtime Build 53
- mutation boundary: Scope Lock Build 55
- proof substrate: Checkpoint Engine Build 56
- validation authority: Validation Pipeline Build 57
- mode: `BUILD`

## Behavioral flow

One Testing Agent execution handles one explicitly supported flow and one explicit acceptance criterion:

```text
explicit acceptance criterion
  -> bounded Tool Runtime test/read tool
  -> completed Tool Runtime invocation
  -> Checkpoint Engine proof
  -> observed tool result
  -> Validation Pipeline
  -> passed | failed
```

The observed value submitted to Validation Pipeline is the actual completed Tool Runtime result. Samuel does not fabricate or semantically infer observed evidence.

## Boundary

`Testing Agent != Validation Pipeline`

Samuel exercises a bounded supported flow and submits the observed result to the canonical Validation Pipeline. Build 57 remains the sole behavioral validation authority and owns `completionEligible`.

`Testing Agent != unrestricted automation`

Build 62 permits only explicitly registered Tool Runtime tools with `READ` or `EXECUTE`. Generic `WRITE`, `NETWORK`, `DATABASE_WRITE`, `GIT_WRITE`, `DESTRUCTIVE` and `SECRETS` are rejected. `EXECUTE` must be declared mutating and requires an exact Scope Lock candidate with `execute` access.

`Testing Agent != browser automation authority`

Build 62 does not create Playwright/Puppeteer/browser-control authority, Preview control or generic UI automation. Later Preview/Perception authorities may expose supported bounded testing surfaces, but they must still enter through the ordinary capability, Scope Lock, Tool Runtime, Checkpoint and Validation chain.

`Testing Agent != mutation authority`

Samuel cannot grant capabilities, enlarge Scope Lock, write project files, mutate databases, write Git or authorize production changes. Any bounded execution authority belongs to Tool Runtime and the existing capability/Scope Lock policies.

`Testing Agent != completion claim authority`

A successful tool execution is not success by itself. Canonical completion eligibility comes only from the Validation Pipeline result. Viktor may communicate that result later but owns no validation authority.

## Current supported evidence

Build 62 accepts only:

- `tool-result`
- `test`

`diagnostic` and `preview` remain valid Validation Pipeline evidence kinds but are not claimed as Testing Agent flow surfaces in this Build.

## Preserved ownership

- Build 15 — capability verification.
- Build 52 — Build orchestration.
- Build 53 — Tool Runtime execution.
- Build 55 — Scope Lock.
- Build 56 — Checkpoint Engine.
- Build 57 — Validation Pipeline.
- Build 63 — Review Agent.
- Build 64 — Agent Orchestrator and later coordinated team flow.
- Build 68/70 — Preview Runtime / Preview Bridge.

Samuel is an operational specialization, not an independent security principal.

## Interactive QA

Interactive QA means the system can exercise a supported bounded behavior and compare its observed result with explicit acceptance intent. It does not mean open-ended browser control, unrestricted shell use, arbitrary network activity or autonomous mutation.
