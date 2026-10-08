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
  'packages/diagnostics/package.json',
  'packages/diagnostics/src/index.ts',
  'apps/local/package.json',
  'apps/local/src/problems-diagnostics-runtime.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'apps/local/src/preview-bridge-runtime.ts',
  'packages/tools/src/validation.ts',
  'docs/architecture/PROBLEMS_DIAGNOSTICS.md',
  'docs/builds/BUILD_72_PROBLEMS_DIAGNOSTICS.md',
  'docs/research/BUILD_72_SOURCE_TRIAGE.md',
  'scripts/test-build72-problems-diagnostics.mjs',
  'scripts/test-build72-problems-diagnostics-runtime.ts',
  'scripts/test-build72-problems-diagnostics-guardian-negative.mjs',
  'scripts/tsconfig.build72-tests.json',
];
for(const file of required) if(!exists(file)) fail('AG780','Required Build 72 artifact is missing.',file);

if(required.every(exists)){
  const policy=json('architecture.guardian.json');
  const root=json('package.json');
  const diagnosticsPackage=json('packages/diagnostics/package.json');
  const localPackage=json('apps/local/package.json');
  const contract=read('packages/diagnostics/src/index.ts');
  const runtime=read('apps/local/src/problems-diagnostics-runtime.ts');
  const browserRuntime=read('apps/local/src/preview-browser-runtime.ts');
  const bridge=read('apps/local/src/preview-bridge-runtime.ts');
  const validation=read('packages/tools/src/validation.ts');
  const triage=read('docs/research/BUILD_72_SOURCE_TRIAGE.md');
  const roadmap=read('docs/product/ROADMAP_V1.md');
  const localIndex=read('apps/local/src/index.ts');
  const rule=policy.problemsDiagnosticsAuthority||{};

  if(policy.currentBuild<72||versionBuild(root.version)<72||versionBuild(diagnosticsPackage.version)<72||versionBuild(localPackage.version)<72){
    fail('AG781','Build 72 version/build authority is not active.');
  }
  if(policy.phaseGates?.problemsDiagnosticsBuild!==72) fail('AG781','Build 72 phase gate is missing.');

  if(diagnosticsPackage.name!=='@github-decrypter/diagnostics'||diagnosticsPackage.exports!=='./src/index.ts'){
    fail('AG782','Diagnostics package identity/export boundary is invalid.');
  }
  if(JSON.stringify(diagnosticsPackage.dependencies??{})!==JSON.stringify({})){
    fail('AG782','Diagnostics contract package must remain dependency-free.');
  }
  const packageRule=policy.packageRules?.['@github-decrypter/diagnostics'];
  if(!packageRule||packageRule.environmentNeutral!==true||JSON.stringify(packageRule.allowedWorkspaceDependencies)!==JSON.stringify([])){
    fail('AG782','Diagnostics package environment-neutral rule is missing.');
  }
  if(localPackage.dependencies?.['@github-decrypter/diagnostics']!=='workspace:*'){
    fail('AG782','Local Runtime must consume diagnostics through workspace package.');
  }

  const expected={
    minimumBuild:72,
    schema:'gd-problems-diagnostics/1',
    diagnosticSchema:'gd-problem-diagnostic/1',
    groupSchema:'gd-problem-diagnostic-group/1',
    correlationSchema:'gd-problem-diagnostic-correlation/1',
    textSchema:'gd-problem-diagnostic-text/1',
    reportSchema:'gd-problems-diagnostics-report/1',
    previewBridgeBuild:70,
    developerConsoleBuild:71,
    validationPipelineBuild:57,
    toolRuntimeBuild:53,
    sources:['runtime','browser','test','preview','validation'],
    severities:['info','warning','error'],
    maxInputs:4096,
    maxEntries:512,
    maxDiagnosticTextCharacters:24000,
    maxDiagnosticTextResults:256,
    bounded:true,
    deterministic:true,
    sourceGrounded:true,
    deduplication:true,
    sourceLocationCorrelation:true,
    correlationIsNotCausation:true,
    unmatchedDiagnosticsPreserved:true,
    worstSeverityPropagation:true,
    telemetryOwner:'preview-bridge',
    secondCollectorAllowed:false,
    validationOwner:'validation-pipeline',
    validationRecordVerificationAuthority:false,
    aggregationAuthority:true,
    correlationAuthority:true,
    rootCauseAuthority:false,
    rootCauseOwnerBuild:106,
    autoFixAuthority:false,
    mutationAuthority:false,
    validationAuthority:false,
    releaseAuthority:false,
    architectureAuthority:false,
    persistentStorage:false,
    networkAuthority:false,
    filesystemAuthority:false,
    databaseAuthority:false,
    toolRuntimeRequired:true,
    readCapabilityOnly:true,
    scopeLockMayBeProvenanceOnly:true,
    uiOwnedByBuild72:false,
    uiDeferred:true,
    rosDiagnosticsSource:'ros/diagnostics',
    rosDiagnosticsClassification:'direct-candidate',
    rosDiagnosticsLicense:'BSD-3-Clause',
    rosDiagnosticsAdoptionScope:'aggregation-data-model-patterns-only',
    rosConsoleBridgeSource:'ros/console_bridge',
    rosConsoleBridgeClassification:'reference-only',
    rosConsoleBridgeLicense:'BSD-3-Clause',
    agentIdeSource:'dreamsxin/agent-ide',
    agentIdeClassification:'direct-candidate',
    agentIdeLicense:'MIT',
    agentIdeAdoptionScope:'problem-normalization-source-correlation-patterns-only',
    externalRuntimeDependency:false,
  };
  for(const [key,value] of Object.entries(expected)){
    if(JSON.stringify(rule[key])!==JSON.stringify(value)){
      fail('AG783','Problems Diagnostics authority drifted: '+key,{expected:value,actual:rule[key]});
    }
  }

  for(const marker of [
    'PROBLEMS_DIAGNOSTICS_BUILD = 72',
    "PROBLEMS_DIAGNOSTICS_SCHEMA = 'gd-problems-diagnostics/1'",
    "PROBLEMS_DIAGNOSTICS_REPORT_SCHEMA = 'gd-problems-diagnostics-report/1'",
    "aggregate: 'tool:problems-diagnostics.aggregate'",
    'PROBLEMS_DIAGNOSTIC_MAX_INPUTS = 4096',
    'PROBLEMS_DIAGNOSTIC_MAX_ENTRIES = 512',
    'PROBLEMS_DIAGNOSTIC_TEXT_MAX_CHARACTERS = 24_000',
    'parseDiagnosticText(',
    'createProblemsDiagnostics(',
    'worstSeverityPropagation: true',
    'correlationIsNotCausation: true',
    'rootCauseAuthority: false',
    'autoFixAuthority: false',
    'validationAuthority: false',
  ]) if(!contract.includes(marker)) fail('AG784','Problems Diagnostics contract marker is missing.',marker);

  if(/\bnode:|\bprocess\.|\bfetch\s*\(|\bWebSocket\b|\bchild_process\b|\bfs\.|\blocalStorage\b|\bindexedDB\b/.test(contract)){
    fail('AG785','Diagnostics contract package gained environment/execution authority.');
  }

  for(const marker of [
    'createProblemsDiagnosticsRuntime(',
    "telemetryOwner: 'preview-bridge'",
    "validationOwner: 'validation-pipeline'",
    'secondCollector: false',
    "requiredCapabilities: Object.freeze(['READ'] as const)",
    'if (context.mutationAuthorized)',
    'session.telemetrySnapshot',
    'createProblemsDiagnostics(',
    'parseDiagnosticText(',
    'rootCauseAuthority: false',
    'autoFixAuthority: false',
    'validationAuthority: false',
    'provenance(context)',
  ]) if(!runtime.includes(marker)) fail('AG786','Problems Diagnostics runtime invariant is missing.',marker);

  if(/createChromiumCdpAdapter|CdpClient|Network\.enable|Runtime\.enable|child_process|\bspawn\s*\(|\bfetch\s*\(|\bWebSocket\b/.test(runtime)){
    fail('AG787','Problems Diagnostics created browser/network/telemetry execution authority.');
  }
  if(/writeFile|appendFile|mkdir|rmSync|database|sqlite/i.test(runtime)){
    fail('AG788','Problems Diagnostics runtime gained persistence/filesystem/database behavior.');
  }
  if(/rootCauseAuthority:\s*true|autoFixAuthority:\s*true|mutationAuthority:\s*true|validationAuthority:\s*true|releaseAuthority:\s*true/.test(runtime+contract)){
    fail('AG789','Problems Diagnostics crossed a forbidden authority boundary.');
  }

  for(const marker of [
    'createProblemsDiagnosticsRuntime(',
    'problemsDiagnostics.createToolRegistrations(scopeLock)',
    'problemsDiagnostics: problemsDiagnostics.status()',
    'getBrowserSession: requireSession',
  ]) if(!browserRuntime.includes(marker)) fail('AG790','Problems Diagnostics is not composed through canonical Preview Runtime.',marker);

  if(!bridge.includes('createPreviewBridgeRuntime(')||!validation.includes("VALIDATION_PIPELINE_SCHEMA = 'gd-validation-pipeline/1'")){
    fail('AG790','Build 72 cannot prove existing Preview/Validation ownership.');
  }
  if(!localIndex.includes("export * from './problems-diagnostics-runtime.js';")){
    fail('AG791','Problems Diagnostics runtime export is missing.');
  }

  if(!triage.includes('ros/diagnostics')
    ||!triage.includes('dreamsxin/agent-ide')
    ||!triage.includes('License: **BSD-3-Clause**')
    ||!triage.includes('License: **MIT**')
    ||!triage.includes('Classification: **direct-candidate — selective aggregation/data-model patterns only**')
    ||!triage.includes('Classification: **direct-candidate — selective problem normalization/source-correlation patterns only**')){
    fail('AG792','Build 72 source triage is incomplete.');
  }
  if(!policy.engineeringIntelligenceDoctrine?.directCandidateRepos?.includes('ros/diagnostics')
    ||!policy.engineeringIntelligenceDoctrine?.directCandidateRepos?.includes('dreamsxin/agent-ide')
    ||!policy.engineeringIntelligenceDoctrine?.referenceOnlyRepos?.includes('ros/console_bridge')){
    fail('AG792','Build 72 source classifications are not recorded in engineering doctrine.');
  }
  for(const token of ['ros/diagnostics','ros/console_bridge','dreamsxin/agent-ide']){
    if(JSON.stringify(root).includes(token)||JSON.stringify(localPackage).includes(token)||JSON.stringify(diagnosticsPackage).includes(token)){
      fail('AG792','Build 72 research source became a runtime package dependency.',token);
    }
  }

  if(!roadmap.includes('72. **Problems & Diagnostics** — ✅ —')){
    fail('AG793','Canonical roadmap does not mark Build 72 Problems & Diagnostics complete.');
  }
  if(policy.previewBridgeAuthority?.minimumBuild!==70||policy.developerConsoleAuthority?.minimumBuild!==71||policy.validationPipelineAuthority?.minimumBuild!==57){
    fail('AG794','Build 72 weakened prior evidence/validation authorities.');
  }
  if(policy.economicDoctrine?.localComputePrimary!==true||policy.economicDoctrine?.vortexManagedPaidInferenceAllowed!==false){
    fail('AG795','Build 72 weakened local-sovereignty economics.');
  }
}

console.log(JSON.stringify({
  ok:violations.length===0,
  schema:'gd-architecture-guardian-problems-diagnostics-report/1',
  build:72,
  violations,
},null,2));
if(violations.length>0) process.exit(1);
