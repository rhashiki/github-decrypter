export const PROJECT_KNOWLEDGE_GRAPH_BUILD = 65 as const;
export const PROJECT_KNOWLEDGE_GRAPH_SCHEMA = 'gd-project-knowledge-graph/1' as const;
export const PROJECT_KNOWLEDGE_QUERY_SCHEMA = 'gd-project-knowledge-query/1' as const;
export const PROJECT_KNOWLEDGE_GRAPH_MAX_NODES = 50_000 as const;
export const PROJECT_KNOWLEDGE_GRAPH_MAX_EDGES = 200_000 as const;
export const PROJECT_KNOWLEDGE_GRAPH_MAX_SOURCE_REFS = 32 as const;
export const PROJECT_KNOWLEDGE_QUERY_MAX_NODES = 256 as const;
export const PROJECT_KNOWLEDGE_QUERY_MAX_EDGES = 512 as const;
export const PROJECT_KNOWLEDGE_QUERY_MAX_DEPTH = 4 as const;
export const PROJECT_KNOWLEDGE_QUERY_MAX_TERMS = 8 as const;
export const PROJECT_KNOWLEDGE_QUERY_MAX_SOURCE_REFS = 2_048 as const;

export const PROJECT_KNOWLEDGE_NODE_KINDS = Object.freeze([
  'repository','module','file','symbol','document','topic','entity',
] as const);
export const PROJECT_KNOWLEDGE_EDGE_KINDS = Object.freeze([
  'contains','imports','depends-on','defines','references','mentions','relates-to',
] as const);
export const PROJECT_KNOWLEDGE_QUERY_DIRECTIONS = Object.freeze(['inbound','outbound','both'] as const);

export type ProjectKnowledgeNodeKind=(typeof PROJECT_KNOWLEDGE_NODE_KINDS)[number];
export type ProjectKnowledgeEdgeKind=(typeof PROJECT_KNOWLEDGE_EDGE_KINDS)[number];
export type ProjectKnowledgeQueryDirection=(typeof PROJECT_KNOWLEDGE_QUERY_DIRECTIONS)[number];

export interface ProjectKnowledgeNodeInput {
  readonly id:string;
  readonly kind:ProjectKnowledgeNodeKind;
  readonly label:string;
  readonly sourceRefs:readonly string[];
}

export interface ProjectKnowledgeEdgeInput {
  readonly from:string;
  readonly to:string;
  readonly kind:ProjectKnowledgeEdgeKind;
  readonly sourceRefs:readonly string[];
}

export interface ProjectKnowledgeGraphInput {
  readonly projectId:string;
  readonly nodes:readonly ProjectKnowledgeNodeInput[];
  readonly edges:readonly ProjectKnowledgeEdgeInput[];
}

export interface ProjectKnowledgeNode extends ProjectKnowledgeNodeInput {
  readonly ordinal:number;
}

export interface ProjectKnowledgeEdge extends ProjectKnowledgeEdgeInput {
  readonly id:string;
  readonly ordinal:number;
}

export interface ProjectKnowledgeGraph {
  readonly schema:typeof PROJECT_KNOWLEDGE_GRAPH_SCHEMA;
  readonly build:typeof PROJECT_KNOWLEDGE_GRAPH_BUILD;
  readonly id:string;
  readonly projectId:string;
  readonly nodes:readonly ProjectKnowledgeNode[];
  readonly edges:readonly ProjectKnowledgeEdge[];
  readonly nodeCount:number;
  readonly edgeCount:number;
  readonly sourceRefCount:number;
  readonly nodeKindCounts:Readonly<Record<ProjectKnowledgeNodeKind,number>>;
  readonly edgeKindCounts:Readonly<Record<ProjectKnowledgeEdgeKind,number>>;
  readonly repositoryGraph:true;
  readonly moduleDependencyGraph:true;
  readonly symbolReferenceRelationships:true;
  readonly documentTopicEntityRelationships:true;
  readonly traceableSourceReferences:true;
  readonly boundedRetrieval:true;
  readonly wholesaleContextDump:false;
  readonly deterministic:true;
  readonly immutable:true;
  readonly localFirst:true;
  readonly semanticEmbedding:false;
  readonly aiExecution:false;
  readonly projectMemory:false;
  readonly knowledgeCompiler:false;
  readonly persistence:false;
  readonly networkAuthority:false;
  readonly filesystemAuthority:false;
  readonly databaseAuthority:false;
}

export interface ProjectKnowledgeQueryInput {
  readonly nodeIds?:readonly string[];
  readonly nodeKinds?:readonly ProjectKnowledgeNodeKind[];
  readonly edgeKinds?:readonly ProjectKnowledgeEdgeKind[];
  readonly textTerms?:readonly string[];
  readonly direction?:ProjectKnowledgeQueryDirection;
  readonly depth?:number;
  readonly maxNodes?:number;
  readonly maxEdges?:number;
}

export interface ProjectKnowledgeQueryResult {
  readonly schema:typeof PROJECT_KNOWLEDGE_QUERY_SCHEMA;
  readonly sourceSchema:typeof PROJECT_KNOWLEDGE_GRAPH_SCHEMA;
  readonly projectId:string;
  readonly nodes:readonly ProjectKnowledgeNode[];
  readonly edges:readonly ProjectKnowledgeEdge[];
  readonly sourceRefs:readonly string[];
  readonly matchedNodeIds:readonly string[];
  readonly requestedDepth:number;
  readonly exploredDepth:number;
  readonly direction:ProjectKnowledgeQueryDirection;
  readonly maxNodes:number;
  readonly maxEdges:number;
  readonly truncated:boolean;
  readonly deterministic:true;
  readonly lexical:true;
  readonly semantic:false;
  readonly bounded:true;
  readonly wholesaleContextDump:false;
}

const ID=/^[a-z][a-z0-9._:/#-]{0,255}$/;
const CONTROL=/[\u0000-\u001f\u007f]/;
const NODE_KINDS=new Set<ProjectKnowledgeNodeKind>(PROJECT_KNOWLEDGE_NODE_KINDS);
const EDGE_KINDS=new Set<ProjectKnowledgeEdgeKind>(PROJECT_KNOWLEDGE_EDGE_KINDS);
const DIRECTIONS=new Set<ProjectKnowledgeQueryDirection>(PROJECT_KNOWLEDGE_QUERY_DIRECTIONS);

function exactKeys(value:Record<string,unknown>,expected:readonly string[],label:string):void {
  const keys=Object.keys(value).sort();
  const target=[...expected].sort();
  if(JSON.stringify(keys)!==JSON.stringify(target)) throw new TypeError(label+' fields are invalid.');
}
function boundedText(value:unknown,label:string,max:number):string {
  if(typeof value!=='string') throw new TypeError(label+' must be a string.');
  const normalized=value.trim();
  if(!normalized||normalized.length>max||CONTROL.test(normalized)) throw new TypeError(label+' is invalid.');
  return normalized;
}
function id(value:unknown,label:string):string {
  const normalized=boundedText(value,label,256).toLowerCase();
  if(!ID.test(normalized)) throw new TypeError(label+' is invalid.');
  return normalized;
}
function sourceRef(value:unknown,label:string):string {
  return boundedText(value,label,1024);
}
function sourceRefs(value:unknown,label:string):readonly string[] {
  if(!Array.isArray(value)||value.length<1||value.length>PROJECT_KNOWLEDGE_GRAPH_MAX_SOURCE_REFS) {
    throw new RangeError(label+' must contain 1-'+PROJECT_KNOWLEDGE_GRAPH_MAX_SOURCE_REFS+' source references.');
  }
  const normalized=value.map((item,index)=>sourceRef(item,label+' '+(index+1))).sort();
  if(new Set(normalized).size!==normalized.length) throw new TypeError(label+' contains duplicate source references.');
  return Object.freeze(normalized);
}
function normalizeNode(value:unknown):ProjectKnowledgeNodeInput {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Knowledge Graph node must be an object.');
  const row=value as Record<string,unknown>;
  exactKeys(row,['id','kind','label','sourceRefs'],'Knowledge Graph node');
  if(typeof row.kind!=='string'||!NODE_KINDS.has(row.kind as ProjectKnowledgeNodeKind)) throw new TypeError('Knowledge Graph node kind is invalid.');
  return Object.freeze({
    id:id(row.id,'Knowledge Graph node id'),
    kind:row.kind as ProjectKnowledgeNodeKind,
    label:boundedText(row.label,'Knowledge Graph node label',512),
    sourceRefs:sourceRefs(row.sourceRefs,'Knowledge Graph node sourceRefs'),
  });
}
function normalizeEdge(value:unknown):ProjectKnowledgeEdgeInput {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Knowledge Graph edge must be an object.');
  const row=value as Record<string,unknown>;
  exactKeys(row,['from','to','kind','sourceRefs'],'Knowledge Graph edge');
  if(typeof row.kind!=='string'||!EDGE_KINDS.has(row.kind as ProjectKnowledgeEdgeKind)) throw new TypeError('Knowledge Graph edge kind is invalid.');
  const from=id(row.from,'Knowledge Graph edge from');
  const to=id(row.to,'Knowledge Graph edge to');
  if(from===to) throw new TypeError('Knowledge Graph self-edges are forbidden.');
  return Object.freeze({
    from,to,kind:row.kind as ProjectKnowledgeEdgeKind,
    sourceRefs:sourceRefs(row.sourceRefs,'Knowledge Graph edge sourceRefs'),
  });
}
function countNodeKinds(nodes:readonly ProjectKnowledgeNode[]):Readonly<Record<ProjectKnowledgeNodeKind,number>> {
  const counts=Object.fromEntries(PROJECT_KNOWLEDGE_NODE_KINDS.map(kind=>[kind,0])) as Record<ProjectKnowledgeNodeKind,number>;
  for(const node of nodes) counts[node.kind]+=1;
  return Object.freeze(counts);
}
function countEdgeKinds(edges:readonly ProjectKnowledgeEdge[]):Readonly<Record<ProjectKnowledgeEdgeKind,number>> {
  const counts=Object.fromEntries(PROJECT_KNOWLEDGE_EDGE_KINDS.map(kind=>[kind,0])) as Record<ProjectKnowledgeEdgeKind,number>;
  for(const edge of edges) counts[edge.kind]+=1;
  return Object.freeze(counts);
}

export function createProjectKnowledgeGraph(input:ProjectKnowledgeGraphInput):ProjectKnowledgeGraph {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new TypeError('Knowledge Graph input must be an object.');
  exactKeys(input as unknown as Record<string,unknown>,['projectId','nodes','edges'],'Knowledge Graph input');
  const projectId=id(input.projectId,'Knowledge Graph projectId');
  if(!Array.isArray(input.nodes)||input.nodes.length<1||input.nodes.length>PROJECT_KNOWLEDGE_GRAPH_MAX_NODES) {
    throw new RangeError('Knowledge Graph node count is invalid.');
  }
  if(!Array.isArray(input.edges)||input.edges.length>PROJECT_KNOWLEDGE_GRAPH_MAX_EDGES) {
    throw new RangeError('Knowledge Graph edge count is invalid.');
  }

  const normalizedNodes=input.nodes.map(normalizeNode).sort((a,b)=>(a.kind+'\0'+a.id).localeCompare(b.kind+'\0'+b.id));
  if(new Set(normalizedNodes.map(node=>node.id)).size!==normalizedNodes.length) throw new TypeError('Knowledge Graph node ids must be unique.');
  const nodeIds=new Set(normalizedNodes.map(node=>node.id));
  const nodes=Object.freeze(normalizedNodes.map((node,index)=>Object.freeze({...node,ordinal:index+1})));

  const normalizedEdges=input.edges.map(normalizeEdge);
  for(const edge of normalizedEdges) {
    if(!nodeIds.has(edge.from)||!nodeIds.has(edge.to)) throw new TypeError('Knowledge Graph edge references an unknown node.');
  }
  normalizedEdges.sort((a,b)=>{
    const left=a.from+'\0'+a.kind+'\0'+a.to+'\0'+a.sourceRefs.join('\0');
    const right=b.from+'\0'+b.kind+'\0'+b.to+'\0'+b.sourceRefs.join('\0');
    return left.localeCompare(right);
  });
  const edgeKeys=normalizedEdges.map(edge=>edge.from+'>'+edge.kind+'>'+edge.to+'>'+edge.sourceRefs.join('|'));
  if(new Set(edgeKeys).size!==edgeKeys.length) throw new TypeError('Knowledge Graph contains duplicate edges.');
  const edges=Object.freeze(normalizedEdges.map((edge,index)=>Object.freeze({
    ...edge,id:'kg-edge-'+String(index+1).padStart(6,'0'),ordinal:index+1,
  })));

  const sourceRefSet=new Set<string>();
  for(const node of nodes) for(const ref of node.sourceRefs) sourceRefSet.add(ref);
  for(const edge of edges) for(const ref of edge.sourceRefs) sourceRefSet.add(ref);

  return Object.freeze({
    schema:PROJECT_KNOWLEDGE_GRAPH_SCHEMA,build:PROJECT_KNOWLEDGE_GRAPH_BUILD,
    id:'knowledge-graph:'+projectId,projectId,nodes,edges,nodeCount:nodes.length,edgeCount:edges.length,
    sourceRefCount:sourceRefSet.size,nodeKindCounts:countNodeKinds(nodes),edgeKindCounts:countEdgeKinds(edges),
    repositoryGraph:true,moduleDependencyGraph:true,symbolReferenceRelationships:true,
    documentTopicEntityRelationships:true,traceableSourceReferences:true,boundedRetrieval:true,
    wholesaleContextDump:false,deterministic:true,immutable:true,localFirst:true,semanticEmbedding:false,
    aiExecution:false,projectMemory:false,knowledgeCompiler:false,persistence:false,
    networkAuthority:false,filesystemAuthority:false,databaseAuthority:false,
  });
}

export function assertCanonicalProjectKnowledgeGraph(value:unknown):asserts value is ProjectKnowledgeGraph {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Knowledge Graph must be an object.');
  const graph=value as ProjectKnowledgeGraph;
  const rebuilt=createProjectKnowledgeGraph({
    projectId:graph.projectId,
    nodes:graph.nodes.map(node=>({id:node.id,kind:node.kind,label:node.label,sourceRefs:node.sourceRefs})),
    edges:graph.edges.map(edge=>({from:edge.from,to:edge.to,kind:edge.kind,sourceRefs:edge.sourceRefs})),
  });
  if(JSON.stringify(value)!==JSON.stringify(rebuilt)) throw new TypeError('Knowledge Graph is non-canonical.');
}

function uniqueIds(values:readonly string[]|undefined,label:string,max:number):readonly string[] {
  if(values===undefined) return Object.freeze([]);
  if(!Array.isArray(values)||values.length>max) throw new RangeError(label+' is invalid.');
  const normalized=values.map((value,index)=>id(value,label+' '+(index+1))).sort();
  if(new Set(normalized).size!==normalized.length) throw new TypeError(label+' contains duplicates.');
  return Object.freeze(normalized);
}
function nodeKinds(values:readonly ProjectKnowledgeNodeKind[]|undefined):readonly ProjectKnowledgeNodeKind[] {
  if(values===undefined) return Object.freeze([]);
  if(!Array.isArray(values)||values.length>PROJECT_KNOWLEDGE_NODE_KINDS.length) throw new RangeError('Knowledge Graph query nodeKinds is invalid.');
  const out=[...values];
  if(out.some(kind=>!NODE_KINDS.has(kind))||new Set(out).size!==out.length) throw new TypeError('Knowledge Graph query nodeKinds is invalid.');
  return Object.freeze(out.sort());
}
function edgeKinds(values:readonly ProjectKnowledgeEdgeKind[]|undefined):readonly ProjectKnowledgeEdgeKind[] {
  if(values===undefined) return Object.freeze([]);
  if(!Array.isArray(values)||values.length>PROJECT_KNOWLEDGE_EDGE_KINDS.length) throw new RangeError('Knowledge Graph query edgeKinds is invalid.');
  const out=[...values];
  if(out.some(kind=>!EDGE_KINDS.has(kind))||new Set(out).size!==out.length) throw new TypeError('Knowledge Graph query edgeKinds is invalid.');
  return Object.freeze(out.sort());
}
function terms(values:readonly string[]|undefined):readonly string[] {
  if(values===undefined) return Object.freeze([]);
  if(!Array.isArray(values)||values.length>PROJECT_KNOWLEDGE_QUERY_MAX_TERMS) throw new RangeError('Knowledge Graph query textTerms is invalid.');
  const out=values.map((value,index)=>boundedText(value,'Knowledge Graph query term '+(index+1),128).toLowerCase()).sort();
  if(new Set(out).size!==out.length) throw new TypeError('Knowledge Graph query textTerms contains duplicates.');
  return Object.freeze(out);
}
function integer(value:number|undefined,fallback:number,min:number,max:number,label:string):number {
  const out=value===undefined?fallback:value;
  if(!Number.isInteger(out)||out<min||out>max) throw new RangeError(label+' is invalid.');
  return out;
}

export function queryProjectKnowledgeGraph(graph:ProjectKnowledgeGraph,input:ProjectKnowledgeQueryInput):ProjectKnowledgeQueryResult {
  assertCanonicalProjectKnowledgeGraph(graph);
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new TypeError('Knowledge Graph query input must be an object.');
  const allowed=new Set(['nodeIds','nodeKinds','edgeKinds','textTerms','direction','depth','maxNodes','maxEdges']);
  for(const key of Object.keys(input)) if(!allowed.has(key)) throw new TypeError('Knowledge Graph query field is invalid: '+key+'.');

  const selectedIds=uniqueIds(input.nodeIds,'Knowledge Graph query nodeIds',PROJECT_KNOWLEDGE_QUERY_MAX_NODES);
  const selectedNodeKinds=nodeKinds(input.nodeKinds);
  const selectedEdgeKinds=edgeKinds(input.edgeKinds);
  const selectedTerms=terms(input.textTerms);
  if(selectedIds.length===0&&selectedNodeKinds.length===0&&selectedEdgeKinds.length===0&&selectedTerms.length===0) {
    throw new TypeError('Knowledge Graph query requires at least one selector; unbounded graph dumping is forbidden.');
  }

  const direction=input.direction??'both';
  if(!DIRECTIONS.has(direction)) throw new TypeError('Knowledge Graph query direction is invalid.');
  const depth=integer(input.depth,1,0,PROJECT_KNOWLEDGE_QUERY_MAX_DEPTH,'Knowledge Graph query depth');
  const maxNodes=integer(input.maxNodes,64,1,PROJECT_KNOWLEDGE_QUERY_MAX_NODES,'Knowledge Graph query maxNodes');
  const maxEdges=integer(input.maxEdges,128,0,PROJECT_KNOWLEDGE_QUERY_MAX_EDGES,'Knowledge Graph query maxEdges');

  const idSet=new Set(selectedIds),kindSet=new Set(selectedNodeKinds),edgeKindSet=new Set(selectedEdgeKinds);
  const hasNodeSelector=selectedIds.length>0||selectedNodeKinds.length>0||selectedTerms.length>0;
  const matchingNode=(node:ProjectKnowledgeNode):boolean=>{
    if(selectedIds.length&& !idSet.has(node.id)) return false;
    if(selectedNodeKinds.length&& !kindSet.has(node.kind)) return false;
    if(selectedTerms.length){
      const haystack=(node.id+'\n'+node.label+'\n'+node.sourceRefs.join('\n')).toLowerCase();
      if(selectedTerms.some(term=>!haystack.includes(term))) return false;
    }
    return true;
  };

  let seedIds=graph.nodes.filter(node=>hasNodeSelector&&matchingNode(node)).map(node=>node.id);
  if(!hasNodeSelector&&selectedEdgeKinds.length){
    const fromEdges=graph.edges.filter(edge=>edgeKindSet.has(edge.kind));
    seedIds=[...new Set(fromEdges.flatMap(edge=>[edge.from,edge.to]))].sort();
  }
  let truncated=seedIds.length>maxNodes;
  const matchedNodeIds=Object.freeze(seedIds.slice(0,maxNodes));
  const included=new Set(matchedNodeIds);
  let frontier=[...included];
  let exploredDepth=0;

  for(let level=1;level<=depth&&frontier.length&&included.size<maxNodes;level+=1){
    const next=new Set<string>();
    const frontierSet=new Set(frontier);
    for(const edge of graph.edges){
      if(selectedEdgeKinds.length&&!edgeKindSet.has(edge.kind)) continue;
      const outbound=direction!=='inbound'&&frontierSet.has(edge.from);
      const inbound=direction!=='outbound'&&frontierSet.has(edge.to);
      if(outbound&&!included.has(edge.to)) next.add(edge.to);
      if(inbound&&!included.has(edge.from)) next.add(edge.from);
    }
    const ordered=[...next].sort();
    for(const nodeId of ordered){
      if(included.size>=maxNodes){truncated=true;break;}
      included.add(nodeId);
    }
    frontier=ordered.filter(nodeId=>included.has(nodeId));
    if(frontier.length) exploredDepth=level;
  }

  const nodes=Object.freeze(graph.nodes.filter(node=>included.has(node.id)).slice(0,maxNodes));
  const eligibleEdges=graph.edges.filter(edge=>{
    if(selectedEdgeKinds.length&&!edgeKindSet.has(edge.kind)) return false;
    return included.has(edge.from)&&included.has(edge.to);
  });
  if(eligibleEdges.length>maxEdges) truncated=true;
  const edges=Object.freeze(eligibleEdges.slice(0,maxEdges));

  const refs=new Set<string>();
  for(const node of nodes) for(const ref of node.sourceRefs) refs.add(ref);
  for(const edge of edges) for(const ref of edge.sourceRefs) refs.add(ref);

  const orderedRefs=[...refs].sort();
  if(orderedRefs.length>PROJECT_KNOWLEDGE_QUERY_MAX_SOURCE_REFS) truncated=true;

  return Object.freeze({
    schema:PROJECT_KNOWLEDGE_QUERY_SCHEMA,sourceSchema:PROJECT_KNOWLEDGE_GRAPH_SCHEMA,projectId:graph.projectId,
    nodes,edges,sourceRefs:Object.freeze(orderedRefs.slice(0,PROJECT_KNOWLEDGE_QUERY_MAX_SOURCE_REFS)),matchedNodeIds,requestedDepth:depth,exploredDepth,direction,
    maxNodes,maxEdges,truncated,deterministic:true,lexical:true,semantic:false,bounded:true,wholesaleContextDump:false,
  });
}
