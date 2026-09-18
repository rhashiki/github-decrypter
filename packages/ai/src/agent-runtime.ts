export const AGENT_RUNTIME_BUILD = 58 as const;
export const AGENT_RUNTIME_SCHEMA = 'gd-agent-runtime/1' as const;
export const AGENT_RUNTIME_TEAM_ID = 'vortex-ars-ai' as const;
export const AGENT_RUNTIME_REVISION = 1 as const;
export const AGENT_RUNTIME_COUNT = 9 as const;

export const AGENT_RUNTIME_ROLES = [
  'orchestrator',
  'architect',
  'builder-programmer',
  'frontend-human-interface',
  'backend-computational-core',
  'reviewer-critic',
  'qa-testing',
  'mentor-professor',
  'visual-perception',
] as const;

export type AgentRuntimeRole = (typeof AGENT_RUNTIME_ROLES)[number];

export interface AgentRuntimeDescriptor {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRuntimeRole;
  readonly specialty: string;
  readonly responsibilities: readonly string[];
  readonly authorityLimits: readonly string[];
  readonly namedIdentity: true;
  readonly presentationMetadataOnly: true;
  readonly operational: false;
  readonly capabilityPrincipal: false;
}

export interface AgentRuntimeRegistry {
  readonly schema: typeof AGENT_RUNTIME_SCHEMA;
  readonly build: typeof AGENT_RUNTIME_BUILD;
  readonly teamId: typeof AGENT_RUNTIME_TEAM_ID;
  readonly revision: typeof AGENT_RUNTIME_REVISION;
  readonly agentCount: typeof AGENT_RUNTIME_COUNT;
  readonly agents: readonly AgentRuntimeDescriptor[];
  readonly namedAgentSystem: true;
  readonly identityRegistry: true;
  readonly roleMetadata: true;
  readonly specialtyMetadata: true;
  readonly responsibilityMetadata: true;
  readonly authorityLimitsExplicit: true;
  readonly coordinatedTeamFoundation: true;
  readonly viktorIsAgent: false;
  readonly plannerAgentBuild: 59;
  readonly codingAgentBuild: 60;
  readonly databaseAgentBuild: 61;
  readonly testingAgentBuild: 62;
  readonly reviewAgentBuild: 63;
  readonly agentOrchestratorBuild: 64;
  readonly automaticSelection: false;
  readonly manualRoutingRequired: false;
  readonly orchestration: false;
  readonly agentExecution: false;
  readonly toolExecution: false;
  readonly execution: false;
  readonly capabilityGrantAuthority: false;
  readonly approvalAuthority: false;
  readonly scopeAuthority: false;
  readonly mutationAuthorized: false;
  readonly scheduling: false;
  readonly jobCreation: false;
  readonly persistence: false;
  readonly networkAuthority: false;
  readonly filesystemAuthority: false;
  readonly databaseAuthority: false;
  readonly studioTransport: false;
  readonly localRuntimeTransport: false;
  readonly immutable: true;
  readonly deterministic: true;
  readonly environmentNeutral: true;
}

function freezeDescriptor(input: Omit<AgentRuntimeDescriptor, 'namedIdentity' | 'presentationMetadataOnly' | 'operational' | 'capabilityPrincipal'>): AgentRuntimeDescriptor {
  return Object.freeze({
    id: input.id,
    name: input.name,
    role: input.role,
    specialty: input.specialty,
    responsibilities: Object.freeze([...input.responsibilities]),
    authorityLimits: Object.freeze([...input.authorityLimits]),
    namedIdentity: true,
    presentationMetadataOnly: true,
    operational: false,
    capabilityPrincipal: false,
  });
}

const SHARED_LIMITS = Object.freeze([
  'No independent capability grants.',
  'No approval, scope or mutation authority from identity alone.',
  'No direct tool, filesystem, network or database authority.',
  'Operational authority belongs only to the owning future Build and ordinary runtime policy.',
]);

export const AGENT_RUNTIME_AGENTS = Object.freeze([
  freezeDescriptor({
    id: 'ramon',
    name: 'Ramon',
    role: 'orchestrator',
    specialty: 'Coordination and orchestration',
    responsibilities: ['Represent coordinated team routing metadata.', 'Maintain a single-team interaction model for future orchestration.'],
    authorityLimits: SHARED_LIMITS,
  }),
  freezeDescriptor({
    id: 'leonardo',
    name: 'Leonardo',
    role: 'architect',
    specialty: 'Software architecture and technical planning',
    responsibilities: ['Represent architecture and system-design expertise.', 'Support future planning and architectural review flows.'],
    authorityLimits: SHARED_LIMITS,
  }),
  freezeDescriptor({
    id: 'strachey',
    name: 'Strachey',
    role: 'builder-programmer',
    specialty: 'Implementation and programming',
    responsibilities: ['Represent implementation expertise.', 'Support future coding-agent workflows under ordinary Build controls.'],
    authorityLimits: SHARED_LIMITS,
  }),
  freezeDescriptor({
    id: 'licklider',
    name: 'Licklider',
    role: 'frontend-human-interface',
    specialty: 'Frontend systems and human-computer interaction',
    responsibilities: ['Represent frontend and interaction expertise.', 'Support future interface implementation and review flows.'],
    authorityLimits: SHARED_LIMITS,
  }),
  freezeDescriptor({
    id: 'pitts',
    name: 'Pitts',
    role: 'backend-computational-core',
    specialty: 'Backend systems and computational core',
    responsibilities: ['Represent backend and data-system expertise.', 'Support future backend/database implementation flows.'],
    authorityLimits: SHARED_LIMITS,
  }),
  freezeDescriptor({
    id: 'weizenbaum',
    name: 'Weizenbaum',
    role: 'reviewer-critic',
    specialty: 'Critical review and implementation critique',
    responsibilities: ['Represent review and critique expertise.', 'Support future review-agent flows without granting veto or mutation authority.'],
    authorityLimits: SHARED_LIMITS,
  }),
  freezeDescriptor({
    id: 'samuel',
    name: 'Samuel',
    role: 'qa-testing',
    specialty: 'Quality assurance and testing',
    responsibilities: ['Represent QA and testing expertise.', 'Support future Testing Agent use of the Validation Pipeline.'],
    authorityLimits: SHARED_LIMITS,
  }),
  freezeDescriptor({
    id: 'seymour',
    name: 'Seymour',
    role: 'mentor-professor',
    specialty: 'Programming mentorship and explanation',
    responsibilities: ['Represent mentor and teaching expertise.', 'Support future adaptive explanation and learning flows.'],
    authorityLimits: SHARED_LIMITS,
  }),
  freezeDescriptor({
    id: 'fukushima',
    name: 'Fukushima',
    role: 'visual-perception',
    specialty: 'Visual perception and interface context',
    responsibilities: ['Represent visual/perception expertise.', 'Support future Preview perception and visual-context flows.'],
    authorityLimits: SHARED_LIMITS,
  }),
] as const satisfies readonly AgentRuntimeDescriptor[]);

function assertDescriptor(candidate: AgentRuntimeDescriptor, expected: AgentRuntimeDescriptor): void {
  if (
    candidate.id !== expected.id
    || candidate.name !== expected.name
    || candidate.role !== expected.role
    || candidate.specialty !== expected.specialty
    || JSON.stringify(candidate.responsibilities) !== JSON.stringify(expected.responsibilities)
    || JSON.stringify(candidate.authorityLimits) !== JSON.stringify(expected.authorityLimits)
    || candidate.namedIdentity !== true
    || candidate.presentationMetadataOnly !== true
    || candidate.operational !== false
    || candidate.capabilityPrincipal !== false
  ) {
    throw new TypeError(`Agent Runtime descriptor ${expected.id} is non-canonical.`);
  }
}

export function createAgentRuntimeRegistry(): AgentRuntimeRegistry {
  return Object.freeze({
    schema: AGENT_RUNTIME_SCHEMA,
    build: AGENT_RUNTIME_BUILD,
    teamId: AGENT_RUNTIME_TEAM_ID,
    revision: AGENT_RUNTIME_REVISION,
    agentCount: AGENT_RUNTIME_COUNT,
    agents: AGENT_RUNTIME_AGENTS,
    namedAgentSystem: true,
    identityRegistry: true,
    roleMetadata: true,
    specialtyMetadata: true,
    responsibilityMetadata: true,
    authorityLimitsExplicit: true,
    coordinatedTeamFoundation: true,
    viktorIsAgent: false,
    plannerAgentBuild: 59,
    codingAgentBuild: 60,
    databaseAgentBuild: 61,
    testingAgentBuild: 62,
    reviewAgentBuild: 63,
    agentOrchestratorBuild: 64,
    automaticSelection: false,
    manualRoutingRequired: false,
    orchestration: false,
    agentExecution: false,
    toolExecution: false,
    execution: false,
    capabilityGrantAuthority: false,
    approvalAuthority: false,
    scopeAuthority: false,
    mutationAuthorized: false,
    scheduling: false,
    jobCreation: false,
    persistence: false,
    networkAuthority: false,
    filesystemAuthority: false,
    databaseAuthority: false,
    studioTransport: false,
    localRuntimeTransport: false,
    immutable: true,
    deterministic: true,
    environmentNeutral: true,
  });
}

export const AGENT_RUNTIME_REGISTRY = createAgentRuntimeRegistry();

export function assertCanonicalAgentRuntime(value: unknown): asserts value is AgentRuntimeRegistry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Agent Runtime registry must be an object.');
  }
  const row = value as AgentRuntimeRegistry;
  const canonical = AGENT_RUNTIME_REGISTRY;
  if (
    row.schema !== canonical.schema
    || row.build !== AGENT_RUNTIME_BUILD
    || row.teamId !== AGENT_RUNTIME_TEAM_ID
    || row.revision !== AGENT_RUNTIME_REVISION
    || row.agentCount !== AGENT_RUNTIME_COUNT
    || !Array.isArray(row.agents)
    || row.agents.length !== AGENT_RUNTIME_COUNT
    || row.namedAgentSystem !== true
    || row.identityRegistry !== true
    || row.roleMetadata !== true
    || row.specialtyMetadata !== true
    || row.responsibilityMetadata !== true
    || row.authorityLimitsExplicit !== true
    || row.coordinatedTeamFoundation !== true
    || row.viktorIsAgent !== false
    || row.plannerAgentBuild !== 59
    || row.codingAgentBuild !== 60
    || row.databaseAgentBuild !== 61
    || row.testingAgentBuild !== 62
    || row.reviewAgentBuild !== 63
    || row.agentOrchestratorBuild !== 64
    || row.automaticSelection !== false
    || row.manualRoutingRequired !== false
    || row.orchestration !== false
    || row.agentExecution !== false
    || row.toolExecution !== false
    || row.execution !== false
    || row.capabilityGrantAuthority !== false
    || row.approvalAuthority !== false
    || row.scopeAuthority !== false
    || row.mutationAuthorized !== false
    || row.scheduling !== false
    || row.jobCreation !== false
    || row.persistence !== false
    || row.networkAuthority !== false
    || row.filesystemAuthority !== false
    || row.databaseAuthority !== false
    || row.studioTransport !== false
    || row.localRuntimeTransport !== false
    || row.immutable !== true
    || row.deterministic !== true
    || row.environmentNeutral !== true
  ) {
    throw new TypeError('Agent Runtime registry is non-canonical.');
  }
  for (let index = 0; index < AGENT_RUNTIME_COUNT; index += 1) {
    assertDescriptor(row.agents[index]!, canonical.agents[index]!);
  }
}

export function listAgentRuntimeDescriptors(): readonly AgentRuntimeDescriptor[] {
  return AGENT_RUNTIME_AGENTS;
}

export function getAgentRuntimeDescriptor(id: string): AgentRuntimeDescriptor | null {
  const normalized = typeof id === 'string' ? id.trim().toLowerCase() : '';
  return AGENT_RUNTIME_AGENTS.find((agent) => agent.id === normalized) ?? null;
}
