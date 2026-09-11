import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';
import { simulateImpact } from '../packages/plan/src/impact-simulation.js';
import { orchestrateBuild } from '../packages/build/src/index.js';
import { analyzeScope } from '../packages/scope/src/index.js';

const intake = createPromptIntakeRecord({ text: `# Goal
Analyze explicit BUILD scope candidates

# Requirements
- Inspect project metadata
- Prepare a bounded change candidate [depends: req-0002]

# Constraint
Scope Intelligence must not lock or authorize mutation

# Acceptance
Coverage and mutation intent are derived only from explicit scope candidates` });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const draftPlan = createPlanAuthority({ spec, graph });
const projectRules = bindProjectRules({
  plan: draftPlan,
  workspaceId: 'workspace:scope-intelligence-alpha',
  rules: [
    { key: 'scope.explicit-only', kind: 'require', statement: 'Use only explicit caller-declared scope candidates.' },
    { key: 'scope.no-lock', kind: 'forbid', statement: 'Do not lock scope before Build 55.' },
  ],
});
const impactSimulation = simulateImpact({
  plan: draftPlan,
  projectRules,
  impacts: [{
    area: 'Scope boundary',
    effect: 'positive',
    severity: 'high',
    summary: 'Adds deterministic scope analysis without granting mutation authority.',
    relatedRuleKeys: ['scope.explicit-only', 'scope.no-lock'],
    relatedTaskIds: ['task-0001', 'task-0002'],
  }],
});
const plan = approvePlan({ plan: draftPlan });
const orchestration = orchestrateBuild({ plan, projectRules, impactSimulation });

const candidates = [
  {
    key: 'project.metadata',
    buildStepId: 'build-step-0001',
    resource: 'project:metadata',
    access: 'read' as const,
    rationale: 'Inspect declared project metadata for the first Build step.',
  },
  {
    key: 'source.change',
    buildStepId: 'build-step-0002',
    resource: 'file:src/app.tsx',
    access: 'write' as const,
    rationale: 'Declare the source resource that may later require mutation under Scope Lock.',
  },
  {
    key: 'verification.command',
    buildStepId: 'build-step-0002',
    resource: 'command:typecheck',
    access: 'execute' as const,
    rationale: 'Declare a future verification command without authorizing execution.',
  },
];

const first = analyzeScope({ orchestration, candidates });
const second = analyzeScope({ orchestration, candidates });
assert.deepEqual(first, second);
assert.equal(first.schema, 'gd-scope-intelligence/1');
assert.equal(first.sourceBuildSchema, 'gd-build-orchestrator/1');
assert.equal(first.sourceOrchestrationId, orchestration.id);
assert.deepEqual(first.sourceOrchestrationDigest, orchestration.orchestrationDigest);
assert.equal(first.mode, 'BUILD');
assert.equal(first.status, 'analyzed');
assert.equal(first.workspaceId, orchestration.workspaceId);
assert.deepEqual(first.candidates.map((candidate) => candidate.id), ['scope-candidate-0001','scope-candidate-0002','scope-candidate-0003']);
assert.deepEqual(first.candidates.map((candidate) => candidate.key), ['project.metadata','source.change','verification.command']);
assert.deepEqual(first.coveredBuildStepIds, ['build-step-0001','build-step-0002']);
assert.deepEqual(first.uncoveredBuildStepIds, []);
assert.deepEqual(first.writeCandidateIds, ['scope-candidate-0002']);
assert.deepEqual(first.executeCandidateIds, ['scope-candidate-0003']);
for (const field of ['immutable','sourceOrchestrationReadOnlyPreserved','workspaceScoped','advisoryOnly','explicitCandidatesOnly','scopeIntelligence','scopeLockRequired'] as const) {
  assert.equal(first[field], true);
}
for (const field of [
  'semanticInference','automaticDiscovery','scopeLock','scopeLocked','mutationAuthorized','capabilityGrantAuthority','toolExecution',
  'checkpoints','validationPipeline','execution','scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority',
  'databaseAuthority','studioTransport','localRuntimeTransport',
] as const) assert.equal(first[field], false);
assert.equal(Object.isFrozen(first), true);
assert.equal(Object.isFrozen(first.candidates), true);
assert.equal(Object.isFrozen(first.candidates[0]!), true);
assert.equal(Object.isFrozen(first.coveredBuildStepIds), true);
assert.equal(Object.isFrozen(first.scopeDigest), true);

const canonicalMaterial = JSON.stringify({
  schema: first.schema,
  sourceBuildSchema: first.sourceBuildSchema,
  sourceOrchestrationId: first.sourceOrchestrationId,
  sourceOrchestrationDigest: first.sourceOrchestrationDigest,
  mode: first.mode,
  workspaceId: first.workspaceId,
  candidates: first.candidates.map((candidate) => ({
    id: candidate.id,
    ordinal: candidate.ordinal,
    key: candidate.key,
    buildStepId: candidate.buildStepId,
    resource: candidate.resource,
    access: candidate.access,
    rationale: candidate.rationale,
  })),
  coveredBuildStepIds: [...first.coveredBuildStepIds],
  uncoveredBuildStepIds: [...first.uncoveredBuildStepIds],
  writeCandidateIds: [...first.writeCandidateIds],
  executeCandidateIds: [...first.executeCandidateIds],
});
const expectedDigest = createHash('sha256').update(canonicalMaterial).digest('hex');
assert.equal(first.scopeDigest.algorithm, 'sha256');
assert.equal(first.scopeDigest.hex, expectedDigest);
assert.equal(first.id, `scope-intelligence-${expectedDigest.slice(0, 16)}`);

const partial = analyzeScope({ orchestration, candidates: [candidates[0]!] });
assert.deepEqual(partial.coveredBuildStepIds, ['build-step-0001']);
assert.deepEqual(partial.uncoveredBuildStepIds, ['build-step-0002']);
const empty = analyzeScope({ orchestration, candidates: [] });
assert.deepEqual(empty.coveredBuildStepIds, []);
assert.deepEqual(empty.uncoveredBuildStepIds, orchestration.buildOrder);
assert.notEqual(analyzeScope({ orchestration, candidates: [{ ...candidates[0]!, resource: 'project:other' }] }).scopeDigest.hex, partial.scopeDigest.hex);

assert.throws(() => analyzeScope({
  orchestration: { ...orchestration, orchestrationDigest: { ...orchestration.orchestrationDigest, hex: '0'.repeat(64) } },
  candidates,
} as never), /digest does not match canonical material/i);
assert.throws(() => analyzeScope({ orchestration, candidates: [
  candidates[0]!,
  { ...candidates[1]!, key: 'PROJECT.METADATA' },
] }), /duplicate Scope candidate key/i);
assert.throws(() => analyzeScope({ orchestration, candidates: [{ ...candidates[0]!, buildStepId: 'build-step-9999' }] }), /unknown build step/i);
assert.throws(() => analyzeScope({ orchestration, candidates: [{ ...candidates[0]!, access: 'delete' as never }] }), /access must be one of/i);
assert.throws(() => analyzeScope({ orchestration, candidates: [{ ...candidates[0]!, extra: true } as never] }), /accepts only key/i);
assert.throws(() => analyzeScope({ orchestration, candidates: Array.from({ length: 4097 }, (_, index) => ({
  ...candidates[0]!,
  key: `candidate.${index}`,
})) }), /at most 4096 candidates/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build54-scope-intelligence-runtime/1',
  build: 54,
  canonicalBuildBinding: true,
  deterministicIdentity: true,
  explicitCandidatesOnly: true,
  structuralCoverage: true,
  advisoryOnly: true,
  scopeLock: false,
  mutationAuthorized: false,
}, null, 2));
