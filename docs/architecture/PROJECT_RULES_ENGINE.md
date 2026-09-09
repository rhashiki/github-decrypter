# Project Rules Engine — Build 50

## Purpose

Build 50 establishes the canonical project rules / constitution for each GitHub Decrypter workspace.

The frozen V1 scope requires **project rules/constitution per workspace** inside the Plan and Decision Flow. These rules are durable project context, not a second capability system and not an execution engine.

## Ownership

Core authority lives in `@github-decrypter/plan` at `packages/plan/src/project-rules.ts`.

Local persistence is owned by the Local Runtime at `apps/local/src/project-rules-store.ts` and reuses the existing durable `gd_metadata` table under the workspace-scoped `project-rules:<workspaceId>` namespace. Build 50 does not introduce a new database migration.

## Canonical rule model

A Project Rule declares:

- category: `architecture`, `dependency`, `code`, `database`, `testing`, `deployment`, `security`, or `workflow`;
- directive: `require`, `forbid`, or `prefer`;
- normalized statement;
- one or more explicit stages: `plan`, `decision`, `build`.

`require` and `forbid` rules are mandatory constraints. `prefer` rules are advisory.

The canonical ruleset is workspace-bound, deterministic, SHA-256 identified, deeply immutable, and limited to 256 rules.

## No fake semantic enforcement

Build 50 does not pretend to infer whether arbitrary source code, a Plan, or a proposed mutation satisfies a natural-language rule. It provides structured, durable rules and deterministic stage selection.

`selectProjectRulesForStage()` returns the exact mandatory/advisory rules applicable to a declared stage. Semantic assessment and impact reasoning are deferred to later authorities.

This preserves an honest boundary:

- Project Rules define the constitution.
- **Build 51 — Impact Simulation** evaluates proposed effects when applicable.
- later Build execution remains subject to capabilities, Scope Lock and validation.

## PLAN boundary

Project Rules do not weaken the runtime-enforced read-only PLAN boundary introduced in Build 48.

Build 50 does not authorize:

- transition from PLAN to BUILD;
- Build orchestration;
- tool execution;
- filesystem/Git/database mutation;
- job creation or scheduling;
- capability grants;
- Scope Intelligence or Scope Lock;
- checkpoints or validation execution.

## Workspace persistence

The Local Project Rules Store:

- verifies that the target `gd-workspace/1` workspace exists;
- stores one current ruleset per workspace in durable local metadata;
- increments a storage revision on each save;
- preserves original creation time and updates modification time;
- validates the canonical rules digest on read;
- creates no Durable Jobs;
- exposes no HTTP/RPC/Studio transport in Build 50.

## Downstream ownership

- Build 51 — Impact Simulation
- Build 52 — Build Orchestrator
- Build 53 — Tool Runtime
- Build 54 — Scope Intelligence
- Build 55 — Scope Lock
- Build 56 — Checkpoint Engine
- Build 57 — Validation Pipeline

None of those authorities are activated by Build 50.
