import {
  AGENT_RUNTIME_REGISTRY,
  AGENT_RUNTIME_SCHEMA,
  assertCanonicalAgentRuntime,
  getAgentRuntimeDescriptor,
  type AgentRuntimeRegistry,
} from './agent-runtime.js';
import { assertCanonicalTestingAgentExecution, type TestingAgentExecutionInput, type TestingAgentExecutionRecord } from './testing-agent.js';
import { assertCanonicalReviewAgentReport, type ReviewAgentInput, type ReviewAgentReport } from './review-agent.js';
import { assertCanonicalHeimdallConformance, type HeimdallInput, type HeimdallConformanceRecord } from './heimdall.js';
import { AI_CANONICAL_DIGEST_ALGORITHM, sha256Hex } from './canonical-digest.js';

export const AGENT_ORCHESTRATOR_BUILD = 64 as const;
export const AGENT_ORCHESTRATOR_SCHEMA = 'gd-agent-orchestrator/1' as const;
export const AGENT_ORCHESTRATOR_ID = 'ramon' as const;
export const AGENT_ORCHESTRATOR_NAME = 'Ramon' as const;
export const AGENT_ORCHESTRATOR_ROLE = 'orchestrator' as const;
export const AGENT_ORCHESTRATOR_STATES = Object.freeze([
  'architecture-blocked','implementation','validation-blocked','architecture-post-blocked','ready-to-communicate',
] as const);
export type AgentOrchestratorState=(typeof AGENT_ORCHESTRATOR_STATES)[number];

export interface AgentOrchestratorInput {
  readonly registry?: AgentRuntimeRegistry;
  readonly workspaceId: string;
  readonly requestId: string;
  readonly participantIds: readonly string[];
  readonly heimdallPre: { readonly input: HeimdallInput; readonly record: HeimdallConformanceRecord };
  readonly heimdallPost?: { readonly input: HeimdallInput; readonly record: HeimdallConformanceRecord };
  readonly testing?: { readonly input: TestingAgentExecutionInput; readonly record: TestingAgentExecutionRecord };
  readonly review?: { readonly input: ReviewAgentInput; readonly record: ReviewAgentReport };
}

export interface AgentOrchestratorRecord {
  readonly schema: typeof AGENT_ORCHESTRATOR_SCHEMA;
  readonly sourceAgentRuntimeSchema: typeof AGENT_RUNTIME_SCHEMA;
  readonly sourceAgentRuntimeRevision: 2;
  readonly id: string;
  readonly revision: 1;
  readonly status: 'coordinated';
  readonly state: AgentOrchestratorState;
  readonly workspaceId: string;
  readonly requestId: string;
  readonly coordinatorId: typeof AGENT_ORCHESTRATOR_ID;
  readonly coordinatorName: typeof AGENT_ORCHESTRATOR_NAME;
  readonly coordinatorRole: typeof AGENT_ORCHESTRATOR_ROLE;
  readonly participantIds: readonly string[];
  readonly participantCount: number;
  readonly heimdallPreId: string;
  readonly heimdallPreStatus: HeimdallConformanceRecord['status'];
  readonly heimdallPostId: string | null;
  readonly heimdallPostStatus: HeimdallConformanceRecord['status'] | null;
  readonly testingId: string | null;
  readonly testingVerdict: TestingAgentExecutionRecord['verdict'] | null;
  readonly testingCompletionEligible: boolean | null;
  readonly reviewId: string | null;
  readonly reviewState: ReviewAgentReport['reviewState'] | null;
  readonly reviewFindingCount: number;
  readonly completionEvidenceReady: boolean;
  readonly viktorCommunicationEligible: boolean;
  readonly orchestrationDigest: { readonly algorithm: typeof AI_CANONICAL_DIGEST_ALGORITHM; readonly hex: string };
  readonly coordinatedTeam: true;
  readonly explicitParticipantRouting: true;
  readonly semanticRouting: false;
  readonly automaticSelection: false;
  readonly canonicalArtifactCoordination: true;
  readonly architecturePreReviewRequired: true;
  readonly architecturePostReviewRequiredForCompletion: true;
  readonly testingRequiredForCompletion: true;
  readonly reviewAdvisoryOnlyPreserved: true;
  readonly heimdallEnforcementAuthority: false;
  readonly deterministicGuardianSovereign: true;
  readonly validationPipelineSovereign: true;
  readonly viktorIsAgent: false;
  readonly viktorCommunicationSurface: true;
  readonly viktorCompletionAuthority: false;
  readonly capabilityGrantAuthority: false;
  readonly approvalAuthority: false;
  readonly scopeAuthority: false;
  readonly directMutationAuthority: false;
  readonly toolExecution: false;
  readonly execution: false;
  readonly scheduling: false;
  readonly jobCreation: false;
  readonly persistence: false;
  readonly networkAuthority: false;
  readonly filesystemAuthority: false;
  readonly databaseAuthority: false;
  readonly immutable: true;
  readonly deterministic: true;
}

const TOKEN=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;
function token(value:unknown,label:string):string {
  if(typeof value!=='string') throw new TypeError(label+' must be a string.');
  const v=value.trim(); if(!TOKEN.test(v)) throw new TypeError(label+' is invalid.'); return v;
}
function assertCoordinator(registry:AgentRuntimeRegistry):void {
  assertCanonicalAgentRuntime(registry);
  const descriptor=getAgentRuntimeDescriptor(AGENT_ORCHESTRATOR_ID);
  if(!descriptor||descriptor.name!==AGENT_ORCHESTRATOR_NAME||descriptor.role!==AGENT_ORCHESTRATOR_ROLE||descriptor.operational!==false||descriptor.capabilityPrincipal!==false) {
    throw new TypeError('Agent Orchestrator requires the canonical Ramon orchestrator identity.');
  }
}
function participants(input:readonly string[],registry:AgentRuntimeRegistry):readonly string[] {
  if(!Array.isArray(input)||input.length<1||input.length>registry.agentCount) throw new TypeError('Agent Orchestrator participantIds are invalid.');
  const normalized=input.map(v=>token(v,'Agent participant id').toLowerCase());
  if(new Set(normalized).size!==normalized.length) throw new TypeError('Agent Orchestrator participantIds contain duplicates.');
  if(normalized.includes('viktor')) throw new TypeError('Viktor is not an agent and cannot be an Agent Orchestrator participant.');
  for(const id of normalized) if(!getAgentRuntimeDescriptor(id)) throw new TypeError('Agent Orchestrator participant is not canonical: '+id+'.');
  if(!normalized.includes(AGENT_ORCHESTRATOR_ID)) throw new TypeError('Agent Orchestrator participantIds must include Ramon.');
  return Object.freeze([...normalized].sort());
}

export function createAgentOrchestratorRecord(input:AgentOrchestratorInput):AgentOrchestratorRecord {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new TypeError('Agent Orchestrator input must be an object.');
  const registry=input.registry??AGENT_RUNTIME_REGISTRY;
  assertCoordinator(registry);
  if(registry.revision!==2||registry.agentCount!==10) throw new TypeError('Agent Orchestrator requires Agent Runtime revision 2 with ten specialists.');
  const participantIds=participants(input.participantIds,registry);
  assertCanonicalHeimdallConformance(input.heimdallPre.record,input.heimdallPre.input);
  if(input.heimdallPre.record.phase!=='pre-change') throw new TypeError('Agent Orchestrator requires Heimdall pre-change review in heimdallPre.');
  if(!participantIds.includes('heimdall')) throw new TypeError('Agent Orchestrator Build 64 requires Heimdall participation.');

  let post:HeimdallConformanceRecord|null=null;
  if(input.heimdallPost){
    assertCanonicalHeimdallConformance(input.heimdallPost.record,input.heimdallPost.input);
    if(input.heimdallPost.record.phase!=='post-change') throw new TypeError('Agent Orchestrator heimdallPost must be post-change.');
    post=input.heimdallPost.record;
  }
  let testing:TestingAgentExecutionRecord|null=null;
  if(input.testing){
    assertCanonicalTestingAgentExecution(input.testing.record,input.testing.input);
    if(!participantIds.includes('samuel')) throw new TypeError('Testing artifact requires Samuel participation.');
    testing=input.testing.record;
  }
  let review:ReviewAgentReport|null=null;
  if(input.review){
    assertCanonicalReviewAgentReport(input.review.record,input.review.input);
    if(!participantIds.includes('weizenbaum')) throw new TypeError('Review artifact requires Weizenbaum participation.');
    review=input.review.record;
  }

  const preOk=input.heimdallPre.record.status==='conformant';
  const testingOk=testing?.completionEligible===true&&testing.verdict==='passed';
  const postOk=post?.completionConformanceSatisfied===true&&post.status==='conformant';
  const state:AgentOrchestratorState=!preOk?'architecture-blocked'
    : testing===null?'implementation'
      : !testingOk?'validation-blocked'
        : !postOk?'architecture-post-blocked'
          :'ready-to-communicate';
  const completionEvidenceReady=state==='ready-to-communicate';
  const workspaceId=token(input.workspaceId,'Agent Orchestrator workspaceId');
  const requestId=token(input.requestId,'Agent Orchestrator requestId');
  const material=JSON.stringify({
    schema:AGENT_ORCHESTRATOR_SCHEMA,workspaceId,requestId,participantIds,
    pre:{id:input.heimdallPre.record.id,status:input.heimdallPre.record.status},
    post:post?{id:post.id,status:post.status}:null,
    testing:testing?{id:testing.id,verdict:testing.verdict,completionEligible:testing.completionEligible}:null,
    review:review?{id:review.id,state:review.reviewState,findingCount:review.findingCount}:null,
    state,completionEvidenceReady,
  });
  const hex=sha256Hex(material);
  return Object.freeze({
    schema:AGENT_ORCHESTRATOR_SCHEMA,sourceAgentRuntimeSchema:AGENT_RUNTIME_SCHEMA,sourceAgentRuntimeRevision:2,
    id:'agent-orchestration-'+hex.slice(0,16),revision:1,status:'coordinated',state,workspaceId,requestId,
    coordinatorId:AGENT_ORCHESTRATOR_ID,coordinatorName:AGENT_ORCHESTRATOR_NAME,coordinatorRole:AGENT_ORCHESTRATOR_ROLE,
    participantIds,participantCount:participantIds.length,
    heimdallPreId:input.heimdallPre.record.id,heimdallPreStatus:input.heimdallPre.record.status,
    heimdallPostId:post?.id??null,heimdallPostStatus:post?.status??null,
    testingId:testing?.id??null,testingVerdict:testing?.verdict??null,testingCompletionEligible:testing?.completionEligible??null,
    reviewId:review?.id??null,reviewState:review?.reviewState??null,reviewFindingCount:review?.findingCount??0,
    completionEvidenceReady,viktorCommunicationEligible:completionEvidenceReady,
    orchestrationDigest:Object.freeze({algorithm:AI_CANONICAL_DIGEST_ALGORITHM,hex}),
    coordinatedTeam:true,explicitParticipantRouting:true,semanticRouting:false,automaticSelection:false,
    canonicalArtifactCoordination:true,architecturePreReviewRequired:true,architecturePostReviewRequiredForCompletion:true,
    testingRequiredForCompletion:true,reviewAdvisoryOnlyPreserved:true,heimdallEnforcementAuthority:false,
    deterministicGuardianSovereign:true,validationPipelineSovereign:true,viktorIsAgent:false,viktorCommunicationSurface:true,
    viktorCompletionAuthority:false,capabilityGrantAuthority:false,approvalAuthority:false,scopeAuthority:false,
    directMutationAuthority:false,toolExecution:false,execution:false,scheduling:false,jobCreation:false,persistence:false,
    networkAuthority:false,filesystemAuthority:false,databaseAuthority:false,immutable:true,deterministic:true,
  });
}

export function assertCanonicalAgentOrchestratorRecord(value:unknown,input:AgentOrchestratorInput):asserts value is AgentOrchestratorRecord {
  const canonical=createAgentOrchestratorRecord(input);
  if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value)!==JSON.stringify(canonical)) {
    throw new TypeError('Agent Orchestrator record is non-canonical.');
  }
}
