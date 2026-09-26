import type { RequirementItem, RequirementSpec } from '@github-decrypter/plan';
import {
  queryProjectKnowledgeGraph,
  type ProjectKnowledgeGraph,
  type ProjectKnowledgeQueryResult,
} from './knowledge-graph.js';
import type { ProjectMemoryEntry } from './project-memory.js';

export const FINAL_CONTEXT_ENGINE_BUILD = 67 as const;
export const PRODUCT_CONTRACT_SCHEMA = 'gd-product-contract/1' as const;
export const GENESIS_DISCOVERY_SCHEMA = 'gd-project-genesis-discovery/1' as const;
export const KNOWLEDGE_CORPUS_SCHEMA = 'gd-knowledge-corpus/1' as const;
export const KNOWLEDGE_PACK_SCHEMA = 'gd-knowledge-pack/1' as const;
export const FINAL_CONTEXT_SCHEMA = 'gd-final-context/1' as const;
export const TYPED_HANDOFF_SCHEMA = 'gd-context-handoff/1' as const;
export const TOOL_SUMMARY_SCHEMA = 'gd-tool-summary/1' as const;

export const CONTEXT_SOURCE_MAX_COUNT = 256 as const;
export const CONTEXT_SOURCE_MAX_CHARACTERS = 1_048_576 as const;
export const CONTEXT_CORPUS_MAX_CHARACTERS = 8_388_608 as const;
export const CONTEXT_CHUNK_MAX_CHARACTERS = 2_800 as const;
export const CONTEXT_CHUNK_OVERLAP_LINES = 2 as const;
export const KNOWLEDGE_PACK_MAX_CHUNKS = 24 as const;
export const KNOWLEDGE_PACK_MAX_CHARACTERS = 32_000 as const;
export const FINAL_CONTEXT_MAX_CHARACTERS = 64_000 as const;
export const FINAL_CONTEXT_MAX_SPECIALISTS = 4 as const;
export const FINAL_CONTEXT_MAX_HANDOFFS = 8 as const;
export const FINAL_CONTEXT_MAX_TOOL_SUMMARIES = 12 as const;

export const GENESIS_DIMENSIONS = Object.freeze([
  'users',
  'roles',
  'workflows',
  'business-rules',
  'content',
  'monetization',
  'integrations',
  'platforms',
  'privacy',
  'accessibility',
  'deployment',
]);

export const EXTERNAL_DEPENDENCY_STATES = Object.freeze(['unresolved', 'satisfied', 'blocked'] as const);
export const CONTEXT_SOURCE_KINDS = Object.freeze(['repository-file', 'document'] as const);
export const CONTEXT_SOURCE_FORMATS = Object.freeze([
  'text', 'markdown', 'json', 'javascript', 'typescript', 'jsx', 'tsx',
] as const);

export type GenesisDimension = (typeof GENESIS_DIMENSIONS)[number];
export type ExternalDependencyState = (typeof EXTERNAL_DEPENDENCY_STATES)[number];
export type ContextSourceKind = (typeof CONTEXT_SOURCE_KINDS)[number];
export type ContextSourceFormat = (typeof CONTEXT_SOURCE_FORMATS)[number];

export interface GenesisDecisionInput {
  readonly dimension: GenesisDimension;
  readonly statement: string;
  readonly sourceRefs: readonly string[];
}

export interface ExternalDependencyInput {
  readonly id: string;
  readonly description: string;
  readonly owner: 'user' | 'project' | 'external-system';
  readonly state: ExternalDependencyState;
  readonly sourceRefs: readonly string[];
}

export interface RepresentativeJourneyInput {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly string[];
  readonly acceptanceRequirementIds: readonly string[];
  readonly sourceRefs: readonly string[];
}

export interface GenesisDiscoveryInput {
  readonly applicableDimensions: readonly GenesisDimension[];
  readonly decisions: readonly GenesisDecisionInput[];
  readonly externalDependencies: readonly ExternalDependencyInput[];
}

export interface GenesisDiscoveryPlan {
  readonly schema: typeof GENESIS_DISCOVERY_SCHEMA;
  readonly build: typeof FINAL_CONTEXT_ENGINE_BUILD;
  readonly applicableDimensions: readonly GenesisDimension[];
  readonly coveredDimensions: readonly GenesisDimension[];
  readonly unresolvedDimensions: readonly GenesisDimension[];
  readonly unresolvedExternalDependencyIds: readonly string[];
  readonly complete: boolean;
  readonly adaptive: true;
  readonly deterministic: true;
  readonly engineeringQuestionsExcluded: true;
  readonly inventionAllowed: false;
}

export interface ProductAcceptanceCriterion {
  readonly id: string;
  readonly requirementId: string;
  readonly statement: string;
  readonly sourceRef: string;
}

export interface ProductContractInput extends GenesisDiscoveryInput {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly revision: number;
  readonly spec: RequirementSpec;
  readonly journeys: readonly RepresentativeJourneyInput[];
  readonly sourceRefs: readonly string[];
}

export interface ProductContract {
  readonly schema: typeof PRODUCT_CONTRACT_SCHEMA;
  readonly build: typeof FINAL_CONTEXT_ENGINE_BUILD;
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly revision: number;
  readonly sourceSpecDigest: string;
  readonly goals: readonly string[];
  readonly requirements: readonly string[];
  readonly constraints: readonly string[];
  readonly nonGoals: readonly string[];
  readonly context: readonly string[];
  readonly decisions: readonly GenesisDecisionInput[];
  readonly externalDependencies: readonly ExternalDependencyInput[];
  readonly acceptanceCriteria: readonly ProductAcceptanceCriterion[];
  readonly representativeJourneys: readonly RepresentativeJourneyInput[];
  readonly discovery: GenesisDiscoveryPlan;
  readonly sourceRefs: readonly string[];
  readonly readiness: 'ready' | 'blocked';
  readonly authoritative: true;
  readonly truthRole: 'product-intent-authority';
  readonly durable: true;
  readonly unresolvedDecisionsRecorded: true;
  readonly externalFactsNeverInvented: true;
  readonly architectureAuthority: false;
  readonly gitAuthority: false;
  readonly validationAuthority: false;
  readonly capabilityAuthority: false;
  readonly executionAuthority: false;
}

export interface ContextSourceInput {
  readonly id: string;
  readonly projectId: string;
  readonly kind: ContextSourceKind;
  readonly format: ContextSourceFormat;
  readonly path: string;
  readonly title: string;
  readonly content: string;
  readonly sourceRef: string;
  readonly semanticLabels?: readonly string[];
}

export interface ContextChunk {
  readonly id: string;
  readonly sourceId: string;
  readonly projectId: string;
  readonly sourceRef: string;
  readonly path: string;
  readonly title: string;
  readonly format: ContextSourceFormat;
  readonly ordinal: number;
  readonly startLine: number;
  readonly endLine: number;
  readonly content: string;
  readonly lexicalTerms: readonly string[];
  readonly semanticLabels: readonly string[];
  readonly structuralLabels: readonly string[];
  readonly promptInjectionShaped: boolean;
  readonly authority: 'data-only';
}

export interface KnowledgeCorpus {
  readonly schema: typeof KNOWLEDGE_CORPUS_SCHEMA;
  readonly build: typeof FINAL_CONTEXT_ENGINE_BUILD;
  readonly projectId: string;
  readonly sourceCount: number;
  readonly chunkCount: number;
  readonly sourceCharacterCount: number;
  readonly chunks: readonly ContextChunk[];
  readonly promptInjectionShapedChunkIds: readonly string[];
  readonly supportedRepositoryIngestion: true;
  readonly supportedDocumentIngestion: true;
  readonly hardenedParsing: true;
  readonly sanitization: true;
  readonly lexicalIndex: true;
  readonly semanticIndex: true;
  readonly structuralIndex: true;
  readonly promptInjectionContentAuthority: false;
  readonly deterministic: true;
  readonly localFirst: true;
  readonly networkAuthority: false;
  readonly filesystemAuthority: false;
  readonly aiExecution: false;
}

export interface KnowledgeQueryInput {
  readonly projectId: string;
  readonly textTerms: readonly string[];
  readonly semanticTerms?: readonly string[];
  readonly structuralSelectors?: readonly string[];
  readonly maxChunks?: number;
  readonly maxCharacters?: number;
}

export interface KnowledgePackChunk {
  readonly chunkId: string;
  readonly sourceRef: string;
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly excerpt: string;
  readonly score: number;
  readonly reasons: readonly ('lexical' | 'semantic' | 'structural')[];
  readonly promptInjectionShaped: boolean;
}

export interface KnowledgePack {
  readonly schema: typeof KNOWLEDGE_PACK_SCHEMA;
  readonly build: typeof FINAL_CONTEXT_ENGINE_BUILD;
  readonly projectId: string;
  readonly query: KnowledgeQueryInput;
  readonly chunks: readonly KnowledgePackChunk[];
  readonly sourceRefs: readonly string[];
  readonly characterCount: number;
  readonly truncated: boolean;
  readonly lexicalRetrieval: true;
  readonly semanticRetrieval: true;
  readonly structuralRetrieval: true;
  readonly progressiveDisclosure: true;
  readonly sourceGrounded: true;
  readonly bounded: true;
  readonly wholesaleContextDump: false;
  readonly promptInjectionContentAuthority: false;
}

export interface SpecialistContextCandidate {
  readonly id: string;
  readonly domains: readonly string[];
  readonly specialties: readonly string[];
  readonly summary: string;
  readonly methods: readonly string[];
  readonly provenanceRefs: readonly string[];
}

export interface SpecialistContextBrief {
  readonly id: string;
  readonly summary: string;
  readonly methods: readonly string[];
  readonly provenanceRefs: readonly string[];
  readonly authorityGranted: false;
}

export interface TypedContextHandoff {
  readonly schema: typeof TYPED_HANDOFF_SCHEMA;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly taskId: string;
  readonly objective: string;
  readonly productContractRefs: readonly string[];
  readonly findings: readonly string[];
  readonly attemptedApproaches: readonly string[];
  readonly failedApproaches: readonly string[];
  readonly openQuestions: readonly string[];
  readonly nextAction: string;
  readonly evidenceRefs: readonly string[];
  readonly scopeRefs: readonly string[];
  readonly degradedContext: boolean;
  readonly authorityGranted: false;
}

export interface LossBoundedToolSummary {
  readonly schema: typeof TOOL_SUMMARY_SCHEMA;
  readonly toolCallId: string;
  readonly summary: string;
  readonly evidenceRef: string;
  readonly omittedCharacters: number;
  readonly expandable: true;
  readonly authorityGranted: false;
}

export interface ActiveTaskContext {
  readonly id: string;
  readonly objective: string;
  readonly textTerms: readonly string[];
  readonly semanticTerms?: readonly string[];
  readonly structuralSelectors?: readonly string[];
}

export interface FinalContextInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly task: ActiveTaskContext;
  readonly productContract: ProductContract;
  readonly corpus: KnowledgeCorpus;
  readonly knowledgeGraph: ProjectKnowledgeGraph;
  readonly memory: readonly ProjectMemoryEntry[];
  readonly specialists: readonly SpecialistContextCandidate[];
  readonly handoffs: readonly TypedContextHandoff[];
  readonly toolSummaries: readonly LossBoundedToolSummary[];
  readonly maxCharacters?: number;
}

export interface FinalContext {
  readonly schema: typeof FINAL_CONTEXT_SCHEMA;
  readonly build: typeof FINAL_CONTEXT_ENGINE_BUILD;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly task: ActiveTaskContext;
  readonly productContractRef: string;
  readonly acceptanceCriteria: readonly ProductAcceptanceCriterion[];
  readonly representativeJourneys: readonly RepresentativeJourneyInput[];
  readonly unresolvedExternalDependencies: readonly ExternalDependencyInput[];
  readonly knowledgePack: KnowledgePack;
  readonly graph: ProjectKnowledgeQueryResult;
  readonly memory: readonly ProjectMemoryEntry[];
  readonly specialistBriefs: readonly SpecialistContextBrief[];
  readonly handoffs: readonly TypedContextHandoff[];
  readonly toolSummaries: readonly LossBoundedToolSummary[];
  readonly sourceRefs: readonly string[];
  readonly characterCount: number;
  readonly truncated: boolean;
  readonly bounded: true;
  readonly progressiveDisclosure: true;
  readonly taskRelevantOnly: true;
  readonly wholesaleContextDump: false;
  readonly productContractAuthorityPreserved: true;
  readonly memoryAuthority: false;
  readonly specialistAuthority: false;
  readonly handoffAuthority: false;
  readonly toolSummaryAuthority: false;
  readonly promptInjectionContentAuthority: false;
  readonly optionalLlmConsolidationAllowed: true;
  readonly optionalLlmConsolidationAuthoritative: false;
  readonly optionalLlmConsolidationMayWriteMemoryTruth: false;
  readonly localFirst: true;
  readonly vortexManagedPaidInferenceRequired: false;
  readonly networkAuthority: false;
  readonly executionAuthority: false;
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const ID = /^[a-z][a-z0-9._:/#-]{0,255}$/;
const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}._:/#-]{1,63}/gu;
const STOP_TERMS: ReadonlySet<string> = new Set([
  'a','an','and','are','as','at','be','by','for','from','has','have','in','is','it','of','on','or','that','the','this','to','was','were','will','with','you','your',
  'a','as','o','os','e','ou','de','da','das','do','dos','em','no','na','nos','nas','um','uma','uns','umas','para','por','com','sem','que','se','ser','é','ao','aos','à','às','como','mais','menos',
] as const);
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions|rules)/i,
  /(?:system|developer)\s+(?:message|prompt|instructions?)\s*:/i,
  /you\s+are\s+(?:chatgpt|an?\s+assistant|the\s+system)/i,
  /reveal\s+(?:the\s+)?(?:system|developer)\s+(?:prompt|message)/i,
  /override\s+(?:the\s+)?(?:system|developer|security|policy)/i,
] as const;
const DIMENSIONS = new Set<GenesisDimension>(GENESIS_DIMENSIONS);
const DEP_STATES = new Set<ExternalDependencyState>(EXTERNAL_DEPENDENCY_STATES);
const SOURCE_KINDS = new Set<ContextSourceKind>(CONTEXT_SOURCE_KINDS);
const SOURCE_FORMATS = new Set<ContextSourceFormat>(CONTEXT_SOURCE_FORMATS);

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a string.');
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (!normalized || normalized.length > max || CONTROL.test(normalized)) throw new TypeError(label + ' is invalid.');
  return normalized;
}

function canonicalId(value: unknown, label: string): string {
  const normalized = boundedText(value, label, 256).toLowerCase();
  if (!ID.test(normalized)) throw new TypeError(label + ' is invalid.');
  return normalized;
}

function uniqueStrings(value: unknown, label: string, maxItems: number, maxChars = 1024, allowEmpty = true): readonly string[] {
  if (!Array.isArray(value) || value.length > maxItems || (!allowEmpty && value.length === 0)) {
    throw new RangeError(label + ' has an invalid number of entries.');
  }
  const normalized = value.map((item, index) => boundedText(item, label + ' ' + (index + 1), maxChars));
  if (new Set(normalized).size !== normalized.length) throw new TypeError(label + ' contains duplicates.');
  return Object.freeze(normalized);
}

function terms(text: string): readonly string[] {
  const matches = text.normalize('NFC').toLowerCase().match(TOKEN) ?? [];
  return Object.freeze([
    ...new Set(matches.filter((term) => term.length >= 2 && !STOP_TERMS.has(term))),
  ].sort());
}

function sourceRefs(value: unknown, label: string, allowEmpty = false): readonly string[] {
  return uniqueStrings(value, label, 128, 1024, allowEmpty);
}

function normalizeDecision(input: GenesisDecisionInput): GenesisDecisionInput {
  if (!DIMENSIONS.has(input.dimension)) throw new TypeError('Genesis decision dimension is invalid.');
  return Object.freeze({
    dimension: input.dimension,
    statement: boundedText(input.statement, 'Genesis decision statement', 8_192),
    sourceRefs: sourceRefs(input.sourceRefs, 'Genesis decision sourceRefs'),
  });
}

function normalizeDependency(input: ExternalDependencyInput): ExternalDependencyInput {
  if (!DEP_STATES.has(input.state)) throw new TypeError('External dependency state is invalid.');
  if (!['user', 'project', 'external-system'].includes(input.owner)) throw new TypeError('External dependency owner is invalid.');
  return Object.freeze({
    id: canonicalId(input.id, 'External dependency id'),
    description: boundedText(input.description, 'External dependency description', 8_192),
    owner: input.owner,
    state: input.state,
    sourceRefs: sourceRefs(input.sourceRefs, 'External dependency sourceRefs'),
  });
}

function assertRequirementSpec(spec: RequirementSpec): void {
  if (!spec || typeof spec !== 'object' || spec.schema !== 'gd-requirement-spec/1') {
    throw new TypeError('Product Contract requires canonical Requirement Compiler output.');
  }
  if (!spec.sourceDigest || spec.sourceDigest.algorithm !== 'sha256' || !/^[0-9a-f]{64}$/.test(spec.sourceDigest.hex)) {
    throw new TypeError('Product Contract Requirement Spec digest is invalid.');
  }
  if (!Array.isArray(spec.items) || spec.items.length > 4096) throw new RangeError('Product Contract Requirement Spec items are invalid.');
}

function normalizeJourney(input: RepresentativeJourneyInput, acceptanceIds: ReadonlySet<string>): RepresentativeJourneyInput {
  const acceptanceRequirementIds = uniqueStrings(
    input.acceptanceRequirementIds,
    'Representative journey acceptanceRequirementIds',
    128,
    256,
  );
  for (const id of acceptanceRequirementIds) {
    if (!acceptanceIds.has(id)) throw new TypeError('Representative journey references an unknown acceptance requirement.');
  }
  return Object.freeze({
    id: canonicalId(input.id, 'Representative journey id'),
    title: boundedText(input.title, 'Representative journey title', 512),
    steps: uniqueStrings(input.steps, 'Representative journey steps', 256, 2_048, false),
    acceptanceRequirementIds,
    sourceRefs: sourceRefs(input.sourceRefs, 'Representative journey sourceRefs'),
  });
}

export function createGenesisDiscoveryPlan(input: GenesisDiscoveryInput): GenesisDiscoveryPlan {
  if (!input || typeof input !== 'object') throw new TypeError('Project Genesis discovery input must be an object.');
  if (!Array.isArray(input.applicableDimensions) || input.applicableDimensions.length === 0) {
    throw new TypeError('Project Genesis requires at least one applicable product dimension.');
  }
  if (input.applicableDimensions.some((dimension) => !DIMENSIONS.has(dimension))) {
    throw new TypeError('Project Genesis applicable dimension is invalid.');
  }
  const applicable = [...new Set(input.applicableDimensions)].sort() as GenesisDimension[];
  const decisions = input.decisions.map(normalizeDecision);
  const covered = applicable.filter((dimension) => decisions.some((decision) => decision.dimension === dimension));
  const unresolvedDimensions = applicable.filter((dimension) => !covered.includes(dimension));
  const dependencies = input.externalDependencies.map(normalizeDependency);
  const unresolvedExternalDependencyIds = dependencies
    .filter((dependency) => dependency.state !== 'satisfied')
    .map((dependency) => dependency.id)
    .sort();
  return Object.freeze({
    schema: GENESIS_DISCOVERY_SCHEMA,
    build: FINAL_CONTEXT_ENGINE_BUILD,
    applicableDimensions: Object.freeze(applicable),
    coveredDimensions: Object.freeze(covered),
    unresolvedDimensions: Object.freeze(unresolvedDimensions),
    unresolvedExternalDependencyIds: Object.freeze(unresolvedExternalDependencyIds),
    complete: unresolvedDimensions.length === 0,
    adaptive: true,
    deterministic: true,
    engineeringQuestionsExcluded: true,
    inventionAllowed: false,
  });
}

export function compileProductContract(input: ProductContractInput): ProductContract {
  if (!input || typeof input !== 'object') throw new TypeError('Product Contract input must be an object.');
  assertRequirementSpec(input.spec);
  if (!Number.isInteger(input.revision) || input.revision < 1) throw new TypeError('Product Contract revision is invalid.');

  const workspaceId = canonicalId(input.workspaceId, 'Product Contract workspaceId');
  const projectId = canonicalId(input.projectId, 'Product Contract projectId');
  const id = canonicalId(input.id, 'Product Contract id');
  const discovery = createGenesisDiscoveryPlan(input);
  const decisions = Object.freeze(input.decisions.map(normalizeDecision));
  const dependencies = Object.freeze(input.externalDependencies.map(normalizeDependency));
  if (new Set(dependencies.map((dependency) => dependency.id)).size !== dependencies.length) {
    throw new TypeError('Product Contract external dependency ids must be unique.');
  }

  const byKind = (kind: RequirementItem['kind']): readonly RequirementItem[] =>
    Object.freeze(input.spec.items.filter((item) => item.kind === kind));
  const acceptanceItems = byKind('acceptance');
  const acceptanceIds = new Set(acceptanceItems.map((item) => item.id));
  const acceptanceCriteria = Object.freeze(acceptanceItems.map((item, index) => Object.freeze({
    id: 'ac-' + String(index + 1).padStart(4, '0'),
    requirementId: item.id,
    statement: item.statement,
    sourceRef: 'requirement:' + item.id + ':lines:' + item.startLine + '-' + item.endLine,
  })));
  const journeys = Object.freeze(input.journeys.map((journey) => normalizeJourney(journey, acceptanceIds)));
  if (new Set(journeys.map((journey) => journey.id)).size !== journeys.length) {
    throw new TypeError('Product Contract representative journey ids must be unique.');
  }

  const unresolvedExternal = dependencies.some((dependency) => dependency.state !== 'satisfied');
  const readiness = discovery.complete && acceptanceCriteria.length > 0 && journeys.length > 0 && !unresolvedExternal
    ? 'ready'
    : 'blocked';

  return Object.freeze({
    schema: PRODUCT_CONTRACT_SCHEMA,
    build: FINAL_CONTEXT_ENGINE_BUILD,
    id,
    workspaceId,
    projectId,
    revision: input.revision,
    sourceSpecDigest: input.spec.sourceDigest.hex,
    goals: Object.freeze(byKind('goal').map((item) => item.statement)),
    requirements: Object.freeze(byKind('requirement').map((item) => item.statement)),
    constraints: Object.freeze(byKind('constraint').map((item) => item.statement)),
    nonGoals: Object.freeze(byKind('non-goal').map((item) => item.statement)),
    context: Object.freeze(byKind('context').map((item) => item.statement)),
    decisions,
    externalDependencies: dependencies,
    acceptanceCriteria,
    representativeJourneys: journeys,
    discovery,
    sourceRefs: sourceRefs(input.sourceRefs, 'Product Contract sourceRefs'),
    readiness,
    authoritative: true,
    truthRole: 'product-intent-authority',
    durable: true,
    unresolvedDecisionsRecorded: true,
    externalFactsNeverInvented: true,
    architectureAuthority: false,
    gitAuthority: false,
    validationAuthority: false,
    capabilityAuthority: false,
    executionAuthority: false,
  });
}

function sanitizeSourceContent(content: string): string {
  const normalized = content.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  if (CONTROL.test(normalized)) throw new TypeError('Context source contains unsupported control characters.');
  return normalized.trim();
}

function structuralLabels(input: ContextSourceInput, content: string): readonly string[] {
  const labels = new Set<string>();
  for (const part of input.path.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) labels.add(part);
  for (const label of input.semanticLabels ?? []) for (const term of terms(label)) labels.add(term);
  const lines = content.split('\n');
  for (const line of lines) {
    const heading = /^\s{0,3}#{1,6}\s+(.+)$/.exec(line);
    if (heading) for (const term of terms(heading[1]!)) labels.add(term);
    if (['javascript', 'typescript', 'jsx', 'tsx'].includes(input.format)) {
      const symbol = /\b(?:class|interface|type|function|const|let|var|enum)\s+([A-Za-z_$][\w$]*)/.exec(line);
      if (symbol) labels.add(symbol[1]!.toLowerCase());
    }
  }
  return Object.freeze([...labels].sort().slice(0, 256));
}

function chunkSource(input: ContextSourceInput, content: string): readonly ContextChunk[] {
  const lines = content.split('\n');
  const sharedLabels = structuralLabels(input, content);
  const chunks: ContextChunk[] = [];
  let start = 0;
  while (start < lines.length) {
    let end = start;
    let value = '';
    while (end < lines.length) {
      const candidate = value.length === 0 ? lines[end]! : value + '\n' + lines[end]!;
      if (candidate.length > CONTEXT_CHUNK_MAX_CHARACTERS && end > start) break;
      value = candidate.slice(0, CONTEXT_CHUNK_MAX_CHARACTERS);
      end += 1;
      if (value.length >= CONTEXT_CHUNK_MAX_CHARACTERS) break;
    }
    if (!value.trim()) {
      start = Math.max(end, start + 1);
      continue;
    }
    const ordinal = chunks.length + 1;
    const injection = INJECTION_PATTERNS.some((pattern) => pattern.test(value));
    const chunkTerms = terms(value);
    const semanticLabels = Object.freeze([...new Set([...sharedLabels, ...chunkTerms.slice(0, 128)])].sort());
    chunks.push(Object.freeze({
      id: input.id + '#chunk-' + String(ordinal).padStart(4, '0'),
      sourceId: input.id,
      projectId: input.projectId,
      sourceRef: input.sourceRef,
      path: input.path,
      title: input.title,
      format: input.format,
      ordinal,
      startLine: start + 1,
      endLine: end,
      content: value,
      lexicalTerms: chunkTerms,
      semanticLabels,
      structuralLabels: sharedLabels,
      promptInjectionShaped: injection,
      authority: 'data-only',
    }));
    if (end >= lines.length) break;
    start = Math.max(start + 1, end - CONTEXT_CHUNK_OVERLAP_LINES);
  }
  return Object.freeze(chunks);
}

export function compileKnowledgeCorpus(inputs: readonly ContextSourceInput[]): KnowledgeCorpus {
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > CONTEXT_SOURCE_MAX_COUNT) {
    throw new RangeError('Knowledge Compiler source count is invalid.');
  }
  const projectIds = new Set<string>();
  const chunks: ContextChunk[] = [];
  let sourceCharacters = 0;
  const ids = new Set<string>();

  for (const source of inputs) {
    if (!source || typeof source !== 'object') throw new TypeError('Knowledge Compiler source must be an object.');
    const id = canonicalId(source.id, 'Knowledge Compiler source id');
    if (ids.has(id)) throw new TypeError('Knowledge Compiler source ids must be unique.');
    ids.add(id);
    const projectId = canonicalId(source.projectId, 'Knowledge Compiler projectId');
    projectIds.add(projectId);
    if (!SOURCE_KINDS.has(source.kind)) throw new TypeError('Knowledge Compiler source kind is invalid.');
    if (!SOURCE_FORMATS.has(source.format)) throw new TypeError('Knowledge Compiler source format is invalid.');
    const path = boundedText(source.path, 'Knowledge Compiler source path', 2_048);
    if (path.includes('..') || path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) {
      throw new TypeError('Knowledge Compiler source path must be project-relative.');
    }
    const normalized: ContextSourceInput = Object.freeze({
      id,
      projectId,
      kind: source.kind,
      format: source.format,
      path,
      title: boundedText(source.title, 'Knowledge Compiler source title', 512),
      content: sanitizeSourceContent(source.content),
      sourceRef: boundedText(source.sourceRef, 'Knowledge Compiler sourceRef', 1_024),
      semanticLabels: source.semanticLabels
        ? uniqueStrings(source.semanticLabels, 'Knowledge Compiler semantic labels', 128, 128)
        : Object.freeze([]),
    });
    if (normalized.content.length > CONTEXT_SOURCE_MAX_CHARACTERS) {
      throw new RangeError('Knowledge Compiler source exceeds the per-source character limit.');
    }
    sourceCharacters += normalized.content.length;
    if (sourceCharacters > CONTEXT_CORPUS_MAX_CHARACTERS) {
      throw new RangeError('Knowledge Compiler corpus exceeds the character budget.');
    }
    chunks.push(...chunkSource(normalized, normalized.content));
  }

  if (projectIds.size !== 1) throw new TypeError('Knowledge Compiler corpus must belong to exactly one project.');
  const projectId = [...projectIds][0]!;
  const promptInjectionShapedChunkIds = chunks.filter((chunk) => chunk.promptInjectionShaped).map((chunk) => chunk.id);

  return Object.freeze({
    schema: KNOWLEDGE_CORPUS_SCHEMA,
    build: FINAL_CONTEXT_ENGINE_BUILD,
    projectId,
    sourceCount: inputs.length,
    chunkCount: chunks.length,
    sourceCharacterCount: sourceCharacters,
    chunks: Object.freeze(chunks),
    promptInjectionShapedChunkIds: Object.freeze(promptInjectionShapedChunkIds),
    supportedRepositoryIngestion: true,
    supportedDocumentIngestion: true,
    hardenedParsing: true,
    sanitization: true,
    lexicalIndex: true,
    semanticIndex: true,
    structuralIndex: true,
    promptInjectionContentAuthority: false,
    deterministic: true,
    localFirst: true,
    networkAuthority: false,
    filesystemAuthority: false,
    aiExecution: false,
  });
}

function normalizeQueryTerms(value: readonly string[] | undefined, label: string): readonly string[] {
  if (value === undefined) return Object.freeze([]);
  const normalized = uniqueStrings(value, label, 32, 128).flatMap((entry) => [...terms(entry)]);
  return Object.freeze([...new Set(normalized)].sort());
}

function intersectionCount(left: readonly string[], right: readonly string[]): number {
  const set = new Set(right);
  return left.reduce((count, item) => count + (set.has(item) ? 1 : 0), 0);
}

export function buildKnowledgePack(corpus: KnowledgeCorpus, input: KnowledgeQueryInput): KnowledgePack {
  if (corpus.schema !== KNOWLEDGE_CORPUS_SCHEMA) throw new TypeError('Knowledge Pack requires a canonical Knowledge Corpus.');
  const projectId = canonicalId(input.projectId, 'Knowledge query projectId');
  if (projectId !== corpus.projectId) throw new TypeError('Knowledge query project does not match corpus.');
  const textTerms = normalizeQueryTerms(input.textTerms, 'Knowledge query textTerms');
  const semanticTerms = normalizeQueryTerms(input.semanticTerms, 'Knowledge query semanticTerms');
  const structuralSelectors = normalizeQueryTerms(input.structuralSelectors, 'Knowledge query structuralSelectors');
  if (textTerms.length + semanticTerms.length + structuralSelectors.length === 0) {
    throw new TypeError('Knowledge query requires at least one selector.');
  }
  const maxChunks = input.maxChunks ?? 12;
  const maxCharacters = input.maxCharacters ?? 16_000;
  if (!Number.isInteger(maxChunks) || maxChunks < 1 || maxChunks > KNOWLEDGE_PACK_MAX_CHUNKS) {
    throw new RangeError('Knowledge query maxChunks is invalid.');
  }
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1_024 || maxCharacters > KNOWLEDGE_PACK_MAX_CHARACTERS) {
    throw new RangeError('Knowledge query maxCharacters is invalid.');
  }

  const ranked = corpus.chunks
    .map((chunk) => {
      const lexical = intersectionCount(chunk.lexicalTerms, textTerms);
      const semantic = intersectionCount(chunk.semanticLabels, semanticTerms);
      const structural = intersectionCount(chunk.structuralLabels, structuralSelectors);
      const score = lexical * 5 + semantic * 3 + structural * 4;
      const reasons: Array<'lexical' | 'semantic' | 'structural'> = [];
      if (lexical > 0) reasons.push('lexical');
      if (semantic > 0) reasons.push('semantic');
      if (structural > 0) reasons.push('structural');
      return { chunk, score, reasons };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));

  const selected: KnowledgePackChunk[] = [];
  let characterCount = 0;
  let truncated = ranked.length > maxChunks;
  for (const candidate of ranked) {
    if (selected.length >= maxChunks) break;
    const remaining = maxCharacters - characterCount;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const excerpt = candidate.chunk.content.slice(0, remaining);
    if (excerpt.length < candidate.chunk.content.length) truncated = true;
    selected.push(Object.freeze({
      chunkId: candidate.chunk.id,
      sourceRef: candidate.chunk.sourceRef,
      path: candidate.chunk.path,
      startLine: candidate.chunk.startLine,
      endLine: candidate.chunk.endLine,
      excerpt,
      score: candidate.score,
      reasons: Object.freeze(candidate.reasons),
      promptInjectionShaped: candidate.chunk.promptInjectionShaped,
    }));
    characterCount += excerpt.length;
    if (excerpt.length < candidate.chunk.content.length) break;
  }

  const query: KnowledgeQueryInput = Object.freeze({
    projectId,
    textTerms,
    semanticTerms,
    structuralSelectors,
    maxChunks,
    maxCharacters,
  });
  return Object.freeze({
    schema: KNOWLEDGE_PACK_SCHEMA,
    build: FINAL_CONTEXT_ENGINE_BUILD,
    projectId,
    query,
    chunks: Object.freeze(selected),
    sourceRefs: Object.freeze([...new Set(selected.map((chunk) => chunk.sourceRef))].sort()),
    characterCount,
    truncated,
    lexicalRetrieval: true,
    semanticRetrieval: true,
    structuralRetrieval: true,
    progressiveDisclosure: true,
    sourceGrounded: true,
    bounded: true,
    wholesaleContextDump: false,
    promptInjectionContentAuthority: false,
  });
}

function relevanceScore(text: string, queryTerms: readonly string[]): number {
  return intersectionCount(terms(text), queryTerms);
}

function selectSpecialists(candidates: readonly SpecialistContextCandidate[], queryTerms: readonly string[]): readonly SpecialistContextBrief[] {
  return Object.freeze(candidates
    .map((candidate) => {
      const searchable = [...candidate.domains, ...candidate.specialties, candidate.summary, ...candidate.methods].join(' ');
      return { candidate, score: relevanceScore(searchable, queryTerms) };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, FINAL_CONTEXT_MAX_SPECIALISTS)
    .map(({ candidate }) => Object.freeze({
      id: canonicalId(candidate.id, 'Specialist context id'),
      summary: boundedText(candidate.summary, 'Specialist context summary', 2_048),
      methods: uniqueStrings(candidate.methods, 'Specialist context methods', 24, 1_024),
      provenanceRefs: sourceRefs(candidate.provenanceRefs, 'Specialist context provenanceRefs'),
      authorityGranted: false as const,
    })));
}

export function normalizeTypedHandoff(value: TypedContextHandoff): TypedContextHandoff {
  if (!value || value.schema !== TYPED_HANDOFF_SCHEMA) throw new TypeError('Typed handoff schema is invalid.');
  return Object.freeze({
    schema: TYPED_HANDOFF_SCHEMA,
    workspaceId: canonicalId(value.workspaceId, 'Handoff workspaceId'),
    projectId: canonicalId(value.projectId, 'Handoff projectId'),
    taskId: canonicalId(value.taskId, 'Handoff taskId'),
    objective: boundedText(value.objective, 'Handoff objective', 4_096),
    productContractRefs: sourceRefs(value.productContractRefs, 'Handoff Product Contract refs', true),
    findings: uniqueStrings(value.findings, 'Handoff findings', 64, 2_048),
    attemptedApproaches: uniqueStrings(value.attemptedApproaches, 'Handoff attempted approaches', 32, 2_048),
    failedApproaches: uniqueStrings(value.failedApproaches, 'Handoff failed approaches', 32, 2_048),
    openQuestions: uniqueStrings(value.openQuestions, 'Handoff open questions', 32, 2_048),
    nextAction: boundedText(value.nextAction, 'Handoff next action', 2_048),
    evidenceRefs: sourceRefs(value.evidenceRefs, 'Handoff evidence refs', true),
    scopeRefs: sourceRefs(value.scopeRefs, 'Handoff scope refs', true),
    degradedContext: value.degradedContext === true,
    authorityGranted: false,
  });
}

export function normalizeToolSummary(value: LossBoundedToolSummary): LossBoundedToolSummary {
  if (!value || value.schema !== TOOL_SUMMARY_SCHEMA) throw new TypeError('Tool summary schema is invalid.');
  if (!Number.isInteger(value.omittedCharacters) || value.omittedCharacters < 0) {
    throw new TypeError('Tool summary omittedCharacters is invalid.');
  }
  return Object.freeze({
    schema: TOOL_SUMMARY_SCHEMA,
    toolCallId: canonicalId(value.toolCallId, 'Tool summary toolCallId'),
    summary: boundedText(value.summary, 'Tool summary', 4_096),
    evidenceRef: boundedText(value.evidenceRef, 'Tool summary evidenceRef', 1_024),
    omittedCharacters: value.omittedCharacters,
    expandable: true,
    authorityGranted: false,
  });
}

function approximateCharacters(value: unknown): number {
  return JSON.stringify(value).length;
}

export function assembleFinalContext(input: FinalContextInput): FinalContext {
  if (!input || typeof input !== 'object') throw new TypeError('Final Context input must be an object.');
  const workspaceId = canonicalId(input.workspaceId, 'Final Context workspaceId');
  const projectId = canonicalId(input.projectId, 'Final Context projectId');
  if (input.productContract.schema !== PRODUCT_CONTRACT_SCHEMA
      || input.productContract.workspaceId !== workspaceId
      || input.productContract.projectId !== projectId) {
    throw new TypeError('Final Context Product Contract does not match active project/workspace.');
  }
  if (input.corpus.schema !== KNOWLEDGE_CORPUS_SCHEMA || input.corpus.projectId !== projectId) {
    throw new TypeError('Final Context Knowledge Corpus does not match active project.');
  }
  if (input.knowledgeGraph.projectId !== projectId) {
    throw new TypeError('Final Context Knowledge Graph does not match active project.');
  }

  const task: ActiveTaskContext = Object.freeze({
    id: canonicalId(input.task.id, 'Final Context task id'),
    objective: boundedText(input.task.objective, 'Final Context task objective', 4_096),
    textTerms: normalizeQueryTerms(input.task.textTerms, 'Final Context task textTerms'),
    semanticTerms: normalizeQueryTerms(input.task.semanticTerms, 'Final Context task semanticTerms'),
    structuralSelectors: normalizeQueryTerms(input.task.structuralSelectors, 'Final Context task structuralSelectors'),
  });
  const queryTerms = Object.freeze([...new Set([
    ...task.textTerms,
    ...(task.semanticTerms ?? []),
    ...terms(task.objective),
  ])].sort());
  if (queryTerms.length === 0) throw new TypeError('Final Context active task has no usable retrieval terms.');

  const maxCharacters = input.maxCharacters ?? 40_000;
  if (!Number.isInteger(maxCharacters) || maxCharacters < 8_192 || maxCharacters > FINAL_CONTEXT_MAX_CHARACTERS) {
    throw new RangeError('Final Context maxCharacters is invalid.');
  }

  const knowledgePack = buildKnowledgePack(input.corpus, {
    projectId,
    textTerms: task.textTerms,
    semanticTerms: task.semanticTerms,
    structuralSelectors: task.structuralSelectors,
    maxChunks: 12,
    maxCharacters: Math.min(16_000, Math.floor(maxCharacters * 0.45)),
  });

  const graphTerms = queryTerms.slice(0, 8);
  const graph = queryProjectKnowledgeGraph(input.knowledgeGraph, {
    textTerms: graphTerms,
    depth: 2,
    maxNodes: 48,
    maxEdges: 96,
  });

  const acceptanceCriteria = Object.freeze(input.productContract.acceptanceCriteria
    .map((criterion) => ({ criterion, score: relevanceScore(criterion.statement, queryTerms) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.criterion.id.localeCompare(b.criterion.id))
    .slice(0, 16)
    .map((candidate) => candidate.criterion));

  const representativeJourneys = Object.freeze(input.productContract.representativeJourneys
    .map((journey) => ({
      journey,
      score: relevanceScore(journey.title + ' ' + journey.steps.join(' '), queryTerms),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.journey.id.localeCompare(b.journey.id))
    .slice(0, 8)
    .map((candidate) => candidate.journey));

  const unresolvedExternalDependencies = Object.freeze(input.productContract.externalDependencies
    .filter((dependency) => dependency.state !== 'satisfied'));

  const memory = Object.freeze(input.memory
    .filter((entry) => entry.workspaceId === workspaceId)
    .map((entry) => ({
      entry,
      score: relevanceScore(entry.statement, queryTerms)
        + (entry.kind === 'unresolved-question' ? 1 : 0)
        + (entry.kind === 'decision' ? 1 : 0),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, 16)
    .map((candidate) => candidate.entry));

  const specialistBriefs = selectSpecialists(input.specialists, queryTerms);
  const handoffs = Object.freeze(input.handoffs
    .filter((handoff) => handoff.workspaceId === workspaceId && handoff.projectId === projectId)
    .slice(0, FINAL_CONTEXT_MAX_HANDOFFS)
    .map(normalizeTypedHandoff));
  const toolSummaries = Object.freeze(input.toolSummaries
    .slice(0, FINAL_CONTEXT_MAX_TOOL_SUMMARIES)
    .map(normalizeToolSummary));

  const projected = {
    task,
    acceptanceCriteria,
    representativeJourneys,
    unresolvedExternalDependencies,
    knowledgePack,
    graph,
    memory,
    specialistBriefs,
    handoffs,
    toolSummaries,
  };
  let characterCount = approximateCharacters(projected);
  let truncated = knowledgePack.truncated || graph.truncated;
  let finalMemory = memory;
  let finalHandoffs = handoffs;
  let finalToolSummaries = toolSummaries;

  while (characterCount > maxCharacters && finalMemory.length > 0) {
    finalMemory = Object.freeze(finalMemory.slice(0, -1));
    characterCount = approximateCharacters({ ...projected, memory: finalMemory, handoffs: finalHandoffs, toolSummaries: finalToolSummaries });
    truncated = true;
  }
  while (characterCount > maxCharacters && finalToolSummaries.length > 0) {
    finalToolSummaries = Object.freeze(finalToolSummaries.slice(0, -1));
    characterCount = approximateCharacters({ ...projected, memory: finalMemory, handoffs: finalHandoffs, toolSummaries: finalToolSummaries });
    truncated = true;
  }
  while (characterCount > maxCharacters && finalHandoffs.length > 0) {
    finalHandoffs = Object.freeze(finalHandoffs.slice(0, -1));
    characterCount = approximateCharacters({ ...projected, memory: finalMemory, handoffs: finalHandoffs, toolSummaries: finalToolSummaries });
    truncated = true;
  }
  if (characterCount > maxCharacters) {
    throw new RangeError('Final Context mandatory evidence exceeds the requested character budget.');
  }

  const sourceRefSet = new Set<string>([
    ...input.productContract.sourceRefs,
    ...knowledgePack.sourceRefs,
    ...graph.sourceRefs,
    ...finalMemory.flatMap((entry) => entry.sourceRefs),
    ...specialistBriefs.flatMap((brief) => brief.provenanceRefs),
    ...finalHandoffs.flatMap((handoff) => handoff.evidenceRefs),
    ...finalToolSummaries.map((summary) => summary.evidenceRef),
  ]);

  return Object.freeze({
    schema: FINAL_CONTEXT_SCHEMA,
    build: FINAL_CONTEXT_ENGINE_BUILD,
    workspaceId,
    projectId,
    task,
    productContractRef: 'product-contract:' + input.productContract.id + ':rev:' + input.productContract.revision,
    acceptanceCriteria,
    representativeJourneys,
    unresolvedExternalDependencies,
    knowledgePack,
    graph,
    memory: finalMemory,
    specialistBriefs,
    handoffs: finalHandoffs,
    toolSummaries: finalToolSummaries,
    sourceRefs: Object.freeze([...sourceRefSet].sort()),
    characterCount,
    truncated,
    bounded: true,
    progressiveDisclosure: true,
    taskRelevantOnly: true,
    wholesaleContextDump: false,
    productContractAuthorityPreserved: true,
    memoryAuthority: false,
    specialistAuthority: false,
    handoffAuthority: false,
    toolSummaryAuthority: false,
    promptInjectionContentAuthority: false,
    optionalLlmConsolidationAllowed: true,
    optionalLlmConsolidationAuthoritative: false,
    optionalLlmConsolidationMayWriteMemoryTruth: false,
    localFirst: true,
    vortexManagedPaidInferenceRequired: false,
    networkAuthority: false,
    executionAuthority: false,
  });
}
