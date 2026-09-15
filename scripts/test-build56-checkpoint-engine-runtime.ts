import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';
import { simulateImpact } from '../packages/plan/src/impact-simulation.js';
import { orchestrateBuild } from '../packages/build/src/index.js';
import { analyzeScope } from '../packages/scope/src/index.js';
import { lockScope } from '../packages/scope/src/lock.js';
import { createToolRuntime } from '../packages/tools/src/index.js';
import { assertCanonicalCheckpoint, createCheckpoint } from '../packages/tools/src/checkpoint.js';

const intake = createPromptIntakeRecord({ text: `# Goal
Create a deterministic recovery checkpoint

# Requirements
- Inspect project metadata
- Update one bounded source file [depends: req-0002]

# Constraint
Checkpoint never grants mutation or replay authority

# Acceptance
Completed tool results are bound into an immutable recovery proof` });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const draftPlan = createPlanAuthority({ spec, graph });
const projectRules = bindProjectRules({
  plan: draftPlan,
  workspaceId: 'workspace:checkpoint-alpha',
  rules: [
    { key: 'checkpoint.result-bound', kind: 'require', statement: 'Checkpoint must bind the completed tool result.' },
    { key: 'checkpoint.no-replay', kind: 'forbid', statement: 'Checkpoint must not authorize replay execution.' },
  ],
});
const impactSimulation = simulateImpact({
  plan: draftPlan,
  projectRules,
  impacts: [{
    area: 'Recovery boundary',
    effect: 'positive',
    severity: 'critical',
    summary: 'A completed invocation becomes a deterministic recovery anchor without gaining execution authority.',
    relatedRuleKeys: ['checkpoint.result-bound','checkpoint.no-replay'],
    relatedTaskIds: ['task-0001','task-0002'],
  }],
});
const plan = approvePlan({ plan: draftPlan });
const orchestration = orchestrateBuild({ plan, projectRules, impactSimulation });
const scope = analyzeScope({
  orchestration,
  candidates: [
    { key: 'project.metadata', buildStepId: 'build-step-0001', resource: 'project:metadata', access: 'read', rationale: 'Read project metadata.' },
    { key: 'source.change', buildStepId: 'build-step-0002', resource: 'file:src/app.tsx', access: 'write', rationale: 'Bounded source change.' },
  ],
});
const scopeLock = lockScope({ orchestration, scope, candidateIds: ['scope-candidate-0002'] });
const runtime = createToolRuntime({
  orchestration,
  scopeLock,
  verifyCapability: () => true,
  tools: [
    {
      descriptor: { id: 'tool:project.read', label: 'Read project', requiredCapabilities: ['READ'], mutating: false },
      handler: () => ({ branch: 'build/56-checkpoint-engine', clean: true }),
    },
    {
      descriptor: { id: 'tool:file.write', label: 'Write file', requiredCapabilities: ['WRITE'], mutating: true },
      handler: (_context, input) => ({ wrote: true, bytes: JSON.stringify(input).length }),
    },
  ],
});

const writeInvocation = await runtime.invoke({
  stepId: 'build-step-0002',
  toolId: 'tool:file.write',
  input: { path: 'src/app.tsx', content: 'bounded' },
  scopeCandidateId: 'scope-candidate-0002',
  mutationAccess: 'write',
});
const first = createCheckpoint({ orchestration, invocation: writeInvocation, scopeLock });
const second = createCheckpoint({ orchestration, invocation: writeInvocation, scopeLock });
assert.deepEqual(first, second);
assert.equal(first.schema, 'gd-checkpoint-engine/1');
assert.equal(first.sourceBuildSchema, 'gd-build-orchestrator/1');
assert.equal(first.sourceToolRuntimeSchema, 'gd-tool-runtime/1');
assert.equal(first.sourceScopeLockSchema, 'gd-scope-lock/1');
assert.equal(first.sourceOrchestrationId, orchestration.id);
assert.equal(first.sourceInvocationId, writeInvocation.id);
assert.equal(first.sourceScopeLockId, scopeLock.id);
assert.equal(first.workspaceId, orchestration.workspaceId);
assert.equal(first.stepId, writeInvocation.stepId);
assert.equal(first.toolId, writeInvocation.toolId);
assert.equal(first.scopeCandidateId, 'scope-candidate-0002');
assert.equal(first.mutationAccess, 'write');
assert.equal(first.sourceMutationAuthorized, true);
assert.equal(first.status, 'checkpointed');
assert.equal(first.checkpointKind, 'tool-invocation');
assert.equal(first.recoveryBoundary, 'after-invocation');
for (const field of [
  'immutable','deterministic','environmentNeutral','workspaceScoped','completedInvocationRequired',
  'sourceInvocationReadOnlyPreserved','sourceOrchestrationReadOnlyPreserved','sourceScopeLockReadOnlyPreserved',
  'resultDigestBinding','scopeLockConsumer','scopeLockRequiredForMutation','recoveryAnchor','durableJobEngineSovereign','checkpoints',
] as const) assert.equal(first[field], true);
for (const field of [
  'capabilityGrantAuthority','mutationAuthorized','toolExecution','execution','restoreExecution','validationPipeline',
  'scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
] as const) assert.equal(first[field], false);
assert.equal(Object.isFrozen(first), true);
assert.equal(Object.isFrozen(first.inputDigest), true);
assert.equal(Object.isFrozen(first.resultDigest), true);
assert.equal(Object.isFrozen(first.checkpointDigest), true);

const canonicalValue = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(',')}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue(row[key])}`).join(',')}}`;
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
assert.equal(first.inputDigest.hex, hash(canonicalValue(writeInvocation.input)));
assert.equal(first.resultDigest.hex, hash(canonicalValue(writeInvocation.result)));
const canonicalCheckpointMaterial = JSON.stringify({
  schema: first.schema,
  sourceBuildSchema: first.sourceBuildSchema,
  sourceToolRuntimeSchema: first.sourceToolRuntimeSchema,
  sourceScopeLockSchema: first.sourceScopeLockSchema,
  sourceOrchestrationId: first.sourceOrchestrationId,
  sourceOrchestrationDigest: first.sourceOrchestrationDigest,
  sourceInvocationId: first.sourceInvocationId,
  sourceInvocationDigest: first.sourceInvocationDigest,
  sourceScopeLockId: first.sourceScopeLockId,
  sourceScopeLockDigest: first.sourceScopeLockDigest,
  mode: first.mode,
  checkpointKind: first.checkpointKind,
  recoveryBoundary: first.recoveryBoundary,
  workspaceId: first.workspaceId,
  stepId: first.stepId,
  toolId: first.toolId,
  scopeCandidateId: first.scopeCandidateId,
  mutationAccess: first.mutationAccess,
  sourceMutationAuthorized: first.sourceMutationAuthorized,
  inputDigest: first.inputDigest,
  resultDigest: first.resultDigest,
});
const expectedCheckpointDigest = hash(canonicalCheckpointMaterial);
assert.equal(first.checkpointDigest.hex, expectedCheckpointDigest);
assert.equal(first.id, `checkpoint-${expectedCheckpointDigest.slice(0, 16)}`);
assert.doesNotThrow(() => assertCanonicalCheckpoint(first, orchestration, scopeLock));

const readInvocation = await runtime.invoke({ stepId: 'build-step-0001', toolId: 'tool:project.read', input: null });
const readCheckpoint = createCheckpoint({ orchestration, invocation: readInvocation, scopeLock });
assert.equal(readCheckpoint.sourceMutationAuthorized, false);
assert.equal(readCheckpoint.scopeCandidateId, null);
assert.equal(readCheckpoint.mutationAccess, null);
assert.equal(readCheckpoint.sourceScopeLockId, scopeLock.id);
assert.doesNotThrow(() => assertCanonicalCheckpoint(readCheckpoint, orchestration, scopeLock));

const unscopedRuntime = createToolRuntime({
  orchestration,
  verifyCapability: () => true,
  tools: [{
    descriptor: { id: 'tool:project.read', label: 'Read project', requiredCapabilities: ['READ'], mutating: false },
    handler: () => ({ ok: true }),
  }],
});
const unscopedInvocation = await unscopedRuntime.invoke({ stepId: 'build-step-0001', toolId: 'tool:project.read', input: null });
const unscopedCheckpoint = createCheckpoint({ orchestration, invocation: unscopedInvocation });
assert.equal(unscopedCheckpoint.sourceScopeLockId, null);
assert.equal(unscopedCheckpoint.sourceScopeLockDigest, null);
assert.doesNotThrow(() => assertCanonicalCheckpoint(unscopedCheckpoint, orchestration));

assert.throws(() => createCheckpoint({ orchestration, invocation: writeInvocation }), /requires the canonical Scope Lock/i);
assert.throws(() => createCheckpoint({ orchestration, invocation: unscopedInvocation, scopeLock }), /not referenced/i);
assert.throws(() => createCheckpoint({
  orchestration,
  invocation: { ...writeInvocation, result: { wrote: false, bytes: 0 } },
  scopeLock,
} as never), /invocation digest|canonical/i);
assert.throws(() => assertCanonicalCheckpoint({
  ...first,
  sourceInvocation: { ...writeInvocation, result: { wrote: false, bytes: 0 } },
} as never, orchestration, scopeLock), /input\/result digest binding/i);
assert.throws(() => assertCanonicalCheckpoint({
  ...first,
  resultDigest: { ...first.resultDigest, hex: '0'.repeat(64) },
} as never, orchestration, scopeLock), /input\/result digest binding/i);
assert.throws(() => assertCanonicalCheckpoint({
  ...first,
  checkpointDigest: { ...first.checkpointDigest, hex: 'f'.repeat(64) },
} as never, orchestration, scopeLock), /checkpoint digest/i);
assert.throws(() => createCheckpoint({
  orchestration,
  invocation: { ...writeInvocation, invocationDigest: { ...writeInvocation.invocationDigest, hex: '0'.repeat(64) } },
  scopeLock,
} as never), /invocation digest/i);
assert.throws(() => createCheckpoint({
  orchestration,
  invocation: { ...writeInvocation, sourceScopeLockDigest: 'f'.repeat(64) },
  scopeLock,
} as never), /Scope Lock binding/i);
assert.throws(() => assertCanonicalCheckpoint({ ...first, restoreExecution: true } as never, orchestration, scopeLock), /boundary is non-canonical/i);
assert.throws(() => assertCanonicalCheckpoint({ ...first, mutationAuthorized: true } as never, orchestration, scopeLock), /boundary is non-canonical/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build56-checkpoint-engine-runtime/1',
  build: 56,
  deterministicCheckpointIdentity: true,
  completedInvocationRequired: true,
  resultDigestBinding: true,
  durableJobEngineSovereign: true,
  restoreExecution: false,
  validationPipeline: false,
}, null, 2));