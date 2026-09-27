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
  'apps/local/src/preview-telemetry.ts',
  'apps/local/src/preview-browser-adapter.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'apps/local/src/preview-bridge-runtime.ts',
  'apps/local/src/live-preview-runtime.ts',
  'docs/architecture/PREVIEW_BRIDGE.md',
  'docs/builds/BUILD_70_PREVIEW_BRIDGE.md',
  'docs/research/BUILD_70_SOURCE_TRIAGE.md',
  'scripts/test-build70-preview-bridge.mjs',
  'scripts/test-build70-preview-bridge-runtime.ts',
  'scripts/test-build70-preview-bridge-guardian-negative.mjs',
  'scripts/tsconfig.build70-tests.json',
  '.github/workflows/build70-preview-bridge.yml',
];
for(const file of required) if(!exists(file)) fail('AG740','Required Build 70 artifact is missing.',file);

if(required.every(exists)){
  const policy=json('architecture.guardian.json');
  const root=json('package.json');
  const previewPackage=json('packages/preview/package.json');
  const localPackage=json('apps/local/package.json');
  const contract=read('packages/preview/src/index.ts');
  const telemetry=read('apps/local/src/preview-telemetry.ts');
  const adapter=read('apps/local/src/preview-browser-adapter.ts');
  const browserRuntime=read('apps/local/src/preview-browser-runtime.ts');
  const bridge=read('apps/local/src/preview-bridge-runtime.ts');
  const live=read('apps/local/src/live-preview-runtime.ts');
  const triage=read('docs/research/BUILD_70_SOURCE_TRIAGE.md');
  const roadmap=read('docs/product/ROADMAP_V1.md');
  const rule=policy.previewBridgeAuthority||{};

  if(policy.currentBuild<70||versionBuild(root.version)<70||versionBuild(previewPackage.version)<70||versionBuild(localPackage.version)<70){
    fail('AG741','Build 70 version/build authority is not active.');
  }
  if(policy.phaseGates?.previewBridgeBuild!==70) fail('AG741','Build 70 phase gate is missing.');

  const expected={
    minimumBuild:70,
    schema:'gd-preview-bridge/1',
    snapshotSchema:'gd-preview-bridge-snapshot/1',
    captureReportSchema:'gd-preview-bridge-capture-report/1',
    capabilitiesSchema:'gd-preview-bridge-capabilities/1',
    browserRuntimeBuild:68,
    livePreviewBuild:69,
    toolRuntimeBuild:53,
    readOnly:true,
    bounded:true,
    telemetryPersistentPerTab:true,
    domStructureEvidence:true,
    accessibilitySummaryEvidence:true,
    networkMetadataEvidence:true,
    consoleEvidence:true,
    runtimeErrorEvidence:true,
    captureMetadataEvidence:true,
    automaticTaskRunProvenance:true,
    provenanceFromToolExecutionContext:true,
    maxNetworkEntries:128,
    maxConsoleEntries:128,
    maxErrorEntries:64,
    maxTextCharacters:2048,
    maxDomNodes:20000,
    boundedRingBuffers:true,
    droppedEntryAccounting:true,
    networkQueryValuesRedacted:true,
    requestHeadersCaptured:false,
    responseHeadersCaptured:false,
    requestBodiesCaptured:false,
    responseBodiesCaptured:false,
    cookiesCaptured:false,
    storageCaptured:false,
    credentialsIncluded:false,
    unsafeEvaluate:false,
    browserInteraction:false,
    mutationAuthority:false,
    validationAuthority:false,
    releaseAuthority:false,
    toolRuntimeRequired:true,
    readCapabilityOnly:true,
    scopeLockMutationRequired:false,
    scopeLockMayBeProvenanceOnly:true,
    secondBrowserRuntimeAllowed:false,
    browserCloudRequired:false,
    persistentTelemetryWrites:false,
    projectFilesystemWrites:false,
    aiExecution:false,
    vortexManagedPaidInferenceRequired:false,
    browserBridgeSource:'vitalysim/browser-bridge',
    browserBridgeClassification:'direct-candidate',
    browserBridgeLicense:'MIT',
    browserBridgeAdoptionScope:'bounded-telemetry-patterns-only',
    browserBridgeLoggedInProfileReuseAllowed:false,
    electrobunSource:'0xpolarzero/electrobun-browser-tools',
    electrobunClassification:'reference-only',
    electrobunLicenseDeclared:false,
    electrobunCodeReuseAllowed:false,
    externalSourceOwnsRuntimeAuthority:false,
  };
  for(const [key,value] of Object.entries(expected)){
    if(JSON.stringify(rule[key])!==JSON.stringify(value)){
      fail('AG742','Preview Bridge authority drifted: '+key,{expected:value,actual:rule[key]});
    }
  }

  for(const marker of [
    'PREVIEW_BRIDGE_BUILD = 70',
    "PREVIEW_BRIDGE_SCHEMA = 'gd-preview-bridge/1'",
    "PREVIEW_BRIDGE_SNAPSHOT_SCHEMA = 'gd-preview-bridge-snapshot/1'",
    "PREVIEW_BRIDGE_CAPTURE_REPORT_SCHEMA = 'gd-preview-bridge-capture-report/1'",
    'PREVIEW_BRIDGE_MAX_NETWORK_ENTRIES = 128',
    'PREVIEW_BRIDGE_MAX_CONSOLE_ENTRIES = 128',
    'PREVIEW_BRIDGE_MAX_ERROR_ENTRIES = 64',
    'PREVIEW_BRIDGE_MAX_DOM_NODES = 20_000',
    'requestHeadersRead: false',
    'responseHeadersRead: false',
    'requestBodyRead: false',
    'responseBodyRead: false',
    'cookiesRead: false',
    'storageRead: false',
    'unsafeEvaluate: false',
    'browserInteraction: false',
  ]) if(!contract.includes(marker)) fail('AG743','Preview Bridge contract marker is missing.',marker);

  for(const marker of [
    'class BoundedTelemetryRing',
    'sanitizeTelemetryUrl(',
    "parsed.searchParams.append(key, '[redacted]')",
    'PREVIEW_BRIDGE_MAX_NETWORK_ENTRIES',
    'latestByRequest',
    'network.replace(',
    '#dropped += 1',
    'get dropped(): number',
  ]) if(!telemetry.includes(marker)) fail('AG744','Preview telemetry bounding/privacy invariant is missing.',marker);

  for(const marker of [
    'telemetrySnapshot?(tabId: string)',
    'telemetryClients',
    'telemetryCollectors',
    "Network.requestWillBeSent",
    "Network.responseReceived",
    "Network.loadingFinished",
    "Network.loadingFailed",
    "Runtime.consoleAPICalled",
    "Runtime.exceptionThrown",
    "DOM.getFlattenedDocument",
    'domSummary(',
    'networkDropped: collector.network.dropped',
  ]) if(!adapter.includes(marker)) fail('AG745','Preview adapter telemetry marker is missing.',marker);

  for(const marker of [
    'createPreviewBridgeRuntime(',
    'previewBridge.createToolRegistrations(scopeLock)',
    'getBrowserSession: requireSession',
    'captureLivePreview: livePreview.captureForBridge',
    'previewBridge: previewBridge.status()',
  ]) if(!browserRuntime.includes(marker)) fail('AG746','Preview Bridge is not composed through the canonical Browser Runtime.',marker);

  for(const marker of [
    'createPreviewBridgeRuntime(',
    "requiredCapabilities: Object.freeze(['READ'] as const)",
    'provenance(context)',
    'workspaceId: context.workspaceId',
    'taskId: context.step.sourceTaskId',
    'runId: context.invocationId',
    'if (!session.telemetrySnapshot)',
    "status: 'failed'",
    "status: 'inconclusive'",
    "status: 'success'",
    'evidenceDataOmitted: true',
    'validationAuthority: false',
    'releaseAuthority: false',
  ]) if(!bridge.includes(marker)) fail('AG747','Preview Bridge runtime invariant is missing.',marker);

  if(/createChromiumCdpAdapter|child_process|\bspawn\s*\(|\bfetch\s*\(|\bWebSocket\b|assertScopedResource\s*\(/.test(bridge)){
    fail('AG748','Preview Bridge gained browser/network/mutation execution authority.');
  }
  if(/requestHeaders|responseHeaders|requestBody|responseBody|cookies|localStorage|sessionStorage/.test(telemetry)){
    fail('AG749','Preview telemetry collector contains forbidden sensitive capture fields.');
  }
  if(read('apps/local/src/index.ts').includes('preview-bridge-runtime')||read('apps/local/src/index.ts').includes('preview-telemetry')){
    fail('AG750','Preview Bridge internals must not be exported as independent Local Runtime authority.');
  }

  if(!live.includes('captureForBridge(')){
    fail('AG751','Build 69 does not expose the internal settled capture boundary required by Preview Bridge.');
  }
  if(policy.previewRuntimeAuthority?.minimumBuild!==68||policy.livePreviewAuthority?.minimumBuild!==69){
    fail('AG751','Build 70 weakened prior Preview authorities.');
  }

  if(!triage.includes('License: **MIT**')
    ||!triage.includes('Classification: **direct-candidate — selective telemetry utilities/patterns only**')
    ||!triage.includes('Classification: **reference-only**')
    ||!triage.includes('License: **not declared in the repository/package metadata inspected at audit time**')){
    fail('AG752','Build 70 source triage is incomplete.');
  }
  if(!policy.engineeringIntelligenceDoctrine?.directCandidateRepos?.includes('vitalysim/browser-bridge')
    ||!policy.engineeringIntelligenceDoctrine?.referenceOnlyRepos?.includes('0xpolarzero/electrobun-browser-tools')){
    fail('AG752','Build 70 source classifications are not recorded in engineering doctrine.');
  }
  if(JSON.stringify(root).includes('browser-bridge')||JSON.stringify(localPackage).includes('browser-bridge')||JSON.stringify(previewPackage).includes('browser-bridge')
    ||JSON.stringify(root).includes('electrobun-browser-tools')||JSON.stringify(localPackage).includes('electrobun-browser-tools')||JSON.stringify(previewPackage).includes('electrobun-browser-tools')){
    fail('AG752','Build 70 external research sources must not become runtime package dependencies.');
  }

  if(policy.economicDoctrine?.localComputePrimary!==true||policy.economicDoctrine?.vortexManagedPaidInferenceAllowed!==false){
    fail('AG753','Build 70 weakened local-sovereignty economics.');
  }
  if(!roadmap.includes('70. **Preview Bridge** — ✅ — structured runtime/browser telemetry substrate')){
    fail('AG754','Canonical roadmap does not mark Build 70 Preview Bridge complete.');
  }
}

console.log(JSON.stringify({
  ok:violations.length===0,
  schema:'gd-architecture-guardian-preview-bridge-report/1',
  build:70,
  violations,
},null,2));
if(violations.length>0) process.exit(1);
