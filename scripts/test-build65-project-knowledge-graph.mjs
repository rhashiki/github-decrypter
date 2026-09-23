import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const json=(file)=>JSON.parse(read(file));
const versionBuild=(value)=>Number(/^0\.0\.(\d+)$/.exec(String(value??''))?.[1]??-1);
const required=[
  'packages/context/src/knowledge-graph.ts',
  'docs/architecture/PROJECT_KNOWLEDGE_GRAPH.md',
  'docs/builds/BUILD_65_PROJECT_KNOWLEDGE_GRAPH.md',
  'scripts/architecture-guardian-knowledge-graph.mjs',
  'scripts/test-build65-project-knowledge-graph-runtime.ts',
  'scripts/test-build65-project-knowledge-graph-guardian-negative.mjs',
  'scripts/tsconfig.build65-tests.json',
  '.github/workflows/build65-project-knowledge-graph.yml',
];
for(const file of required) assert.ok(fs.existsSync(file),'Build 65 artifact missing: '+file);

const policy=json('architecture.guardian.json');
const root=json('package.json');
const contextPackage=json('packages/context/package.json');
const source=read('packages/context/src/knowledge-graph.ts');
const roadmap=read('docs/product/ROADMAP_V1.md');

assert.ok(policy.currentBuild>=65,'Architecture Guardian must not regress below Build 65');
assert.ok(versionBuild(root.version)>=65&&versionBuild(root.version)<=policy.currentBuild,'root version must preserve Build 65 while allowing later builds');
const contextBuild=versionBuild(contextPackage.version);
assert.ok(contextBuild>=65&&contextBuild<=policy.currentBuild,'context package version must preserve Build 65 while allowing later context builds');
assert.equal(contextPackage.exports['./knowledge-graph'],'./src/knowledge-graph.ts');
assert.equal(policy.knowledgeGraphAuthority.schema,'gd-project-knowledge-graph/1');
assert.equal(policy.knowledgeGraphAuthority.querySchema,'gd-project-knowledge-query/1');
assert.equal(policy.knowledgeGraphAuthority.localFirst,true);
assert.equal(policy.knowledgeGraphAuthority.boundedRetrieval,true);
assert.equal(policy.knowledgeGraphAuthority.wholesaleContextDump,false);
assert.equal(policy.knowledgeGraphAuthority.semanticEmbedding,false);
assert.equal(policy.knowledgeGraphAuthority.projectMemory,false);
assert.equal(policy.knowledgeGraphAuthority.knowledgeCompiler,false);
assert.equal(policy.knowledgeGraphAuthority.networkAuthority,false);
assert.equal(policy.knowledgeGraphAuthority.persistence,false);
assert.equal(policy.economicDoctrine.localComputePrimary,true);
assert.equal(policy.economicDoctrine.vortexManagedPaidInferenceAllowed,false);
assert.equal(policy.economicDoctrine.byokOptional,true);

for(const marker of [
  "PROJECT_KNOWLEDGE_GRAPH_BUILD = 65",
  "PROJECT_KNOWLEDGE_GRAPH_SCHEMA = 'gd-project-knowledge-graph/1'",
  "PROJECT_KNOWLEDGE_QUERY_SCHEMA = 'gd-project-knowledge-query/1'",
  'createProjectKnowledgeGraph(','queryProjectKnowledgeGraph(','assertCanonicalProjectKnowledgeGraph(',
  'wholesaleContextDump:false','semanticEmbedding:false','projectMemory:false','knowledgeCompiler:false',
]){
  assert.ok(source.includes(marker),'Missing Build 65 marker: '+marker);
}
assert.equal(/\bfetch\s*\(|\bWebSocket\b|\blocalStorage\b|\bindexedDB\b|['"]node:/.test(source),false);
assert.match(roadmap,/^65\. \*\*Knowledge Graph\*\* — ✅ —/m);
assert.ok(root.scripts.guardian.includes('architecture-guardian-knowledge-graph.mjs'));
assert.ok(root.scripts['check:build65']);
assert.ok(root.scripts.ci.includes('check:build65'));

console.log(JSON.stringify({
  ok:true,schema:'gd-build65-project-knowledge-graph-static/1',build:65,
  nodeKinds:policy.knowledgeGraphAuthority.nodeKinds.length,
  edgeKinds:policy.knowledgeGraphAuthority.edgeKinds.length,
  nextBuild:66,
},null,2));
