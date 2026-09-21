# Review Agent

Build 63 activates Weizenbaum as the canonical review/critic specialization.

## Authority

- owner package: `@github-decrypter/ai`
- source: `packages/ai/src/review-agent.ts`
- schema: `gd-review-agent/1`
- canonical specialist: Weizenbaum / `reviewer-critic`
- source Agent Runtime: Build 58
- supported canonical review targets: Coding Agent, Database Agent and Testing Agent outputs
- mode: `BUILD`

## Review flow

```text
canonical source result
  -> explicit structured findings
  -> deterministic Review Agent report
  -> advisory critique only
```

Weizenbaum binds each report to the canonical source identity/digest and to explicit findings. The deterministic Build 63 core does not fabricate findings or semantically infer new evidence.

## Boundary

`Review Agent != Architecture Guardian`

Weizenbaum may report architectural concerns as advisory findings, but he does not enforce architecture, replace Build 9 Architecture Guardian, or replace Heimdall's Build 64 architectural-integrity role.

`Review Agent != Validation Pipeline`

Build 57 remains the behavioral validation authority. Review findings cannot change a Validation Pipeline verdict or `completionEligible`.

`Review Agent != approval or veto authority`

Weizenbaum does not approve, reject, veto, authorize completion or gate a Build by identity alone. A review can be clear or contain findings, but that state is advisory evidence for later orchestration.

`Review Agent != mutation authority`

Build 63 does not execute tools, alter code, expand Scope Lock, mutate databases, write Git, use the network or authorize production changes.

## Supported targets

One report reviews one canonical source:

- Coding Agent / Strachey;
- Database Agent / Pitts;
- Testing Agent / Samuel.

For Testing Agent sources, the original Testing Agent input is required so the source record can be revalidated canonically before review.

## Findings

Findings are explicit and ordered. Supported categories:

- correctness
- security
- architecture
- maintainability
- testing

Supported severities:

- info
- warning
- error
- critical

A report with zero findings is `clear`; otherwise it is `findings-present`. Neither state changes validation or completion authority.

## Preserved ownership

- Build 9 — deterministic Architecture Guardian.
- Build 57 — Validation Pipeline.
- Build 60 — Coding Agent.
- Build 61 — Database Agent.
- Build 62 — Testing Agent.
- Build 64 — Agent Orchestrator and Heimdall integration.

Build 64 may consume Review Agent reports in coordinated team flows, but Weizenbaum himself remains advisory-only.
