import assert from 'node:assert/strict';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';
import { simulateImpact } from '../packages/plan/src/impact-simulation.js';
import { orchestrateBuild } from '../packages/build/src/index.js';
import { analyzeScope } from '../packages/scope/src/index.js';
import { lockScope } from '../packages/scope/src/lock.js';
import { createToolRuntime, ToolRuntimeCapabilityError } from '../packages/tools/src/index.js';
import {
  normalizePreviewUrl,
  previewBrowserScopeResource,
  previewDownloadScopeResource,
  previewTabScopeResource,
  previewUploadScopeResource,
  previewUrlScopeResource,
  type PreviewPageState,
  type PreviewSessionDescriptor,
  type PreviewTabDescriptor,
  type PreviewUploadResult,
  type PreviewDownloadResult,
  type VisualEvidence,
  type VisualEvidenceRequest,
} from '../packages/preview/src/index.js';
import {
  createPreviewBrowserRuntime,
  PREVIEW_TOOL_IDS,
  type PreviewBrowserRuntime,
} from '../apps/local/src/preview-browser-runtime.js';
import type {
  BrowserAdapterLaunchOptions,
  BrowserAdapterSession,
  PreviewBrowserAdapter,
} from '../apps/local/src/preview-browser-adapter.js';

const intake=createPromptIntakeRecord({text:`
# Goal
Run a bounded local generated-app preview.

# Requirements
- Open the generated application in an isolated Preview browser.
- Capture structured and visual evidence from the generated application.

# Constraint
All browser mutations require Tool Runtime capability verification and exact Scope Lock.

# Acceptance
Preview sessions clean up deterministically and visual evidence remains read-only.
`});
const spec=compileRequirements({intake});
const graph=compileTaskGraph({spec});
const draft=createPlanAuthority({spec,graph});
const rules=bindProjectRules({
  plan:draft,
  workspaceId:'workspace:preview-alpha',
  rules:[
    {key:'preview.scope',kind:'require',statement:'Browser mutations require exact locked resources.'},
    {key:'preview.evidence',kind:'require',statement:'Visual capture is read-only evidence.'},
  ],
});
const impact=simulateImpact({
  plan:draft,
  projectRules:rules,
  impacts:[{
    area:'Preview browser boundary',
    effect:'positive',
    severity:'critical',
    summary:'Binds local browser execution to Tool Runtime and Scope Lock.',
    relatedRuleKeys:['preview.scope','preview.evidence'],
    relatedTaskIds:['task-0001','task-0002'],
  }],
});
const plan=approvePlan({plan:draft});
const orchestration=orchestrateBuild({plan,projectRules:rules,impactSimulation:impact});

const initialUrl=normalizePreviewUrl('https://example.test/app');
const nextUrl=normalizePreviewUrl('https://example.test/next');
const scope=analyzeScope({
  orchestration,
  candidates:[
    {key:'preview.browser.session',buildStepId:'build-step-0001',resource:previewBrowserScopeResource(),access:'execute',rationale:'Start and stop isolated browser session.'},
    {key:'preview.url.initial',buildStepId:'build-step-0001',resource:previewUrlScopeResource(initialUrl),access:'execute',rationale:'Open the initial Preview URL.'},
    {key:'preview.browser.tab',buildStepId:'build-step-0001',resource:previewTabScopeResource(),access:'execute',rationale:'Close a Preview tab.'},
    {key:'preview.url.next',buildStepId:'build-step-0001',resource:previewUrlScopeResource(nextUrl),access:'execute',rationale:'Navigate to the explicitly scoped next URL.'},
    {key:'preview.upload.file',buildStepId:'build-step-0001',resource:previewUploadScopeResource('#file'),access:'execute',rationale:'Set the explicitly scoped file input.'},
    {key:'preview.download.file',buildStepId:'build-step-0001',resource:previewDownloadScopeResource('#download'),access:'execute',rationale:'Trigger the explicitly scoped download.'},
  ],
});
const lock=lockScope({
  orchestration,
  scope,
  candidateIds:scope.candidates.map((candidate)=>candidate.id),
});

let launchCount=0;
let closeCount=0;
let tabCloseCount=0;
let navigationCount=0;
let uploadCount=0;
let downloadCount=0;
let captureCount=0;

const sessionDescriptor: PreviewSessionDescriptor=Object.freeze({
  schema:'gd-preview-session/1',
  build:68,
  id:'preview-session-test',
  status:'ready',
  browserFamily:'chromium',
  browserExecutable:'/fake/chromium',
  isolatedProfile:true,
  profilePersistence:false,
  createdAt:'2026-09-26T03:00:00.000Z',
  viewport:Object.freeze({width:1440,height:900,deviceScaleFactor:1}),
  tabIds:Object.freeze([]),
  toolRuntimeRequired:true,
  scopeLockRequiredForMutation:true,
  deterministicCleanup:true,
});

const tab=(url:string):PreviewTabDescriptor=>Object.freeze({
  schema:'gd-preview-tab/1',
  build:68,
  id:'tab-test',
  sessionId:sessionDescriptor.id,
  status:'open',
  url,
  title:'Preview Test',
  createdAt:'2026-09-26T03:00:01.000Z',
});

const fakeSession: BrowserAdapterSession={
  descriptor:sessionDescriptor,
  async openTab(url){ return tab(url); },
  async closeTab(tabId){ assert.equal(tabId,'tab-test'); tabCloseCount+=1; },
  async navigate(tabId,url){
    assert.equal(tabId,'tab-test');
    navigationCount+=1;
    return tab(url);
  },
  async pageState(tabId):Promise<PreviewPageState>{
    assert.equal(tabId,'tab-test');
    return Object.freeze({
      schema:'gd-preview-page-state/1',
      build:68,
      sessionId:sessionDescriptor.id,
      tabId,
      url:nextUrl,
      title:'Preview Test',
      readyState:'complete',
      viewport:sessionDescriptor.viewport,
      document:Object.freeze({width:1440,height:1800,scrollX:0,scrollY:0}),
      accessibilityNodeCount:24,
      capturedAt:'2026-09-26T03:00:02.000Z',
      readOnlyEvidence:true,
      arbitraryScriptExecution:false,
    });
  },
  async capture(tabId,request:VisualEvidenceRequest):Promise<VisualEvidence>{
    assert.equal(tabId,'tab-test');
    captureCount+=1;
    return Object.freeze({
      schema:'gd-visual-evidence/1',
      build:68,
      sessionId:sessionDescriptor.id,
      tabId,
      url:nextUrl,
      mode:request.mode,
      format:request.format,
      selector:request.selector??null,
      viewport:sessionDescriptor.viewport,
      width:1440,
      height:900,
      bytes:3,
      dataBase64:Buffer.from('png').toString('base64'),
      capturedAt:'2026-09-26T03:00:03.000Z',
      readOnly:true,
      inline:true,
      persisted:false,
      interactionAuthority:false,
      validationAuthority:false,
    });
  },
  async upload(tabId,selector,fileName,bytes):Promise<PreviewUploadResult>{
    assert.equal(tabId,'tab-test');
    assert.equal(selector,'#file');
    assert.equal(fileName,'test.txt');
    assert.equal(Buffer.from(bytes).toString('utf8'),'hello');
    uploadCount+=1;
    return Object.freeze({
      schema:'gd-preview-transfer/1',
      build:68,
      direction:'upload',
      sessionId:sessionDescriptor.id,
      tabId,
      selector,
      fileName,
      bytes:bytes.byteLength,
      temporaryOnly:true,
      persistedToProject:false,
    });
  },
  async download(tabId,selector):Promise<PreviewDownloadResult>{
    assert.equal(tabId,'tab-test');
    assert.equal(selector,'#download');
    downloadCount+=1;
    const data=Buffer.from('download');
    return Object.freeze({
      schema:'gd-preview-transfer/1',
      build:68,
      direction:'download',
      sessionId:sessionDescriptor.id,
      tabId,
      fileName:'download.txt',
      bytes:data.byteLength,
      dataBase64:data.toString('base64'),
      temporaryOnly:true,
      persistedToProject:false,
    });
  },
  async close(){ closeCount+=1; },
};

const adapter:PreviewBrowserAdapter={
  family:'chromium',
  async launch(options:BrowserAdapterLaunchOptions){
    launchCount+=1;
    assert.equal(options.viewport.width,1440);
    assert.ok(options.profileDir.includes('vortex-preview-'));
    return fakeSession;
  },
};

const preview=createPreviewBrowserRuntime({
  adapter,
  now:()=> '2026-09-26T03:00:00.000Z',
  executablePath:'/fake/chromium',
});
assert.equal(preview.build,68);
assert.equal(preview.status().activeSessionCount,0);
assert.equal(preview.status().directBrowserAuthorityExposed,false);
assert.equal(preview.status().visualEvidenceReadOnly,true);
assert.equal(preview.status().persistentFileWrites,false);

const capabilityRequests:string[]=[];
const tools=createToolRuntime({
  orchestration,
  scopeLock:lock,
  verifyCapability:(request)=>{ capabilityRequests.push(request.toolId+':'+request.capability); return true; },
  tools:preview.createToolRegistrations(lock),
});

const start=await tools.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.startSession,
  input:{viewport:'desktop'},
  scopeCandidateId:'scope-candidate-0001',
  mutationAccess:'execute',
});
assert.equal((start.result as any).id,sessionDescriptor.id);
assert.equal(launchCount,1);
assert.equal(preview.status().activeSessionCount,1);

const opened=await tools.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.openTab,
  input:{sessionId:sessionDescriptor.id,url:initialUrl},
  scopeCandidateId:'scope-candidate-0002',
  mutationAccess:'execute',
});
assert.equal((opened.result as any).url,initialUrl);

await assert.rejects(tools.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.navigate,
  input:{sessionId:sessionDescriptor.id,tabId:'tab-test',url:nextUrl},
  scopeCandidateId:'scope-candidate-0002',
  mutationAccess:'execute',
}),/scope resource does not match/i);

const navigated=await tools.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.navigate,
  input:{sessionId:sessionDescriptor.id,tabId:'tab-test',url:nextUrl},
  scopeCandidateId:'scope-candidate-0004',
  mutationAccess:'execute',
});
assert.equal((navigated.result as any).url,nextUrl);
assert.equal(navigationCount,1);

const state=await tools.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.pageState,
  input:{sessionId:sessionDescriptor.id,tabId:'tab-test'},
});
assert.equal((state.result as any).readOnlyEvidence,true);
assert.equal((state.result as any).arbitraryScriptExecution,false);
assert.equal(state.mutationAuthorized,false);

const captured=await tools.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.capture,
  input:{sessionId:sessionDescriptor.id,tabId:'tab-test',request:{mode:'viewport',format:'png'}},
});
assert.equal((captured.result as any).readOnly,true);
assert.equal((captured.result as any).interactionAuthority,false);
assert.equal((captured.result as any).validationAuthority,false);
assert.equal(captureCount,1);

const uploaded=await tools.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.upload,
  input:{
    sessionId:sessionDescriptor.id,
    tabId:'tab-test',
    selector:'#file',
    fileName:'test.txt',
    mediaType:'text/plain',
    dataBase64:Buffer.from('hello').toString('base64'),
  },
  scopeCandidateId:'scope-candidate-0005',
  mutationAccess:'execute',
});
assert.equal((uploaded.result as any).temporaryOnly,true);
assert.equal((uploaded.result as any).persistedToProject,false);
assert.equal(uploadCount,1);

const downloaded=await tools.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.download,
  input:{sessionId:sessionDescriptor.id,tabId:'tab-test',selector:'#download'},
  scopeCandidateId:'scope-candidate-0006',
  mutationAccess:'execute',
});
assert.equal(Buffer.from((downloaded.result as any).dataBase64,'base64').toString('utf8'),'download');
assert.equal((downloaded.result as any).persistedToProject,false);
assert.equal(downloadCount,1);

await tools.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.closeTab,
  input:{sessionId:sessionDescriptor.id,tabId:'tab-test'},
  scopeCandidateId:'scope-candidate-0003',
  mutationAccess:'execute',
});
assert.equal(tabCloseCount,1);

await tools.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.stopSession,
  input:{sessionId:sessionDescriptor.id},
  scopeCandidateId:'scope-candidate-0001',
  mutationAccess:'execute',
});
assert.equal(closeCount,1);
assert.equal(preview.status().activeSessionCount,0);

assert.ok(capabilityRequests.includes(PREVIEW_TOOL_IDS.openTab+':NETWORK'));
assert.ok(capabilityRequests.includes(PREVIEW_TOOL_IDS.navigate+':NETWORK'));
assert.ok(capabilityRequests.includes(PREVIEW_TOOL_IDS.capture+':READ'));
assert.ok(capabilityRequests.includes(PREVIEW_TOOL_IDS.upload+':EXECUTE'));

const deniedPreview=createPreviewBrowserRuntime({adapter,executablePath:'/fake/chromium'});
const denied=createToolRuntime({
  orchestration,
  scopeLock:lock,
  verifyCapability:()=>false,
  tools:deniedPreview.createToolRegistrations(lock),
});
await assert.rejects(denied.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.startSession,
  input:{viewport:'desktop'},
  scopeCandidateId:'scope-candidate-0001',
  mutationAccess:'execute',
}),(error:unknown)=>error instanceof ToolRuntimeCapabilityError);
assert.equal(launchCount,1);

const cleanupPreview=createPreviewBrowserRuntime({adapter,executablePath:'/fake/chromium'});
const cleanupTools=createToolRuntime({
  orchestration,
  scopeLock:lock,
  verifyCapability:()=>true,
  tools:cleanupPreview.createToolRegistrations(lock),
});
await cleanupTools.invoke({
  stepId:'build-step-0001',
  toolId:PREVIEW_TOOL_IDS.startSession,
  input:{viewport:'desktop'},
  scopeCandidateId:'scope-candidate-0001',
  mutationAccess:'execute',
});
assert.equal(cleanupPreview.status().activeSessionCount,1);
await cleanupPreview.shutdown();
assert.equal(cleanupPreview.status().activeSessionCount,0);
assert.equal(closeCount,2);

assert.throws(()=>normalizePreviewUrl('javascript:alert(1)'),/http or https/i);
assert.throws(()=>normalizePreviewUrl('https://user:secret@example.test/'),/credentials/i);
assert.equal(previewUrlScopeResource(initialUrl),'preview-url:'+initialUrl);

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build68-preview-runtime-runtime/1',
  build:68,
  toolRuntimeGated:true,
  exactScopeResourceBinding:true,
  capabilityVerification:true,
  sessionLifecycle:true,
  tabLifecycle:true,
  structuredPageState:true,
  visualEvidenceReadOnly:true,
  ephemeralTransfers:true,
  deterministicCleanup:true,
  productionAdapter:'local-chromium-cdp',
},null,2));
