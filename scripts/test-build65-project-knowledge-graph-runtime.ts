import assert from 'node:assert/strict';
import {
  createProjectKnowledgeGraph,
  assertCanonicalProjectKnowledgeGraph,
  queryProjectKnowledgeGraph,
} from '../packages/context/src/knowledge-graph.js';

const nodes=[
  {id:'repository:vortex',kind:'repository' as const,label:'Vortex Ars AI',sourceRefs:['repo:#root']},
  {id:'module:checkout',kind:'module' as const,label:'Checkout module',sourceRefs:['src/checkout/#module']},
  {id:'file:src/checkout/service.ts',kind:'file' as const,label:'checkout service',sourceRefs:['src/checkout/service.ts#L1-L120']},
  {id:'file:src/api/router.ts',kind:'file' as const,label:'API router',sourceRefs:['src/api/router.ts#L1-L80']},
  {id:'symbol:checkout-service',kind:'symbol' as const,label:'CheckoutService',sourceRefs:['src/checkout/service.ts#L12-L74']},
  {id:'symbol:create-order',kind:'symbol' as const,label:'createOrder',sourceRefs:['src/checkout/service.ts#L30-L57']},
  {id:'document:payments-rfc',kind:'document' as const,label:'Payments RFC',sourceRefs:['docs/payments.md#overview']},
  {id:'topic:idempotency',kind:'topic' as const,label:'Payment idempotency',sourceRefs:['docs/payments.md#idempotency']},
  {id:'entity:payment-provider',kind:'entity' as const,label:'Payment provider',sourceRefs:['docs/payments.md#provider']},
];
const edges=[
  {from:'repository:vortex',to:'module:checkout',kind:'contains' as const,sourceRefs:['src/checkout/#module']},
  {from:'module:checkout',to:'file:src/checkout/service.ts',kind:'contains' as const,sourceRefs:['src/checkout/service.ts#L1-L120']},
  {from:'repository:vortex',to:'file:src/api/router.ts',kind:'contains' as const,sourceRefs:['src/api/router.ts#L1-L80']},
  {from:'file:src/checkout/service.ts',to:'symbol:checkout-service',kind:'defines' as const,sourceRefs:['src/checkout/service.ts#L12-L74']},
  {from:'symbol:checkout-service',to:'symbol:create-order',kind:'defines' as const,sourceRefs:['src/checkout/service.ts#L30-L57']},
  {from:'file:src/api/router.ts',to:'file:src/checkout/service.ts',kind:'imports' as const,sourceRefs:['src/api/router.ts#L4']},
  {from:'file:src/api/router.ts',to:'symbol:create-order',kind:'references' as const,sourceRefs:['src/api/router.ts#L42']},
  {from:'document:payments-rfc',to:'topic:idempotency',kind:'mentions' as const,sourceRefs:['docs/payments.md#idempotency']},
  {from:'topic:idempotency',to:'entity:payment-provider',kind:'relates-to' as const,sourceRefs:['docs/payments.md#provider']},
];

const graph=createProjectKnowledgeGraph({projectId:'project:vortex',nodes,edges});
assert.equal(graph.schema,'gd-project-knowledge-graph/1');
assert.equal(graph.build,65);
assert.equal(graph.nodeCount,9);
assert.equal(graph.edgeCount,9);
assert.equal(graph.nodeKindCounts.symbol,2);
assert.equal(graph.edgeKindCounts.references,1);
assert.equal(graph.traceableSourceReferences,true);
assert.equal(graph.wholesaleContextDump,false);
assert.equal(graph.localFirst,true);
assert.equal(graph.semanticEmbedding,false);
assert.equal(graph.projectMemory,false);
assert.equal(graph.knowledgeCompiler,false);
assert.equal(graph.networkAuthority,false);
assert.equal(graph.persistence,false);
assert.doesNotThrow(()=>assertCanonicalProjectKnowledgeGraph(graph));

const reordered=createProjectKnowledgeGraph({
  projectId:'project:vortex',
  nodes:[...nodes].reverse(),
  edges:[...edges].reverse(),
});
assert.deepEqual(reordered,graph,'Equivalent reordered input must compile identically.');

const symbolQuery=queryProjectKnowledgeGraph(graph,{
  textTerms:['createorder'],depth:1,maxNodes:8,maxEdges:16,
});
assert.equal(symbolQuery.bounded,true);
assert.equal(symbolQuery.semantic,false);
assert.equal(symbolQuery.wholesaleContextDump,false);
assert.ok(symbolQuery.nodes.some(node=>node.id==='symbol:create-order'));
assert.ok(symbolQuery.edges.some(edge=>edge.kind==='references'));
assert.ok(symbolQuery.sourceRefs.includes('src/api/router.ts#L42'));

const docsQuery=queryProjectKnowledgeGraph(graph,{
  nodeKinds:['document'],edgeKinds:['mentions','relates-to'],depth:2,maxNodes:6,maxEdges:8,
});
assert.deepEqual(docsQuery.matchedNodeIds,['document:payments-rfc']);
assert.ok(docsQuery.nodes.some(node=>node.id==='topic:idempotency'));
assert.ok(docsQuery.nodes.some(node=>node.id==='entity:payment-provider'));
assert.ok(docsQuery.edges.some(edge=>edge.kind==='mentions'));
assert.ok(docsQuery.edges.some(edge=>edge.kind==='relates-to'));

const inbound=queryProjectKnowledgeGraph(graph,{
  nodeIds:['file:src/checkout/service.ts'],direction:'inbound',depth:1,maxNodes:8,maxEdges:8,
});
assert.ok(inbound.nodes.some(node=>node.id==='file:src/api/router.ts'));
assert.ok(inbound.edges.some(edge=>edge.kind==='imports'));

const bounded=queryProjectKnowledgeGraph(graph,{
  nodeKinds:['file'],depth:2,maxNodes:1,maxEdges:0,
});
assert.equal(bounded.nodes.length,1);
assert.equal(bounded.edges.length,0);
assert.equal(bounded.truncated,true);
assert.ok(bounded.matchedNodeIds.length<=1);

assert.throws(()=>queryProjectKnowledgeGraph(graph,{}),/unbounded graph dumping is forbidden/i);
assert.throws(()=>createProjectKnowledgeGraph({
  projectId:'project:vortex',
  nodes,
  edges:[...edges,{from:'file:missing.ts',to:'symbol:create-order',kind:'references',sourceRefs:['missing#L1']}],
}),/unknown node/i);
assert.throws(()=>createProjectKnowledgeGraph({
  projectId:'project:vortex',
  nodes,
  edges:[...edges,edges[0]!],
}),/duplicate edges/i);
assert.throws(()=>createProjectKnowledgeGraph({
  projectId:'project:vortex',
  nodes:[...nodes,{...nodes[0]!}],
  edges,
}),/node ids must be unique/i);

console.log(JSON.stringify({
  ok:true,schema:'gd-build65-project-knowledge-graph-runtime/1',build:65,
  nodeCount:graph.nodeCount,edgeCount:graph.edgeCount,
  boundedQueryNodes:symbolQuery.nodes.length,
  traceableSourceRefs:symbolQuery.sourceRefs.length,
  nextBuild:66,
},null,2));
