import assert from 'node:assert/strict';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';
import { simulateImpact } from '../packages/plan/src/impact-simulation.js';
import { orchestrateBuild } from '../packages/build/src/index.js';
import { AGENT_RUNTIME_REGISTRY, getAgentRuntimeDescriptor } from '../packages/ai/src/agent-runtime.js';
import { createArchitectureContract } from '../packages/ai/src/architecture-contract.js';
import { createArchitectureLedger } from '../packages/ai/src/architecture-ledger.js';
import { createHeimdallConformance } from '../packages/ai/src/heimdall.js';
import { executeTestingAgent, type TestingAgentExecutionInput } from '../packages/ai/src/testing-agent.js';
import { createReviewAgentReport, type ReviewAgentInput } from '../packages/ai/src/review-agent.js';
import { createAgentOrchestratorRecord, assertCanonicalAgentOrchestratorRecord } from '../packages/ai/src/agent-orchestrator.js';

const workspaceId='workspace:agent-orchestrator-alpha';

assert.equal(AGENT_RUNTIME_REGISTRY.revision,2);
assert.equal(AGENT_RUNTIME_REGISTRY.agentCount,10);
assert.equal(AGENT_RUNTIME_REGISTRY.historicalRevisionOneCount,9);
assert.equal(AGENT_RUNTIME_REGISTRY.viktorIsAgent,false);
assert.equal(getAgentRuntimeDescriptor('heimdall')?.name,'Heimdall');
assert.equal(getAgentRuntimeDescriptor('viktor'),null);

const contract=createArchitectureContract({
  projectId:workspaceId,
  revision:1,
  domains:[
    {id:'editor',owns:['ui.editor'],dependsOn:['project-service'],forbiddenDependencies:['backend-provider'],infrastructureAccess:[]},
    {id:'project-service',owns:['service.project'],dependsOn:['backend-provider'],forbiddenDependencies:[],infrastructureAccess:[]},
    {id:'backend-provider',owns:['provider.backend'],dependsOn:[],forbiddenDependencies:[],infrastructureAccess:['database']},
    {id:'preview',owns:['runtime.preview'],dependsOn:[],forbiddenDependencies:[],infrastructureAccess:[]},
  ],
  invariants:[{id:'editor-provider-isolation',statement:'Editor reaches backend provider only through project-service.'}],
});
const ledger=createArchitectureLedger({
  contract,
  entries:[{
    id:'adr-018',
    title:'Editor provider isolation',
    status:'accepted',
    rationale:'Keep editor concerns independent from backend provider implementation.',
    introducedBuild:64,
    affectedDomains:['editor','project-service'],
    allowedDependencies:[{from:'editor',to:'project-service'}],
    forbiddenDependencies:[{from:'editor',to:'backend-provider'}],
    supersedes:null,
  }],
});

const localChange={
  id:'architecture-change-local-editor',
  classification:'local-extension' as const,
  rationale:'Add behavior within the existing editor responsibility.',
  affectedDomains:['editor'],
  introducedDependencies:[],
  removedDependencies:[],
  ledgerDecisionIds:[],
  refactorBeforeFeatureRequired:false,
};
const preInput={phase:'pre-change' as const,contract,ledger,change:localChange,deterministicGuardian:'not-run' as const};
const pre=createHeimdallConformance(preInput);
assert.equal(pre.status,'conformant');
assert.equal(pre.completionConformanceSatisfied,false);

const postInput={phase:'post-change' as const,contract,ledger,change:localChange,deterministicGuardian:'passed' as const};
const post=createHeimdallConformance(postInput);
assert.equal(post.status,'conformant');
assert.equal(post.completionConformanceSatisfied,true);

const forbidden=createHeimdallConformance({
  phase:'pre-change',contract,ledger,deterministicGuardian:'not-run',
  change:{...localChange,id:'architecture-change-forbidden-edge',introducedDependencies:[{from:'editor',to:'backend-provider'}]},
});
assert.equal(forbidden.status,'violation');
assert.ok(forbidden.findings.some(f=>f.code==='HEIMDALL_FORBIDDEN_DEPENDENCY'));

const transition=createHeimdallConformance({
  phase:'pre-change',contract,ledger,deterministicGuardian:'not-run',
  change:{...localChange,id:'architecture-change-preview-edge',introducedDependencies:[{from:'editor',to:'preview'}]},
});
assert.equal(transition.status,'architectural-change-required');
assert.ok(transition.findings.some(f=>f.code==='HEIMDALL_UNDECLARED_DEPENDENCY'));

const refactor=createHeimdallConformance({
  phase:'pre-change',contract,ledger,deterministicGuardian:'not-run',
  change:{...localChange,id:'architecture-change-refactor-first',refactorBeforeFeatureRequired:true},
});
assert.equal(refactor.status,'architectural-change-required');
assert.ok(refactor.findings.some(f=>f.code==='HEIMDALL_REFACTOR_BEFORE_FEATURE'));

const missingDecision=createHeimdallConformance({
  phase:'pre-change',contract,ledger,deterministicGuardian:'not-run',
  change:{...localChange,id:'architecture-change-domain-evolution',classification:'architectural-change',ledgerDecisionIds:[]},
});
assert.equal(missingDecision.status,'architectural-change-required');
assert.ok(missingDecision.findings.some(f=>f.code==='HEIMDALL_EXPLICIT_DECISION_REQUIRED'));

const insufficient=createHeimdallConformance({
  phase:'post-change',contract,ledger,change:localChange,deterministicGuardian:'not-run',
});
assert.equal(insufficient.status,'insufficient-evidence');

const guardianFailed=createHeimdallConformance({
  phase:'post-change',contract,ledger,change:localChange,deterministicGuardian:'failed',
});
assert.equal(guardianFailed.status,'violation');
assert.equal(guardianFailed.completionConformanceSatisfied,false);

const intake=createPromptIntakeRecord({
  text:'# Goal\nCoordinate canonical team evidence\n\n# Requirements\n- Observe a bounded test result\n\n# Constraint\nAgent Orchestrator must not execute tools\n\n# Acceptance\nValidation and architecture evidence must both pass',
});
const spec=compileRequirements({intake});
const graph=compileTaskGraph({spec});
const draftPlan=createPlanAuthority({spec,graph});
const projectRules=bindProjectRules({
  plan:draftPlan,
  workspaceId,
  rules:[{key:'orchestrator.read-only',kind:'require',statement:'Ramon coordinates canonical artifacts without direct tool execution.'}],
});
const impactSimulation=simulateImpact({
  plan:draftPlan,
  projectRules,
  impacts:[{
    area:'Agent coordination boundary',
    effect:'positive',
    severity:'critical',
    summary:'Canonical artifacts are composed without granting new execution authority.',
    relatedRuleKeys:['orchestrator.read-only'],
    relatedTaskIds:['task-0001'],
  }],
});
const plan=approvePlan({plan:draftPlan});
const build=orchestrateBuild({plan,projectRules,impactSimulation});
let toolCalls=0;
const toolRuntime={
  orchestration:build,
  verifyCapability:()=>true,
  tools:[{
    descriptor:{id:'tool:orchestrator.read',label:'Read validation state',requiredCapabilities:['READ'] as const,mutating:false},
    handler:()=>{toolCalls+=1;return {ok:true};},
  }],
};
const invocation={stepId:'build-step-0001',toolId:'tool:orchestrator.read',input:null} as const;
const testingInput:TestingAgentExecutionInput={
  toolRuntime,
  invocation,
  criterion:{id:'validation-criterion-0001',statement:'Observed behavior is successful.',expectation:{operator:'truthy'}},
  evidenceKind:'test',
  sourceRef:'tool:orchestrator.read#result',
};
const testing=await executeTestingAgent(testingInput);
assert.equal(testing.verdict,'passed');
assert.equal(testing.completionEligible,true);
assert.equal(toolCalls,1);

const reviewInput:ReviewAgentInput={
  target:{kind:'testing',record:testing,input:testingInput},
  findings:[{
    id:'review-finding-0001',
    category:'maintainability',
    severity:'warning',
    sourceRef:'testing-agent:flow',
    statement:'Keep future orchestration artifact-based and bounded.',
  }],
};
const review=createReviewAgentReport(reviewInput);
assert.equal(review.reviewState,'findings-present');

const readyInput={
  workspaceId,
  requestId:'request:build64-ready',
  participantIds:['ramon','heimdall','samuel','weizenbaum'],
  heimdallPre:{input:preInput,record:pre},
  heimdallPost:{input:postInput,record:post},
  testing:{input:testingInput,record:testing},
  review:{input:reviewInput,record:review},
};
const ready=createAgentOrchestratorRecord(readyInput);
assert.equal(toolCalls,1);
assert.equal(ready.state,'ready-to-communicate');
assert.equal(ready.completionEvidenceReady,true);
assert.equal(ready.viktorCommunicationEligible,true);
assert.equal(ready.reviewFindingCount,1);
assert.equal(ready.reviewAdvisoryOnlyPreserved,true);
assert.equal(ready.viktorIsAgent,false);
assert.equal(ready.toolExecution,false);
assert.equal(ready.execution,false);
assert.doesNotThrow(()=>assertCanonicalAgentOrchestratorRecord(ready,readyInput));

const noPost=createAgentOrchestratorRecord({...readyInput,requestId:'request:build64-no-post',heimdallPost:undefined});
assert.equal(noPost.state,'architecture-post-blocked');
assert.equal(noPost.completionEvidenceReady,false);

const blockedPreInput={phase:'pre-change' as const,contract,ledger,change:{...localChange,id:'architecture-change-blocked-pre',refactorBeforeFeatureRequired:true},deterministicGuardian:'not-run' as const};
const blockedPre=createHeimdallConformance(blockedPreInput);
const blocked=createAgentOrchestratorRecord({
  ...readyInput,
  requestId:'request:build64-blocked',
  heimdallPre:{input:blockedPreInput,record:blockedPre},
});
assert.equal(blocked.state,'architecture-blocked');
assert.equal(blocked.completionEvidenceReady,false);

const failedTestingInput:TestingAgentExecutionInput={
  ...testingInput,
  criterion:{id:'validation-criterion-0001',statement:'Observed behavior must equal false.',expectation:{operator:'equals',expected:false}},
};
const failedTesting=await executeTestingAgent(failedTestingInput);
assert.equal(failedTesting.verdict,'failed');
const validationBlocked=createAgentOrchestratorRecord({
  workspaceId,
  requestId:'request:build64-validation-blocked',
  participantIds:['ramon','heimdall','samuel'],
  heimdallPre:{input:preInput,record:pre},
  heimdallPost:{input:postInput,record:post},
  testing:{input:failedTestingInput,record:failedTesting},
});
assert.equal(validationBlocked.state,'validation-blocked');
assert.equal(validationBlocked.completionEvidenceReady,false);
assert.equal(toolCalls,2);

assert.throws(()=>createAgentOrchestratorRecord({...readyInput,requestId:'request:viktor-invalid',participantIds:['ramon','heimdall','viktor']} as never),/Viktor is not an agent/i);
assert.throws(()=>createAgentOrchestratorRecord({...readyInput,requestId:'request:no-heimdall',participantIds:['ramon','samuel','weizenbaum']}),/requires Heimdall participation/i);
assert.throws(()=>createAgentOrchestratorRecord({...readyInput,workspaceId:'workspace:other'}),/different workspace/i);

console.log(JSON.stringify({
  ok:true,schema:'gd-build64-agent-orchestrator-runtime/1',build:64,
  agentRuntimeRevision:AGENT_RUNTIME_REGISTRY.revision,agentCount:AGENT_RUNTIME_REGISTRY.agentCount,
  heimdallStatuses:{pre:pre.status,post:post.status,forbidden:forbidden.status,transition:transition.status,insufficient:insufficient.status},
  readyState:ready.state,reviewFindingDoesNotVeto:ready.completionEvidenceReady,
  orchestratorToolCalls:0,viktorIsAgent:ready.viktorIsAgent,
},null,2));
