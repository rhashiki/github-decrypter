import assert from 'node:assert/strict';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';
import { simulateImpact } from '../packages/plan/src/impact-simulation.js';
import { orchestrateBuild } from '../packages/build/src/index.js';
import { executeCodingAgent } from '../packages/ai/src/coding-agent.js';
import { executeDatabaseAgent } from '../packages/ai/src/database-agent.js';
import { executeTestingAgent, type TestingAgentExecutionInput } from '../packages/ai/src/testing-agent.js';
import {
  assertCanonicalReviewAgentReport,
  createReviewAgentReport,
  type ReviewAgentInput,
} from '../packages/ai/src/review-agent.js';

const intake = createPromptIntakeRecord({
  text: '# Goal\nCreate canonical sources for advisory review\n\n# Requirements\n- Read a bounded implementation result\n\n# Constraint\nReview must not mutate source authority\n\n# Acceptance\nCanonical sources remain read only',
});
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const draftPlan = createPlanAuthority({ spec, graph });
const projectRules = bindProjectRules({
  plan: draftPlan,
  workspaceId: 'workspace:review-agent-alpha',
  rules: [
    { key: 'review.read-only', kind: 'require', statement: 'Review Agent consumes canonical sources read only.' },
  ],
});
const impactSimulation = simulateImpact({
  plan: draftPlan,
  projectRules,
  impacts: [{
    area: 'Review boundary',
    effect: 'positive',
    severity: 'critical',
    summary: 'Weizenbaum can critique canonical results without approval, veto or mutation authority.',
    relatedRuleKeys: ['review.read-only'],
    relatedTaskIds: ['task-0001'],
  }],
});
const plan = approvePlan({ plan: draftPlan });
const orchestration = orchestrateBuild({ plan, projectRules, impactSimulation });

let readCalls = 0;
const toolRuntime = {
  orchestration,
  verifyCapability: () => true,
  tools: [{
    descriptor: {
      id: 'tool:review.read',
      label: 'Read bounded review source',
      requiredCapabilities: ['READ'] as const,
      mutating: false,
    },
    handler: () => {
      readCalls += 1;
      return { ok: true, surface: 'review-source' };
    },
  }],
};

const invocation = { stepId: 'build-step-0001', toolId: 'tool:review.read', input: null } as const;

const coding = await executeCodingAgent({ toolRuntime, invocation });
const database = await executeDatabaseAgent({ toolRuntime, invocation });
const testingInput: TestingAgentExecutionInput = {
  toolRuntime,
  invocation,
  criterion: {
    id: 'validation-criterion-0001',
    statement: 'Review source is available.',
    expectation: { operator: 'truthy' },
  },
  evidenceKind: 'test',
  sourceRef: 'tool:review.read#result',
};
const testing = await executeTestingAgent(testingInput);
assert.equal(readCalls, 3);
assert.equal(testing.verdict, 'passed');
assert.equal(testing.completionEligible, true);

const codingInput: ReviewAgentInput = {
  target: { kind: 'coding', record: coding },
  findings: [],
};
const codingReview1 = createReviewAgentReport(codingInput);
const codingReview2 = createReviewAgentReport(codingInput);
assert.deepEqual(codingReview1, codingReview2);
assert.equal(readCalls, 3);
assert.equal(codingReview1.schema, 'gd-review-agent/1');
assert.equal(codingReview1.agentId, 'weizenbaum');
assert.equal(codingReview1.agentName, 'Weizenbaum');
assert.equal(codingReview1.agentRole, 'reviewer-critic');
assert.equal(codingReview1.sourceKind, 'coding');
assert.equal(codingReview1.sourceId, coding.id);
assert.equal(codingReview1.sourceDigest.hex, coding.codingDigest.hex);
assert.equal(codingReview1.reviewState, 'clear');
assert.equal(codingReview1.findingCount, 0);
assert.equal(codingReview1.sourceVerdict, null);
assert.equal(codingReview1.sourceCompletionEligible, null);
assert.doesNotThrow(() => assertCanonicalReviewAgentReport(codingReview1, codingInput));

const databaseInput: ReviewAgentInput = {
  target: { kind: 'database', record: database },
  findings: [{
    id: 'review-finding-0001',
    category: 'architecture',
    severity: 'warning',
    sourceRef: 'database-agent:boundary',
    statement: 'Keep provider-specific integration outside the Database Agent boundary.',
  }],
};
const databaseReview = createReviewAgentReport(databaseInput);
assert.equal(databaseReview.sourceKind, 'database');
assert.equal(databaseReview.sourceDigest.hex, database.databaseDigest.hex);
assert.equal(databaseReview.reviewState, 'findings-present');
assert.equal(databaseReview.findingCount, 1);
assert.equal(databaseReview.warningCount, 1);
assert.equal(databaseReview.errorCount, 0);
assert.equal(readCalls, 3);
assert.doesNotThrow(() => assertCanonicalReviewAgentReport(databaseReview, databaseInput));

const testingInputReview: ReviewAgentInput = {
  target: { kind: 'testing', record: testing, input: testingInput },
  findings: [
    {
      id: 'review-finding-0001',
      category: 'testing',
      severity: 'info',
      sourceRef: 'testing-agent:validation',
      statement: 'Validation passed with explicit observed evidence.',
    },
    {
      id: 'review-finding-0002',
      category: 'maintainability',
      severity: 'warning',
      sourceRef: 'testing-agent:flow',
      statement: 'Keep future test surfaces bounded by registered Tool Runtime handlers.',
    },
  ],
};
const testingReview = createReviewAgentReport(testingInputReview);
assert.equal(testingReview.sourceKind, 'testing');
assert.equal(testingReview.sourceId, testing.id);
assert.equal(testingReview.sourceDigest.hex, testing.sourceValidationDigest);
assert.equal(testingReview.sourceVerdict, 'passed');
assert.equal(testingReview.sourceCompletionEligible, true);
assert.equal(testingReview.reviewState, 'findings-present');
assert.equal(testingReview.findingCount, 2);
assert.equal(testingReview.infoCount, 1);
assert.equal(testingReview.warningCount, 1);
assert.equal(testingReview.errorCount, 0);
assert.equal(testingReview.criticalCount, 0);
assert.equal(testing.completionEligible, true);
assert.equal(testing.validation.completionEligible, true);
assert.equal(readCalls, 3);
assert.doesNotThrow(() => assertCanonicalReviewAgentReport(testingReview, testingInputReview));

assert.throws(() => createReviewAgentReport({
  target: { kind: 'coding', record: { ...coding, directMutationAuthority: true } as never },
  findings: [],
}), /non-canonical/i);

assert.throws(() => createReviewAgentReport({
  target: { kind: 'database', record: database },
  findings: [{
    id: 'wrong-id',
    category: 'security',
    severity: 'error',
    sourceRef: 'database-agent',
    statement: 'Invalid finding identity.',
  }],
}), /review-finding-0001/i);

assert.throws(() => createReviewAgentReport({
  target: { kind: 'database', record: database },
  findings: [{
    id: 'review-finding-0001',
    category: 'security',
    severity: 'error',
    sourceRef: ' ',
    statement: 'Invalid empty source reference.',
  }],
}), /sourceRef/i);

assert.throws(() => assertCanonicalReviewAgentReport({
  ...testingReview,
  vetoAuthority: true,
} as never, testingInputReview), /non-canonical/i);

for (const field of [
  'namedAgentBinding','reviewAgent','reviewSpecialization','reviewAdvisoryOnly','sourceCanonicalRequired',
  'sourceReadOnlyPreserved','explicitFindingsOnly','sourceVerdictReadOnlyPreserved',
  'sourceCompletionEligibilityReadOnlyPreserved','deterministic','environmentNeutral','immutable',
] as const) assert.equal(testingReview[field], true);

for (const field of [
  'semanticInference','vetoAuthority','approvalAuthority','completionAuthority','validationAuthority','checkpointAuthority',
  'architectureEnforcementAuthority','capabilityGrantAuthority','scopeAuthority','directMutationAuthority',
  'codingAgentAuthority','databaseAgentAuthority','testingAgentAuthority','agentOrchestratorAuthority',
  'automaticAgentSelection','orchestration','agentExecution','toolExecution','execution','scheduling','jobCreation',
  'persistence','networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
] as const) assert.equal(testingReview[field], false);

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build63-review-agent-runtime/1',
  build:63,
  agentId:testingReview.agentId,
  codingTarget:true,
  databaseTarget:true,
  testingTarget:true,
  sourceCompletionPreserved:testingReview.sourceCompletionEligible,
  advisoryOnly:testingReview.reviewAdvisoryOnly,
  toolCallsDuringReview:0,
},null,2));
