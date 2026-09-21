import {
  createToolRuntime,
  type ToolCapability,
  type ToolInvocationInput,
  type ToolInvocationRecord,
  type ToolRuntimeInput,
  type ToolValue,
} from '@github-decrypter/tools';
import {
  CHECKPOINT_ENGINE_SCHEMA,
  createCheckpoint,
  assertCanonicalCheckpoint,
  type CheckpointRecord,
} from '@github-decrypter/tools/checkpoint';
import {
  VALIDATION_PIPELINE_SCHEMA,
  createValidation,
  assertCanonicalValidation,
  type ValidationCriterionInput,
  type ValidationEvidenceKind,
  type ValidationPipelineInput,
  type ValidationRecord,
} from '@github-decrypter/tools/validation';
import {
  AGENT_RUNTIME_REGISTRY,
  AGENT_RUNTIME_SCHEMA,
  assertCanonicalAgentRuntime,
  getAgentRuntimeDescriptor,
  type AgentRuntimeRegistry,
} from './agent-runtime.js';

export const TESTING_AGENT_BUILD = 62 as const;
export const TESTING_AGENT_SCHEMA = 'gd-testing-agent/1' as const;
export const TESTING_AGENT_SOURCE_RUNTIME_SCHEMA = 'gd-agent-runtime/1' as const;
export const TESTING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1' as const;
export const TESTING_AGENT_SOURCE_CHECKPOINT_SCHEMA = 'gd-checkpoint-engine/1' as const;
export const TESTING_AGENT_SOURCE_VALIDATION_SCHEMA = 'gd-validation-pipeline/1' as const;
export const TESTING_AGENT_ID = 'samuel' as const;
export const TESTING_AGENT_NAME = 'Samuel' as const;
export const TESTING_AGENT_ROLE = 'qa-testing' as const;
export const TESTING_AGENT_MODE = 'BUILD' as const;
export const TESTING_AGENT_ALLOWED_CAPABILITIES = Object.freeze(['READ','EXECUTE'] as const);
export const TESTING_AGENT_BLOCKED_CAPABILITIES = Object.freeze([
  'WRITE','NETWORK','DATABASE_WRITE','GIT_WRITE','DESTRUCTIVE','SECRETS',
] as const);
export const TESTING_AGENT_EVIDENCE_KINDS = Object.freeze(['tool-result','test'] as const);

export type TestingAgentEvidenceKind = (typeof TESTING_AGENT_EVIDENCE_KINDS)[number];

export interface TestingAgentExecutionInput {
  readonly registry?: AgentRuntimeRegistry;
  readonly toolRuntime: ToolRuntimeInput;
  readonly invocation: ToolInvocationInput;
  readonly criterion: ValidationCriterionInput;
  readonly evidenceKind: TestingAgentEvidenceKind;
  readonly sourceRef: string;
}

export interface TestingAgentExecutionRecord {
  readonly schema: typeof TESTING_AGENT_SCHEMA;
  readonly sourceAgentRuntimeSchema: typeof TESTING_AGENT_SOURCE_RUNTIME_SCHEMA;
  readonly sourceToolRuntimeSchema: typeof TESTING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA;
  readonly sourceCheckpointSchema: typeof TESTING_AGENT_SOURCE_CHECKPOINT_SCHEMA;
  readonly sourceValidationSchema: typeof TESTING_AGENT_SOURCE_VALIDATION_SCHEMA;
  readonly sourceOrchestrationId: string;
  readonly sourceOrchestrationDigest: string;
  readonly sourceInvocationId: string;
  readonly sourceInvocationDigest: string;
  readonly sourceCompletionDigest: string;
  readonly sourceCheckpointId: string;
  readonly sourceCheckpointDigest: string;
  readonly sourceValidationId: string;
  readonly sourceValidationDigest: string;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof TESTING_AGENT_MODE;
  readonly status: 'tested';
  readonly verdict: 'passed' | 'failed';
  readonly completionEligible: boolean;
  readonly agentId: typeof TESTING_AGENT_ID;
  readonly agentName: typeof TESTING_AGENT_NAME;
  readonly agentRole: typeof TESTING_AGENT_ROLE;
  readonly workspaceId: string;
  readonly stepId: string;
  readonly toolId: string;
  readonly requiredCapabilities: readonly ToolCapability[];
  readonly evidenceKind: TestingAgentEvidenceKind;
  readonly sourceRef: string;
  readonly toolInvocation: ToolInvocationRecord;
  readonly checkpoint: CheckpointRecord;
  readonly validation: ValidationRecord;
  readonly namedAgentBinding: true;
  readonly testingAgent: true;
  readonly interactiveQA: true;
  readonly behavioralFlowExecution: true;
  readonly boundedFlowExecution: true;
  readonly singleFlowPerExecution: true;
  readonly singleCriterionPerFlow: true;
  readonly explicitAcceptanceRequired: true;
  readonly observedResultBoundToToolResult: true;
  readonly semanticInference: false;
  readonly evidenceFabricationAuthority: false;
  readonly toolRuntimeConsumer: true;
  readonly toolRuntimeSovereign: true;
  readonly checkpointEngineConsumer: true;
  readonly validationPipelineConsumer: true;
  readonly scopeLockRequiredForExecute: true;
  readonly capabilityVerifierRequired: true;
  readonly mutationAuthorityOwnedByToolRuntime: true;
  readonly checkpointAuthority: false;
  readonly validationAuthority: false;
  readonly unrestrictedAutomation: false;
  readonly browserAutomationAuthority: false;
  readonly previewAuthority: false;
  readonly capabilityGrantAuthority: false;
  readonly approvalAuthority: false;
  readonly scopeAuthority: false;
  readonly directMutationAuthority: false;
  readonly codingAgentAuthority: false;
  readonly databaseAgentAuthority: false;
  readonly reviewAgentAuthority: false;
  readonly agentOrchestratorAuthority: false;
  readonly automaticAgentSelection: false;
  readonly orchestration: false;
  readonly agentExecution: true;
  readonly toolExecution: true;
  readonly execution: true;
  readonly scheduling: false;
  readonly jobCreation: false;
  readonly persistence: false;
  readonly networkAuthority: false;
  readonly filesystemAuthority: false;
  readonly databaseAuthority: false;
  readonly studioTransport: false;
  readonly localRuntimeTransport: false;
  readonly deterministicBinding: true;
  readonly environmentNeutral: true;
  readonly immutable: true;
}

function assertCanonicalSpecialist(registry: AgentRuntimeRegistry): void {
  assertCanonicalAgentRuntime(registry);
  const descriptor = getAgentRuntimeDescriptor(TESTING_AGENT_ID);
  if (!descriptor || descriptor.id !== TESTING_AGENT_ID || descriptor.name !== TESTING_AGENT_NAME
      || descriptor.role !== TESTING_AGENT_ROLE || descriptor.operational !== false || descriptor.capabilityPrincipal !== false) {
    throw new TypeError('Testing Agent requires the canonical Samuel qa-testing identity.');
  }
}

function assertAllowedCapabilities(capabilities: readonly ToolCapability[]): void {
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    throw new TypeError('Testing Agent requires explicit Tool Runtime capabilities.');
  }
  for (const capability of capabilities) {
    if (!(TESTING_AGENT_ALLOWED_CAPABILITIES as readonly string[]).includes(capability)) {
      throw new TypeError('Testing Agent blocks Tool Runtime capability ' + capability + '.');
    }
  }
}

function normalizeSourceRef(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Testing Agent sourceRef must be a string.');
  const normalized = value.trim();
  if (!normalized || normalized.length > 1024) throw new TypeError('Testing Agent sourceRef is invalid.');
  return normalized;
}

function assertToolValue(value: ToolValue): void {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Testing Agent acceptance values must contain only finite numbers.');
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) assertToolValue(child);
    return;
  }
  if (typeof value === 'object') {
    for (const child of Object.values(value)) assertToolValue(child);
    return;
  }
  throw new TypeError('Testing Agent acceptance values must be JSON-compatible.');
}

function assertCriterion(value: ValidationCriterionInput): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Testing Agent requires one explicit acceptance criterion.');
  }
  if (value.id !== 'validation-criterion-0001') {
    throw new TypeError('Testing Agent single-flow criterion id must be validation-criterion-0001.');
  }
  const statement = typeof value.statement === 'string' ? value.statement.trim() : '';
  if (!statement || statement.length > 65536) throw new TypeError('Testing Agent acceptance statement is invalid.');
  const expectation = value.expectation as unknown as Record<string, unknown>;
  if (!expectation || typeof expectation !== 'object' || Array.isArray(expectation)) {
    throw new TypeError('Testing Agent acceptance expectation is invalid.');
  }
  const operator = expectation.operator;
  const requiringExpected = operator === 'equals' || operator === 'not-equals' || operator === 'contains';
  const unary = operator === 'truthy' || operator === 'falsy' || operator === 'exists';
  if (!requiringExpected && !unary) throw new TypeError('Testing Agent acceptance operator is unsupported.');
  const keys = Object.keys(expectation).sort();
  if (requiringExpected) {
    if (JSON.stringify(keys) !== JSON.stringify(['expected','operator'])) {
      throw new TypeError('Testing Agent acceptance expectation shape is invalid.');
    }
    assertToolValue(expectation.expected as ToolValue);
  } else if (JSON.stringify(keys) !== JSON.stringify(['operator'])) {
    throw new TypeError('Testing Agent acceptance expectation shape is invalid.');
  }
}

function assertInvocationBoundary(invocation: ToolInvocationRecord): void {
  if (!invocation || typeof invocation !== 'object' || Array.isArray(invocation)) {
    throw new TypeError('Testing Agent requires a completed canonical Tool Runtime invocation.');
  }
  if (
    invocation.schema !== TESTING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA
    || invocation.sourceBuildSchema !== 'gd-build-orchestrator/1'
    || invocation.revision !== 1
    || invocation.mode !== TESTING_AGENT_MODE
    || invocation.status !== 'completed'
    || invocation.immutable !== true
    || invocation.denyByDefault !== true
    || invocation.capabilityVerifierRequired !== true
    || invocation.capabilityGrantAuthority !== false
    || invocation.toolExecution !== true
    || invocation.execution !== true
    || invocation.scopeLockRequired !== true
    || invocation.scopeIntelligence !== false
    || invocation.checkpoints !== false
    || invocation.validationPipeline !== false
    || invocation.scheduling !== false
    || invocation.jobCreation !== false
    || invocation.persistence !== false
  ) throw new TypeError('Testing Agent source Tool Runtime invocation is non-canonical.');

  assertAllowedCapabilities(invocation.requiredCapabilities);
  const executes = invocation.requiredCapabilities.includes('EXECUTE');
  if (executes) {
    if (invocation.mutationAuthorized !== true || invocation.scopeLock !== true
        || invocation.sourceScopeLockId === null || invocation.sourceScopeLockDigest === null
        || invocation.scopeCandidateId === null || invocation.mutationAccess !== 'execute') {
      throw new TypeError('Testing Agent EXECUTE requires exact Tool Runtime Scope Lock execute authorization.');
    }
  } else if (invocation.mutationAuthorized !== false || invocation.scopeCandidateId !== null || invocation.mutationAccess !== null) {
    throw new TypeError('Testing Agent READ flow cannot carry mutation authorization.');
  }
}

function buildValidationInput(
  input: TestingAgentExecutionInput,
  checkpoint: CheckpointRecord,
  invocation: ToolInvocationRecord,
  sourceRef: string,
): ValidationPipelineInput {
  const base = {
    orchestration: input.toolRuntime.orchestration,
    checkpoint,
    criteria: [input.criterion],
    observations: [{
      criterionId: input.criterion.id,
      kind: input.evidenceKind as ValidationEvidenceKind,
      sourceRef,
      observed: invocation.result,
    }],
  } as const;
  return input.toolRuntime.scopeLock === undefined
    ? base
    : { ...base, scopeLock: input.toolRuntime.scopeLock };
}

export async function executeTestingAgent(input: TestingAgentExecutionInput): Promise<TestingAgentExecutionRecord> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Testing Agent input must be an object.');
  const keys = Object.keys(input as unknown as Record<string, unknown>).sort();
  const withoutRegistry = ['criterion','evidenceKind','invocation','sourceRef','toolRuntime'];
  const withRegistry = ['criterion','evidenceKind','invocation','registry','sourceRef','toolRuntime'];
  if (JSON.stringify(keys) !== JSON.stringify(withoutRegistry) && JSON.stringify(keys) !== JSON.stringify(withRegistry)) {
    throw new TypeError('Testing Agent input accepts only optional registry, toolRuntime, invocation, criterion, evidenceKind and sourceRef.');
  }

  assertCanonicalSpecialist(input.registry ?? AGENT_RUNTIME_REGISTRY);
  assertCriterion(input.criterion);
  if (!(TESTING_AGENT_EVIDENCE_KINDS as readonly string[]).includes(input.evidenceKind)) {
    throw new TypeError('Testing Agent evidence kind is unsupported.');
  }
  const sourceRef = normalizeSourceRef(input.sourceRef);

  const runtime = createToolRuntime(input.toolRuntime);
  const descriptor = runtime.tools.find((tool) => tool.id === input.invocation.toolId);
  if (!descriptor) throw new TypeError('Testing Agent invocation references an unknown Tool Runtime tool.');
  assertAllowedCapabilities(descriptor.requiredCapabilities);

  const executes = descriptor.requiredCapabilities.includes('EXECUTE');
  if (executes !== descriptor.mutating) {
    throw new TypeError('Testing Agent requires EXECUTE tools to declare bounded execution as mutating.');
  }

  const invocation = await runtime.invoke(input.invocation);
  assertInvocationBoundary(invocation);

  const checkpointInput = input.toolRuntime.scopeLock === undefined
    ? { orchestration: input.toolRuntime.orchestration, invocation }
    : { orchestration: input.toolRuntime.orchestration, invocation, scopeLock: input.toolRuntime.scopeLock };
  const checkpoint = createCheckpoint(checkpointInput);
  assertCanonicalCheckpoint(checkpoint, input.toolRuntime.orchestration, input.toolRuntime.scopeLock);

  const validationInput = buildValidationInput(input, checkpoint, invocation, sourceRef);
  const validation = createValidation(validationInput);
  assertCanonicalValidation(validation, validationInput);

  return Object.freeze({
    schema: TESTING_AGENT_SCHEMA,
    sourceAgentRuntimeSchema: AGENT_RUNTIME_SCHEMA,
    sourceToolRuntimeSchema: TESTING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA,
    sourceCheckpointSchema: CHECKPOINT_ENGINE_SCHEMA,
    sourceValidationSchema: VALIDATION_PIPELINE_SCHEMA,
    sourceOrchestrationId: invocation.sourceOrchestrationId,
    sourceOrchestrationDigest: invocation.sourceOrchestrationDigest,
    sourceInvocationId: invocation.id,
    sourceInvocationDigest: invocation.invocationDigest.hex,
    sourceCompletionDigest: invocation.completionDigest.hex,
    sourceCheckpointId: checkpoint.id,
    sourceCheckpointDigest: checkpoint.checkpointDigest.hex,
    sourceValidationId: validation.id,
    sourceValidationDigest: validation.validationDigest.hex,
    id: 'testing-run-' + validation.validationDigest.hex.slice(0, 16),
    revision: 1,
    mode: TESTING_AGENT_MODE,
    status: 'tested',
    verdict: validation.verdict,
    completionEligible: validation.completionEligible,
    agentId: TESTING_AGENT_ID,
    agentName: TESTING_AGENT_NAME,
    agentRole: TESTING_AGENT_ROLE,
    workspaceId: invocation.workspaceId,
    stepId: invocation.stepId,
    toolId: invocation.toolId,
    requiredCapabilities: invocation.requiredCapabilities,
    evidenceKind: input.evidenceKind,
    sourceRef,
    toolInvocation: invocation,
    checkpoint,
    validation,
    namedAgentBinding: true,
    testingAgent: true,
    interactiveQA: true,
    behavioralFlowExecution: true,
    boundedFlowExecution: true,
    singleFlowPerExecution: true,
    singleCriterionPerFlow: true,
    explicitAcceptanceRequired: true,
    observedResultBoundToToolResult: true,
    semanticInference: false,
    evidenceFabricationAuthority: false,
    toolRuntimeConsumer: true,
    toolRuntimeSovereign: true,
    checkpointEngineConsumer: true,
    validationPipelineConsumer: true,
    scopeLockRequiredForExecute: true,
    capabilityVerifierRequired: true,
    mutationAuthorityOwnedByToolRuntime: true,
    checkpointAuthority: false,
    validationAuthority: false,
    unrestrictedAutomation: false,
    browserAutomationAuthority: false,
    previewAuthority: false,
    capabilityGrantAuthority: false,
    approvalAuthority: false,
    scopeAuthority: false,
    directMutationAuthority: false,
    codingAgentAuthority: false,
    databaseAgentAuthority: false,
    reviewAgentAuthority: false,
    agentOrchestratorAuthority: false,
    automaticAgentSelection: false,
    orchestration: false,
    agentExecution: true,
    toolExecution: true,
    execution: true,
    scheduling: false,
    jobCreation: false,
    persistence: false,
    networkAuthority: false,
    filesystemAuthority: false,
    databaseAuthority: false,
    studioTransport: false,
    localRuntimeTransport: false,
    deterministicBinding: true,
    environmentNeutral: true,
    immutable: true,
  });
}

export function assertCanonicalTestingAgentExecution(
  value: unknown,
  input: TestingAgentExecutionInput,
): asserts value is TestingAgentExecutionRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Testing Agent execution record must be an object.');
  }
  assertCanonicalSpecialist(input.registry ?? AGENT_RUNTIME_REGISTRY);
  assertCriterion(input.criterion);
  const sourceRef = normalizeSourceRef(input.sourceRef);
  const row = value as TestingAgentExecutionRecord;
  assertInvocationBoundary(row.toolInvocation);
  assertCanonicalCheckpoint(row.checkpoint, input.toolRuntime.orchestration, input.toolRuntime.scopeLock);
  const validationInput = buildValidationInput(input, row.checkpoint, row.toolInvocation, sourceRef);
  assertCanonicalValidation(row.validation, validationInput);

  if (
    row.schema !== TESTING_AGENT_SCHEMA
    || row.sourceAgentRuntimeSchema !== TESTING_AGENT_SOURCE_RUNTIME_SCHEMA
    || row.sourceToolRuntimeSchema !== TESTING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA
    || row.sourceCheckpointSchema !== TESTING_AGENT_SOURCE_CHECKPOINT_SCHEMA
    || row.sourceValidationSchema !== TESTING_AGENT_SOURCE_VALIDATION_SCHEMA
    || row.sourceOrchestrationId !== row.toolInvocation.sourceOrchestrationId
    || row.sourceOrchestrationDigest !== row.toolInvocation.sourceOrchestrationDigest
    || row.sourceInvocationId !== row.toolInvocation.id
    || row.sourceInvocationDigest !== row.toolInvocation.invocationDigest.hex
    || row.sourceCompletionDigest !== row.toolInvocation.completionDigest.hex
    || row.sourceCheckpointId !== row.checkpoint.id
    || row.sourceCheckpointDigest !== row.checkpoint.checkpointDigest.hex
    || row.sourceValidationId !== row.validation.id
    || row.sourceValidationDigest !== row.validation.validationDigest.hex
    || row.id !== 'testing-run-' + row.validation.validationDigest.hex.slice(0, 16)
    || row.revision !== 1 || row.mode !== TESTING_AGENT_MODE || row.status !== 'tested'
    || row.verdict !== row.validation.verdict || row.completionEligible !== row.validation.completionEligible
    || row.agentId !== TESTING_AGENT_ID || row.agentName !== TESTING_AGENT_NAME || row.agentRole !== TESTING_AGENT_ROLE
    || row.workspaceId !== row.toolInvocation.workspaceId || row.stepId !== row.toolInvocation.stepId || row.toolId !== row.toolInvocation.toolId
    || JSON.stringify(row.requiredCapabilities) !== JSON.stringify(row.toolInvocation.requiredCapabilities)
    || row.evidenceKind !== input.evidenceKind || row.sourceRef !== sourceRef
    || row.namedAgentBinding !== true || row.testingAgent !== true || row.interactiveQA !== true
    || row.behavioralFlowExecution !== true || row.boundedFlowExecution !== true || row.singleFlowPerExecution !== true
    || row.singleCriterionPerFlow !== true || row.explicitAcceptanceRequired !== true || row.observedResultBoundToToolResult !== true
    || row.semanticInference !== false || row.evidenceFabricationAuthority !== false
    || row.toolRuntimeConsumer !== true || row.toolRuntimeSovereign !== true || row.checkpointEngineConsumer !== true
    || row.validationPipelineConsumer !== true || row.scopeLockRequiredForExecute !== true || row.capabilityVerifierRequired !== true
    || row.mutationAuthorityOwnedByToolRuntime !== true || row.checkpointAuthority !== false || row.validationAuthority !== false
    || row.unrestrictedAutomation !== false || row.browserAutomationAuthority !== false || row.previewAuthority !== false
    || row.capabilityGrantAuthority !== false || row.approvalAuthority !== false || row.scopeAuthority !== false
    || row.directMutationAuthority !== false || row.codingAgentAuthority !== false || row.databaseAgentAuthority !== false
    || row.reviewAgentAuthority !== false || row.agentOrchestratorAuthority !== false || row.automaticAgentSelection !== false
    || row.orchestration !== false || row.agentExecution !== true || row.toolExecution !== true || row.execution !== true
    || row.scheduling !== false || row.jobCreation !== false || row.persistence !== false || row.networkAuthority !== false
    || row.filesystemAuthority !== false || row.databaseAuthority !== false || row.studioTransport !== false
    || row.localRuntimeTransport !== false || row.deterministicBinding !== true || row.environmentNeutral !== true
    || row.immutable !== true
  ) throw new TypeError('Testing Agent execution record is non-canonical.');
}
