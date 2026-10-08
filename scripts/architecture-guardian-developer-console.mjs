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
  'packages/preview/package.json',
  'packages/preview/src/index.ts',
  'apps/local/package.json',
  'apps/local/src/developer-console-runtime.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'apps/local/src/preview-bridge-runtime.ts',
  'apps/local/src/preview-telemetry.ts',
  'docs/architecture/DEVELOPER_CONSOLE.md',
  'docs/builds/BUILD_71_DEVELOPER_CONSOLE.md',
  'docs/research/BUILD_71_SOURCE_TRIAGE.md',
  'scripts/test-build71-developer-console.mjs',
  'scripts/test-build71-developer-console-runtime.ts',
  'scripts/test-build71-developer-console-guardian-negative.mjs',
  'scripts/tsconfig.build71-tests.json',
];
for(const file of required) if(!exists(file)) fail('AG760','Required Build 71 artifact is missing.',file);

if(required.every(exists)){
  const policy=json('architecture.guardian.json');
  const root=json('package.json');
  const previewPackage=json('packages/preview/package.json');
  const localPackage=json('apps/local/package.json');
  const contract=read('packages/preview/src/index.ts');
  const runtime=read('apps/local/src/developer-console-runtime.ts');
  const browserRuntime=read('apps/local/src/preview-browser-runtime.ts');
  const bridge=read('apps/local/src/preview-bridge-runtime.ts');
  const telemetry=read('apps/local/src/preview-telemetry.ts');
  const triage=read('docs/research/BUILD_71_SOURCE_TRIAGE.md');
  const roadmap=read('docs/product/ROADMAP_V1.md');
  const localIndex=read('apps/local/src/index.ts');
  const rule=policy.developerConsoleAuthority||{};

  if(policy.currentBuild<71||versionBuild(root.version)<71||versionBuild(previewPackage.version)<71||versionBuild(localPackage.version)<71){
    fail('AG761','Build 71 version/build authority is not active.');
  }
  if(policy.phaseGates?.developerConsoleBuild!==71) fail('AG761','Build 71 phase gate is missing.');

  const expected={
    minimumBuild:71,
    schema:'gd-developer-console/1',
    querySchema:'gd-developer-console-query/1',
    resultSchema:'gd-developer-console-result/1',
    protocolSchema:'gd-developer-console-protocol/1',
    previewBridgeBuild:70,
    toolRuntimeBuild:53,
    readOnly:true,
    bounded:true,
    streamingByCursor:true,
    querySources:['console','network','runtime-error'],
    filterByLevel:true,
    filterByMethod:true,
    filterByStatus:true,
    filterByText:true,
    maxQueryLimit:256,
    telemetryOwner:'preview-bridge',
    secondCollectorAllowed:false,
    hostExecutionSeparated:true,
    persistentStorage:false,
    requestHeadersIncluded:false,
    responseHeadersIncluded:false,
    requestBodiesIncluded:false,
    responseBodiesIncluded:false,
    credentialsIncluded:false,
    browserInteraction:false,
    mutationAuthority:false,
    diagnosticsAuthority:false,
    validationAuthority:false,
    releaseAuthority:false,
    architectureAuthority:false,
    toolRuntimeRequired:true,
    readCapabilityOnly:true,
    scopeLockMayBeProvenanceOnly:true,
    uiOwnedByBuild71:false,
    uiDeferred:true,
    edgeNetworkConsoleSource:'microsoft/edge-devtools-network-console',
    edgeNetworkConsoleClassification:'direct-candidate',
    edgeNetworkConsoleLicense:'MIT',
    edgeNetworkConsoleAdoptionScope:'host-protocol-data-model-patterns-only',
    webConsoleCaptureSource:'AminAdineh/WebConsoleCapture',
    webConsoleCaptureClassification:'reference-only',
    webConsoleCaptureLicense:'MIT',
    devtoolsCloneSource:'Sakil9051/devtools-clone',
    devtoolsCloneClassification:'reference-only',
    devtoolsCloneLicenseVerified:false,
    devtoolsCloneCodeReuseAllowed:false,
    externalSourceOwnsRuntimeAuthority:false,
  };
  for(const [key,value] of Object.entries(expected)){
    if(JSON.stringify(rule[key])!==JSON.stringify(value)){
      fail('AG762','Developer Console authority drifted: '+key,{expected:value,actual:rule[key]});
    }
  }

  for(const marker of [
    'DEVELOPER_CONSOLE_BUILD = 71',
    "DEVELOPER_CONSOLE_SCHEMA = 'gd-developer-console/1'",
    "DEVELOPER_CONSOLE_QUERY_SCHEMA = 'gd-developer-console-query/1'",
    "DEVELOPER_CONSOLE_RESULT_SCHEMA = 'gd-developer-console-result/1'",
    'DEVELOPER_CONSOLE_MAX_LIMIT = 256',
    "query: 'tool:developer-console.query'",
    "summary: 'tool:developer-console.summary'",
    'normalizeDeveloperConsoleQuery(',
    'afterSequence',
    'requestHeadersIncluded: false',
    'responseHeadersIncluded: false',
    'bodiesIncluded: false',
  ]) if(!contract.includes(marker)) fail('AG763','Developer Console contract marker is missing.',marker);

  for(const marker of [
    'createDeveloperConsoleRuntime(',
    "telemetryOwner: 'preview-bridge'",
    'secondCollector: false',
    'hostExecutionSeparated: true',
    "requiredCapabilities: Object.freeze(['READ'] as const)",
    'if (context.mutationAuthorized)',
    'session.telemetrySnapshot',
    'normalizeEntries(',
    'afterSequence',
    'query.limit',
    'provenance(context)',
    'diagnosticsAuthority: false',
    'validationAuthority: false',
    'releaseAuthority: false',
  ]) if(!runtime.includes(marker)) fail('AG764','Developer Console runtime invariant is missing.',marker);

  if(/createChromiumCdpAdapter|CdpClient|Network\.enable|Runtime\.enable|child_process|\bspawn\s*\(|\bfetch\s*\(|\bWebSocket\b/.test(runtime)){
    fail('AG765','Developer Console created browser/network/telemetry execution authority.');
  }
  if(/requestHeadersIncluded:\s*true|responseHeadersIncluded:\s*true|bodiesIncluded:\s*true|\b(?:requestHeaders|responseHeaders|requestBody|responseBody|cookies|localStorage|sessionStorage)\s*[:=.(\[]/.test(runtime)){
    fail('AG766','Developer Console runtime crossed the Build 70 privacy boundary.');
  }
  if(/writeFile|appendFile|mkdir|rmSync|database|sqlite/i.test(runtime)){
    fail('AG767','Developer Console runtime gained persistence/filesystem/database behavior.');
  }

  for(const marker of [
    'createDeveloperConsoleRuntime(',
    'developerConsole.createToolRegistrations(scopeLock)',
    'developerConsole: developerConsole.status()',
    'getBrowserSession: requireSession',
  ]) if(!browserRuntime.includes(marker)) fail('AG768','Developer Console is not composed through canonical Preview Runtime.',marker);

  if(!bridge.includes('createPreviewBridgeRuntime(')||!telemetry.includes('createPreviewTelemetryCollector(')){
    fail('AG768','Build 71 cannot prove Build 70 telemetry ownership.');
  }
  if(!localIndex.includes("export * from './developer-console-runtime.js';")){
    fail('AG769','Developer Console runtime export is missing.');
  }
  if(localIndex.includes('preview-telemetry.js')){
    fail('AG769','Developer Console must not expose Preview telemetry internals as a new public authority.');
  }

  if(!triage.includes('Classification: **direct-candidate — selective protocol/data-model patterns only**')
    ||!triage.includes('Classification: **reference-only**')
    ||!triage.includes('License: **MIT**')
    ||!triage.includes('Observed licensing state:')){
    fail('AG770','Build 71 source triage is incomplete.');
  }
  if(!policy.engineeringIntelligenceDoctrine?.directCandidateRepos?.includes('microsoft/edge-devtools-network-console')
    ||!policy.engineeringIntelligenceDoctrine?.referenceOnlyRepos?.includes('AminAdineh/WebConsoleCapture')
    ||!policy.engineeringIntelligenceDoctrine?.referenceOnlyRepos?.includes('Sakil9051/devtools-clone')){
    fail('AG770','Build 71 source classifications are not recorded in engineering doctrine.');
  }
  for(const token of ['edge-devtools-network-console','WebConsoleCapture','devtools-clone']){
    if(JSON.stringify(root).includes(token)||JSON.stringify(localPackage).includes(token)||JSON.stringify(previewPackage).includes(token)){
      fail('AG770','Build 71 research source became a runtime package dependency.',token);
    }
  }

  if(!roadmap.includes('71. **Developer Console** — ✅')){
    fail('AG771','Canonical roadmap does not mark Build 71 Developer Console complete.');
  }
  if(policy.previewBridgeAuthority?.minimumBuild!==70||policy.previewRuntimeAuthority?.minimumBuild!==68){
    fail('AG772','Build 71 weakened prior Preview authorities.');
  }
  if(policy.economicDoctrine?.localComputePrimary!==true||policy.economicDoctrine?.vortexManagedPaidInferenceAllowed!==false){
    fail('AG773','Build 71 weakened local-sovereignty economics.');
  }
}

console.log(JSON.stringify({
  ok:violations.length===0,
  schema:'gd-architecture-guardian-developer-console-report/1',
  build:71,
  violations,
},null,2));
if(violations.length>0) process.exit(1);
