# GitHub Decrypter — Product Constitution V1.0

Status: FROZEN for V1.0

## Mission

GitHub Decrypter is a local-first, Git-native AI development environment that combines a lightweight GitHub browser extension, an installable React PWA Studio, and an independent local runtime. It must let a user describe, plan, build, inspect, test, version, deploy, and maintain software without making a single commercial AI, backend, deployment, domain, or infrastructure provider mandatory.

## Constitutional Principles

1. Git is the source of truth for project code and version history.
2. The local filesystem is the active development workspace.
3. GitHub is the primary remote collaboration provider for V1, but remote-provider boundaries must remain explicit.
4. The Chrome extension is a lightweight launcher/bridge, never the heavy execution environment.
5. The Studio is React + TypeScript and ships as an installable PWA.
6. The local runtime owns privileged execution, jobs, tools, processes, secrets, local AI, Git, preview servers, persistence, and recovery.
7. Frontend state never grants backend capability.
8. PLAN is enforced read-only by the runtime, not merely represented as a UI state.
9. BUILD operates only through explicit capabilities and Scope Lock.
10. Every AI-originated change is attributable to a durable transaction.
11. Human, AI, and external modifications must remain distinguishable where required for safe undo/redo.
12. Long requests are compiled into structured requirements and a persistent executable task graph before execution.
13. Model context windows are real technical limits; the product hides their operational burden through persistent state, hierarchical context, resumable jobs, task decomposition, and context packs. GitHub Decrypter must never falsely claim physically infinite context.
14. Local AI is first-class. Paid external AI APIs are optional providers, not requirements.
15. Internet connectivity is not required for already-installed local capabilities that do not inherently require a remote service.
16. Remote-dependent operations such as fetch, push, PR creation, cloud deploy, remote backend access, and DNS changes may pause or queue while offline.
17. Jobs belong to the local runtime, not to a browser tab or chat view.
18. Closing Chrome, closing the Studio, or navigating to another conversation must not cancel eligible background jobs.
19. Durable jobs use persistent checkpoints and recover from process crash or machine restart from the last known consistent state.
20. Operations must be idempotent or explicitly guarded where replay could be destructive.
21. Supabase is a first-class backend provider, never a hard dependency.
22. Backend architecture is provider-agnostic through explicit provider contracts.
23. Deployment architecture is provider-agnostic through explicit provider contracts.
24. Domain management and purchasing are provider integrations; GitHub Decrypter does not become a registrar in V1.
25. MCP and plugins operate behind permission, trust, scope, and approval boundaries.
26. Secrets never belong in ordinary React state or logs.
27. Sensitive and destructive operations fail closed.
28. No provider receives more access than required for the requested operation.
29. The product must provide an exit path: project code, Git history, backend, domains, deployments, and ordinary project assets remain usable without GitHub Decrypter.
30. Internal Decrypter state that is portable must be exportable by the V1 portability features.
31. No automatic release, OTA, store publication, production deploy, production database mutation, or DNS mutation is authorized merely by completing a Build.
32. Production-affecting actions require the policy and approvals defined by the relevant later Build.
33. Architecture is event-driven across process boundaries and uses versioned shared protocols.
34. Provider and plugin interfaces are replaceable by design.
35. Agent specialization is orchestrated; no agent bypasses tools, capabilities, scope, or approval policy.
36. The Architecture Guardian must prevent architectural drift from silently becoming precedent.
37. Existing Lovable Decrypter code is inherited only as a technical starting point; GitHub Decrypter evolves independently.
38. No automatic synchronization between Lovable Decrypter and GitHub Decrypter is permitted.
39. V1 scope is frozen by `docs/product/V1_SCOPE.md`.
40. New product ideas discovered after this freeze are RFCs for a future planning window unless they are required to correct a defect, security flaw, acceptance failure, or contradiction in already-frozen V1 scope.

## Product Shape

GitHub -> Chrome Extension -> GitHub Decrypter Studio PWA -> Local Runtime -> Local filesystem / Git / AI / tools / providers.

To the user these components should feel like one product, while remaining technically separated so UI lifecycle does not own execution lifecycle.

## Independence

Lovable Decrypter continues as `rhashiki/lovable-decrypter-extension`.

GitHub Decrypter continues as `rhashiki/github-decrypter`.

They are separate products, roadmaps, Builds, releases, and authorities.