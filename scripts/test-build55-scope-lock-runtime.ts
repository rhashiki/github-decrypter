import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';
import { simulateImpact } from '../packages/plan/src/impact-simulation.js';
import { orchestrateBuild } from '../packages/build/src/index.js';
import { analyzeScope } from '../packages/scope/src/index.js';
import {
  assertCanonicalScopeLock,
  assertScopeLockAllowsMutation,
  lockScope,
} from '../packages/scope/src/lock.js';
import {
  createToolRuntime,
  ToolRuntimeCapabilityError,
  ToolRuntimeMutationBlockedError,
} from '../packages/tools/src/index.js';

const intake = createPromptIntakeRecord({ text: `# Goal
Lock an explicit BUILD mutation scope

# Requirements
- Inspect project metadata
- Update the bounded source file [depends: req-0002]

# Constraint
Scope Lock never grants capabilities

# Acceptance
A mutating tool runs only when exact Scope Lock and capabilities both pass` });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const draftPlan = createPlanAuthority({ spec, graph });
const projectRules = bindProjectRules({
  plan: draftPlan,
  workspaceId: 'workspace:scope-lock-alpha',
  rules: [
    { key: 'scope.explicit-lock', kind: 'require', statement: 'Lock only caller-selected analyzed candidates.' },
    { key: 'scope.capabilities-remain', kind: 'require', statement: 'Scope Lock must not grant capabilities.' },
  ],
});
const impactSimulation = simulateImpact({
  plan: draftPlan,
  projectRules,
  impacts: [{
    area: 'Mutation boundary',
    effect: 'positive',
    severity: 'critical',
    summary: 'Requires exact Scope Lock proof in addition to Tool Runtime capability verification.',
    relatedRuleKeys: ['scope.explicit-lock','scope.capabilities-remain'],
    relatedTaskIds: ['task-0001','task-0002'],
  }],
});
const plan = approvePlan({ plan: draftPlan });
const orchestration = orchestrateBuild({ plan, projectRules, impactSimulation });
const scope = analyzeScope({
  orchestration,
  candidates: [
    {
      key: 'project.metadata',
      buildStepId: 'build-step-0001',
      resource: 'project:metadata',
      access: 'read',
      rationale: 'Read project metadata before mutation.',
    },
    {
      key: 'source.change',
      buildStepId: 'build-step-0002',
      resource: 'file:src/app.tsx',
      access: 'write',
      rationale: 'Bounded source mutation candidate.',
    },
    {
      key: 'verification.command',
      buildStepId: 'build-step-0002',
      resource: 'command:typecheck',
      access: 'execute',
      rationale: 'Bounded verification execution candidate.',
    },
  ],
});

const first = lockScope({
  orchestration,
  scope,
  candidateIds: ['scope-candidate-0003','scope-candidate-0002'],
});
const second = lockScope({
  orchestration,
  scope,
  candidateIds: ['scope-candidate-0002','scope-candidate-0003'],
});
assert.deepEqual(first, second);
assert.equal(first.schema, 'gd-scope-lock/1');
assert.equal(first.sourceScopeSchema, 'gd-scope-intelligence/1');
assert.equal(first.sourceBuildSchema, 'gd-build-orchestrator/1');
assert.equal(first.sourceScopeId, scope.id);
assert.deepEqual(first.sourceScopeDigest, scope.scopeDigest);
assert.equal(first.sourceOrchestrationId, orchestration.id);
assert.deepEqual(first.sourceOrchestrationDigest, orchestration.orchestrationDigest);
assert.equal(first.workspaceId, orchestration.workspaceId);
assert.equal(first.mode, 'BUILD');
assert.equal(first.status, 'locked');
assert.deepEqual(first.lockedCandidateIds, ['scope-candidate-0002','scope-candidate-0003']);
assert.deepEqual(first.lockedBuildStepIds, ['build-step-0002']);
assert.deepEqual(first.lockedWriteCandidateIds, ['scope-candidate-0002']);
assert.deepEqual(first.lockedExecuteCandidateIds, ['scope-candidate-0003']);
for (const field of [
  'immutable','sourceScopeReadOnlyPreserved','sourceOrchestrationReadOnlyPreserved','workspaceScoped','explicitLock',
  'exactCandidateAllowlist','scopeIntelligence','scopeLockRequired','scopeLock','scopeLocked','mutationBoundarySatisfied',
  'capabilitiesRequired','capabilityVerifierRequired','toolRuntimeScopedMutationIntegration',
] as const) assert.equal(first[field], true);
for (const field of [
  'automaticExpansion','semanticInference','capabilityGrantAuthority','mutationAuthorized','toolExecution','checkpoints',
  'validationPipeline','execution','scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority',
  'databaseAuthority','studioTransport','localRuntimeTransport',
] as const) assert.equal(first[field], false);
assert.equal(Object.isFrozen(first), true);
assert.equal(Object.isFrozen(first.lockedCandidateIds), true);
assert.equal(Object.isFrozen(first.lockDigest), true);

const canonicalLockMaterial = JSON.stringify({
  schema: first.schema,
  sourceScopeSchema: first.sourceScopeSchema,
  sourceBuildSchema: first.sourceBuildSchema,
  sourceScopeId: first.sourceScopeId,
  sourceScopeDigest: first.sourceScopeDigest,
  sourceOrchestrationId: first.sourceOrchestrationId,
  sourceOrchestrationDigest: first.sourceOrchestrationDigest,
  mode: first.mode,
  workspaceId: first.workspaceId,
  lockedCandidateIds: [...first.lockedCandidateIds],
  lockedBuildStepIds: [...first.lockedBuildStepIds],
  lockedWriteCandidateIds: [...first.lockedWriteCandidateIds],
  lockedExecuteCandidateIds: [...first.lockedExecuteCandidateIds],
});
const expectedLockDigest = createHash('sha256').update(canonicalLockMaterial).digest('hex');
assert.equal(first.lockDigest.algorithm, 'sha256');
assert.equal(first.lockDigest.hex, expectedLockDigest);
assert.equal(first.id, `scope-lock-${expectedLockDigest.slice(0, 16)}`);
assert.doesNotThrow(() => assertCanonicalScopeLock(first, orchestration));
assert.equal(assertScopeLockAllowsMutation(first, orchestration, 'scope-candidate-0002', 'build-step-0002', 'write').key, 'source.change');
assert.equal(assertScopeLockAllowsMutation(first, orchestration, 'scope-candidate-0003', 'build-step-0002', 'execute').key, 'verification.command');
assert.throws(() => assertScopeLockAllowsMutation(first, orchestration, 'scope-candidate-0001', 'build-step-0001', 'write'), /does not allow/i);
assert.throws(() => assertScopeLockAllowsMutation(first, orchestration, 'scope-candidate-0002', 'build-step-0001', 'write'), /does not belong/i);
assert.throws(() => assertScopeLockAllowsMutation(first, orchestration, 'scope-candidate-0002', 'build-step-0002', 'execute'), /access does not match/i);
assert.throws(() => lockScope({ orchestration, scope, candidateIds: ['scope-candidate-9999'] }), /not present/i);
assert.throws(() => lockScope({ orchestration, scope, candidateIds: ['scope-candidate-0002','scope-candidate-0002'] }), /duplicated/i);
assert.throws(() => lockScope({
  orchestration,
  scope: { ...scope, scopeDigest: { ...scope.scopeDigest, hex: '0'.repeat(64) } },
  candidateIds: ['scope-candidate-0002'],
} as never), /digest does not match canonical material/i);
assert.throws(() => assertCanonicalScopeLock({ ...first, lockDigest: { ...first.lockDigest, hex: '0'.repeat(64) } }, orchestration), /digest does not match/i);

let noLockMutationCalls = 0;
const noLockRuntime = createToolRuntime({
  orchestration,
  verifyCapability: () => true,
  tools: [{
    descriptor: { id: 'tool:file.write', label: 'Write file', requiredCapabilities: ['WRITE'], mutating: true },
    handler: () => { noLockMutationCalls += 1; return { unreachable: true }; },
  }],
});
await assert.rejects(
  noLockRuntime.invoke({ stepId: 'build-step-0002', toolId: 'tool:file.write', input: { content: 'blocked' } }),
  (error: unknown) => error instanceof ToolRuntimeMutationBlockedError,
);
assert.equal(noLockMutationCalls, 0);

const capabilityRequests: string[] = [];
let mutationCalls = 0;
const scopedRuntime = createToolRuntime({
  orchestration,
  scopeLock: first,
  verifyCapability: (request) => {
    capabilityRequests.push(`${request.toolId}:${request.capability}:${request.stepId}`);
    return true;
  },
  tools: [
    {
      descriptor: { id: 'tool:file.write', label: 'Write file', requiredCapabilities: ['WRITE'], mutating: true },
      handler: (context, input) => {
        mutationCalls += 1;
        assert.equal(context.scopeLock, true);
        assert.equal(context.mutationAuthorized, true);
        assert.equal(context.sourceScopeLockId, first.id);
        assert.equal(context.sourceScopeLockDigest, first.lockDigest.hex);
        assert.equal(context.scopeCandidateId, 'scope-candidate-0002');
        assert.equal(context.mutationAccess, 'write');
        assert.deepEqual(context.verifiedCapabilities, ['WRITE']);
        return { wrote: true, input };
      },
    },
    {
      descriptor: { id: 'tool:verify.execute', label: 'Run typecheck', requiredCapabilities: ['EXECUTE'], mutating: true },
      handler: (context) => ({ executed: context.mutationAuthorized }),
    },
    {
      descriptor: { id: 'tool:project.read', label: 'Read project', requiredCapabilities: ['READ'], mutating: false },
      handler: (context) => ({ read: true, mutationAuthorized: context.mutationAuthorized }),
    },
  ],
});
assert.equal(scopedRuntime.scopeLock, true);
assert.equal(scopedRuntime.sourceScopeLockId, first.id);
assert.equal(scopedRuntime.sourceScopeLockDigest, first.lockDigest.hex);
assert.equal(scopedRuntime.mutationAuthorized, false);

const writeResult = await scopedRuntime.invoke({
  stepId: 'build-step-0002',
  toolId: 'tool:file.write',
  input: { content: 'bounded' },
  scopeCandidateId: 'scope-candidate-0002',
  mutationAccess: 'write',
});
assert.equal(mutationCalls, 1);
assert.equal(writeResult.scopeLock, true);
assert.equal(writeResult.mutationAuthorized, true);
assert.equal(writeResult.scopeCandidateId, 'scope-candidate-0002');
assert.equal(writeResult.mutationAccess, 'write');
assert.equal(writeResult.sourceScopeLockId, first.id);
assert.equal(writeResult.sourceScopeLockDigest, first.lockDigest.hex);
assert.deepEqual(capabilityRequests, ['tool:file.write:WRITE:build-step-0002']);

const executeResult = await scopedRuntime.invoke({
  stepId: 'build-step-0002',
  toolId: 'tool:verify.execute',
  input: null,
  scopeCandidateId: 'scope-candidate-0003',
  mutationAccess: 'execute',
});
assert.equal(executeResult.mutationAuthorized, true);
assert.equal((executeResult.result as { executed: boolean }).executed, true);

const readResult = await scopedRuntime.invoke({ stepId: 'build-step-0001', toolId: 'tool:project.read', input: null });
assert.equal(readResult.mutationAuthorized, false);
assert.equal(readResult.scopeCandidateId, null);
assert.equal(readResult.mutationAccess, null);
assert.equal((readResult.result as { mutationAuthorized: boolean }).mutationAuthorized, false);

await assert.rejects(scopedRuntime.invoke({
  stepId: 'build-step-0002', toolId: 'tool:file.write', input: null,
  scopeCandidateId: 'scope-candidate-0003', mutationAccess: 'write',
}), /access does not match/i);
await assert.rejects(scopedRuntime.invoke({
  stepId: 'build-step-0001', toolId: 'tool:file.write', input: null,
  scopeCandidateId: 'scope-candidate-0002', mutationAccess: 'write',
}), /does not belong/i);

let deniedCalls = 0;
const deniedRuntime = createToolRuntime({
  orchestration,
  scopeLock: first,
  verifyCapability: () => false,
  tools: [{
    descriptor: { id: 'tool:file.write', label: 'Write file', requiredCapabilities: ['WRITE'], mutating: true },
    handler: () => { deniedCalls += 1; return null; },
  }],
});
await assert.rejects(deniedRuntime.invoke({
  stepId: 'build-step-0002', toolId: 'tool:file.write', input: null,
  scopeCandidateId: 'scope-candidate-0002', mutationAccess: 'write',
}), (error: unknown) => error instanceof ToolRuntimeCapabilityError && error.capability === 'WRITE');
assert.equal(deniedCalls, 0);

assert.throws(() => createToolRuntime({
  orchestration,
  scopeLock: { ...first, lockDigest: { ...first.lockDigest, hex: 'f'.repeat(64) } },
  verifyCapability: () => true,
  tools: [{ descriptor: { id: 'tool:test', label: 'Test', requiredCapabilities: ['READ'], mutating: false }, handler: () => null }],
} as never), /digest does not match/i);
assert.throws(() => createToolRuntime({
  orchestration,
  verifyCapability: () => true,
  tools: [{ descriptor: { id: 'tool:bad-mutation', label: 'Bad mutation', requiredCapabilities: ['READ'], mutating: true }, handler: () => null }],
}), /mutating capability/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build55-scope-lock-runtime/1',
  build: 55,
  deterministicLockIdentity: true,
  exactCandidateAllowlist: true,
  scopeLockDoesNotGrantCapabilities: true,
  mutatingToolsBlockedWithoutLock: true,
  scopedMutationRequiresLockAndCapabilities: true,
  checkpointEngine: false,
  validationPipeline: false,
}, null, 2));
