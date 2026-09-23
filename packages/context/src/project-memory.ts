export const PROJECT_MEMORY_BUILD = 66 as const;
export const PROJECT_MEMORY_SCHEMA = 'gd-project-memory-entry/1' as const;
export const PROJECT_MEMORY_QUERY_SCHEMA = 'gd-project-memory-query/1' as const;
export const PROJECT_MEMORY_MAX_SOURCE_REFS = 64 as const;
export const PROJECT_MEMORY_MAX_DECISION_PROVENANCE_REFS = 32 as const;
export const PROJECT_MEMORY_QUERY_MAX_LIMIT = 500 as const;

export const PROJECT_MEMORY_KINDS = Object.freeze([
  'observation',
  'finding',
  'coverage',
  'unresolved-question',
  'project-fact',
  'decision',
  'knowledge-pack',
] as const);

export const PROJECT_MEMORY_LIFECYCLES = Object.freeze(['active', 'closed'] as const);
export const PROJECT_MEMORY_COVERAGE_STATUSES = Object.freeze(['tested', 'untested'] as const);

export type ProjectMemoryKind = (typeof PROJECT_MEMORY_KINDS)[number];
export type ProjectMemoryLifecycle = (typeof PROJECT_MEMORY_LIFECYCLES)[number];
export type ProjectMemoryCoverageStatus = (typeof PROJECT_MEMORY_COVERAGE_STATUSES)[number];

export interface ProjectMemoryEntryInput {
  readonly id: string;
  readonly workspaceId: string;
  readonly kind: ProjectMemoryKind;
  readonly statement: string;
  readonly sourceRefs: readonly string[];
  readonly decisionProvenanceRefs?: readonly string[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly supersedesId?: string | null;
  readonly lifecycle?: ProjectMemoryLifecycle;
  readonly coverageStatus?: ProjectMemoryCoverageStatus | null;
}

export interface ProjectMemoryEntry {
  readonly schema: typeof PROJECT_MEMORY_SCHEMA;
  readonly build: typeof PROJECT_MEMORY_BUILD;
  readonly id: string;
  readonly workspaceId: string;
  readonly kind: ProjectMemoryKind;
  readonly statement: string;
  readonly sourceRefs: readonly string[];
  readonly decisionProvenanceRefs: readonly string[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly supersedesId: string | null;
  readonly lifecycle: ProjectMemoryLifecycle;
  readonly coverageStatus: ProjectMemoryCoverageStatus | null;
  readonly authoritative: false;
  readonly truthRole: 'operational-memory';
  readonly workspaceScoped: true;
  readonly sharedAgentOperationalState: true;
  readonly observationMemory: true;
  readonly findingMemory: true;
  readonly coverageMemory: true;
  readonly unresolvedQuestionMemory: true;
  readonly reusableProjectFactMemory: true;
  readonly decisionProvenanceMemory: true;
  readonly compiledKnowledgePackMemory: true;
  readonly architectureLedgerAuthority: false;
  readonly productContractAuthority: false;
  readonly gitAuthority: false;
  readonly validationAuthority: false;
  readonly capabilityAuthority: false;
  readonly approvalAuthority: false;
  readonly aiExecution: false;
  readonly networkAuthority: false;
  readonly immutableRevision: true;
  readonly localFirst: true;
}

export interface ProjectMemoryQueryInput {
  readonly workspaceId: string;
  readonly kinds?: readonly ProjectMemoryKind[];
  readonly lifecycle?: ProjectMemoryLifecycle | null;
  readonly includeSuperseded?: boolean;
  readonly limit?: number;
}

export interface ProjectMemoryQuery {
  readonly schema: typeof PROJECT_MEMORY_QUERY_SCHEMA;
  readonly workspaceId: string;
  readonly kinds: readonly ProjectMemoryKind[];
  readonly lifecycle: ProjectMemoryLifecycle | null;
  readonly includeSuperseded: boolean;
  readonly limit: number;
  readonly bounded: true;
  readonly workspaceScoped: true;
}

const CONTROL = /[\u0000-\u001f\u007f]/;
const ID = /^[a-z][a-z0-9._:/_-]{0,255}$/;
const KINDS = new Set<ProjectMemoryKind>(PROJECT_MEMORY_KINDS);
const LIFECYCLES = new Set<ProjectMemoryLifecycle>(PROJECT_MEMORY_LIFECYCLES);
const COVERAGE = new Set<ProjectMemoryCoverageStatus>(PROJECT_MEMORY_COVERAGE_STATUSES);

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a string.');
  const normalized = value.trim();
  if (!normalized || normalized.length > max || CONTROL.test(normalized)) throw new TypeError(label + ' is invalid.');
  return normalized;
}

function canonicalId(value: unknown, label: string): string {
  const normalized = boundedText(value, label, 256).toLowerCase();
  if (!ID.test(normalized)) throw new TypeError(label + ' is invalid.');
  return normalized;
}

function refs(value: unknown, label: string, max: number, allowEmpty: boolean): readonly string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length < 1) || value.length > max) {
    throw new RangeError(label + ' has an invalid number of references.');
  }
  const normalized = value.map((item, index) => boundedText(item, label + ' ' + (index + 1), 1024)).sort();
  if (new Set(normalized).size !== normalized.length) throw new TypeError(label + ' contains duplicate references.');
  return Object.freeze(normalized);
}

export function normalizeProjectMemoryEntry(input: ProjectMemoryEntryInput): ProjectMemoryEntry {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Project Memory entry input must be an object.');
  if (typeof input.kind !== 'string' || !KINDS.has(input.kind)) throw new TypeError('Project Memory kind is invalid.');

  const id = canonicalId(input.id, 'Project Memory id');
  const workspaceId = canonicalId(input.workspaceId, 'Project Memory workspaceId');
  const statement = boundedText(input.statement, 'Project Memory statement', 16_384);
  const sourceRefs = refs(input.sourceRefs, 'Project Memory sourceRefs', PROJECT_MEMORY_MAX_SOURCE_REFS, false);
  const decisionProvenanceRefs = refs(
    input.decisionProvenanceRefs ?? [],
    'Project Memory decisionProvenanceRefs',
    PROJECT_MEMORY_MAX_DECISION_PROVENANCE_REFS,
    true,
  );
  if (input.kind === 'decision' && decisionProvenanceRefs.length < 1) {
    throw new TypeError('Project Memory decision entries require explicit decision provenance.');
  }
  if (input.kind !== 'decision' && decisionProvenanceRefs.length > 0) {
    throw new TypeError('Only Project Memory decision entries may carry decision provenance refs.');
  }

  const lifecycle = input.lifecycle ?? 'active';
  if (!LIFECYCLES.has(lifecycle)) throw new TypeError('Project Memory lifecycle is invalid.');

  const coverageStatus = input.coverageStatus ?? null;
  if (input.kind === 'coverage') {
    if (coverageStatus === null || !COVERAGE.has(coverageStatus)) {
      throw new TypeError('Project Memory coverage entries require tested or untested coverageStatus.');
    }
  } else if (coverageStatus !== null) {
    throw new TypeError('Only Project Memory coverage entries may carry coverageStatus.');
  }

  const createdAt = boundedText(input.createdAt, 'Project Memory createdAt', 64);
  if (!Number.isFinite(Date.parse(createdAt))) throw new TypeError('Project Memory createdAt is invalid.');
  const createdBy = boundedText(input.createdBy, 'Project Memory createdBy', 160);
  const supersedesId = input.supersedesId == null ? null : canonicalId(input.supersedesId, 'Project Memory supersedesId');
  if (supersedesId === id) throw new TypeError('Project Memory entry cannot supersede itself.');

  return Object.freeze({
    schema: PROJECT_MEMORY_SCHEMA,
    build: PROJECT_MEMORY_BUILD,
    id,
    workspaceId,
    kind: input.kind,
    statement,
    sourceRefs,
    decisionProvenanceRefs,
    createdBy,
    createdAt,
    supersedesId,
    lifecycle,
    coverageStatus,
    authoritative: false,
    truthRole: 'operational-memory',
    workspaceScoped: true,
    sharedAgentOperationalState: true,
    observationMemory: true,
    findingMemory: true,
    coverageMemory: true,
    unresolvedQuestionMemory: true,
    reusableProjectFactMemory: true,
    decisionProvenanceMemory: true,
    compiledKnowledgePackMemory: true,
    architectureLedgerAuthority: false,
    productContractAuthority: false,
    gitAuthority: false,
    validationAuthority: false,
    capabilityAuthority: false,
    approvalAuthority: false,
    aiExecution: false,
    networkAuthority: false,
    immutableRevision: true,
    localFirst: true,
  });
}

export function assertCanonicalProjectMemoryEntry(value: unknown): asserts value is ProjectMemoryEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Project Memory entry must be an object.');
  const row = value as ProjectMemoryEntry;
  const canonical = normalizeProjectMemoryEntry({
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind,
    statement: row.statement,
    sourceRefs: row.sourceRefs,
    decisionProvenanceRefs: row.decisionProvenanceRefs,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    supersedesId: row.supersedesId,
    lifecycle: row.lifecycle,
    coverageStatus: row.coverageStatus,
  });
  if (JSON.stringify(value) !== JSON.stringify(canonical)) throw new TypeError('Project Memory entry is non-canonical.');
}

export function normalizeProjectMemoryQuery(input: ProjectMemoryQueryInput): ProjectMemoryQuery {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Project Memory query must be an object.');
  const workspaceId = canonicalId(input.workspaceId, 'Project Memory query workspaceId');
  const kinds = input.kinds ?? [];
  if (!Array.isArray(kinds) || kinds.length > PROJECT_MEMORY_KINDS.length) throw new RangeError('Project Memory query kinds are invalid.');
  if (kinds.some((kind) => !KINDS.has(kind)) || new Set(kinds).size !== kinds.length) throw new TypeError('Project Memory query kinds are invalid.');
  const lifecycle = input.lifecycle ?? null;
  if (lifecycle !== null && !LIFECYCLES.has(lifecycle)) throw new TypeError('Project Memory query lifecycle is invalid.');
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > PROJECT_MEMORY_QUERY_MAX_LIMIT) throw new RangeError('Project Memory query limit is invalid.');
  return Object.freeze({
    schema: PROJECT_MEMORY_QUERY_SCHEMA,
    workspaceId,
    kinds: Object.freeze([...kinds].sort()),
    lifecycle,
    includeSuperseded: input.includeSuperseded === true,
    limit,
    bounded: true,
    workspaceScoped: true,
  });
}
