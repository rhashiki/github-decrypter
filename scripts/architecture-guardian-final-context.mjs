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
  'packages/context/src/final-context.ts',
  'apps/local/package.json',
  'apps/local/src/product-contract-store.ts',
  'apps/local/src/database-migrations.ts',
  'apps/local/src/daemon.ts',
  'docs/architecture/CONTEXT_ENGINE_FINAL.md',
  'docs/builds/BUILD_67_CONTEXT_ENGINE_FINAL.md',
  'scripts/test-build67-context-engine-final.mjs',
  'scripts/test-build67-context-engine-final-runtime.ts',
  'scripts/test-build67-context-engine-final-guardian-negative.mjs',
  'scripts/tsconfig.build67-tests.json',
  '.github/workflows/build67-context-engine-final.yml',
];
for(const file of required) if(!exists(file)) fail('AG680','Required Build 67 artifact is missing.',file);

if(required.every(exists)){
  const policy=json('architecture.guardian.json');
  const root=json('package.json');
  const contextPackage=json('packages/context/package.json');
  const localPackage=json('apps/local/package.json');
  const source=read('packages/context/src/final-context.ts');
  const store=read('apps/local/src/product-contract-store.ts');
  const migrations=read('apps/local/src/database-migrations.ts');
  const daemon=read('apps/local/src/daemon.ts');
  const roadmap=read('docs/product/ROADMAP_V1.md');
  const rule=policy.finalContextEngineAuthority||{};

  if(policy.currentBuild<67||versionBuild(root.version)<67||versionBuild(contextPackage.version)<67||versionBuild(localPackage.version)<67){
    fail('AG681','Build 67 version/build authority is not active.');
  }
  if(policy.phaseGates?.finalContextEngineBuild!==67){
    fail('AG681','Build 67 phase gate is missing.');
  }
  if(contextPackage.exports?.['./final-context']!=='./src/final-context.ts'){
    fail('AG682','Final Context Engine package export is missing.');
  }
  if(localPackage.dependencies?.['@github-decrypter/context']!=='workspace:*'){
    fail('AG682','Local Runtime must consume Context Engine contracts through @github-decrypter/context.');
  }

  const expected={
    minimumBuild:67,
    productContractSchema:'gd-product-contract/1',
    genesisDiscoverySchema:'gd-project-genesis-discovery/1',
    knowledgeCorpusSchema:'gd-knowledge-corpus/1',
    knowledgePackSchema:'gd-knowledge-pack/1',
    finalContextSchema:'gd-final-context/1',
    typedHandoffSchema:'gd-context-handoff/1',
    toolSummarySchema:'gd-tool-summary/1',
    databaseSchemaVersion:14,
    projectGenesisFinalIntegration:true,
    adaptivePreBuildDiscovery:true,
    durableProductContract:true,
    unresolvedExternalDependencyLedger:true,
    acceptanceCriteriaRetrieval:true,
    representativeUserJourneyRetrieval:true,
    repositoryIngestion:true,
    documentIngestion:true,
    hardenedParsing:true,
    sanitization:true,
    promptInjectionShapedContentTreatedAsData:true,
    lexicalRetrieval:true,
    semanticRetrieval:true,
    semanticMode:'deterministic-label-index',
    structuralRetrieval:true,
    progressiveDisclosure:true,
    onDemandKnowledgePacks:true,
    boundedFinalAssembly:true,
    wholesaleContextDump:false,
    typedHandoffs:true,
    lossBoundedToolSummaries:true,
    sourceEvidenceExpandable:true,
    boundedSpecialistProfileLoading:true,
    maxSpecialistProfiles:4,
    wholeSpecialistCatalogContextAllowed:false,
    productContractAuthority:true,
    memoryAuthority:false,
    specialistAuthority:false,
    handoffAuthority:false,
    toolSummaryAuthority:false,
    optionalLlmConsolidationAllowed:true,
    optionalLlmConsolidationAuthoritative:false,
    optionalLlmConsolidationMayWriteMemoryTruth:false,
    localFirst:true,
    vortexManagedPaidInferenceRequired:false,
    networkAuthority:false,
    filesystemAuthority:false,
    aiExecution:false,
    executionAuthority:false,
    externalTransport:false,
    legacyContextEngineDependencyAllowed:false,
  };
  for(const [key,value] of Object.entries(expected)){
    if(rule[key]!==value) fail('AG683','Final Context Engine authority drifted: '+key,{expected:value,actual:rule[key]});
  }

  for(const marker of [
    'FINAL_CONTEXT_ENGINE_BUILD = 67',
    "PRODUCT_CONTRACT_SCHEMA = 'gd-product-contract/1'",
    "KNOWLEDGE_CORPUS_SCHEMA = 'gd-knowledge-corpus/1'",
    "KNOWLEDGE_PACK_SCHEMA = 'gd-knowledge-pack/1'",
    "FINAL_CONTEXT_SCHEMA = 'gd-final-context/1'",
    'createGenesisDiscoveryPlan(',
    'compileProductContract(',
    'compileKnowledgeCorpus(',
    'buildKnowledgePack(',
    'assembleFinalContext(',
    "authority: 'data-only'",
    'promptInjectionContentAuthority: false',
    'wholesaleContextDump: false',
    'optionalLlmConsolidationAuthoritative: false',
    'optionalLlmConsolidationMayWriteMemoryTruth: false',
    'vortexManagedPaidInferenceRequired: false',
  ]) if(!source.includes(marker)) fail('AG684','Final Context Engine marker is missing.',marker);

  if(/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\blocalStorage\b|\bindexedDB\b|['"]node:/.test(source)){
    fail('AG685','Final Context Engine gained network, browser persistence or Node authority.');
  }
  if(/core\/context-engine-v2|background\/context-engine-runtime|content\/context-engine-client/.test(source)){
    fail('AG686','Final Context Engine delegates to a historical Context Engine root.');
  }

  for(const marker of [
    'class ProductContractStore',
    'gd_product_contract_revisions',
    'Product Contract active revision must be explicitly superseded.',
    'Product Contract revision must increment exactly by one.',
    'productIntentAuthority: true',
    'externalTransport: false',
  ]) if(!store.includes(marker)) fail('AG687','Product Contract Store marker is missing.',marker);

  if(/\bfetch\s*\(|\bWebSocket\b|https?:\/\//.test(store)){
    fail('AG688','Product Contract Store gained forbidden network transport.');
  }
  if(/UPDATE\s+gd_product_contract_revisions|DELETE\s+FROM\s+gd_product_contract_revisions/i.test(store)){
    fail('AG688','Product Contract Store gained mutable/destructive Product Contract SQL.');
  }

  for(const marker of [
    'MIGRATION_014_SQL',
    'CREATE TABLE gd_product_contract_revisions',
    "CHECK (truth_role = 'product-intent-authority')",
    'gd_product_contract_revisions is append-only',
    "name: 'product-contract'",
  ]) if(!migrations.includes(marker)) fail('AG689','Product Contract migration marker is missing.',marker);

  for(const marker of [
    'createProductContractStore',
    'readonly productContracts?: ProductContractStore',
    'readonly #productContracts: ProductContractStore',
    'get productContracts(): ProductContractStore',
    'const productContractStatus = this.#productContracts.initialize()',
    'this.#productContracts.shutdown()',
    '#closeProductContractsBestEffort()',
  ]) if(!daemon.includes(marker)) fail('AG689','Product Contract Store is not integrated into Local Runtime lifecycle.',marker);

  if(policy.databaseAuthority?.productContractSchemaBuild!==67||policy.databaseAuthority?.productContractSchemaVersion!==14){
    fail('AG690','Database authority does not bind Product Contract to Build 67 / schema 14.');
  }
  if(policy.economicDoctrine?.localComputePrimary!==true||policy.economicDoctrine?.vortexManagedPaidInferenceAllowed!==false){
    fail('AG690','Build 67 weakened local-sovereignty economics.');
  }
  if(!roadmap.includes('67. **Context Engine vFinal** — ✅ — primary owner for **Project Genesis final integration + Vortex Knowledge Compiler**')){
    fail('AG691','Canonical roadmap does not mark Build 67 Context Engine vFinal complete.');
  }
}

console.log(JSON.stringify({
  ok:violations.length===0,
  schema:'gd-architecture-guardian-final-context-report/1',
  build:67,
  violations,
},null,2));
if(violations.length>0) process.exit(1);
