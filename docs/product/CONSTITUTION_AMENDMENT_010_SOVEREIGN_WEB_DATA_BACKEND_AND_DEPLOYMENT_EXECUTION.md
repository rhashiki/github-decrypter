# Constitutional Amendment 010 — Sovereign Web, Data, Backend & Deployment Execution

Status: **ADOPTED by product owner**

## Purpose

Vortex Ars AI must be able to operate real browsers, turn repeatable web work into deterministic recipes, generate and validate serious backends, and deploy complete products without turning those capabilities into alternate intelligence authorities or mandatory Vortex-paid infrastructure.

This amendment absorbs useful architecture from Browser Use, Maxun, Coolify and Supabase while preserving the frozen Builds 1–134 roadmap, One Intelligence, Local Sovereignty, Zero Marginal Vortex Compute, Scope Lock, Evidence Before Completion and license-aware adoption.

No reviewed upstream becomes mandatory Core by this amendment.

## 1. One Intelligence, many executors

Vortex has one user-facing intelligence authority.

Browser engines, scrapers, recorders, backend runtimes, deployment platforms, CLIs, MCP servers and provider SDKs are **executors/adapters**, not additional agents and not alternate reasoning authorities.

Rules:

- Ramon and the canonical agent system retain planning/orchestration authority.
- External executors receive bounded tasks, capabilities and scope.
- An executor may report observation, status, result and structured failure, but it may not silently redefine intent, policy or acceptance criteria.
- Provider-specific agent loops must not become hidden parallel intelligence.
- Cloud-hosted executor services may exist as optional user-funded integrations, never as a required core path.
- External provider credentials never become Vortex authority.

## 2. Vortex Browser Executor Boundary

The Vortex Browser Runtime may use an adapter inspired by or directly compatible with Browser Use, subject to normal dependency review.

The canonical boundary separates:

1. Vortex planning/reasoning;
2. browser execution;
3. DOM/accessibility/runtime evidence;
4. deterministic recipe replay;
5. visual evidence capture;
6. Validation Pipeline truth.

Browser executor capabilities may include:

- controlled local Chrome/Chromium sessions;
- explicit reuse of a user's existing system-browser profile when authorized;
- CDP/DOM/accessibility state;
- navigation, input, clicking, uploads/downloads and tab/session lifecycle;
- registered bounded tools/actions;
- structured step/result history;
- persistent-browser reuse where it improves performance.

Constraints:

- Browser Use's model/provider layer is not Vortex authority.
- Browser Use Cloud is not required.
- Python must not become a mandatory Vortex runtime merely because an upstream implementation uses Python; integration may use a bounded sidecar/subprocess/adapter or an independent native implementation when simpler.
- raw cookies, session tokens, passwords and browser-profile secrets must not be copied into model context;
- using a logged-in browser/profile requires explicit user authorization;
- browser actions remain subject to Tool Runtime, Capability Security Model, Scope Lock and network/filesystem scope;
- read-only Visual Evidence Capture remains separate from interaction authority.

## 3. Reason once, replay deterministically

For stable repeatable browser work, Vortex should prefer:

```text
reason/observe
→ verify
→ compile deterministic recipe
→ replay cheaply
→ detect drift
→ repair only when needed
```

This is the **Reason Once, Replay Many** doctrine.

A deterministic recipe may contain:

- target/source identity and allowed network scope;
- ordered navigation/action/extraction steps;
- stable selectors/semantic references with fallback strategy;
- input/output schema;
- authentication assumptions without embedded secrets;
- retry/timeouts;
- validation assertions;
- provenance/version;
- drift/failure evidence.

Repeated AI reasoning is a fallback for ambiguity or verified drift, not the default execution mode for already-understood stable flows.

## 4. Web Data Recipes

Useful Maxun concepts are adopted as an independently implemented **Web Data Recipe** capability.

A Web Data Recipe can turn authorized website interaction/extraction into structured project data and, when requested, a typed local/project API.

Supported product-level patterns may include:

- structured extraction;
- crawling within explicit scope;
- site search;
- scheduled monitoring;
- change detection;
- authenticated extraction with user-authorized local sessions;
- typed JSON/schema output;
- feeding generated products, tests or project knowledge.

Rules:

- Maxun is **reference-only by default** because the reviewed root license is AGPL-3.0.
- Maxun source is not copied/vendorized into proprietary Vortex Core without separate explicit licensing approval.
- the `legacy/` implementation patterns in an upstream repository are not imported as architecture;
- robots/policy/authorization/rate-limit constraints are respected where applicable;
- CAPTCHA/anti-bot circumvention is not a core product goal;
- monitoring runs as bounded durable work through existing Jobs/Background Concurrency infrastructure;
- stored recipes remain inspectable, versionable and exportable.

## 5. Sovereign Deployment Provider

The Deployment Provider Contract gains a first-class **user-owned/self-hosted** path inspired by Coolify.

A sovereign deployment adapter may support:

- SSH-reachable user-owned servers;
- Dockerfile and Docker Compose targets;
- compatible build detection/buildpack paths such as Nixpacks/Railpack when available;
- Git-triggered deployment;
- preview deployment for branches/PRs;
- health checks;
- logs;
- retained-image rollback;
- domains and automatic TLS;
- persistent volumes;
- backups;
- scheduled jobs;
- secrets/environment configuration.

Rules:

- Coolify is an Apache-2.0 direct integration/reference candidate, not a mandatory Vortex service.
- embedding the whole Coolify application is not required; a thin adapter to a user's Coolify instance or an independent deployment implementation is preferred according to the minimal-solution ladder.
- no Vortex-operated deployment cloud is required for core product completion.
- SSH keys, deployment tokens and infrastructure credentials remain local/secret-scoped.
- production mutation requires explicit authorization and remains governed by deployment/domain capability scopes.
- if Vortex loses access to the deployment controller, already-running user workloads must not become artificially dependent on Vortex to continue running.

## 6. Backend sovereignty and Supabase parity

Build 81 remains the canonical Supabase Provider and gains an explicit local/self-hosted path.

Vortex may generate/test projects against a composable Supabase-style stack including:

- PostgreSQL;
- authentication/authorization;
- REST/GraphQL APIs where selected;
- Realtime;
- Storage;
- database/edge functions;
- local development and self-hosted deployment;
- migration/schema/type generation workflows.

Rules:

- Supabase is an Apache-2.0 provider/reference candidate, not a mandatory backend for generated projects.
- Build 80 Backend Provider Contract remains above provider-specific behavior.
- when ordinary PostgreSQL satisfies the Product Contract, the Generic PostgreSQL Provider may be preferred to avoid unnecessary platform surface.
- provider-specific capabilities must be explicit in the Product Contract/Architecture Ledger so portability trade-offs are visible.
- local/test and selected production/self-hosted configuration should preserve migration/schema parity as far as the provider supports.
- secrets never enter generated client bundles.
- generated projects remain exportable without requiring a hidden Vortex runtime.

## 7. External dependency classification

Reviewed on 2026-09-25:

| Repository | Root license reviewed | Vortex classification |
| --- | --- | --- |
| `browser-use/browser-use` | MIT | Direct integration candidate behind Browser Executor boundary |
| `getmaxun/maxun` | AGPL-3.0 | Reference-only by default; independently implement useful concepts |
| `coollabsio/coolify` | Apache-2.0 | Adapter/direct-integration candidate; no full-platform embedding requirement |
| `supabase/supabase` | Apache-2.0 | Canonical provider/reference candidate for Build 81 |

Classification does not skip security, maintenance, API stability or transitive-license review.

A permissive root license does not automatically authorize copying arbitrary vendored/third-party material from a monorepo.

## 8. Security and consent boundaries

Web/backend/deployment integration must preserve:

- least privilege;
- explicit host/browser/account authorization;
- secret vault boundaries;
- no credential echo into prompts/logs/artifacts;
- default-deny network egress for plugins;
- bounded retries/concurrency;
- auditable external mutations;
- prompt-injection-shaped web content treated as data, never authority;
- authenticated page content does not gain instruction authority over Vortex;
- production backend/deployment writes remain distinguishable from preview/test writes.

## 9. Failure, recovery and drift

The executor layer must expose structured failure instead of pretending success.

Examples:

- selector/DOM drift;
- navigation timeout;
- authentication expiry;
- extraction schema mismatch;
- deployment health-check failure;
- rollback failure;
- backend migration mismatch;
- unavailable local runtime;
- provider API incompatibility.

Recovery rules:

- deterministic replay may retry only within bounded policy;
- browser recipe drift routes to evidence-driven repair;
- deployment rollback is explicit and evidenced;
- failed backend/deployment mutation cannot be reported as complete;
- recovery revalidates capability and scope before destructive replay.

## 10. Release-blocking invariants

A Release Candidate is blocked when applicable work:

- requires a second hidden agent/LLM authority to operate the browser;
- requires Browser Use Cloud or any equivalent paid hosted browser for the core path;
- copies raw browser credentials into model context;
- performs logged-in browser reuse without authorization;
- repeatedly spends model reasoning on a stable workflow that should have been compiled to a deterministic recipe without documented reason;
- presents failed/drifted extraction as valid structured data;
- directly vendors Maxun AGPL code into proprietary Core without explicit approval;
- makes Coolify or Supabase mandatory when the Product Contract does not require them;
- requires Vortex-hosted paid deployment infrastructure for an otherwise self-hostable project;
- stores SSH/backend/deployment secrets in generated client-side code;
- bypasses Deployment Provider Contract or Backend Provider Contract;
- reports deployment success before health/integration evidence;
- reports backend readiness before migrations/schema/integration evidence;
- introduces provider lock-in without recording the trade-off where portability matters.

## Roadmap ownership

No Build is added or renumbered.

- **47, 52–55, 68–70, 75, 90–92, 115, 124–128, 133** — Browser Executor, deterministic replay, Web Data Recipes and drift handling.
- **80–86, 117, 124–128, 133** — backend provider sovereignty, local/self-host parity and portability evidence.
- **93–102, 117–118, 124–128, 133** — sovereign deployment, user-owned infrastructure, preview/rollback/domain/secret evidence.
- **61–63, 65–67, 73, 91** — structured web/backend evidence exposed to agents, Code Intelligence and generated products without changing authority.
- **9, 15–16, 53–55, 88, 92, 116, 127, 133** — security, capability, secret, scope and external-content authority boundaries.

## Final doctrine

**One intelligence decides. Executors act. Stable work becomes deterministic. User-owned infrastructure stays user-owned. Provider convenience never becomes hidden lock-in, and permissive reuse never overrides license/security discipline.**
