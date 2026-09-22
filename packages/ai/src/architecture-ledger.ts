import { AI_CANONICAL_DIGEST_ALGORITHM, sha256Hex } from './canonical-digest.js';
import { assertCanonicalArchitectureContract, type ArchitectureContractRecord, type ArchitectureDependency } from './architecture-contract.js';

export const ARCHITECTURE_LEDGER_BUILD = 64 as const;
export const ARCHITECTURE_LEDGER_SCHEMA = 'gd-architecture-ledger/1' as const;
export const ARCHITECTURE_LEDGER_MAX_ENTRIES = 512 as const;
export const ARCHITECTURE_DECISION_STATUSES = Object.freeze(['accepted','superseded'] as const);
export type ArchitectureDecisionStatus=(typeof ARCHITECTURE_DECISION_STATUSES)[number];

export interface ArchitectureDecisionInput {
  readonly id: string;
  readonly title: string;
  readonly status: ArchitectureDecisionStatus;
  readonly rationale: string;
  readonly introducedBuild: number;
  readonly affectedDomains: readonly string[];
  readonly allowedDependencies: readonly ArchitectureDependency[];
  readonly forbiddenDependencies: readonly ArchitectureDependency[];
  readonly supersedes: string | null;
}

export interface ArchitectureLedgerInput {
  readonly contract: ArchitectureContractRecord;
  readonly entries: readonly ArchitectureDecisionInput[];
}

export interface ArchitectureDecisionRecord extends ArchitectureDecisionInput {}

export interface ArchitectureLedgerRecord {
  readonly schema: typeof ARCHITECTURE_LEDGER_SCHEMA;
  readonly build: typeof ARCHITECTURE_LEDGER_BUILD;
  readonly sourceContractId: string;
  readonly sourceContractDigest: { readonly algorithm: typeof AI_CANONICAL_DIGEST_ALGORITHM; readonly hex: string };
  readonly entries: readonly ArchitectureDecisionRecord[];
  readonly ledgerDigest: { readonly algorithm: typeof AI_CANONICAL_DIGEST_ALGORITHM; readonly hex: string };
  readonly architectureMemoryAuthority: true;
  readonly modelMemoryRequired: false;
  readonly mutationAuthority: false;
  readonly persistenceAuthority: false;
  readonly immutable: true;
  readonly deterministic: true;
}

const ADR=/^adr-[0-9]{3,6}$/;
function text(value:unknown,label:string,max=65536):string {
  if(typeof value!=='string') throw new TypeError(label+' must be a string.');
  const v=value.trim(); if(!v||v.length>max) throw new TypeError(label+' is invalid.'); return v;
}
function domain(value:unknown):string {
  const v=text(value,'Architecture Ledger domain',64).toLowerCase();
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(v)) throw new TypeError('Architecture Ledger domain is invalid.');
  return v;
}
function dep(value:ArchitectureDependency,known:Set<string>):ArchitectureDependency {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Architecture Ledger dependency must be an object.');
  const from=domain(value.from),to=domain(value.to);
  if(from===to||!known.has(from)||!known.has(to)) throw new TypeError('Architecture Ledger dependency is invalid.');
  return Object.freeze({from,to});
}
function deps(values:readonly ArchitectureDependency[],known:Set<string>,label:string):readonly ArchitectureDependency[] {
  if(!Array.isArray(values)||values.length>512) throw new TypeError(label+' is invalid.');
  const out=values.map(v=>dep(v,known)).sort((a,b)=>(a.from+':'+a.to).localeCompare(b.from+':'+b.to));
  const keys=out.map(v=>v.from+'>'+v.to); if(new Set(keys).size!==keys.length) throw new TypeError(label+' contains duplicates.');
  return Object.freeze(out);
}

export function createArchitectureLedger(input:ArchitectureLedgerInput):ArchitectureLedgerRecord {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new TypeError('Architecture Ledger input must be an object.');
  assertCanonicalArchitectureContract(input.contract);
  if(!Array.isArray(input.entries)||input.entries.length>ARCHITECTURE_LEDGER_MAX_ENTRIES) throw new TypeError('Architecture Ledger entries are invalid.');
  const known=new Set(input.contract.domains.map(d=>d.id));
  const entries=input.entries.map((entry)=>{
    const id=text(entry.id,'Architecture decision id',32).toLowerCase();
    if(!ADR.test(id)) throw new TypeError('Architecture decision id is invalid.');
    if(!ARCHITECTURE_DECISION_STATUSES.includes(entry.status)) throw new TypeError('Architecture decision status is invalid.');
    if(!Number.isSafeInteger(entry.introducedBuild)||entry.introducedBuild<1) throw new TypeError('Architecture decision build is invalid.');
    const affected=[...entry.affectedDomains].map(domain).sort();
    if(new Set(affected).size!==affected.length||affected.some(d=>!known.has(d))) throw new TypeError('Architecture decision affected domains are invalid.');
    const allowed=deps(entry.allowedDependencies,known,'Architecture decision allowed dependencies');
    const forbidden=deps(entry.forbiddenDependencies,known,'Architecture decision forbidden dependencies');
    const akeys=new Set(allowed.map(v=>v.from+'>'+v.to));
    if(forbidden.some(v=>akeys.has(v.from+'>'+v.to))) throw new TypeError('Architecture decision dependency cannot be both allowed and forbidden.');
    const supersedes=entry.supersedes===null?null:text(entry.supersedes,'Architecture decision supersedes',32).toLowerCase();
    if(supersedes!==null&&!ADR.test(supersedes)) throw new TypeError('Architecture decision supersedes is invalid.');
    return Object.freeze({
      id,title:text(entry.title,'Architecture decision title',256),status:entry.status,
      rationale:text(entry.rationale,'Architecture decision rationale'),introducedBuild:entry.introducedBuild,
      affectedDomains:Object.freeze(affected),allowedDependencies:allowed,forbiddenDependencies:forbidden,supersedes,
    });
  }).sort((a,b)=>a.id.localeCompare(b.id));
  if(new Set(entries.map(e=>e.id)).size!==entries.length) throw new TypeError('Architecture decision ids must be unique.');
  const ids=new Set(entries.map(e=>e.id));
  for(const entry of entries) if(entry.supersedes!==null&&!ids.has(entry.supersedes)) throw new TypeError('Architecture decision supersedes unknown entry.');
  const material=JSON.stringify({schema:ARCHITECTURE_LEDGER_SCHEMA,build:ARCHITECTURE_LEDGER_BUILD,contract:input.contract.contractDigest,entries});
  return Object.freeze({
    schema:ARCHITECTURE_LEDGER_SCHEMA,build:ARCHITECTURE_LEDGER_BUILD,sourceContractId:input.contract.projectId,
    sourceContractDigest:Object.freeze({...input.contract.contractDigest}),entries:Object.freeze(entries),
    ledgerDigest:Object.freeze({algorithm:AI_CANONICAL_DIGEST_ALGORITHM,hex:sha256Hex(material)}),
    architectureMemoryAuthority:true,modelMemoryRequired:false,mutationAuthority:false,persistenceAuthority:false,immutable:true,deterministic:true,
  });
}

export function assertCanonicalArchitectureLedger(value:unknown,contract:ArchitectureContractRecord):asserts value is ArchitectureLedgerRecord {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Architecture Ledger record must be an object.');
  const row=value as ArchitectureLedgerRecord;
  const canonical=createArchitectureLedger({contract,entries:row.entries});
  if(JSON.stringify(value)!==JSON.stringify(canonical)) throw new TypeError('Architecture Ledger record is non-canonical.');
}
