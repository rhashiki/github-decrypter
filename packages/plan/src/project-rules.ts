export const PROJECT_RULES_BUILD = 50 as const;
export const PROJECT_RULES_SCHEMA = 'gd-project-rules/1' as const;
export const PROJECT_RULE_SCHEMA = 'gd-project-rule/1' as const;
export const PROJECT_RULES_STAGE_SCHEMA = 'gd-project-rules-stage/1' as const;
export const PROJECT_RULES_WORKSPACE_SCHEMA = 'gd-workspace/1' as const;
export const PROJECT_RULES_DIGEST_ALGORITHM = 'sha256' as const;
export const PROJECT_RULES_MAX_RULES = 256 as const;
export const PROJECT_RULES_MAX_STATEMENT_CHARACTERS = 8192 as const;

export const PROJECT_RULE_CATEGORIES = [
  'architecture', 'dependency', 'code', 'database', 'testing', 'deployment', 'security', 'workflow',
] as const;
export type ProjectRuleCategory = (typeof PROJECT_RULE_CATEGORIES)[number];

export const PROJECT_RULE_DIRECTIVES = ['require', 'forbid', 'prefer'] as const;
export type ProjectRuleDirective = (typeof PROJECT_RULE_DIRECTIVES)[number];

export const PROJECT_RULE_STAGES = ['plan', 'decision', 'build'] as const;
export type ProjectRuleStage = (typeof PROJECT_RULE_STAGES)[number];

export interface ProjectRuleInput {
  readonly category: ProjectRuleCategory;
  readonly directive: ProjectRuleDirective;
  readonly statement: string;
  readonly stages: readonly ProjectRuleStage[];
}

export interface ProjectRulesInput {
  readonly workspaceId: string;
  readonly rules: readonly ProjectRuleInput[];
}

export interface ProjectRule {
  readonly schema: typeof PROJECT_RULE_SCHEMA;
  readonly id: string;
  readonly ordinal: number;
  readonly category: ProjectRuleCategory;
  readonly directive: ProjectRuleDirective;
  readonly statement: string;
  readonly stages: readonly ProjectRuleStage[];
  readonly mandatory: boolean;
}

export interface ProjectRulesDigest {
  readonly algorithm: typeof PROJECT_RULES_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface ProjectRulesRecord {
  readonly schema: typeof PROJECT_RULES_SCHEMA;
  readonly workspaceSchema: typeof PROJECT_RULES_WORKSPACE_SCHEMA;
  readonly workspaceId: string;
  readonly id: string;
  readonly revision: 1;
  readonly rulesDigest: ProjectRulesDigest;
  readonly rules: readonly ProjectRule[];
  readonly workspaceScoped: true;
  readonly readOnly: true;
  readonly deterministic: true;
  readonly structuredRulesOnly: true;
  readonly semanticInference: false;
  readonly automaticComplianceDecision: false;
  readonly planReadOnlyPreserved: true;
  readonly decisionEngineCompatible: true;
  readonly projectRulesApplied: true;
  readonly impactSimulationApplied: false;
  readonly buildTransitionAuthorized: false;
  readonly buildOrchestration: false;
  readonly toolExecution: false;
  readonly scopeIntelligence: false;
  readonly scopeLock: false;
  readonly checkpoints: false;
  readonly validationPipeline: false;
  readonly execution: false;
  readonly scheduling: false;
}

export interface ProjectRulesStageInput {
  readonly rules: ProjectRulesRecord;
  readonly stage: ProjectRuleStage;
}

export interface ProjectRulesStageSelection {
  readonly schema: typeof PROJECT_RULES_STAGE_SCHEMA;
  readonly sourceRulesId: string;
  readonly sourceRulesDigest: ProjectRulesDigest;
  readonly workspaceId: string;
  readonly stage: ProjectRuleStage;
  readonly rules: readonly ProjectRule[];
  readonly mandatoryRules: readonly ProjectRule[];
  readonly advisoryRules: readonly ProjectRule[];
  readonly semanticEvaluation: false;
  readonly impactSimulationApplied: false;
  readonly buildTransitionAuthorized: false;
  readonly execution: false;
}

const SHA256_K = Object.freeze([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
] as const);

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

function sha256Hex(text: string): string {
  const input = new TextEncoder().encode(text);
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const bitLength = input.length * 8;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const x=words[i-15]!, y=words[i-2]!;
      const s0=rotateRight(x,7)^rotateRight(x,18)^(x>>>3), s1=rotateRight(y,17)^rotateRight(y,19)^(y>>>10);
      words[i]=(words[i-16]!+s0+words[i-7]!+s1)>>>0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let i=0;i<64;i+=1) {
      const s1=rotateRight(e,6)^rotateRight(e,11)^rotateRight(e,25), ch=(e&f)^(~e&g);
      const t1=(h+s1+ch+SHA256_K[i]!+words[i]!)>>>0;
      const s0=rotateRight(a,2)^rotateRight(a,13)^rotateRight(a,22), maj=(a&b)^(a&c)^(b&c), t2=(s0+maj)>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map((value)=>value.toString(16).padStart(8,'0')).join('');
}

function normalizeStatement(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (!normalized) throw new TypeError(`${label} must not be empty.`);
  if (normalized.length > PROJECT_RULES_MAX_STATEMENT_CHARACTERS) throw new RangeError(`${label} exceeds the Project Rules statement limit.`);
  return normalized;
}

function workspaceId(value: unknown): string {
  if (typeof value !== 'string' || !/^gd_ws_[0-9a-f-]{36}$/i.test(value)) {
    throw new TypeError('Project Rules workspaceId must use the canonical gd_ws_<uuid> format.');
  }
  return value.toLowerCase();
}

function category(value: unknown): ProjectRuleCategory {
  if (typeof value !== 'string' || !(PROJECT_RULE_CATEGORIES as readonly string[]).includes(value)) throw new TypeError('Project Rule category is invalid.');
  return value as ProjectRuleCategory;
}

function directive(value: unknown): ProjectRuleDirective {
  if (typeof value !== 'string' || !(PROJECT_RULE_DIRECTIVES as readonly string[]).includes(value)) throw new TypeError('Project Rule directive is invalid.');
  return value as ProjectRuleDirective;
}

function stage(value: unknown): ProjectRuleStage {
  if (typeof value !== 'string' || !(PROJECT_RULE_STAGES as readonly string[]).includes(value)) throw new TypeError('Project Rule stage is invalid.');
  return value as ProjectRuleStage;
}

function canonicalStages(value: unknown, label: string): readonly ProjectRuleStage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > PROJECT_RULE_STAGES.length) throw new RangeError(`${label} must target at least one canonical stage.`);
  const parsed = value.map(stage);
  if (new Set(parsed).size !== parsed.length) throw new TypeError(`${label} contains duplicate stages.`);
  return Object.freeze(PROJECT_RULE_STAGES.filter((item) => parsed.includes(item)));
}

function canonicalRule(value: unknown, index: number): ProjectRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Project Rule ${index + 1} must be an object.`);
  const row = value as Record<string, unknown>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['category','directive','stages','statement'])) {
    throw new TypeError(`Project Rule ${index + 1} accepts only category, directive, statement and stages.`);
  }
  const parsedDirective = directive(row.directive);
  return Object.freeze({
    schema: PROJECT_RULE_SCHEMA,
    id: `rule-${String(index + 1).padStart(4, '0')}`,
    ordinal: index + 1,
    category: category(row.category),
    directive: parsedDirective,
    statement: normalizeStatement(row.statement, `Project Rule ${index + 1} statement`),
    stages: canonicalStages(row.stages, `Project Rule ${index + 1} stages`),
    mandatory: parsedDirective !== 'prefer',
  });
}

function canonicalMaterial(workspace: string, rules: readonly ProjectRule[]): string {
  return JSON.stringify({
    schema: PROJECT_RULES_SCHEMA,
    workspaceSchema: PROJECT_RULES_WORKSPACE_SCHEMA,
    workspaceId: workspace,
    rules: rules.map((rule) => ({ id: rule.id, ordinal: rule.ordinal, category: rule.category, directive: rule.directive, statement: rule.statement, stages: [...rule.stages] })),
  });
}

export function createProjectRules(input: ProjectRulesInput): ProjectRulesRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Project Rules input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['rules','workspaceId'])) throw new TypeError('Project Rules input accepts only workspaceId and rules.');
  if (!Array.isArray(row.rules) || row.rules.length < 1 || row.rules.length > PROJECT_RULES_MAX_RULES) {
    throw new RangeError(`Project Rules requires between 1 and ${PROJECT_RULES_MAX_RULES} rules.`);
  }
  const workspace = workspaceId(row.workspaceId);
  const rules = Object.freeze(row.rules.map((item, index) => canonicalRule(item, index)));
  const signatures = rules.map((rule) => `${rule.category}\u0000${rule.directive}\u0000${rule.statement}\u0000${rule.stages.join(',')}`);
  if (new Set(signatures).size !== signatures.length) throw new TypeError('Project Rules does not allow duplicate canonical rules.');
  const hex = sha256Hex(canonicalMaterial(workspace, rules));
  return Object.freeze({
    schema: PROJECT_RULES_SCHEMA,
    workspaceSchema: PROJECT_RULES_WORKSPACE_SCHEMA,
    workspaceId: workspace,
    id: `rules-${hex.slice(0, 16)}`,
    revision: 1,
    rulesDigest: Object.freeze({ algorithm: PROJECT_RULES_DIGEST_ALGORITHM, hex }),
    rules,
    workspaceScoped: true,
    readOnly: true,
    deterministic: true,
    structuredRulesOnly: true,
    semanticInference: false,
    automaticComplianceDecision: false,
    planReadOnlyPreserved: true,
    decisionEngineCompatible: true,
    projectRulesApplied: true,
    impactSimulationApplied: false,
    buildTransitionAuthorized: false,
    buildOrchestration: false,
    toolExecution: false,
    scopeIntelligence: false,
    scopeLock: false,
    checkpoints: false,
    validationPipeline: false,
    execution: false,
    scheduling: false,
  });
}

export function assertProjectRulesRecord(value: unknown): asserts value is ProjectRulesRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected a canonical Project Rules record.');
  const row = value as Record<string, unknown>;
  if (row.schema !== PROJECT_RULES_SCHEMA || row.workspaceSchema !== PROJECT_RULES_WORKSPACE_SCHEMA || row.revision !== 1 || !Array.isArray(row.rules)) {
    throw new TypeError('Expected a canonical Project Rules record.');
  }
  const recreated = createProjectRules({
    workspaceId: row.workspaceId as string,
    rules: (row.rules as ProjectRule[]).map((rule) => ({ category: rule.category, directive: rule.directive, statement: rule.statement, stages: rule.stages })),
  });
  if (row.id !== recreated.id || !row.rulesDigest || typeof row.rulesDigest !== 'object' || Array.isArray(row.rulesDigest)
      || (row.rulesDigest as Record<string, unknown>).algorithm !== PROJECT_RULES_DIGEST_ALGORITHM
      || (row.rulesDigest as Record<string, unknown>).hex !== recreated.rulesDigest.hex) {
    throw new TypeError('Project Rules digest does not match canonical rule material.');
  }
  for (const [field, expected] of Object.entries({
    workspaceScoped:true,readOnly:true,deterministic:true,structuredRulesOnly:true,semanticInference:false,
    automaticComplianceDecision:false,planReadOnlyPreserved:true,decisionEngineCompatible:true,projectRulesApplied:true,
    impactSimulationApplied:false,buildTransitionAuthorized:false,buildOrchestration:false,toolExecution:false,
    scopeIntelligence:false,scopeLock:false,checkpoints:false,validationPipeline:false,execution:false,scheduling:false,
  })) if (row[field] !== expected) throw new TypeError(`Project Rules ${field} boundary is invalid.`);
}

export function selectProjectRulesForStage(input: ProjectRulesStageInput): ProjectRulesStageSelection {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Project Rules stage input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['rules','stage'])) throw new TypeError('Project Rules stage input accepts only rules and stage.');
  assertProjectRulesRecord(row.rules);
  const parsedStage = stage(row.stage);
  const applicable = Object.freeze(row.rules.rules.filter((rule) => rule.stages.includes(parsedStage)));
  const mandatory = Object.freeze(applicable.filter((rule) => rule.mandatory));
  const advisory = Object.freeze(applicable.filter((rule) => !rule.mandatory));
  return Object.freeze({
    schema: PROJECT_RULES_STAGE_SCHEMA,
    sourceRulesId: row.rules.id,
    sourceRulesDigest: Object.freeze({ algorithm: row.rules.rulesDigest.algorithm, hex: row.rules.rulesDigest.hex }),
    workspaceId: row.rules.workspaceId,
    stage: parsedStage,
    rules: applicable,
    mandatoryRules: mandatory,
    advisoryRules: advisory,
    semanticEvaluation: false,
    impactSimulationApplied: false,
    buildTransitionAuthorized: false,
    execution: false,
  });
}
