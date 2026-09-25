export const CONTEXT_ENGINE_FINAL_BUILD = 67 as const;
export const PROJECT_GENESIS_SCHEMA = 'gd-project-genesis/1' as const;
export const PRODUCT_CONTRACT_SCHEMA = 'gd-product-contract/1' as const;
export const PRODUCT_CONTRACT_QUERY_SCHEMA = 'gd-product-contract-query/1' as const;
export const PROJECT_GENESIS_MAX_ANSWERS = 128 as const;
export const PRODUCT_CONTRACT_MAX_SOURCE_REFS = 2048 as const;

export const PROJECT_GENESIS_DOMAINS = Object.freeze([
  'identity','users-roles','workflows','business-rules','content','monetization','integrations',
  'platforms','authentication','privacy','accessibility','deployment','operations','external-dependencies',
] as const);
export type ProjectGenesisDomain = (typeof PROJECT_GENESIS_DOMAINS)[number];
export type ProjectGenesisQuestionKind = 'text'|'list'|'choice'|'multi-choice'|'boolean';
export type ProjectGenesisAnswerValue = string|boolean|readonly string[];

export interface ProjectGenesisQuestion {
  readonly id:string;
  readonly domain:ProjectGenesisDomain;
  readonly prompt:string;
  readonly kind:ProjectGenesisQuestionKind;
  readonly required:boolean;
  readonly options:readonly string[];
  readonly productDecision:true;
  readonly implementationTrivia:false;
}

export interface ProjectGenesisAnswerInput {
  readonly questionId:string;
  readonly value:ProjectGenesisAnswerValue;
  readonly sourceRefs:readonly string[];
}

export interface ProjectGenesisAnswer extends ProjectGenesisAnswerInput {
  readonly ordinal:number;
}

export interface ProjectGenesisState {
  readonly schema:typeof PROJECT_GENESIS_SCHEMA;
  readonly build:typeof CONTEXT_ENGINE_FINAL_BUILD;
  readonly workspaceId:string;
  readonly projectId:string;
  readonly questions:readonly ProjectGenesisQuestion[];
  readonly answers:readonly ProjectGenesisAnswer[];
  readonly activeQuestionIds:readonly string[];
  readonly unansweredRequiredQuestionIds:readonly string[];
  readonly complete:boolean;
  readonly adaptive:true;
  readonly productQuestionsOnly:true;
  readonly engineeringDecisionsOwnedByVortex:true;
  readonly noSilentGuessing:true;
}

export interface ProductContractAcceptanceCriterion {
  readonly id:string;
  readonly statement:string;
  readonly sourceQuestionId:string;
  readonly sourceRefs:readonly string[];
}

export interface ProductContractJourney {
  readonly id:string;
  readonly actor:string;
  readonly workflow:string;
  readonly expectedOutcome:string;
  readonly sourceQuestionId:'core-workflows';
  readonly sourceRefs:readonly string[];
}

export interface ProductContractExternalDependency {
  readonly id:string;
  readonly kind:'dependency'|'external-fact';
  readonly description:string;
  readonly state:'declared';
  readonly blockingStage:'rc';
  readonly sourceRefs:readonly string[];
}

export interface ProductContractUnresolvedDecision {
  readonly id:string;
  readonly questionId:string;
  readonly prompt:string;
  readonly blockingStage:'build';
}

export interface ProductContract {
  readonly schema:typeof PRODUCT_CONTRACT_SCHEMA;
  readonly build:typeof CONTEXT_ENGINE_FINAL_BUILD;
  readonly id:string;
  readonly workspaceId:string;
  readonly projectId:string;
  readonly revision:number;
  readonly createdAt:string;
  readonly supersedesId:string|null;
  readonly status:'ready'|'blocked';
  readonly answers:readonly ProjectGenesisAnswer[];
  readonly acceptanceCriteria:readonly ProductContractAcceptanceCriterion[];
  readonly representativeUserJourneys:readonly ProductContractJourney[];
  readonly unresolvedDecisions:readonly ProductContractUnresolvedDecision[];
  readonly externalDependencies:readonly ProductContractExternalDependency[];
  readonly sourceRefs:readonly string[];
  readonly buildReady:boolean;
  readonly rcBlockedByExternalDependencies:boolean;
  readonly authoritative:true;
  readonly truthRole:'product-contract';
  readonly durable:true;
  readonly adaptiveDiscovery:true;
  readonly acceptanceCriteriaDerived:true;
  readonly representativeJourneysDerived:true;
  readonly externalDependencyLedger:true;
  readonly engineeringDecisionAuthority:false;
  readonly noSilentGuessing:true;
  readonly localFirst:true;
}

export interface ProductContractCompileInput {
  readonly workspaceId:string;
  readonly projectId:string;
  readonly revision:number;
  readonly createdAt:string;
  readonly supersedesId?:string|null;
  readonly answers:readonly ProjectGenesisAnswerInput[];
}

export interface ProductContractQueryInput {
  readonly terms:readonly string[];
  readonly maxAnswers?:number;
  readonly maxCriteria?:number;
  readonly maxJourneys?:number;
}

export interface ProductContractQueryResult {
  readonly schema:typeof PRODUCT_CONTRACT_QUERY_SCHEMA;
  readonly contractId:string;
  readonly terms:readonly string[];
  readonly answers:readonly ProjectGenesisAnswer[];
  readonly acceptanceCriteria:readonly ProductContractAcceptanceCriterion[];
  readonly representativeUserJourneys:readonly ProductContractJourney[];
  readonly unresolvedDecisions:readonly ProductContractUnresolvedDecision[];
  readonly externalDependencies:readonly ProductContractExternalDependency[];
  readonly bounded:true;
  readonly lexical:true;
  readonly wholesaleContractDump:false;
}

const CONTROL=/[\u0000-\u001f\u007f]/;
const ID=/^[a-z][a-z0-9._:/_-]{0,255}$/;

function question(
  id:string,domain:ProjectGenesisDomain,prompt:string,kind:ProjectGenesisQuestionKind,
  required:boolean,options:readonly string[]=[],
):ProjectGenesisQuestion {
  return Object.freeze({id,domain,prompt,kind,required,options:Object.freeze([...options]),productDecision:true,implementationTrivia:false});
}

const CATALOG=Object.freeze([
  question('product-summary','identity','What product are we building, for whom, and what core problem must it solve?','text',true),
  question('primary-users','users-roles','Who are the primary user groups?','list',true),
  question('user-roles','users-roles','Which distinct product roles or permission personas exist?','list',true),
  question('core-workflows','workflows','What are the representative end-to-end workflows users must be able to complete?','list',true),
  question('representative-outcomes','workflows','What observable outcomes prove those core workflows succeeded?','list',true),
  question('business-rules','business-rules','Which business rules, limits, cooldowns, approvals, calculations, or lifecycle rules must the product enforce?','list',true),
  question('content-types','content','Which user or business content types must the product create, read, edit, import, export, or retain?','list',true),
  question('monetization-model','monetization','What monetization model applies?','choice',true,['none','subscription','one-time','usage','advertising','marketplace','other']),
  question('billing-rules','monetization','Which billing, trial, entitlement, refund, renewal, or purchase rules apply?','list',true),
  question('integrations','integrations','Which external systems, APIs, devices, providers, or data sources are part of the product? Use "none" when none apply.','list',true),
  question('target-platforms','platforms','Which supported platforms are required?','multi-choice',true,['web','pwa','windows','macos','linux','android','ios','browser-extension','other']),
  question('authentication-model','authentication','What authentication model does the product require?','choice',true,['none','account','passwordless','social','enterprise-sso','custom']),
  question('authorization-rules','authentication','Which product permissions, role boundaries, or ownership rules must be enforced?','list',true),
  question('personal-data','privacy','Will the product process personal data?','boolean',true),
  question('sensitive-data','privacy','Will it process sensitive or high-impact data requiring stronger handling?','boolean',true),
  question('privacy-rules','privacy','Which consent, visibility, deletion, portability, sharing, or confidentiality rules apply?','list',true),
  question('data-retention','privacy','What retention and deletion expectations apply to product data?','text',true),
  question('accessibility-target','accessibility','What accessibility target must the product satisfy?','choice',true,['wcag-aa','wcag-aaa','platform-default','custom']),
  question('deployment-expectations','deployment','Where and how must the product be distributable or deployable?','list',true),
  question('offline-behavior','operations','What should work without internet connectivity?','choice',true,['none','read-only','core-workflows','full-local']),
  question('notifications','operations','Which notifications or background reminders are part of the product? Use "none" when none apply.','list',false),
  question('localization','operations','Which languages, regions, currencies, time zones, or localization rules are required? Use "none" when none apply.','list',false),
  question('analytics','operations','Which analytics, audit, observability, or business metrics are required? Use "none" when none apply.','list',false),
  question('scale-expectations','operations','What usage, data-volume, concurrency, latency, or performance expectations materially affect the product?','text',true),
  question('import-export','content','Which import, export, backup, migration, or portability flows are required? Use "none" when none apply.','list',false),
  question('media-requirements','content','Which image, audio, video, document, generation, or media-processing capabilities are required? Use "none" when none apply.','list',false),
  question('external-dependencies','external-dependencies','Which external dependencies must exist for the product to work or ship? Use "none" when none apply.','list',true),
  question('external-facts','external-dependencies','Which facts, credentials, contracts, approvals, content, or decisions can only come from the user or an external party? Use "none" when none apply.','list',true),
  question('legal-regulatory','external-dependencies','Which legal, regulatory, policy, store, contractual, or compliance constraints are already known? Use "none" when none apply.','list',false),
] as const);

const QUESTION_BY_ID=new Map(CATALOG.map(q=>[q.id,q] as const));

function boundedText(value:unknown,label:string,max:number):string {
  if(typeof value!=='string') throw new TypeError(label+' must be a string.');
  const out=value.trim();
  if(!out||out.length>max||CONTROL.test(out.replace(/[\n\r\t]/g,''))) throw new TypeError(label+' is invalid.');
  return out;
}
function canonicalId(value:unknown,label:string):string {
  const out=boundedText(value,label,256).toLowerCase();
  if(!ID.test(out)) throw new TypeError(label+' is invalid.');
  return out;
}
function refs(value:unknown,label:string):readonly string[] {
  if(!Array.isArray(value)||value.length<1||value.length>64) throw new RangeError(label+' must contain 1-64 source refs.');
  const out=value.map((v,i)=>boundedText(v,label+' '+(i+1),1024)).sort();
  if(new Set(out).size!==out.length) throw new TypeError(label+' contains duplicate refs.');
  return Object.freeze(out);
}
function answerValue(question:ProjectGenesisQuestion,value:unknown):ProjectGenesisAnswerValue {
  if(question.kind==='boolean') {
    if(typeof value!=='boolean') throw new TypeError(question.id+' requires a boolean answer.');
    return value;
  }
  if(question.kind==='list'||question.kind==='multi-choice') {
    if(!Array.isArray(value)||value.length<1||value.length>128) throw new RangeError(question.id+' requires a non-empty bounded list.');
    const out=value.map((item,i)=>boundedText(item,question.id+' item '+(i+1),2048));
    if(new Set(out.map(v=>v.toLowerCase())).size!==out.length) throw new TypeError(question.id+' contains duplicate values.');
    if(question.kind==='multi-choice'&&out.some(item=>!question.options.includes(item))) throw new TypeError(question.id+' contains an unsupported option.');
    return Object.freeze(out);
  }
  const out=boundedText(value,question.id+' answer',8192);
  if(question.kind==='choice'&&!question.options.includes(out)) throw new TypeError(question.id+' contains an unsupported option.');
  return out;
}
function normalizeAnswers(input:readonly ProjectGenesisAnswerInput[]):readonly ProjectGenesisAnswer[] {
  if(!Array.isArray(input)||input.length>PROJECT_GENESIS_MAX_ANSWERS) throw new RangeError('Project Genesis answers are invalid.');
  const seen=new Set<string>();
  const out=input.map((item,index)=>{
    if(!item||typeof item!=='object'||Array.isArray(item)) throw new TypeError('Project Genesis answer must be an object.');
    const question=QUESTION_BY_ID.get(item.questionId);
    if(!question) throw new TypeError('Unknown Project Genesis question: '+item.questionId+'.');
    if(seen.has(question.id)) throw new TypeError('Duplicate Project Genesis answer: '+question.id+'.');
    seen.add(question.id);
    return Object.freeze({
      questionId:question.id,value:answerValue(question,item.value),sourceRefs:refs(item.sourceRefs,'Project Genesis sourceRefs'),ordinal:index+1,
    });
  });
  return Object.freeze(out);
}
function scalar(answers:Map<string,ProjectGenesisAnswer>,id:string):string|null {
  const value=answers.get(id)?.value;
  return typeof value==='string'?value:null;
}
function bool(answers:Map<string,ProjectGenesisAnswer>,id:string):boolean|null {
  const value=answers.get(id)?.value;
  return typeof value==='boolean'?value:null;
}
function list(answers:Map<string,ProjectGenesisAnswer>,id:string):readonly string[] {
  const value=answers.get(id)?.value;
  return typeof value!=='string'&&typeof value!=='boolean'&&value!==undefined?value:Object.freeze([]);
}
function active(question:ProjectGenesisQuestion,answers:Map<string,ProjectGenesisAnswer>):boolean {
  if(question.id==='billing-rules') return scalar(answers,'monetization-model')!==null&&scalar(answers,'monetization-model')!=='none';
  if(question.id==='authorization-rules') return scalar(answers,'authentication-model')!==null&&scalar(answers,'authentication-model')!=='none';
  if(['sensitive-data','privacy-rules','data-retention'].includes(question.id)) return bool(answers,'personal-data')===true;
  return true;
}

export function deriveProjectGenesis(input:{readonly workspaceId:string;readonly projectId:string;readonly answers:readonly ProjectGenesisAnswerInput[]}):ProjectGenesisState {
  const workspaceId=canonicalId(input.workspaceId,'Project Genesis workspaceId');
  const projectId=canonicalId(input.projectId,'Project Genesis projectId');
  const answers=normalizeAnswers(input.answers);
  const byId=new Map(answers.map(a=>[a.questionId,a] as const));
  const questions=Object.freeze(CATALOG.filter(q=>active(q,byId)));
  const activeQuestionIds=Object.freeze(questions.map(q=>q.id));
  const unansweredRequiredQuestionIds=Object.freeze(questions.filter(q=>q.required&&!byId.has(q.id)).map(q=>q.id));
  return Object.freeze({
    schema:PROJECT_GENESIS_SCHEMA,build:CONTEXT_ENGINE_FINAL_BUILD,workspaceId,projectId,questions,answers,
    activeQuestionIds,unansweredRequiredQuestionIds,complete:unansweredRequiredQuestionIds.length===0,
    adaptive:true,productQuestionsOnly:true,engineeringDecisionsOwnedByVortex:true,noSilentGuessing:true,
  });
}

function flatten(value:ProjectGenesisAnswerValue):readonly string[] {
  if(typeof value==='boolean') return Object.freeze([value?'yes':'no']);
  if(typeof value==='string') return Object.freeze([value]);
  return value;
}
function criterionDomains(domain:ProjectGenesisDomain):boolean {
  return ['workflows','business-rules','content','monetization','integrations','platforms','authentication','privacy','accessibility','deployment','operations'].includes(domain);
}
function aggregateRefs(answers:readonly ProjectGenesisAnswer[]):readonly string[] {
  const out=new Set<string>();
  for(const a of answers) for(const ref of a.sourceRefs) out.add(ref);
  const sorted=[...out].sort();
  if(sorted.length>PRODUCT_CONTRACT_MAX_SOURCE_REFS) throw new RangeError('Product Contract source reference limit exceeded.');
  return Object.freeze(sorted);
}
function noneLike(value:string):boolean { return /^(?:none|n\/a|not applicable|no)$/i.test(value.trim()); }

export function compileProductContract(input:ProductContractCompileInput):ProductContract {
  if(!Number.isInteger(input.revision)||input.revision<1||input.revision>1_000_000) throw new RangeError('Product Contract revision is invalid.');
  const createdAt=boundedText(input.createdAt,'Product Contract createdAt',64);
  if(new Date(createdAt).toISOString()!==createdAt) throw new TypeError('Product Contract createdAt must be canonical ISO.');
  const genesis=deriveProjectGenesis(input);
  const answerMap=new Map(genesis.answers.map(a=>[a.questionId,a] as const));

  const unresolvedDecisions=Object.freeze(genesis.questions
    .filter(q=>q.required&&!answerMap.has(q.id))
    .map((q,index)=>Object.freeze({id:'unresolved-'+String(index+1).padStart(3,'0'),questionId:q.id,prompt:q.prompt,blockingStage:'build' as const})));

  const criteria:ProductContractAcceptanceCriterion[]=[];
  let criterionOrdinal=0;
  for(const answer of genesis.answers){
    const q=QUESTION_BY_ID.get(answer.questionId)!;
    if(!criterionDomains(q.domain)||q.id==='core-workflows'||q.id==='representative-outcomes') continue;
    for(const value of flatten(answer.value)){
      if(noneLike(value)) continue;
      criterionOrdinal+=1;
      criteria.push(Object.freeze({
        id:'ac-'+String(criterionOrdinal).padStart(4,'0'),
        statement:'Product decision "'+q.prompt+'" must be satisfied: '+value,
        sourceQuestionId:q.id,sourceRefs:answer.sourceRefs,
      }));
    }
  }
  for(const outcome of list(answerMap,'representative-outcomes')){
    if(noneLike(outcome)) continue;
    criterionOrdinal+=1;
    const answer=answerMap.get('representative-outcomes')!;
    criteria.push(Object.freeze({
      id:'ac-'+String(criterionOrdinal).padStart(4,'0'),
      statement:'Representative outcome must be observable: '+outcome,
      sourceQuestionId:'representative-outcomes',sourceRefs:answer.sourceRefs,
    }));
  }

  const roles=list(answerMap,'primary-users');
  const workflows=list(answerMap,'core-workflows');
  const outcomes=list(answerMap,'representative-outcomes');
  const workflowAnswer=answerMap.get('core-workflows');
  const journeys=Object.freeze(workflows.map((workflow,index)=>Object.freeze({
    id:'journey-'+String(index+1).padStart(3,'0'),
    actor:roles[index%Math.max(roles.length,1)]??'representative-user',
    workflow,expectedOutcome:outcomes[index]??workflow,
    sourceQuestionId:'core-workflows' as const,
    sourceRefs:workflowAnswer?.sourceRefs??Object.freeze([]),
  })));

  const external:ProductContractExternalDependency[]=[];
  let externalOrdinal=0;
  for(const [kind,qid] of [['dependency','external-dependencies'],['external-fact','external-facts']] as const){
    const a=answerMap.get(qid);
    for(const description of list(answerMap,qid)){
      if(noneLike(description)) continue;
      externalOrdinal+=1;
      external.push(Object.freeze({
        id:'external-'+String(externalOrdinal).padStart(3,'0'),kind,description,state:'declared',blockingStage:'rc',
        sourceRefs:a?.sourceRefs??Object.freeze([]),
      }));
    }
  }

  const workspaceId=genesis.workspaceId,projectId=genesis.projectId;
  const id='product-contract:'+projectId+':r'+String(input.revision).padStart(4,'0');
  const supersedesId=input.supersedesId==null?null:canonicalId(input.supersedesId,'Product Contract supersedesId');
  if(input.revision===1&&supersedesId!==null) throw new TypeError('Product Contract revision 1 cannot supersede another contract.');
  if(input.revision>1&&supersedesId===null) throw new TypeError('Product Contract revision >1 requires supersedesId.');
  const buildReady=unresolvedDecisions.length===0;
  return Object.freeze({
    schema:PRODUCT_CONTRACT_SCHEMA,build:CONTEXT_ENGINE_FINAL_BUILD,id,workspaceId,projectId,revision:input.revision,createdAt,supersedesId,
    status:buildReady?'ready':'blocked',answers:genesis.answers,acceptanceCriteria:Object.freeze(criteria),
    representativeUserJourneys:journeys,unresolvedDecisions,externalDependencies:Object.freeze(external),
    sourceRefs:aggregateRefs(genesis.answers),buildReady,rcBlockedByExternalDependencies:external.length>0,
    authoritative:true,truthRole:'product-contract',durable:true,adaptiveDiscovery:true,acceptanceCriteriaDerived:true,
    representativeJourneysDerived:true,externalDependencyLedger:true,engineeringDecisionAuthority:false,noSilentGuessing:true,localFirst:true,
  });
}

export function assertCanonicalProductContract(value:unknown):asserts value is ProductContract {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Product Contract must be an object.');
  const row=value as ProductContract;
  const rebuilt=compileProductContract({
    workspaceId:row.workspaceId,projectId:row.projectId,revision:row.revision,createdAt:row.createdAt,
    supersedesId:row.supersedesId,answers:row.answers.map(a=>({questionId:a.questionId,value:a.value,sourceRefs:a.sourceRefs})),
  });
  if(JSON.stringify(value)!==JSON.stringify(rebuilt)) throw new TypeError('Product Contract is non-canonical.');
}

function tokens(value:string):readonly string[] {
  return Object.freeze([...new Set(value.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}_-]+/u).filter(t=>t.length>=2))]);
}
function relevance(text:string,query:readonly string[]):number {
  const hay=new Set(tokens(text));
  let score=0;
  for(const term of query) if(hay.has(term)) score+=1;
  return score;
}
function limit(value:number|undefined,fallback:number,max:number,label:string):number {
  const out=value??fallback;
  if(!Number.isInteger(out)||out<1||out>max) throw new RangeError(label+' is invalid.');
  return out;
}

export function queryProductContract(contract:ProductContract,input:ProductContractQueryInput):ProductContractQueryResult {
  assertCanonicalProductContract(contract);
  if(!Array.isArray(input.terms)||input.terms.length<1||input.terms.length>16) throw new RangeError('Product Contract query requires 1-16 terms.');
  const terms=Object.freeze([...new Set(input.terms.flatMap(tokens))].slice(0,32));
  if(terms.length===0) throw new TypeError('Product Contract query terms contain no searchable tokens.');
  const maxAnswers=limit(input.maxAnswers,12,32,'Product Contract maxAnswers');
  const maxCriteria=limit(input.maxCriteria,16,64,'Product Contract maxCriteria');
  const maxJourneys=limit(input.maxJourneys,8,32,'Product Contract maxJourneys');
  const ranked=<T>(items:readonly T[],text:(item:T)=>string,max:number):readonly T[]=>Object.freeze(items
    .map((item,index)=>({item,index,score:relevance(text(item),terms)}))
    .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,max).map(x=>x.item));
  return Object.freeze({
    schema:PRODUCT_CONTRACT_QUERY_SCHEMA,contractId:contract.id,terms,
    answers:ranked(contract.answers,a=>QUESTION_BY_ID.get(a.questionId)!.prompt+' '+flatten(a.value).join(' '),maxAnswers),
    acceptanceCriteria:ranked(contract.acceptanceCriteria,c=>c.statement,maxCriteria),
    representativeUserJourneys:ranked(contract.representativeUserJourneys,j=>j.actor+' '+j.workflow+' '+j.expectedOutcome,maxJourneys),
    unresolvedDecisions:contract.unresolvedDecisions,
    externalDependencies:contract.externalDependencies,
    bounded:true,lexical:true,wholesaleContractDump:false,
  });
}

export const PROJECT_GENESIS_QUESTION_CATALOG:readonly ProjectGenesisQuestion[]=CATALOG;
