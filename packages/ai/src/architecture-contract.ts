import { AI_CANONICAL_DIGEST_ALGORITHM, sha256Hex } from './canonical-digest.js';

export const ARCHITECTURE_CONTRACT_BUILD = 64 as const;
export const ARCHITECTURE_CONTRACT_SCHEMA = 'gd-architecture-contract/1' as const;
export const ARCHITECTURE_CONTRACT_MAX_DOMAINS = 256 as const;
export const ARCHITECTURE_CONTRACT_MAX_ITEMS = 512 as const;

const ID = /^[a-z][a-z0-9-]{0,63}$/;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;

export interface ArchitectureDependency {
  readonly from: string;
  readonly to: string;
}

export interface ArchitectureDomainInput {
  readonly id: string;
  readonly owns: readonly string[];
  readonly dependsOn: readonly string[];
  readonly forbiddenDependencies: readonly string[];
  readonly infrastructureAccess: readonly string[];
}

export interface ArchitectureInvariantInput {
  readonly id: string;
  readonly statement: string;
}

export interface ArchitectureContractInput {
  readonly projectId: string;
  readonly revision: number;
  readonly domains: readonly ArchitectureDomainInput[];
  readonly invariants: readonly ArchitectureInvariantInput[];
}

export interface ArchitectureContractDomain extends ArchitectureDomainInput {}
export interface ArchitectureContractInvariant extends ArchitectureInvariantInput {}

export interface ArchitectureContractRecord {
  readonly schema: typeof ARCHITECTURE_CONTRACT_SCHEMA;
  readonly build: typeof ARCHITECTURE_CONTRACT_BUILD;
  readonly projectId: string;
  readonly revision: number;
  readonly domains: readonly ArchitectureContractDomain[];
  readonly invariants: readonly ArchitectureContractInvariant[];
  readonly contractDigest: { readonly algorithm: typeof AI_CANONICAL_DIGEST_ALGORITHM; readonly hex: string };
  readonly machineReadable: true;
  readonly canonicalProjectArchitecture: true;
  readonly explicitOwnership: true;
  readonly explicitDependencyDirection: true;
  readonly explicitInfrastructureBoundaries: true;
  readonly mutationAuthority: false;
  readonly persistenceAuthority: false;
  readonly immutable: true;
  readonly deterministic: true;
}

function normalizeId(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a string.');
  const normalized=value.trim().toLowerCase();
  if (!ID.test(normalized)) throw new TypeError(label + ' is invalid.');
  return normalized;
}
function normalizeToken(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a string.');
  const normalized=value.trim();
  if (!TOKEN.test(normalized)) throw new TypeError(label + ' is invalid.');
  return normalized;
}
function uniqueSorted(values: readonly string[], label: string, normalizer:(v:unknown,l:string)=>string): readonly string[] {
  if (!Array.isArray(values) || values.length>ARCHITECTURE_CONTRACT_MAX_ITEMS) throw new TypeError(label+' is invalid.');
  const normalized=values.map((v)=>normalizer(v,label));
  if (new Set(normalized).size!==normalized.length) throw new TypeError(label+' contains duplicates.');
  return Object.freeze([...normalized].sort());
}
function normalizeStatement(value: unknown): string {
  if (typeof value!=='string') throw new TypeError('Architecture invariant statement must be a string.');
  const normalized=value.trim();
  if (!normalized || normalized.length>65536) throw new TypeError('Architecture invariant statement is invalid.');
  return normalized;
}

export function createArchitectureContract(input: ArchitectureContractInput): ArchitectureContractRecord {
  if (!input || typeof input!=='object' || Array.isArray(input)) throw new TypeError('Architecture Contract input must be an object.');
  const keys=Object.keys(input as unknown as Record<string,unknown>).sort();
  if (JSON.stringify(keys)!==JSON.stringify(['domains','invariants','projectId','revision'])) throw new TypeError('Architecture Contract input shape is invalid.');
  const projectId=normalizeToken(input.projectId,'Architecture project id');
  if (!Number.isSafeInteger(input.revision) || input.revision<1) throw new TypeError('Architecture Contract revision is invalid.');
  if (!Array.isArray(input.domains) || input.domains.length<1 || input.domains.length>ARCHITECTURE_CONTRACT_MAX_DOMAINS) throw new TypeError('Architecture Contract domains are invalid.');
  const domains=input.domains.map((domain)=>{
    const id=normalizeId(domain.id,'Architecture domain id');
    const owns=uniqueSorted(domain.owns,'Architecture ownership',normalizeToken);
    const dependsOn=uniqueSorted(domain.dependsOn,'Architecture dependencies',normalizeId);
    const forbiddenDependencies=uniqueSorted(domain.forbiddenDependencies,'Architecture forbidden dependencies',normalizeId);
    const infrastructureAccess=uniqueSorted(domain.infrastructureAccess,'Architecture infrastructure access',normalizeToken);
    if (dependsOn.includes(id) || forbiddenDependencies.includes(id)) throw new TypeError('Architecture domain cannot depend on itself.');
    if (dependsOn.some((dep)=>forbiddenDependencies.includes(dep))) throw new TypeError('Architecture dependency cannot be both allowed and forbidden.');
    return Object.freeze({id,owns,dependsOn,forbiddenDependencies,infrastructureAccess});
  }).sort((a,b)=>a.id.localeCompare(b.id));
  const ids=domains.map(d=>d.id);
  if (new Set(ids).size!==ids.length) throw new TypeError('Architecture Contract domain ids must be unique.');
  const known=new Set(ids);
  for (const domain of domains) {
    for (const dep of [...domain.dependsOn,...domain.forbiddenDependencies]) if (!known.has(dep)) throw new TypeError('Architecture dependency references unknown domain '+dep+'.');
  }
  if (!Array.isArray(input.invariants) || input.invariants.length>ARCHITECTURE_CONTRACT_MAX_ITEMS) throw new TypeError('Architecture invariants are invalid.');
  const invariants=input.invariants.map((item)=>Object.freeze({
    id:normalizeId(item.id,'Architecture invariant id'),
    statement:normalizeStatement(item.statement),
  })).sort((a,b)=>a.id.localeCompare(b.id));
  if (new Set(invariants.map(i=>i.id)).size!==invariants.length) throw new TypeError('Architecture invariant ids must be unique.');
  const material=JSON.stringify({schema:ARCHITECTURE_CONTRACT_SCHEMA,build:ARCHITECTURE_CONTRACT_BUILD,projectId,revision:input.revision,domains,invariants});
  return Object.freeze({
    schema:ARCHITECTURE_CONTRACT_SCHEMA,build:ARCHITECTURE_CONTRACT_BUILD,projectId,revision:input.revision,
    domains:Object.freeze(domains),invariants:Object.freeze(invariants),
    contractDigest:Object.freeze({algorithm:AI_CANONICAL_DIGEST_ALGORITHM,hex:sha256Hex(material)}),
    machineReadable:true,canonicalProjectArchitecture:true,explicitOwnership:true,explicitDependencyDirection:true,
    explicitInfrastructureBoundaries:true,mutationAuthority:false,persistenceAuthority:false,immutable:true,deterministic:true,
  });
}

export function assertCanonicalArchitectureContract(value: unknown): asserts value is ArchitectureContractRecord {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new TypeError('Architecture Contract record must be an object.');
  const row=value as ArchitectureContractRecord;
  const canonical=createArchitectureContract({projectId:row.projectId,revision:row.revision,domains:row.domains,invariants:row.invariants});
  if (JSON.stringify(value)!==JSON.stringify(canonical)) throw new TypeError('Architecture Contract record is non-canonical.');
}
