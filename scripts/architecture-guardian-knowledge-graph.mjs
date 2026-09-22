import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const json=(file)=>JSON.parse(read(file));
const exists=(file)=>fs.existsSync(file);
const violations=[];
const fail=(code,message,detail=undefined)=>violations.push({code,message,...(detail===undefined?{}:{detail})});
const versionBuild=(value)=>Number(String(value||'').match(/^0\.0\.(\d+)$/)?.[1]||-1);

const required=[
  'architecture.guardian.json',
  'package.json',
  'packages/context/package.json',
  'packages/context/src/knowledge-graph.ts',
  'docs/architecture/PROJECT_KNOWLEDGE_GRAPH.md',
  'docs/builds/BUILD_65_PROJECT_KNOWLEDGE_GRAPH.md',
  'scripts/test-build65-project-knowledge-graph.mjs',
  'scripts/test-build65-project-knowledge-graph-runtime.ts',
  'scripts/test-build65-project-knowledge-graph-guardian-negative.mjs',
  'scripts/tsconfig.build65-tests.json',
  '.github/workflows/build65-project-knowledge-graph.yml',
];
for(const file of required) if(!exists(file)) fail('AG650','Required Build 65 artifact is missing.',file);

if(required.every(exists)){
  const policy=json('architecture.guardian.json');
  const root=json('package.json');
  const contextPackage=json('packages/context/package.json');
  const source=read('packages/context/src/knowledge-graph.ts');
  const architecture=read('docs/architecture/PROJECT_KNOWLEDGE_GRAPH.md');
  const build=read('docs/builds/BUILD_65_PROJECT_KNOWLEDGE_GRAPH.md');
  const roadmap=read('docs/product/ROADMAP_V1.md');
  const rule=policy.knowledgeGraphAuthority||{};

  if(policy.currentBuild<65||versionBuild(root.version)<65||versionBuild(contextPackage.version)<65){
    fail('AG651','Build 65 version/build authority is not active.',{currentBuild:policy.currentBuild,root:root.version,context:contextPackage.version});
  }
  if(contextPackage.exports?.['./knowledge-graph']!=='./src/knowledge-graph.ts'){
    fail('AG652','Knowledge Graph package export is missing or drifted.');
  }

  const expectedNodeKinds=['repository','module','file','symbol','document','topic','entity'];
  const expectedEdgeKinds=['contains','imports','depends-on','defines','references','mentions','relates-to'];
  if(
    rule.ownerPackage!=='@github-decrypter/context'
    || rule.ownerSource!=='packages/context/src/knowledge-graph.ts'
    || rule.minimumBuild!==65
    || rule.schema!=='gd-project-knowledge-graph/1'
    || rule.querySchema!=='gd-project-knowledge-query/1'
    || JSON.stringify(rule.nodeKinds)!==JSON.stringify(expectedNodeKinds)
    || JSON.stringify(rule.edgeKinds)!==JSON.stringify(expectedEdgeKinds)
    || rule.maxNodes!==50000 || rule.maxEdges!==200000
    || rule.queryMaxNodes!==256 || rule.queryMaxEdges!==512 || rule.queryMaxDepth!==4
  ) fail('AG653','Knowledge Graph structural policy drifted.');

  for(const field of [
    'sourceReferencesRequired','repositoryGraph','moduleDependencyGraph','symbolReferenceRelationships',
    'documentTopicEntityRelationships','deterministic','immutable','localFirst','boundedRetrieval',
  ]){
    if(rule[field]!==true) fail('AG654','Knowledge Graph required authority was weakened.',field);
  }
  for(const field of [
    'wholesaleContextDump','semanticEmbedding','aiExecution','projectMemory','knowledgeCompiler',
    'persistence','networkAuthority','filesystemAuthority','databaseAuthority',
  ]){
    if(rule[field]!==false) fail('AG655','Knowledge Graph gained forbidden/deferred authority.',field);
  }
  if(rule.projectMemoryBuild!==66||rule.knowledgeCompilerBuild!==67){
    fail('AG655','Knowledge Graph downstream Build ownership drifted.');
  }

  for(const marker of [
    "PROJECT_KNOWLEDGE_GRAPH_BUILD = 65",
    "PROJECT_KNOWLEDGE_GRAPH_SCHEMA = 'gd-project-knowledge-graph/1'",
    "PROJECT_KNOWLEDGE_QUERY_SCHEMA = 'gd-project-knowledge-query/1'",
    'traceableSourceReferences:true','boundedRetrieval:true','wholesaleContextDump:false',
    'semanticEmbedding:false','aiExecution:false','projectMemory:false','knowledgeCompiler:false',
    'persistence:false','networkAuthority:false','filesystemAuthority:false','databaseAuthority:false',
    'unbounded graph dumping is forbidden',
  ]){
    if(!source.includes(marker)) fail('AG656','Knowledge Graph source lost a protected marker.',marker);
  }

  for(const forbiddenMarker of [
    'wholesaleContextDump:true',
    'semanticEmbedding:true',
    'aiExecution:true',
    'projectMemory:true',
    'knowledgeCompiler:true',
    'persistence:true',
    'networkAuthority:true',
    'filesystemAuthority:true',
    'databaseAuthority:true',
  ]){
    if(source.includes(forbiddenMarker)) fail('AG656','Knowledge Graph source contains a forbidden authority marker.',forbiddenMarker);
  }

  if(/^\s*import\s/m.test(source)
      || /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/.test(source)
      || /(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\(|\breadFile\s*\(|\bwriteFile\s*\()/i.test(source)
      || /@github-decrypter\/(?:ai|chat|tools|workspace|git|github-provider|github-app)/.test(source)){
    fail('AG657','Knowledge Graph gained environment, provider, execution or storage authority.');
  }

  if(!architecture.includes('Build 66 — Project Memory')
      || !architecture.includes('Build 67 — Context Engine vFinal / Vortex Knowledge Compiler')
      || !architecture.includes('unbounded')
      || !architecture.includes('Local sovereignty')
      || !build.includes('Project Memory remains false until Build 66')
      || !build.includes('Knowledge Compiler remains false until Build 67')){
    fail('AG658','Build 65 documentation lost ownership or bounded-retrieval doctrine.');
  }
  if(!/^65\. \*\*Knowledge Graph\*\* — ✅ —/m.test(roadmap)){
    fail('AG658','Canonical roadmap does not mark Build 65 implementation.');
  }

  const economic=policy.economicDoctrine||{};
  if(economic.localComputePrimary!==true
      || economic.vortexManagedPaidInferenceAllowed!==false
      || economic.vortexManagedPaidFallbackAllowed!==false
      || economic.byokOptional!==true){
    fail('AG659','Build 65 conflicts with Constitutional Amendment 006.');
  }
}

console.log(JSON.stringify({
  ok:violations.length===0,
  schema:'gd-architecture-guardian-project-knowledge-graph-report/1',
  currentBuild:exists('architecture.guardian.json')?json('architecture.guardian.json').currentBuild:null,
  violations,
},null,2));
if(violations.length) process.exit(1);
