# Local Agent Runtime Portability & Compute Governance

Status: **Architecture doctrine — Amendment 008**

This document translates Amendment 008 into the intended Vortex runtime shape.

## Target topology

```text
Viktor / User
     |
Project Genesis / Product Contract
     |
Ramon / canonical agents
     |
Context + Specialist selection
     |
Model Routing
     |
Local AI Runtime
     +-- Ollama-compatible
     +-- OpenAI-compatible local
     +-- vLLM-compatible
     +-- LM Studio-compatible
     +-- LocalAI-compatible
     +-- LiteLLM/local gateway
     +-- future trusted local adapter
```

Provider/model identity remains below Vortex agent/product identity.

## Adapter contract

A local adapter should expose normalized functions equivalent to:

- health/discovery;
- list supported/installed models;
- normalized model capability facts;
- generate/stream;
- cancellation;
- optional install/update/remove through owning authorities;
- diagnostic status.

Adapters do not own:

- Product Contract;
- agent selection;
- capabilities;
- Scope Lock;
- approvals;
- Tool Runtime;
- validation;
- release.

## Capability metadata

The runtime should reason from capability facts rather than brand names.

Examples:

- context window;
- max output;
- tools;
- structured output;
- reasoning/thinking;
- text/image/audio/video/document modality;
- local GPU/CPU/runtime compatibility;
- quantization;
- health/readiness.

An unknown local model may use conservative defaults.

## Per-execution context safety

Each parent/worker execution resolves:

```text
resolved model
  -> context window + output budget
  -> request headroom
  -> hard limit
  -> automatic compaction threshold
  -> retained recent-context budget
```

The shared formula must not diverge between parent and worker implementations.

Before fallback:

```text
current bounded context
      |
candidate model window
      |
fits? -- no --> skip + record reason
      |
     yes
      |
attempt fallback
```

## Worker Sessions

Workers are durable execution contexts, not new agents.

Suggested lifecycle:

```text
planned
 -> queued
 -> running
 -> waiting
 -> degraded
 -> succeeded / failed / cancelled
```

A worker retains parent/project linkage, task envelope, evidence requirements, context/model budget and checkpoint identity.

Fan-out is bounded. Results return through a structured fan-in contract.

## Compute / Tool admission

Authorization and capacity are separate:

```text
Tool request
 -> capability/scope/approval
 -> compute/tool admission budget
 -> queue or execute
 -> checkpoint/audit
 -> result
```

Potential budget dimensions:

- global;
- per workspace/project;
- per worker/session;
- per tool class;
- mutation serialization;
- model/GPU slots;
- CPU-heavy slots;
- browser slots;
- plugin/service slots.

A budget never creates permission.

## Host-owned consent

For a dangerous operation, the trusted runtime owns the copy shown to the user.

The untrusted caller supplies canonical operation id + arguments only.

The host resolves:

- operation title;
- risk class;
- trusted explanation;
- argument preview;
- allowed consent choices.

Prompt/document/plugin content cannot relabel a destructive action.

## Plugin sandbox direction

A future plugin contract should combine:

```text
declared permission
 + declared scope
 + user grant
 + runtime gate
 + audit
```

Network egress should be host-brokered and allowlisted.

Filesystem access should resolve real paths before scope checks and fail closed on escape/host-protected paths.

New permissions on upgrade require renewed consent.

Resident plugin services receive lifecycle supervision, backoff and shutdown cleanup.

## Recovery

Recoverable long work stores enough durable state to resume without redoing committed mutation.

Recovery re-checks:

- current workspace;
- current authority/capability;
- current Scope Lock;
- current dependency state;
- last committed checkpoint;
- pending tool/model work.

## Upstream reference

PI-Desktop is a useful architectural reference for:

- provider/model portability;
- persistent sessions;
- subagents and worker sessions;
- model-window context budgeting;
- tool admission budgets;
- plugin permission matrices;
- host-owned consent;
- supervised services;
- restart recovery.

Its LGPL-3.0 code is not a Vortex Core dependency by this doctrine.

The lower-level Pi ecosystem must be evaluated separately before any package is adopted.
