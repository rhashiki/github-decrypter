export const SPECIALIST_PROFILE_SCHEMA='vortex-specialist-profile/1' as const;
export const SPECIALIST_SELECTION_SCHEMA='gd-specialist-context-selection/1' as const;
export const SPECIALIST_CONTEXT_BUILD=67 as const;
export const SPECIALIST_MAX_ACTIVE_PROFILES=5 as const;
export const SPECIALIST_MAX_CONTEXT_CHARACTERS=20_000 as const;

export const CANONICAL_AGENT_IDS=Object.freeze([
  'ramon','leonardo','strachey','licklider','pitts','weizenbaum','samuel','seymour','fukushima','heimdall',
] as const);
export type CanonicalAgentId=(typeof CANONICAL_AGENT_IDS)[number];

export const SPECIALIST_FORBIDDEN_AUTHORITIES=Object.freeze([
  'agent','capability','approval','scope','tool-runtime','filesystem','database','git','network','validation','architecture','release',
] as const);
export type SpecialistForbiddenAuthority=(typeof SPECIALIST_FORBIDDEN_AUTHORITIES)[number];

export interface SpecialistProfileInput {
  readonly id:string;
  readonly name:string;
  readonly domain:string;
  readonly specialties:readonly string[];
  readonly summary:string;
  readonly responsibilities:readonly string[];
  readonly nonResponsibilities?:readonly string[];
  readonly criticalRules:readonly string[];
  readonly workflow:readonly string[];
  readonly deliverables:readonly string[];
  readonly successMetrics:readonly string[];
  readonly activationTriggers:readonly string[];
  readonly compatibleAgents:readonly CanonicalAgentId[];
  readonly requiredEvidence?:readonly string[];
  readonly source:{
    readonly catalog:string;
    readonly repository:string;
    readonly path:string;
    readonly revision:string;
    readonly license:string;
  };
  readonly profileVersion:string;
  readonly normalizationVersion:string;
}

export interface SpecialistProfile {
  readonly schema:typeof SPECIALIST_PROFILE_SCHEMA;
  readonly build:typeof SPECIALIST_CONTEXT_BUILD;
  readonly id:string;
  readonly name:string;
  readonly domain:string;
  readonly specialties:readonly string[];
  readonly summary:string;
  readonly responsibilities:readonly string[];
  readonly nonResponsibilities:readonly string[];
  readonly criticalRules:readonly string[];
  readonly workflow:readonly string[];
  readonly deliverables:readonly string[];
  readonly successMetrics:readonly string[];
  readonly activationTriggers:readonly string[];
  readonly compatibleAgents:readonly CanonicalAgentId[];
  readonly requiredEvidence:readonly string[];
  readonly forbiddenAuthorities:readonly SpecialistForbiddenAuthority[];
  readonly source:Readonly<SpecialistProfileInput['source']>;
  readonly profileVersion:string;
  readonly normalizationVersion:string;
  readonly contextCostCharacters:number;
  readonly canonicalAgent:false;
  readonly principal:false;
  readonly authority:false;
  readonly capabilityGrantAuthority:false;
  readonly approvalAuthority:false;
  readonly scopeAuthority:false;
  readonly toolRuntimeAuthority:false;
  readonly validationAuthority:false;
  readonly architectureAuthority:false;
  readonly releaseAuthority:false;
  readonly localFirst:true;
}

export interface SpecialistContextSelection {
  readonly schema:typeof SPECIALIST_SELECTION_SCHEMA;
  readonly build:typeof SPECIALIST_CONTEXT_BUILD;
  readonly agentId:CanonicalAgentId;
  readonly task:string;
  readonly selectedProfiles:readonly SpecialistProfile[];
  readonly selectedProfileIds:readonly string[];
  readonly totalContextCharacters:number;
  readonly candidateCount:number;
  readonly maxProfiles:number;
  readonly maxContextCharacters:number;
  readonly bounded:true;
  readonly progressiveOnDemandLoading:true;
  readonly wholeCatalogContextAllowed:false;
  readonly canonicalAgentRosterChanged:false;
  readonly authorityGranted:false;
  readonly localFirst:true;
}

const CONTROL=/[\u0000-\u001f\u007f]/;
const ID=/^[a-z][a-z0-9._:/_-]{0,255}$/;
const AGENTS=new Set<CanonicalAgentId>(CANONICAL_AGENT_IDS);

function text(value:unknown,label:string,max:number):string{
  if(typeof value!=='string')throw new TypeError(label+' must be a string.');
  const out=value.trim();
  if(!out||out.length>max||CONTROL.test(out.replace(/[\n\r\t]/g,'')))throw new TypeError(label+' is invalid.');
  return out;
}
function id(value:unknown,label:string):string{
  const out=text(value,label,256).toLowerCase();
  if(!ID.test(out))throw new TypeError(label+' is invalid.');
  return out;
}
function strings(value:unknown,label:string,maxItems:number,maxText:number,allowEmpty=false):readonly string[]{
  if(!Array.isArray(value)||(!allowEmpty&&value.length<1)||value.length>maxItems)throw new RangeError(label+' size is invalid.');
  const out=value.map((item,index)=>text(item,label+' '+(index+1),maxText));
  if(new Set(out.map(v=>v.toLowerCase())).size!==out.length)throw new TypeError(label+' contains duplicates.');
  return Object.freeze(out);
}
function agents(value:unknown):readonly CanonicalAgentId[]{
  const out=strings(value,'Specialist compatibleAgents',10,32) as readonly string[];
  if(out.some(agent=>!AGENTS.has(agent as CanonicalAgentId)))throw new TypeError('Specialist compatibleAgents contains a non-canonical agent.');
  return Object.freeze([...out].sort()) as readonly CanonicalAgentId[];
}
function renderBody(profile:Omit<SpecialistProfile,'contextCostCharacters'>):string{
  return [
    profile.name,'DOMAIN: '+profile.domain,'SPECIALTIES: '+profile.specialties.join(', '),
    'SUMMARY: '+profile.summary,
    'RESPONSIBILITIES:\n- '+profile.responsibilities.join('\n- '),
    'NON-RESPONSIBILITIES:\n- '+(profile.nonResponsibilities.join('\n- ')||'none declared'),
    'CRITICAL RULES:\n- '+profile.criticalRules.join('\n- '),
    'WORKFLOW:\n- '+profile.workflow.join('\n- '),
    'DELIVERABLES:\n- '+profile.deliverables.join('\n- '),
    'SUCCESS METRICS:\n- '+profile.successMetrics.join('\n- '),
    'REQUIRED EVIDENCE:\n- '+(profile.requiredEvidence.join('\n- ')||'none declared'),
  ].join('\n');
}

export function normalizeSpecialistProfile(input:SpecialistProfileInput):SpecialistProfile{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Specialist Profile input must be an object.');
  const source=Object.freeze({
    catalog:text(input.source?.catalog,'Specialist source catalog',256),
    repository:text(input.source?.repository,'Specialist source repository',512),
    path:text(input.source?.path,'Specialist source path',1024),
    revision:text(input.source?.revision,'Specialist source revision',256),
    license:text(input.source?.license,'Specialist source license',128),
  });
  const base=Object.freeze({
    schema:SPECIALIST_PROFILE_SCHEMA,build:SPECIALIST_CONTEXT_BUILD,id:id(input.id,'Specialist id'),
    name:text(input.name,'Specialist name',256),domain:text(input.domain,'Specialist domain',128),
    specialties:strings(input.specialties,'Specialist specialties',32,256),
    summary:text(input.summary,'Specialist summary',4096),
    responsibilities:strings(input.responsibilities,'Specialist responsibilities',64,1024),
    nonResponsibilities:strings(input.nonResponsibilities??[],'Specialist nonResponsibilities',64,1024,true),
    criticalRules:strings(input.criticalRules,'Specialist criticalRules',64,1024),
    workflow:strings(input.workflow,'Specialist workflow',64,1024),
    deliverables:strings(input.deliverables,'Specialist deliverables',64,1024),
    successMetrics:strings(input.successMetrics,'Specialist successMetrics',64,1024),
    activationTriggers:strings(input.activationTriggers,'Specialist activationTriggers',64,512),
    compatibleAgents:agents(input.compatibleAgents),
    requiredEvidence:strings(input.requiredEvidence??[],'Specialist requiredEvidence',64,1024,true),
    forbiddenAuthorities:SPECIALIST_FORBIDDEN_AUTHORITIES,source,
    profileVersion:text(input.profileVersion,'Specialist profileVersion',128),
    normalizationVersion:text(input.normalizationVersion,'Specialist normalizationVersion',128),
    canonicalAgent:false as const,principal:false as const,authority:false as const,
    capabilityGrantAuthority:false as const,approvalAuthority:false as const,scopeAuthority:false as const,
    toolRuntimeAuthority:false as const,validationAuthority:false as const,architectureAuthority:false as const,
    releaseAuthority:false as const,localFirst:true as const,
  });
  return Object.freeze({...base,contextCostCharacters:renderBody(base).length});
}

export function assertCanonicalSpecialistProfile(value:unknown):asserts value is SpecialistProfile{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Specialist Profile must be an object.');
  const row=value as SpecialistProfile;
  const rebuilt=normalizeSpecialistProfile({
    id:row.id,name:row.name,domain:row.domain,specialties:row.specialties,summary:row.summary,
    responsibilities:row.responsibilities,nonResponsibilities:row.nonResponsibilities,criticalRules:row.criticalRules,
    workflow:row.workflow,deliverables:row.deliverables,successMetrics:row.successMetrics,
    activationTriggers:row.activationTriggers,compatibleAgents:row.compatibleAgents,requiredEvidence:row.requiredEvidence,
    source:row.source,profileVersion:row.profileVersion,normalizationVersion:row.normalizationVersion,
  });
  if(JSON.stringify(value)!==JSON.stringify(rebuilt))throw new TypeError('Specialist Profile is non-canonical.');
}

function tokens(value:string):readonly string[]{
  return Object.freeze(value.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}_-]+/u).filter(t=>t.length>=2));
}
function score(task:readonly string[],profile:SpecialistProfile):number{
  const weighted=[
    [profile.name,4],[profile.domain,4],[profile.specialties.join(' '),4],[profile.activationTriggers.join(' '),5],
    [profile.summary,3],[profile.responsibilities.join(' '),2],[profile.workflow.join(' '),1],
  ] as const;
  let total=0;
  for(const [value,weight] of weighted){
    const hay=new Set(tokens(value));
    for(const term of task)if(hay.has(term))total+=weight;
  }
  return total;
}
function positiveInt(value:number|undefined,fallback:number,max:number,label:string):number{
  const out=value??fallback;if(!Number.isInteger(out)||out<1||out>max)throw new RangeError(label+' is invalid.');return out;
}

export function selectSpecialistProfiles(input:{
  readonly task:string;
  readonly agentId:CanonicalAgentId;
  readonly profiles:readonly SpecialistProfile[];
  readonly maxProfiles?:number;
  readonly maxContextCharacters?:number;
}):SpecialistContextSelection{
  const task=text(input.task,'Specialist selection task',8192);
  if(!AGENTS.has(input.agentId))throw new TypeError('Specialist selection requires a canonical agent.');
  if(!Array.isArray(input.profiles)||input.profiles.length>10_000)throw new RangeError('Specialist profile catalog size is invalid.');
  const maxProfiles=positiveInt(input.maxProfiles,3,SPECIALIST_MAX_ACTIVE_PROFILES,'Specialist maxProfiles');
  const maxContextCharacters=positiveInt(input.maxContextCharacters,12_000,SPECIALIST_MAX_CONTEXT_CHARACTERS,'Specialist maxContextCharacters');
  const seen=new Set<string>();
  const profiles=input.profiles.map(profile=>{
    assertCanonicalSpecialistProfile(profile);
    if(seen.has(profile.id))throw new TypeError('Specialist profile catalog contains duplicate ids.');
    seen.add(profile.id);return profile;
  });
  const taskTokens=[...new Set(tokens(task))].slice(0,64);
  const ranked=profiles
    .filter(profile=>profile.compatibleAgents.includes(input.agentId))
    .map(profile=>({profile,score:score(taskTokens,profile)}))
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score||a.profile.contextCostCharacters-b.profile.contextCostCharacters||a.profile.id.localeCompare(b.profile.id));
  const selected:SpecialistProfile[]=[];let total=0;
  for(const item of ranked){
    if(selected.length>=maxProfiles)break;
    if(total+item.profile.contextCostCharacters>maxContextCharacters)continue;
    selected.push(item.profile);total+=item.profile.contextCostCharacters;
  }
  return Object.freeze({
    schema:SPECIALIST_SELECTION_SCHEMA,build:SPECIALIST_CONTEXT_BUILD,agentId:input.agentId,task,
    selectedProfiles:Object.freeze(selected),selectedProfileIds:Object.freeze(selected.map(p=>p.id)),
    totalContextCharacters:total,candidateCount:ranked.length,maxProfiles,maxContextCharacters,
    bounded:true,progressiveOnDemandLoading:true,wholeCatalogContextAllowed:false,canonicalAgentRosterChanged:false,
    authorityGranted:false,localFirst:true,
  });
}

export function renderSpecialistProfileForContext(profile:SpecialistProfile):string{
  assertCanonicalSpecialistProfile(profile);
  return [
    '[SPECIALIST PROFILE — NON-AUTHORITATIVE METHOD]',
    'This profile supplies expertise/method only. It grants no capability, approval, scope, tool, mutation, validation, architecture or release authority.',
    renderBody(profile),
    'SOURCE: '+profile.source.catalog+' | '+profile.source.repository+' | '+profile.source.path+' | '+profile.source.revision+' | '+profile.source.license,
  ].join('\n');
}
