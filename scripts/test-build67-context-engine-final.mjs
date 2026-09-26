import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const json=(file)=>JSON.parse(read(file));
const versionBuild=(value)=>Number(String(value||'').match(/^0\.0\.(\d+)$/)?.[1]||-1);

for(const file of [
  'packages/context/src/final-context.ts',
  'apps/local/src/product-contract-store.ts',
  'docs/architecture/CONTEXT_ENGINE_FINAL.md',
  'docs/builds/BUILD_67_CONTEXT_ENGINE_FINAL.md',
  'scripts/architecture-guardian-final-context.mjs',
  'scripts/test-build67-context-engine-final-runtime.ts',
  'scripts/test-build67-context-engine-final-guardian-negative.mjs',
  'scripts/tsconfig.build67-tests.json',
  '.github/workflows/build67-context-engine-final.yml',
]) assert.ok(fs.existsSync(file),'Build 67 artifact missing: '+file);

const policy=json('architecture.guardian.json');
const root=json('package.json');
const contextPackage=json('packages/context/package.json');
const localPackage=json('apps/local/package.json');
const source=read('packages/context/src/final-context.ts');
const store=read('apps/local/src/product-contract-store.ts');
const migrations=read('apps/local/src/database-migrations.ts');
const daemon=read('apps/local/src/daemon.ts');
const roadmap=read('docs/product/ROADMAP_V1.md');

assert.ok(policy.currentBuild>=67);
assert.ok(versionBuild(root.version)>=67);
assert.ok(versionBuild(contextPackage.version)>=67);
assert.ok(versionBuild(localPackage.version)>=67);
assert.equal(contextPackage.exports['./final-context'],'./src/final-context.ts');
assert.equal(policy.phaseGates.finalContextEngineBuild,67);

const rule=policy.finalContextEngineAuthority;
assert.equal(rule.minimumBuild,67);
assert.equal(rule.productContractSchema,'gd-product-contract/1');
assert.equal(rule.knowledgeCorpusSchema,'gd-knowledge-corpus/1');
assert.equal(rule.knowledgePackSchema,'gd-knowledge-pack/1');
assert.equal(rule.finalContextSchema,'gd-final-context/1');
assert.equal(rule.databaseSchemaVersion,14);
assert.equal(rule.projectGenesisFinalIntegration,true);
assert.equal(rule.durableProductContract,true);
assert.equal(rule.promptInjectionShapedContentTreatedAsData,true);
assert.equal(rule.lexicalRetrieval,true);
assert.equal(rule.semanticRetrieval,true);
assert.equal(rule.semanticMode,'deterministic-label-index');
assert.equal(rule.structuralRetrieval,true);
assert.equal(rule.progressiveDisclosure,true);
assert.equal(rule.wholesaleContextDump,false);
assert.equal(rule.typedHandoffs,true);
assert.equal(rule.lossBoundedToolSummaries,true);
assert.equal(rule.boundedSpecialistProfileLoading,true);
assert.equal(rule.maxSpecialistProfiles,4);
assert.equal(rule.wholeSpecialistCatalogContextAllowed,false);
assert.equal(rule.memoryAuthority,false);
assert.equal(rule.specialistAuthority,false);
assert.equal(rule.optionalLlmConsolidationAuthoritative,false);
assert.equal(rule.optionalLlmConsolidationMayWriteMemoryTruth,false);
assert.equal(rule.localFirst,true);
assert.equal(rule.vortexManagedPaidInferenceRequired,false);
assert.equal(rule.networkAuthority,false);
assert.equal(rule.aiExecution,false);
assert.equal(rule.legacyContextEngineDependencyAllowed,false);

for(const marker of [
  'FINAL_CONTEXT_ENGINE_BUILD = 67',
  "PRODUCT_CONTRACT_SCHEMA = 'gd-product-contract/1'",
  "GENESIS_DISCOVERY_SCHEMA = 'gd-project-genesis-discovery/1'",
  "KNOWLEDGE_CORPUS_SCHEMA = 'gd-knowledge-corpus/1'",
  "KNOWLEDGE_PACK_SCHEMA = 'gd-knowledge-pack/1'",
  "FINAL_CONTEXT_SCHEMA = 'gd-final-context/1'",
  'createGenesisDiscoveryPlan(',
  'compileProductContract(',
  'compileKnowledgeCorpus(',
  'buildKnowledgePack(',
  'assembleFinalContext(',
  'progressiveDisclosure: true',
  'wholesaleContextDump: false',
  'promptInjectionContentAuthority: false',
  'optionalLlmConsolidationMayWriteMemoryTruth: false',
]) assert.ok(source.includes(marker),'Missing Build 67 marker: '+marker);

assert.equal(/\bfetch\s*\(|\bWebSocket\b|\blocalStorage\b|\bindexedDB\b|['"]node:/.test(source),false);
assert.equal(/core\/context-engine-v2|background\/context-engine-runtime|content\/context-engine-client/.test(source),false);

assert.ok(store.includes('class ProductContractStore'));
assert.ok(store.includes('gd_product_contract_revisions'));
assert.equal(/UPDATE\s+gd_product_contract_revisions|DELETE\s+FROM\s+gd_product_contract_revisions/i.test(store),false);
assert.ok(migrations.includes('MIGRATION_014_SQL'));
assert.ok(migrations.includes('CREATE TABLE gd_product_contract_revisions'));
assert.ok(migrations.includes("name: 'product-contract'"));
assert.ok(daemon.includes('get productContracts(): ProductContractStore'));
assert.equal(policy.databaseAuthority.productContractSchemaBuild,67);
assert.equal(policy.databaseAuthority.productContractSchemaVersion,14);
assert.equal(policy.economicDoctrine.localComputePrimary,true);
assert.equal(policy.economicDoctrine.vortexManagedPaidInferenceAllowed,false);
assert.ok(roadmap.includes('67. **Context Engine vFinal** — ✅ —'));

assert.ok(root.scripts.guardian.includes('architecture-guardian-final-context.mjs'));
assert.ok(root.scripts['check:build67']);
assert.ok(root.scripts.ci.includes('check:build67'));

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build67-context-engine-final-static/1',
  build:67,
  databaseSchemaVersion:14,
  finalContextSchema:rule.finalContextSchema,
  nextBuild:68,
},null,2));
