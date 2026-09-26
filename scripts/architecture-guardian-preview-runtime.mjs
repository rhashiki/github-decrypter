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
  'apps/local/src/daemon.ts',
  'docs/architecture/PREVIEW_BROWSER_RUNTIME.md',
  'docs/builds/BUILD_68_PREVIEW_RUNTIME.md',
  'scripts/test-build68-preview-runtime.mjs',
  'scripts/test-build68-preview-runtime-runtime.ts',
  'scripts/test-build68-preview-runtime-guardian-negative.mjs',
  'scripts/tsconfig.build68-tests.json',
  '.github/workflows/build68-preview-runtime.yml',
];
for(const file of required) if(!exists(file)) fail('AG700','Required Build 68 artifact is missing.',file);

if(required.every(exists)){
  const policy=json('architecture.guardian.json');
  const root=json('package.json');
  const previewPackage=json('packages/preview/package.json');
  const localPackage=json('apps/local/package.json');
  const contract=read('packages/preview/src/index.ts');
  const adapter=read('apps/local/src/preview-browser-adapter.ts');
  const runtime=read('apps/local/src/preview-browser-runtime.ts');
  const daemon=read('apps/local/src/daemon.ts');
  const roadmap=read('docs/product/ROADMAP_V1.md');
  const rule=policy.previewRuntimeAuthority||{};

  if(policy.currentBuild<68||versionBuild(root.version)<68||versionBuild(previewPackage.version)<68||versionBuild(localPackage.version)<68){
    fail('AG701','Build 68 version/build authority is not active.');
  }
  if(policy.phaseGates?.previewRuntimeBuild!==68) fail('AG701','Build 68 phase gate is missing.');
  if(previewPackage.name!=='@github-decrypter/preview'||previewPackage.exports!=='./src/index.ts'){
    fail('AG702','Preview package identity/export boundary is invalid.');
  }
  if(JSON.stringify(previewPackage.dependencies??{})!==JSON.stringify({})){
    fail('AG702','Preview contract package must remain dependency-free.');
  }
  const packageRule=policy.packageRules?.['@github-decrypter/preview'];
  if(!packageRule||packageRule.environmentNeutral!==true||JSON.stringify(packageRule.allowedWorkspaceDependencies)!==JSON.stringify([])){
    fail('AG702','Preview package environment-neutral rule is missing.');
  }
  for(const dep of ['@github-decrypter/preview','@github-decrypter/scope','@github-decrypter/tools']){
    if(localPackage.dependencies?.[dep]!=='workspace:*') fail('AG702','Local Runtime Preview dependency is missing.',dep);
  }

  const expected={
    minimumBuild:68,
    schema:'gd-preview-runtime/1',
    sessionSchema:'gd-preview-session/1',
    tabSchema:'gd-preview-tab/1',
    pageStateSchema:'gd-preview-page-state/1',
    visualEvidenceSchema:'gd-visual-evidence/1',
    transferSchema:'gd-preview-transfer/1',
    browserFamily:'chromium',
    protocol:'cdp',
    localBrowserOnly:true,
    isolatedProfiles:true,
    profilePersistence:false,
    sessionTabLifecycle:true,
    deterministicCleanup:true,
    structuredPageState:true,
    visualEvidenceCapture:true,
    visualEvidenceReadOnly:true,
    screenshotInlineByDefault:true,
    persistentCaptureWrites:false,
    selectorCapture:true,
    fullPageCapture:true,
    viewportCapture:true,
    desktopTabletMobilePresets:true,
    uploadDownloadSupported:true,
    transferMode:'ephemeral-inline',
    projectFilesystemWrites:false,
    toolRuntimeBuild:53,
    scopeLockBuild:55,
    toolRuntimeRequired:true,
    scopeLockRequiredForMutation:true,
    exactScopeResourceBinding:true,
    capabilityVerifierRequired:true,
    networkCapabilityRequiredForNavigation:true,
    browserMutationCapability:'EXECUTE',
    readEvidenceCapability:'READ',
    capabilityGrantAuthority:false,
    approvalAuthority:false,
    validationAuthority:false,
    releaseAuthority:false,
    architectureAuthority:false,
    arbitraryScriptAutomation:false,
    systemProfileReuse:false,
    credentialExtraction:false,
    cloudBrowserRequired:false,
    vortexManagedBrowserServiceRequired:false,
    aiExecution:false,
    vortexManagedPaidInferenceRequired:false,
    legacyBrowserRuntimeDependencyAllowed:false,
  };
  for(const [key,value] of Object.entries(expected)){
    if(rule[key]!==value) fail('AG703','Preview Runtime authority drifted: '+key,{expected:value,actual:rule[key]});
  }

  for(const marker of [
    'PREVIEW_RUNTIME_BUILD = 68',
    "PREVIEW_RUNTIME_SCHEMA = 'gd-preview-runtime/1'",
    "VISUAL_EVIDENCE_SCHEMA = 'gd-visual-evidence/1'",
    'PREVIEW_MAX_SESSIONS = 8',
    'normalizePreviewUrl(',
    'normalizePreviewViewport(',
    'normalizeVisualEvidenceRequest(',
    'previewUrlScopeResource(',
    'decodePreviewInlineData(',
  ]) if(!contract.includes(marker)) fail('AG704','Preview contract marker is missing.',marker);

  if(/\bnode:|\bprocess\.|\bfetch\s*\(|\bWebSocket\b|\bchild_process\b|\bfs\.|\blocalStorage\b|\bindexedDB\b/.test(contract)){
    fail('AG705','Preview contract package gained environment/execution authority.');
  }

  for(const marker of [
    'createChromiumCdpAdapter(',
    '--headless=new',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    '--user-data-dir=',
    'DevToolsActivePort',
    "Page.captureScreenshot",
    "Accessibility.getFullAXTree",
    "DOM.setFileInputFiles",
    "Browser.setDownloadBehavior",
    'rmSync(options.profileDir, { recursive: true, force: true })',
  ]) if(!adapter.includes(marker)) fail('AG706','Chromium CDP adapter marker is missing.',marker);

  if(/puppeteer|playwright|browserless|browser-use/i.test(adapter)) fail('AG706','Build 68 production adapter must not silently depend on an alternate browser executor.');
  if(/--remote-debugging-address=(?!127\.0\.0\.1)/.test(adapter)) fail('AG706','Chromium CDP must remain loopback bound.');

  for(const marker of [
    'createPreviewBrowserRuntime(',
    'createToolRegistrations(scopeLock',
    'ensureToolContext(',
    'assertScopedResource(',
    "['EXECUTE','NETWORK']",
    "['READ']",
    'previewUrlScopeResource(url)',
    'previewUploadScopeResource(selector)',
    'previewDownloadScopeResource(selector)',
    'directBrowserAuthorityExposed: false',
    'visualEvidenceReadOnly: true',
    'persistentFileWrites: false',
  ]) if(!runtime.includes(marker)) fail('AG707','Preview Browser Runtime Tool/Scope boundary is incomplete.',marker);

  if(runtime.includes("export { createChromiumCdpAdapter")||read('apps/local/src/index.ts').includes("preview-browser-adapter")){
    fail('AG708','Raw Chromium adapter must not be exported as Local Runtime public authority.');
  }
  if(/core\/.*browser|background\/.*browser|content\/.*browser|core\/tool-runtime|core\/scope-lock/.test(runtime+adapter)){
    fail('AG709','Preview Runtime delegates to a legacy browser/tool/scope implementation.');
  }

  for(const marker of [
    "import { createPreviewBrowserRuntime, type PreviewBrowserRuntime } from './preview-browser-runtime.js';",
    'readonly previewBrowser?: PreviewBrowserRuntime;',
    'readonly #previewBrowser: PreviewBrowserRuntime;',
    'this.#previewBrowser = options.previewBrowser ?? createPreviewBrowserRuntime',
    'get previewBrowser(): PreviewBrowserRuntime',
    'await this.#previewBrowser.shutdown()',
    '#closePreviewBrowserBestEffort()',
  ]) if(!daemon.includes(marker)) fail('AG710','Preview Browser Runtime is not integrated into Local Runtime lifecycle.',marker);

  if(policy.economicDoctrine?.localComputePrimary!==true||policy.economicDoctrine?.vortexManagedPaidInferenceAllowed!==false){
    fail('AG711','Build 68 weakened local-sovereignty economics.');
  }
  if(!roadmap.includes('68. **Preview Runtime** — ✅ — expands into the bounded **Vortex Browser Runtime** foundation')){
    fail('AG712','Canonical roadmap does not mark Build 68 Preview Runtime complete.');
  }
}

console.log(JSON.stringify({
  ok:violations.length===0,
  schema:'gd-architecture-guardian-preview-runtime-report/1',
  build:68,
  violations,
},null,2));
if(violations.length>0) process.exit(1);
