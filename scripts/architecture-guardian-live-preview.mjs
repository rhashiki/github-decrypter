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
  'apps/local/src/preview-browser-adapter.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'apps/local/src/live-preview-runtime.ts',
  'apps/local/src/identity.ts',
  'docs/architecture/LIVE_PREVIEW.md',
  'docs/builds/BUILD_69_LIVE_PREVIEW.md',
  'docs/research/BUILD_69_SOURCE_TRIAGE.md',
  'docs/research/EXTERNAL_SOURCE_REPOSITORY_QUEUE.md',
  'scripts/test-build69-live-preview.mjs',
  'scripts/test-build69-live-preview-runtime.ts',
  'scripts/test-build69-live-preview-guardian-negative.mjs',
  'scripts/tsconfig.build69-tests.json',
];
for(const file of required) if(!exists(file)) fail('AG720','Required Build 69 artifact is missing.',file);

if(required.every(exists)){
  const policy=json('architecture.guardian.json');
  const root=json('package.json');
  const previewPkg=json('packages/preview/package.json');
  const localPkg=json('apps/local/package.json');
  const contract=read('packages/preview/src/index.ts');
  const adapter=read('apps/local/src/preview-browser-adapter.ts');
  const browserRuntime=read('apps/local/src/preview-browser-runtime.ts');
  const liveRuntime=read('apps/local/src/live-preview-runtime.ts');
  const identity=read('apps/local/src/identity.ts');
  const roadmap=read('docs/product/ROADMAP_V1.md');
  const triage=read('docs/research/BUILD_69_SOURCE_TRIAGE.md');
  const queue=read('docs/research/EXTERNAL_SOURCE_REPOSITORY_QUEUE.md');
  const rule=policy.livePreviewAuthority||{};

  if(policy.currentBuild<69||versionBuild(root.version)<69||versionBuild(previewPkg.version)<69||versionBuild(localPkg.version)<69){
    fail('AG721','Build 69 version/build authority is not active.');
  }
  if(policy.phaseGates?.livePreviewBuild!==69) fail('AG721','Build 69 phase gate is missing.');

  const expected={
    minimumBuild:69,
    schema:'gd-live-preview/1',
    probeSchema:'gd-live-preview-probe/1',
    settlingSchema:'gd-live-preview-settling/1',
    captureSchema:'gd-live-preview-capture/1',
    browserRuntimeBuild:68,
    toolRuntimeBuild:53,
    scopeLockBuild:55,
    stableTargetUrl:true,
    longRunningSession:true,
    nativeHmrPreferred:true,
    hmrOwner:'target-dev-server',
    hostReloadRequiredForSourceChange:false,
    healthProbe:true,
    readinessEvidenceBased:true,
    explicitRefresh:true,
    boundedRecovery:true,
    maxRecoveryAttempts:3,
    recoveryCreatesNewBrowserGeneration:true,
    failedRecoveryPreservesPriorSession:true,
    deterministicFormFactors:['desktop','tablet','mobile'],
    persistentBrowserAcrossFormFactorChange:true,
    colorSchemes:['light','dark'],
    browserMediaEmulation:true,
    boundedVisualSettling:true,
    visualSettlingRequiredBeforeCapture:true,
    defaultStableSamples:3,
    defaultSampleIntervalMs:150,
    defaultMaxWaitMs:3000,
    captureFailureMayPass:false,
    captureValidationAuthority:false,
    captureReleaseAuthority:false,
    toolRuntimeRequired:true,
    scopeLockRequiredForMutation:true,
    exactTargetScopeBinding:true,
    exactSessionScopeBinding:true,
    networkCapabilityRequiredForStartRefreshRecovery:true,
    readCapabilityRequiredForProbeCapture:true,
    directBrowserAuthority:false,
    secondBrowserRuntimeAllowed:false,
    browserCloudRequired:false,
    systemProfileReuse:false,
    credentialExtraction:false,
    projectFilesystemWrites:false,
    aiExecution:false,
    vortexManagedPaidInferenceRequired:false,
    flowentSource:'Dheeraj-Kumar-089/flowent',
    flowentClassification:'reference-only',
    flowentLicenseDeclared:false,
    flowentCodeReuseAllowed:false,
    externalReferenceOwnsRuntimeAuthority:false,
  };
  for(const [key,value] of Object.entries(expected)){
    if(JSON.stringify(rule[key])!==JSON.stringify(value)){
      fail('AG722','Live Preview authority drifted: '+key,{expected:value,actual:rule[key]});
    }
  }

  for(const marker of [
    'LIVE_PREVIEW_BUILD = 69',
    "LIVE_PREVIEW_SCHEMA = 'gd-live-preview/1'",
    "LIVE_PREVIEW_PROBE_SCHEMA = 'gd-live-preview-probe/1'",
    "LIVE_PREVIEW_SETTLING_SCHEMA = 'gd-live-preview-settling/1'",
    "LIVE_PREVIEW_CAPTURE_SCHEMA = 'gd-live-preview-capture/1'",
    'LIVE_PREVIEW_MAX_RECOVERY_ATTEMPTS = 3',
    'LIVE_PREVIEW_TOOL_IDS',
    'normalizeLivePreviewSettlingPolicy(',
    'livePreviewTargetScopeResource(',
    'livePreviewSessionScopeResource(',
    "hostReloadRequiredForSourceChange: false",
  ]) if(!contract.includes(marker)) fail('AG723','Live Preview contract marker is missing.',marker);

  for(const marker of [
    'setViewport?(tabId: string',
    'setColorScheme?(tabId: string',
    'reload?(tabId: string',
    'tabViewports',
    'tabColorSchemes',
    "Emulation.setEmulatedMedia",
    "Page.reload",
  ]) if(!adapter.includes(marker)) fail('AG724','Build 69 CDP adapter capability is missing.',marker);

  for(const marker of [
    'createLivePreviewRuntime(',
    'livePreview.createToolRegistrations(scopeLock)',
    'createBrowserSession',
    'getBrowserSession: requireSession',
    'closeBrowserSession: stopSession',
    'await livePreview.shutdown()',
  ]) if(!browserRuntime.includes(marker)) fail('AG725','Live Preview is not composed through the canonical Browser Runtime.',marker);

  if(/createChromiumCdpAdapter|child_process|\bspawn\s*\(|\bfetch\s*\(|\bWebSocket\b/.test(liveRuntime)){
    fail('AG726','Live Preview orchestration gained a second browser/network executor.');
  }

  for(const marker of [
    'createLivePreviewRuntime(',
    "hmrOwner: 'target-dev-server'",
    'hostReloadRequiredForSourceChange: false',
    'record.refreshCount += 1',
    'record.recoveryCount >= LIVE_PREVIEW_MAX_RECOVERY_ATTEMPTS',
    'generation: record.generation + 1',
    'Object.assign(record, candidate)',
    'session.setViewport',
    'session.setColorScheme',
    'const settling = await settle(record)',
    'if (settling.settled)',
    'captured: evidence !== null',
    'validationAuthority: false',
    'releaseAuthority: false',
  ]) if(!liveRuntime.includes(marker)) fail('AG727','Live Preview runtime invariant is missing.',marker);

  for(const marker of [
    "['EXECUTE','NETWORK']",
    "['READ']",
    'livePreviewTargetScopeResource(id, url)',
    'livePreviewTargetScopeResource(record.id, url)',
    'livePreviewSessionScopeResource(record.id)',
    'assertScopedResource(',
  ]) if(!liveRuntime.includes(marker)) fail('AG728','Live Preview Tool Runtime / Scope Lock boundary is incomplete.',marker);

  if(read('apps/local/src/index.ts').includes("live-preview-runtime")){
    fail('AG729','Internal Live Preview orchestration must not be exported as an independent Local Runtime authority.');
  }
  if(!identity.includes("'live-preview'")||!identity.includes("'target-owned-native-hmr'")||!identity.includes("'bounded-visual-settling'")){
    fail('AG729','Local Runtime identity does not advertise Build 69 Live Preview.');
  }

  if(!triage.includes('Classification: **reference-only**')
    ||!triage.includes('License: **not declared in the repository at audit time**')
    ||!triage.includes('No direct dependency, vendoring or copied implementation.')){
    fail('AG730','Flowent Build 69 triage does not preserve reference-only/license boundaries.');
  }
  if(!queue.includes('https://github.com/Dheeraj-Kumar-089/flowent')){
    fail('AG730','External source queue lost the Build 69 Flowent source.');
  }
  if(JSON.stringify(root).includes('flowent')||JSON.stringify(previewPkg).includes('flowent')||JSON.stringify(localPkg).includes('flowent')){
    fail('AG730','Flowent must not become a package/runtime dependency.');
  }

  if(policy.previewRuntimeAuthority?.minimumBuild!==68||policy.previewRuntimeAuthority?.secondBrowserRuntimeAllowed===true){
    fail('AG731','Build 69 weakened the canonical Build 68 Browser Runtime boundary.');
  }
  if(policy.economicDoctrine?.localComputePrimary!==true||policy.economicDoctrine?.vortexManagedPaidInferenceAllowed!==false){
    fail('AG731','Build 69 weakened local-sovereignty economics.');
  }
  if(!roadmap.includes('69. **Live Preview** — ✅ — live application state')){
    fail('AG732','Canonical roadmap does not mark Build 69 Live Preview complete.');
  }
}

console.log(JSON.stringify({
  ok:violations.length===0,
  schema:'gd-architecture-guardian-live-preview-report/1',
  build:69,
  violations,
},null,2));
if(violations.length>0) process.exit(1);
