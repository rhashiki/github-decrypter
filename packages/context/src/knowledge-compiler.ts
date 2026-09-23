import {
  queryProjectKnowledgeGraph,
  type ProjectKnowledgeGraph,
} from './knowledge-graph.js';

export const KNOWLEDGE_COMPILER_BUILD=67 as const;
export const KNOWLEDGE_SOURCE_SCHEMA='gd-knowledge-source/1' as const;
export const KNOWLEDGE_CORPUS_SCHEMA='gd-knowledge-corpus/1' as const;
export const KNOWLEDGE_RETRIEVAL_SCHEMA='gd-knowledge-retrieval/1' as const;
export const KNOWLEDGE_PACK_SCHEMA='gd-knowledge-pack/1' as const;
export const KNOWLEDGE_SOURCE_MAX_CHARACTERS=1_000_000 as const;
export const KNOWLEDGE_CHUNK_MAX_CHARACTERS=6_000 as const;
export const KNOWLEDGE_CORPUS_MAX_SOURCES=256 as const;
export const KNOWLEDGE_CORPUS_MAX_CHUNKS=8_192 as const;
export const KNOWLEDGE_SEMANTIC_CANDIDATE_MAX=24 as const;

export const KNOWLEDGE_SOURCE_KINDS=Object.freeze([
  'repository-code','repository-document','technical-document','structured-json','structured-csv','plain-text',
] as const);
export type KnowledgeSourceKind=(typeof KNOWLEDGE_SOURCE_KINDS)[number];

export interface KnowledgeSourceInput {
  readonly id:string;
  readonly projectId:string;
  readonly kind:KnowledgeSourceKind;
  readonly title:string;
  readonly mediaType:string;
  readonly content:string;
  readonly sourceRef:string;
}

export interface KnowledgeChunk {
  readonly id:string;
  readonly sourceId:string;
  readonly projectId:string;
  readonly kind:KnowledgeSourceKind;
  readonly title:string;
  readonly text:string;
  readonly sourceRef:string;
  readonly ordinal:number;
  readonly promptInjectionShaped:boolean;
  readonly authority:'data';
  readonly executableInstruction:false;
}

export interface CompiledKnowledgeSource {
  readonly schema:typeof KNOWLEDGE_SOURCE_SCHEMA;
  readonly build:typeof KNOWLEDGE_COMPILER_BUILD;
  readonly id:string;
  readonly projectId:string;
  readonly kind:KnowledgeSourceKind;
  readonly title:string;
  readonly mediaType:string;
  readonly sourceRef:string;
  readonly chunks:readonly KnowledgeChunk[];
  readonly chunkCount:number;
  readonly promptInjectionShaped:boolean;
  readonly sanitized:true;
  readonly parsed:true;
  readonly sourceContentAuthority:false;
  readonly sourceContentIsData:true;
  readonly localFirst:true;
}

export interface KnowledgeCorpus {
  readonly schema:typeof KNOWLEDGE_CORPUS_SCHEMA;
  readonly build:typeof KNOWLEDGE_COMPILER_BUILD;
  readonly projectId:string;
  readonly sources:readonly CompiledKnowledgeSource[];
  readonly chunks:readonly KnowledgeChunk[];
  readonly sourceCount:number;
  readonly chunkCount:number;
  readonly sourceRefs:readonly string[];
  readonly lexicalIndex:true;
  readonly structuralIndex:boolean;
  readonly semanticIndex:'on-demand-local-rerank';
  readonly wholesaleContextDump:false;
  readonly localFirst:true;
}

export interface SemanticCandidate {
  readonly chunkId:string;
  readonly title:string;
  readonly text:string;
  readonly sourceRef:string;
  readonly authority:'data';
}

export interface SemanticScore {
  readonly chunkId:string;
  readonly score:number;
}

export interface SemanticRerankResult {
  readonly available:boolean;
  readonly reason:string|null;
  readonly scores:readonly SemanticScore[];
}

export interface KnowledgeSemanticReranker {
  rerank(input:{
    readonly query:string;
    readonly candidates:readonly SemanticCandidate[];
  }):Promise<SemanticRerankResult>;
}

export interface KnowledgeRetrievalInput {
  readonly query:string;
  readonly maxChunks?:number;
  readonly semanticReranker?:KnowledgeSemanticReranker|null;
}

export interface KnowledgeRetrievalHit {
  readonly chunk:KnowledgeChunk;
  readonly lexicalScore:number;
  readonly structuralScore:number;
  readonly semanticScore:number|null;
  readonly combinedScore:number;
}

export interface KnowledgeRetrievalResult {
  readonly schema:typeof KNOWLEDGE_RETRIEVAL_SCHEMA;
  readonly projectId:string;
  readonly query:string;
  readonly hits:readonly KnowledgeRetrievalHit[];
  readonly sourceRefs:readonly string[];
  readonly lexicalUsed:true;
  readonly structuralUsed:boolean;
  readonly semanticAvailable:boolean;
  readonly semanticUsed:boolean;
  readonly semanticReason:string|null;
  readonly bounded:true;
  readonly progressiveDisclosure:true;
  readonly wholesaleContextDump:false;
  readonly untrustedSourceAuthority:false;
}

export interface KnowledgePack {
  readonly schema:typeof KNOWLEDGE_PACK_SCHEMA;
  readonly build:typeof KNOWLEDGE_COMPILER_BUILD;
  readonly id:string;
  readonly projectId:string;
  readonly query:string;
  readonly chunks:readonly KnowledgeChunk[];
  readonly sourceRefs:readonly string[];
  readonly semanticUsed:boolean;
  readonly onDemand:true;
  readonly bounded:true;
  readonly sourceGrounded:true;
  readonly promptInjectionContentIsData:true;
  readonly wholesaleContextDump:false;
}

const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const ANSI=/\u001b\[[0-?]*[ -\/]*[@-~]/g;
const ID=/^[a-z][a-z0-9._:/#_-]{0,255}$/;
const KINDS=new Set<KnowledgeSourceKind>(KNOWLEDGE_SOURCE_KINDS);
const INJECTION_PATTERNS=[
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /(?:system|developer)\s+(?:message|prompt|instruction)/i,
  /you\s+are\s+(?:now|chatgpt|an?\s+ai)/i,
  /(?:reveal|print|show)\s+(?:the\s+)?(?:system|developer)\s+prompt/i,
  /<\|(?:system|assistant|developer|user)\|>/i,
  /(?:do not|don't)\s+follow\s+(?:the\s+)?(?:user|developer|system)/i,
] as const;

function bounded(value:unknown,label:string,max:number):string{
  if(typeof value!=='string') throw new TypeError(label+' must be a string.');
  const out=value.trim();
  if(!out||out.length>max) throw new TypeError(label+' is invalid.');
  return out;
}
function id(value:unknown,label:string):string{
  const out=bounded(value,label,256).toLowerCase();
  if(!ID.test(out)) throw new TypeError(label+' is invalid.');
  return out;
}
function normalizeSourceContent(value:unknown):string{
  if(typeof value!=='string') throw new TypeError('Knowledge source content must be a string.');
  if(value.length<1||value.length>KNOWLEDGE_SOURCE_MAX_CHARACTERS) throw new RangeError('Knowledge source content size is invalid.');
  return value.normalize('NFC').replace(/\r\n?/g,'\n').replace(ANSI,'').replace(CONTROL,'').trim();
}
function injectionShaped(value:string):boolean{return INJECTION_PATTERNS.some(pattern=>pattern.test(value));}
function mediaType(value:unknown):string{
  const out=bounded(value,'Knowledge source mediaType',128).toLowerCase();
  if(!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+;-]*$/i.test(out)) throw new TypeError('Knowledge source mediaType is invalid.');
  return out;
}
function splitBounded(text:string):readonly string[]{
  if(text.length<=KNOWLEDGE_CHUNK_MAX_CHARACTERS) return Object.freeze([text]);
  const lines=text.split('\n');
  const chunks:string[]=[];
  let current='';
  const flush=()=>{const out=current.trim();if(out)chunks.push(out);current='';};
  for(const line of lines){
    if(line.length>KNOWLEDGE_CHUNK_MAX_CHARACTERS){
      flush();
      for(let i=0;i<line.length;i+=KNOWLEDGE_CHUNK_MAX_CHARACTERS) chunks.push(line.slice(i,i+KNOWLEDGE_CHUNK_MAX_CHARACTERS));
      continue;
    }
    const next=current?current+'\n'+line:line;
    if(next.length>KNOWLEDGE_CHUNK_MAX_CHARACTERS){flush();current=line;}else current=next;
  }
  flush();
  return Object.freeze(chunks);
}
function textChunks(text:string):readonly string[]{
  const sections=text.split(/\n(?=#{1,6}\s)|\n{2,}/).map(v=>v.trim()).filter(Boolean);
  const out:string[]=[];
  for(const section of sections) out.push(...splitBounded(section));
  return Object.freeze(out);
}
function codeChunks(text:string):readonly string[]{
  const lines=text.split('\n');
  const out:string[]=[];
  for(let start=0;start<lines.length;start+=80){
    const slice=lines.slice(start,start+100).join('\n').trim();
    if(slice) out.push(...splitBounded('lines '+(start+1)+'-'+Math.min(start+100,lines.length)+'\n'+slice));
  }
  return Object.freeze(out);
}
function flattenJson(value:unknown,path:string,depth:number,out:string[]):void{
  if(depth>32) throw new RangeError('Structured JSON exceeds maximum nesting depth.');
  if(out.length>10_000) throw new RangeError('Structured JSON exceeds maximum leaf count.');
  if(value===null||typeof value==='string'||typeof value==='number'||typeof value==='boolean'){
    out.push((path||'$')+' = '+JSON.stringify(value));return;
  }
  if(Array.isArray(value)){
    value.forEach((item,index)=>flattenJson(item,(path||'$')+'['+index+']',depth+1,out));return;
  }
  if(typeof value==='object'){
    const row=value as Record<string,unknown>;
    for(const key of Object.keys(row).sort()) flattenJson(row[key],(path?path+'.':'$.')+key,depth+1,out);
    return;
  }
  throw new TypeError('Structured JSON contains unsupported values.');
}
function jsonChunks(text:string):readonly string[]{
  let parsed:unknown;
  try{parsed=JSON.parse(text);}catch{throw new TypeError('Structured JSON source is invalid JSON.');}
  const leaves:string[]=[];flattenJson(parsed,'',0,leaves);
  return textChunks(leaves.join('\n'));
}
function parseCsv(text:string):readonly (readonly string[])[]{
  const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
  for(let i=0;i<text.length;i+=1){
    const ch=text[i]!;
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){cell+='"';i+=1;}
      else if(ch==='"') quoted=false;
      else cell+=ch;
    }else if(ch==='"') quoted=true;
    else if(ch===','){row.push(cell);cell='';}
    else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';if(rows.length>10_000)throw new RangeError('Structured CSV exceeds row limit.');}
    else cell+=ch;
  }
  if(quoted) throw new TypeError('Structured CSV contains an unterminated quoted field.');
  row.push(cell);if(row.some(v=>v.length>0)||rows.length===0)rows.push(row);
  const width=Math.max(...rows.map(r=>r.length));
  if(width>256) throw new RangeError('Structured CSV exceeds column limit.');
  return Object.freeze(rows.map(r=>Object.freeze(r)));
}
function csvChunks(text:string):readonly string[]{
  const rows=parseCsv(text);const header=rows[0]??Object.freeze([]);
  const rendered=rows.slice(1).map((row,index)=>'row '+(index+2)+': '+row.map((value,col)=>(header[col]||'column_'+(col+1))+'='+JSON.stringify(value)).join(' | '));
  return textChunks(rendered.join('\n')||text);
}

export function compileKnowledgeSource(input:KnowledgeSourceInput):CompiledKnowledgeSource{
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new TypeError('Knowledge source input must be an object.');
  const sourceId=id(input.id,'Knowledge source id'),projectId=id(input.projectId,'Knowledge source projectId');
  if(!KINDS.has(input.kind)) throw new TypeError('Knowledge source kind is invalid.');
  const title=bounded(input.title,'Knowledge source title',512);
  const normalized=normalizeSourceContent(input.content);
  const sourceRef=bounded(input.sourceRef,'Knowledge source ref',1024);
  const mt=mediaType(input.mediaType);
  const pieces=input.kind==='structured-json'?jsonChunks(normalized)
    :input.kind==='structured-csv'?csvChunks(normalized)
    :input.kind==='repository-code'?codeChunks(normalized):textChunks(normalized);
  if(pieces.length<1||pieces.length>4096) throw new RangeError('Knowledge source chunk count is invalid.');
  const chunks=Object.freeze(pieces.map((text,index)=>Object.freeze({
    id:sourceId+'#chunk-'+String(index+1).padStart(4,'0'),sourceId,projectId,kind:input.kind,title,text,sourceRef,
    ordinal:index+1,promptInjectionShaped:injectionShaped(text),authority:'data' as const,executableInstruction:false as const,
  })));
  return Object.freeze({
    schema:KNOWLEDGE_SOURCE_SCHEMA,build:KNOWLEDGE_COMPILER_BUILD,id:sourceId,projectId,kind:input.kind,title,mediaType:mt,sourceRef,
    chunks,chunkCount:chunks.length,promptInjectionShaped:chunks.some(c=>c.promptInjectionShaped),sanitized:true,parsed:true,
    sourceContentAuthority:false,sourceContentIsData:true,localFirst:true,
  });
}

export function compileKnowledgeCorpus(input:{readonly projectId:string;readonly sources:readonly KnowledgeSourceInput[]}):KnowledgeCorpus{
  const projectId=id(input.projectId,'Knowledge corpus projectId');
  if(!Array.isArray(input.sources)||input.sources.length<1||input.sources.length>KNOWLEDGE_CORPUS_MAX_SOURCES) throw new RangeError('Knowledge corpus source count is invalid.');
  const sources=Object.freeze(input.sources.map(compileKnowledgeSource).sort((a,b)=>a.id.localeCompare(b.id)));
  if(sources.some(source=>source.projectId!==projectId)) throw new TypeError('Knowledge corpus source belongs to another project.');
  if(new Set(sources.map(s=>s.id)).size!==sources.length) throw new TypeError('Knowledge corpus source ids must be unique.');
  const chunks=Object.freeze(sources.flatMap(s=>s.chunks));
  if(chunks.length>KNOWLEDGE_CORPUS_MAX_CHUNKS) throw new RangeError('Knowledge corpus chunk limit exceeded.');
  return Object.freeze({
    schema:KNOWLEDGE_CORPUS_SCHEMA,build:KNOWLEDGE_COMPILER_BUILD,projectId,sources,chunks,
    sourceCount:sources.length,chunkCount:chunks.length,sourceRefs:Object.freeze([...new Set(sources.map(s=>s.sourceRef))].sort()),
    lexicalIndex:true,structuralIndex:false,semanticIndex:'on-demand-local-rerank',wholesaleContextDump:false,localFirst:true,
  });
}

function tokens(value:string):readonly string[]{
  return Object.freeze(value.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}_-]+/u).filter(t=>t.length>=2).slice(0,4096));
}
function queryTokens(value:string):readonly string[]{
  const out=[...new Set(tokens(value))].slice(0,32);if(out.length<1)throw new TypeError('Knowledge query contains no searchable tokens.');return Object.freeze(out);
}
function lexical(text:string,query:readonly string[]):number{
  const ts=tokens(text);if(!ts.length)return 0;const counts=new Map<string,number>();for(const t of ts)counts.set(t,(counts.get(t)??0)+1);
  let score=0;for(const q of query){const count=counts.get(q)??0;if(count)score+=1+Math.log1p(count);}
  return score/Math.max(1,Math.sqrt(ts.length));
}
function normalizeScores(values:readonly number[]):readonly number[]{
  const max=Math.max(0,...values);return Object.freeze(values.map(v=>max>0?v/max:0));
}
function boundedMax(value:number|undefined,fallback:number,max:number):number{
  const out=value??fallback;if(!Number.isInteger(out)||out<1||out>max)throw new RangeError('Knowledge retrieval maxChunks is invalid.');return out;
}

export async function retrieveKnowledge(
  corpus:KnowledgeCorpus,
  graph:ProjectKnowledgeGraph|null,
  input:KnowledgeRetrievalInput,
):Promise<KnowledgeRetrievalResult>{
  if(corpus.schema!==KNOWLEDGE_CORPUS_SCHEMA) throw new TypeError('Knowledge retrieval requires a canonical corpus.');
  const query=bounded(input.query,'Knowledge query',4096);
  const qTokens=queryTokens(query);
  const maxChunks=boundedMax(input.maxChunks,12,64);

  let graphRefs=new Set<string>();let structuralUsed=false;
  if(graph){
    const graphResult=queryProjectKnowledgeGraph(graph,{textTerms:qTokens.slice(0,8),depth:2,maxNodes:128,maxEdges:256});
    graphRefs=new Set(graphResult.sourceRefs);structuralUsed=true;
  }

  const raw=corpus.chunks.map((chunk,index)=>({
    chunk,index,lexicalScore:lexical(chunk.title+'\n'+chunk.text+'\n'+chunk.sourceRef,qTokens),
    structuralScore:graphRefs.has(chunk.sourceRef)?1:0,
  }));
  const lexicalNorm=normalizeScores(raw.map(x=>x.lexicalScore));
  const ranked=raw.map((x,index)=>({...x,lexicalScore:lexicalNorm[index]!}))
    .filter(x=>x.lexicalScore>0||x.structuralScore>0)
    .sort((a,b)=>(b.lexicalScore*0.75+b.structuralScore*0.25)-(a.lexicalScore*0.75+a.structuralScore*0.25)||a.index-b.index);
  const candidates=ranked.slice(0,KNOWLEDGE_SEMANTIC_CANDIDATE_MAX);

  let semanticAvailable=false,semanticUsed=false,semanticReason:string|null='local-semantic-reranker-not-provided';
  const semanticById=new Map<string,number>();
  if(input.semanticReranker&&candidates.length){
    const result=await input.semanticReranker.rerank({
      query,candidates:Object.freeze(candidates.map(x=>Object.freeze({
        chunkId:x.chunk.id,title:x.chunk.title,text:x.chunk.text.slice(0,2500),sourceRef:x.chunk.sourceRef,authority:'data' as const,
      }))),
    });
    semanticAvailable=result.available;semanticReason=result.reason;
    if(result.available){
      const expected=new Set(candidates.map(c=>c.chunk.id));
      for(const score of result.scores){
        if(!expected.has(score.chunkId)||semanticById.has(score.chunkId)||!Number.isFinite(score.score)||score.score<0||score.score>1){
          throw new TypeError('Semantic reranker returned invalid scores.');
        }
        semanticById.set(score.chunkId,score.score);
      }
      semanticUsed=semanticById.size>0;
    }
  }

  const hits=Object.freeze(candidates.map(x=>{
    const semanticScore=semanticUsed?(semanticById.get(x.chunk.id)??0):null;
    const combined=semanticScore===null?(x.lexicalScore*0.75+x.structuralScore*0.25)
      :(x.lexicalScore*0.55+x.structuralScore*0.20+semanticScore*0.25);
    return Object.freeze({chunk:x.chunk,lexicalScore:x.lexicalScore,structuralScore:x.structuralScore,semanticScore,combinedScore:combined});
  }).sort((a,b)=>b.combinedScore-a.combinedScore||a.chunk.id.localeCompare(b.chunk.id)).slice(0,maxChunks));
  const refs=Object.freeze([...new Set(hits.map(h=>h.chunk.sourceRef))].sort());
  return Object.freeze({
    schema:KNOWLEDGE_RETRIEVAL_SCHEMA,projectId:corpus.projectId,query,hits,sourceRefs:refs,lexicalUsed:true,structuralUsed,
    semanticAvailable,semanticUsed,semanticReason,bounded:true,progressiveDisclosure:true,wholesaleContextDump:false,untrustedSourceAuthority:false,
  });
}

export function compileKnowledgePack(result:KnowledgeRetrievalResult):KnowledgePack{
  if(result.schema!==KNOWLEDGE_RETRIEVAL_SCHEMA) throw new TypeError('Knowledge Pack requires canonical retrieval output.');
  const chunks=Object.freeze(result.hits.map(hit=>hit.chunk));
  const key=result.query.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'query';
  return Object.freeze({
    schema:KNOWLEDGE_PACK_SCHEMA,build:KNOWLEDGE_COMPILER_BUILD,id:'knowledge-pack:'+result.projectId+':'+key,
    projectId:result.projectId,query:result.query,chunks,sourceRefs:result.sourceRefs,semanticUsed:result.semanticUsed,
    onDemand:true,bounded:true,sourceGrounded:true,promptInjectionContentIsData:true,wholesaleContextDump:false,
  });
}
