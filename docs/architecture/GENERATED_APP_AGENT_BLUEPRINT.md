# Generated-App Embedded Agent Blueprint

Status: **Future owning Builds 39 / 60 / 68–70 / 90–92 / 117**

A Vortex user may request an AI agent/copilot inside the product Vortex is generating.

## Genesis decisions

Resolve purpose, allowed workflows/actions, page reach, read-vs-mutate capability, voice need, visible data, memory/persistence, model/compute source, auth/authorization, consent/audit and offline/degraded behavior.

## Modes

### In-page agent
For bounded current-page/app workflows. Prefer structured DOM/app state over screenshot-only control. Alibaba PageAgent (MIT) is a candidate after review.

### Multi-page/browser-assisted agent
For legitimate cross-page workflows. Requires browser/extension permissions and explicit scope.

### App-native tool agent
Preferred when the generated app exposes typed operations. Typed app actions beat click imitation where safe APIs exist.

## Security

- no provider/model secret in browser JavaScript;
- app auth/session permissions remain app-owned;
- consequential mutations require suitable confirmation;
- page content is untrusted;
- prompt-injection-shaped content cannot redefine tools;
- cross-origin/network reach is explicit;
- agent tools are least privilege;
- generated-project agents are not Vortex canonical agents and inherit no Vortex host capability.

## Preview / QA

Exercise success, unsupported request, permission denial, ambiguity, page-content prompt injection, offline/model unavailable behavior, consequential-action approval and cross-page behavior when enabled.
