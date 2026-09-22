import { AI_CANONICAL_DIGEST_ALGORITHM, sha256Hex } from './canonical-digest.js';
import {
  assertCanonicalArchitectureContract,
  type ArchitectureContractRecord,
  type ArchitectureDependency,
} from './architecture-contract.js';
import {
  assertCanonicalArchitectureLedger,
  type ArchitectureLedgerRecord,
} from './architecture-ledger.js';
import {
  AGENT_RUNTIME_REGISTRY,
  AGENT_RUNTIME_SCHEMA,
  assertCanonicalAgentRuntime,
  getAgentRuntimeDescriptor,
  type AgentRuntimeRegistry,
} from './agent-runtime.js';

export const HEIMDALL_BUILD = 64 as const;
export const HEIMDALL_SCHEMA = 'gd-heimdall-conformance/1' as const;
export const HEIMDALL_ID = 'heimdall' as const;
export const HEIMDALL_NAME = 'Heimdall' as const;
export const HEIMDALL_ROLE = 'architecture-guardian' as const;
export const HEIMDALL_PHASES = Object.freeze(['pre-change','post-change'] as const);
export const HEIMDALL_CLASSIFICATIONS = Object.freeze([
  'local-extension','cross-cutting','new-domain','architectural-change',
] as const);
export const HEIMDALL_STATUSES = Object.freeze([
  'conformant','violation','architectural-change-required','insufficient-evidence',
] as const);
export const HEIMDALL_GUARDIAN_EVIDENCE = Object.freeze(['not-run','passed','failed'] as const);

export type HeimdallPhase=(typeof HEIMDALL_PHASES)[number];
export type HeimdallClassification=(typeof HEIMDALL_CLASSIFICATIONS)[number];
export type HeimdallStatus=(typeof HEIMDALL_STATUSES)[number];
export type HeimdallGuardianEvidence=(typeof HEIMDALL_GUARDIAN_EVIDENCE)[number];

export interface HeimdallChangeInput {
  readonly id: string;
  readonly classification: HeimdallClassification;
  readonly rationale: string;
  readonly affectedDomains: readonly string[];
  readonly introducedDependencies: readonly ArchitectureDependency[];
  readonly removedDependencies: readonly ArchitectureDependency[];
  readonly ledgerDecisionIds: readonly string[];
  readonly refactorBeforeFeatureRequired: boolean;
}

export interface HeimdallInput {
  readonly registry?: AgentRuntimeRegistry;
  readonly phase: HeimdallPhase;
  readonly contract: ArchitectureContractRecord;
  readonly ledger: ArchitectureLedgerRecord;
  readonly change: HeimdallChangeInput;
  readonly deterministicGuardian: HeimdallGuardianEvidence;
}

export interface HeimdallFinding {
  readonly code: string;
  readonly kind: 'violation'|'transition'|'evidence';
  readonly statement: string;
  readonly sourceRef: string;
}

export interface HeimdallConformanceRecord {
  readonly schema: typeof HEIMDALL_SCHEMA;
  readonly sourceAgentRuntimeSchema: typeof AGENT_RUNTIME_SCHEMA;
  readonly sourceContractSchema: 'gd-architecture-contract/1';
  readonly sourceLedgerSchema: 'gd-architecture-ledger/1';
  readonly sourceContractDigest: { readonly algorithm: typeof AI_CANONICAL_DIGEST_ALGORITHM; readonly hex: string };
  readonly sourceLedgerDigest: { readonly algorithm: typeof AI_CANONICAL_DIGEST_ALGORITHM; readonly hex: string };
  readonly id: string;
  readonly revision: 1;
  readonly phase: HeimdallPhase;
  readonly status: HeimdallStatus;
  readonly classification: HeimdallClassification;
  readonly changeId: string;
  readonly deterministicGuardian: HeimdallGuardianEvidence;
  readonly findings: readonly HeimdallFinding[];
  readonly findingCount: number;
  readonly agentId: typeof HEIMDALL_ID;
  readonly agentName: typeof HEIMDALL_NAME;
  readonly agentRole: typeof HEIMDALL_ROLE;
  readonly completionConformanceSatisfied: boolean;
  readonly namedAgentBinding: true;
  readonly architecturalIntegrity: true;
  readonly controlledEvolution: true;
  readonly architectureContractConsumer: true;
  readonly architectureLedgerConsumer: true;
  readonly deterministicGuardianConsumer: true;
  readonly refactorBeforeFeature: true;
  readonly architectureDesignAuthority: false;
  readonly architectureEnforcementAuthority: false;
  readonly contractMutationAuthority: false;
  readonly ledgerMutationAuthority: false;
  readonly capabilityGrantAuthority: false;
  readonly approvalAuthority: false;
  readonly scopeAuthority: false;
  readonly directMutationAuthority: false;
  readonly validationAuthority: false;
  readonly toolExecution: false;
  readonly execution: false;
  readonly persistence: false;
  readonly networkAuthority: false;
  readonly filesystemAuthority: false;
  readonly databaseAuthority: false;
  readonly immutable: true;
  readonly deterministic: true;
}

const CHANGE_ID=/^architecture-change-[a-z0-9][a-z0-9-]{0,63}$/;
const DOMAIN=/^[a-z][a-z0-9-]{0,63}$/;
const ADR=/^adr-[0-9]{3,6}$/;

function cleanText(value:unknown,label:string,max=65536):string {
  if(typeof value!=='string') throw new TypeError(label+' must be a string.');
  const v=value.trim(); if(!v||v.length>max) throw new TypeError(label+' is invalid.'); return v;
}
function normalizeDomain(value:unknown):string {
  const v=cleanText(value,'Heimdall domain',64).toLowerCase();
  if(!DOMAIN.test(v)) throw new TypeError('Heimdall domain is invalid.');
  return v;
}
function normalizeEdge(value:ArchitectureDependency):ArchitectureDependency {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Heimdall dependency must be an object.');
  const from=normalizeDomain(value.from),to=normalizeDomain(value.to);
  if(from===to) throw new TypeError('Heimdall dependency cannot target itself.');
  return Object.freeze({from,to});
}
function normalizeEdges(values:readonly ArchitectureDependency[],label:string):readonly ArchitectureDependency[] {
  if(!Array.isArray(values)||values.length>512) throw new TypeError(label+' is invalid.');
  const out=values.map(normalizeEdge).sort((a,b)=>(a.from+'>'+a.to).localeCompare(b.from+'>'+b.to));
  const keys=out.map(v=>v.from+'>'+v.to); if(new Set(keys).size!==keys.length) throw new TypeError(label+' contains duplicates.');
  return Object.freeze(out);
}
function edgeKey(edge:ArchitectureDependency):string { return edge.from+'>'+edge.to; }
function finding(code:string,kind:HeimdallFinding['kind'],statement:string,sourceRef:string):HeimdallFinding {
  return Object.freeze({code,kind,statement,sourceRef});
}

function normalizeChange(input:HeimdallChangeInput):HeimdallChangeInput {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new TypeError('Heimdall change must be an object.');
  const id=cleanText(input.id,'Heimdall change id',96).toLowerCase();
  if(!CHANGE_ID.test(id)) throw new TypeError('Heimdall change id is invalid.');
  if(!HEIMDALL_CLASSIFICATIONS.includes(input.classification)) throw new TypeError('Heimdall classification is invalid.');
  if(typeof input.refactorBeforeFeatureRequired!=='boolean') throw new TypeError('Heimdall refactorBeforeFeatureRequired must be boolean.');
  const affected=input.affectedDomains.map(normalizeDomain).sort();
  if(new Set(affected).size!==affected.length) throw new TypeError('Heimdall affected domains contain duplicates.');
  const ledgerDecisionIds=input.ledgerDecisionIds.map(v=>cleanText(v,'Heimdall ledger decision id',32).toLowerCase()).sort();
  if(ledgerDecisionIds.some(id=>!ADR.test(id))||new Set(ledgerDecisionIds).size!==ledgerDecisionIds.length) throw new TypeError('Heimdall ledger decision ids are invalid.');
  return Object.freeze({
    id,classification:input.classification,rationale:cleanText(input.rationale,'Heimdall change rationale'),
    affectedDomains:Object.freeze(affected),introducedDependencies:normalizeEdges(input.introducedDependencies,'Heimdall introduced dependencies'),
    removedDependencies:normalizeEdges(input.removedDependencies,'Heimdall removed dependencies'),
    ledgerDecisionIds:Object.freeze(ledgerDecisionIds),refactorBeforeFeatureRequired:input.refactorBeforeFeatureRequired,
  });
}

function assertIdentity(registry:AgentRuntimeRegistry):void {
  assertCanonicalAgentRuntime(registry);
  const descriptor=getAgentRuntimeDescriptor(HEIMDALL_ID);
  if(!descriptor||descriptor.name!==HEIMDALL_NAME||descriptor.role!==HEIMDALL_ROLE||descriptor.operational!==false||descriptor.capabilityPrincipal!==false) {
    throw new TypeError('Heimdall requires the canonical architecture-guardian identity.');
  }
}

export function createHeimdallConformance(input:HeimdallInput):HeimdallConformanceRecord {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new TypeError('Heimdall input must be an object.');
  assertIdentity(input.registry??AGENT_RUNTIME_REGISTRY);
  assertCanonicalArchitectureContract(input.contract);
  assertCanonicalArchitectureLedger(input.ledger,input.contract);
  if(!HEIMDALL_PHASES.includes(input.phase)) throw new TypeError('Heimdall phase is invalid.');
  if(!HEIMDALL_GUARDIAN_EVIDENCE.includes(input.deterministicGuardian)) throw new TypeError('Heimdall deterministic Guardian evidence is invalid.');
  if(input.phase==='pre-change'&&input.deterministicGuardian!=='not-run') throw new TypeError('Heimdall pre-change review must precede deterministic Guardian execution.');
  const change=normalizeChange(input.change);
  const known=new Set(input.contract.domains.map(d=>d.id));
  const findings:HeimdallFinding[]=[];
  const ledgerById=new Map(input.ledger.entries.map(e=>[e.id,e] as const));

  for(const domain of change.affectedDomains) {
    if(!known.has(domain)) findings.push(finding('HEIMDALL_UNKNOWN_DOMAIN','transition','Affected domain is not present in the canonical Architecture Contract.','domain:'+domain));
  }

  for(const edge of change.introducedDependencies) {
    const from=input.contract.domains.find(d=>d.id===edge.from);
    if(!from||!known.has(edge.to)) {
      findings.push(finding('HEIMDALL_UNKNOWN_DEPENDENCY_DOMAIN','transition','Introduced dependency references a domain outside the canonical Architecture Contract.','dependency:'+edgeKey(edge)));
      continue;
    }
    if(from.forbiddenDependencies.includes(edge.to)) {
      findings.push(finding('HEIMDALL_FORBIDDEN_DEPENDENCY','violation','Introduced dependency violates an explicit forbidden dependency boundary.','dependency:'+edgeKey(edge)));
    } else if(!from.dependsOn.includes(edge.to)) {
      findings.push(finding('HEIMDALL_UNDECLARED_DEPENDENCY','transition','Introduced dependency is not allowed by the current Architecture Contract.','dependency:'+edgeKey(edge)));
    }
  }

  for(const decisionId of change.ledgerDecisionIds) {
    const entry=ledgerById.get(decisionId);
    if(!entry||entry.status!=='accepted') findings.push(finding('HEIMDALL_LEDGER_DECISION_UNAVAILABLE','transition','Referenced Architecture Ledger decision is absent or not accepted.','ledger:'+decisionId));
  }

  if((change.classification==='new-domain'||change.classification==='architectural-change')&&change.ledgerDecisionIds.length===0) {
    findings.push(finding('HEIMDALL_EXPLICIT_DECISION_REQUIRED','transition','Architectural evolution requires an explicit accepted Architecture Ledger decision.','change:'+change.id));
  }
  if(change.refactorBeforeFeatureRequired) {
    findings.push(finding('HEIMDALL_REFACTOR_BEFORE_FEATURE','transition','Refactor Before Feature is required before this change may proceed as ordinary feature work.','change:'+change.id));
  }
  if(input.phase==='post-change'&&input.deterministicGuardian==='failed') {
    findings.push(finding('HEIMDALL_GUARDIAN_VIOLATION','violation','Deterministic Architecture Guardian reported a violation.','guardian:build-9'));
  } else if(input.phase==='post-change'&&input.deterministicGuardian==='not-run') {
    findings.push(finding('HEIMDALL_GUARDIAN_EVIDENCE_REQUIRED','evidence','Post-change conformance requires deterministic Architecture Guardian evidence.','guardian:build-9'));
  }

  const hasViolation=findings.some(f=>f.kind==='violation');
  const hasEvidence=findings.some(f=>f.kind==='evidence');
  const hasTransition=findings.some(f=>f.kind==='transition');
  const status:HeimdallStatus=hasViolation?'violation':hasEvidence?'insufficient-evidence':hasTransition?'architectural-change-required':'conformant';
  const frozen=Object.freeze(findings);
  const material=JSON.stringify({
    schema:HEIMDALL_SCHEMA,phase:input.phase,status,classification:change.classification,change,
    contractDigest:input.contract.contractDigest,ledgerDigest:input.ledger.ledgerDigest,
    deterministicGuardian:input.deterministicGuardian,findings:frozen,
  });
  const hex=sha256Hex(material);
  return Object.freeze({
    schema:HEIMDALL_SCHEMA,sourceAgentRuntimeSchema:AGENT_RUNTIME_SCHEMA,sourceContractSchema:input.contract.schema,
    sourceLedgerSchema:input.ledger.schema,sourceContractDigest:Object.freeze({...input.contract.contractDigest}),
    sourceLedgerDigest:Object.freeze({...input.ledger.ledgerDigest}),id:'heimdall-'+hex.slice(0,16),revision:1,
    phase:input.phase,status,classification:change.classification,changeId:change.id,
    deterministicGuardian:input.deterministicGuardian,findings:frozen,findingCount:frozen.length,
    agentId:HEIMDALL_ID,agentName:HEIMDALL_NAME,agentRole:HEIMDALL_ROLE,
    completionConformanceSatisfied:input.phase==='post-change'&&status==='conformant'&&input.deterministicGuardian==='passed',
    namedAgentBinding:true,architecturalIntegrity:true,controlledEvolution:true,architectureContractConsumer:true,
    architectureLedgerConsumer:true,deterministicGuardianConsumer:true,refactorBeforeFeature:true,
    architectureDesignAuthority:false,architectureEnforcementAuthority:false,contractMutationAuthority:false,
    ledgerMutationAuthority:false,capabilityGrantAuthority:false,approvalAuthority:false,scopeAuthority:false,
    directMutationAuthority:false,validationAuthority:false,toolExecution:false,execution:false,persistence:false,
    networkAuthority:false,filesystemAuthority:false,databaseAuthority:false,immutable:true,deterministic:true,
  });
}

export function assertCanonicalHeimdallConformance(value:unknown,input:HeimdallInput):asserts value is HeimdallConformanceRecord {
  const canonical=createHeimdallConformance(input);
  if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value)!==JSON.stringify(canonical)) {
    throw new TypeError('Heimdall conformance record is non-canonical.');
  }
}
