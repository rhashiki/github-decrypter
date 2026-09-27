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
  LIVE_PREVIEW_TOOL_IDS,
  livePreviewSessionScopeResource,
  livePreviewTargetScopeResource,
  normalizePreviewUrl,
  type LivePreviewColorScheme,
  type PreviewDownloadResult,
  type PreviewPageState,
  type PreviewSessionDescriptor,
  type PreviewTabDescriptor,
  type PreviewUploadResult,
  type PreviewViewport,
  type VisualEvidence,
  type VisualEvidenceRequest,
} from '../packages/preview/src/index.js';
import { createPreviewBrowserRuntime } from '../apps/local/src/preview-browser-runtime.js';
import type {
  BrowserAdapterLaunchOptions,
  BrowserAdapterSession,
  PreviewBrowserAdapter,
} from '../apps/local/src/preview-browser-adapter.js';

const intake=createPromptIntakeRecord({text:`
# Goal
Keep a generated application live in Preview.

# Requirements
- Preserve native dev-server HMR when available.
- Probe Preview health without mutating browser state.
- Recover a broken Preview through bounded replacement sessions.
- Support deterministic desktop, tablet and mobile form factors.
- Support deterministic light and dark Preview.
- Capture visual evidence only after bounded settling.

# Constraint
All Live Preview mutations require Tool Runtime capability verification and exact Scope Lock.

# Acceptance
A long-running Preview remains inspectable and recoverable without creating a second browser executor.
`});
const spec=compileRequirements({intake});
const graph=compileTaskGraph({spec});
const draft=createPlanAuthority({spec,graph});
const rules=bindProjectRules({
  plan:draft,
  workspaceId:'workspace:live-preview-alpha',
  rules:[
    {key:'live.scope',kind:'require',statement:'Live Preview mutations require exact locked resources.'},
    {key:'live.hmr',kind:'require',statement:'Native target HMR is preferred over host-forced reload.'},
    {key:'live.evidence',kind:'require',statement:'Visual evidence requires bounded settling.'},
  ],
});
const impact=simulateImpact({
  plan:draft,
  projectRules:rules,
  impacts:[{
    area:'Live Preview lifecycle',
    effect:'positive',
    severity:'critical',
    summary:'Adds bounded long-running Preview health, refresh, recovery and deterministic form factors.',
    relatedRuleKeys:['live.scope','live.hmr','live.evidence'],
    relatedTaskIds:['task-0001','task-0002'],
  }],
});
const plan=approvePlan({plan:draft});
const orchestration=orchestrateBuild({plan,projectRules:rules,impactSimulation:impact});

const liveId='preview:alpha';
const targetUrl=normalizePreviewUrl('http://127.0.0.1:5173/');
const targetResource=livePreviewTargetScopeResource(liveId,targetUrl);
const sessionResource=livePreviewSessionScopeResource(liveId);
const scope=analyzeScope({
  orchestration,
  candidates:[
    {key:'live.target',buildStepId:'build-step-0001',resource:targetResource,access:'execute',rationale:'Start, refresh and recover the explicit Live Preview target.'},
    {key:'live.session',buildStepId:'build-step-0001',resource:sessionResource,access:'execute',rationale:'Stop or change deterministic Live Preview presentation state.'},
  ],
});
const lock=lockScope({
  orchestration,
  scope,
  candidateIds:scope.candidates.map((candidate)=>candidate.id),
});
const targetCandidate=scope.candidates.find((candidate)=>candidate.resource===targetResource)!;
const sessionCandidate=scope.candidates.find((candidate)=>candidate.resource===sessionResource)!;
assert.ok(targetCandidate);
assert.ok(sessionCandidate);

let launchAttempts=0;
let successfulLaunches=0;
let closeCount=0;
let reloadCount=0;
let viewportChangeCount=0;
let colorChangeCount=0;
let captureCount=0;
let lastCaptureDarkMode:boolean|undefined;
let failNextLaunch=false;
let nowTick=0;
let monotonic=0;
const failedSessions=new Set<string>();

const now=()=>new Date(Date.UTC(2026,8,27,22,0,nowTick++)).toISOString();

function createFakeSession(options:BrowserAdapterLaunchOptions, ordinal:number):BrowserAdapterSession{
  const sessionId='preview-session-'+ordinal;
  const tabId='tab-'+ordinal;
  let currentUrl=targetUrl;
  let currentViewport:PreviewViewport=options.viewport;
  let currentColorScheme:LivePreviewColorScheme='light';
  let tabOpen=false;

  const descriptor=():PreviewSessionDescriptor=>Object.freeze({
    schema:'gd-preview-session/1',
    build:68,
    id:sessionId,
    status:'ready',
    browserFamily:'chromium',
    browserExecutable:'/fake/chromium',
    isolatedProfile:true,
    profilePersistence:false,
    createdAt:now(),
    viewport:options.viewport,
    tabIds:Object.freeze(tabOpen?[tabId]:[]),
    toolRuntimeRequired:true,
    scopeLockRequiredForMutation:true,
    deterministicCleanup:true,
  });

  const tab=():PreviewTabDescriptor=>Object.freeze({
    schema:'gd-preview-tab/1',
    build:68,
    id:tabId,
    sessionId,
    status:'open',
    url:currentUrl,
    title:'Live Preview Test',
    createdAt:now(),
  });

  return {
    get descriptor(){ return descriptor(); },
    async openTab(url){
      currentUrl=url;
      tabOpen=true;
      return tab();
    },
    async closeTab(id){
      assert.equal(id,tabId);
      tabOpen=false;
    },
    async navigate(id,url){
      assert.equal(id,tabId);
      currentUrl=url;
      return tab();
    },
    async reload(id){
      assert.equal(id,tabId);
      reloadCount+=1;
      return tab();
    },
    async setViewport(id,viewport){
      assert.equal(id,tabId);
      currentViewport=viewport;
      viewportChangeCount+=1;
    },
    async setColorScheme(id,colorScheme){
      assert.equal(id,tabId);
      currentColorScheme=colorScheme;
      colorChangeCount+=1;
    },
    async pageState(id):Promise<PreviewPageState>{
      assert.equal(id,tabId);
      if(failedSessions.has(sessionId)) throw new Error('synthetic preview target unavailable');
      return Object.freeze({
        schema:'gd-preview-page-state/1',
        build:68,
        sessionId,
        tabId,
        url:currentUrl,
        title:'Live Preview Test',
        readyState:'complete',
        viewport:currentViewport,
        document:Object.freeze({
          width:currentViewport.width,
          height:currentViewport.height*2,
          scrollX:0,
          scrollY:0,
        }),
        accessibilityNodeCount:42,
        capturedAt:now(),
        readOnlyEvidence:true,
        arbitraryScriptExecution:false,
      });
    },
    async capture(id,request:VisualEvidenceRequest):Promise<VisualEvidence>{
      assert.equal(id,tabId);
      captureCount+=1;
      lastCaptureDarkMode=request.darkMode;
      const bytes=Buffer.from('live-preview-image');
      return Object.freeze({
        schema:'gd-visual-evidence/1',
        build:68,
        sessionId,
        tabId,
        url:currentUrl,
        mode:request.mode,
        format:request.format,
        selector:request.selector??null,
        viewport:currentViewport,
        width:currentViewport.width,
        height:currentViewport.height,
        bytes:bytes.byteLength,
        dataBase64:bytes.toString('base64'),
        capturedAt:now(),
        readOnly:true,
        inline:true,
        persisted:false,
        interactionAuthority:false,
        validationAuthority:false,
      });
    },
    async upload():Promise<PreviewUploadResult>{ throw new Error('not used by Build 69 test'); },
    async download():Promise<PreviewDownloadResult>{ throw new Error('not used by Build 69 test'); },
    async close(){
      closeCount+=1;
      tabOpen=false;
    },
  };
}

const adapter:PreviewBrowserAdapter={
  family:'chromium',
  async launch(options){
    launchAttempts+=1;
    if(failNextLaunch){
      failNextLaunch=false;
      throw new Error('synthetic replacement launch failure');
    }
    successfulLaunches+=1;
    return createFakeSession(options,successfulLaunches);
  },
};

const preview=createPreviewBrowserRuntime({
  adapter,
  now,
  executablePath:'/fake/chromium',
  livePreviewSettlingPolicy:{maxWaitMs:250,sampleIntervalMs:25,requiredStableSamples:2},
  livePreviewMonotonicNow:()=>monotonic,
  livePreviewSleep:async(ms)=>{monotonic+=ms;},
});
assert.equal(preview.build,68);
assert.equal(preview.status().livePreview.build,69);
assert.equal(preview.status().livePreview.activeCount,0);
assert.equal(preview.status().livePreview.nativeHmrPreferred,true);
assert.equal(preview.status().livePreview.hmrOwner,'target-dev-server');
assert.equal(preview.status().livePreview.directBrowserAuthority,false);

const capabilityRequests:string[]=[];
const tools=createToolRuntime({
  orchestration,
  scopeLock:lock,
  verifyCapability:(request)=>{
    capabilityRequests.push(request.toolId+':'+request.capability);
    return true;
  },
  tools:preview.createToolRegistrations(lock),
});

const started=await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.start,
  input:{id:liveId,url:targetUrl,formFactor:'desktop',colorScheme:'light'},
  scopeCandidateId:targetCandidate.id,
  mutationAccess:'execute',
});
const startedValue=started.result as any;
assert.equal(startedValue.status,'ready');
assert.equal(startedValue.generation,1);
assert.equal(startedValue.refreshCount,0);
assert.equal(startedValue.recoveryCount,0);
assert.equal(startedValue.nativeHmrPreferred,true);
assert.equal(startedValue.hmrOwner,'target-dev-server');
assert.equal(startedValue.hostReloadRequiredForSourceChange,false);
assert.equal(successfulLaunches,1);
assert.equal(reloadCount,0);
assert.equal(preview.status().activeSessionCount,1);
assert.equal(preview.status().livePreview.activeCount,1);

const probe=await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.probe,
  input:{id:liveId},
});
assert.equal((probe.result as any).healthy,true);
assert.equal((probe.result as any).mutationPerformed,false);
assert.equal(probe.mutationAuthorized,false);
assert.equal(reloadCount,0);

const mobile=await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.setFormFactor,
  input:{id:liveId,formFactor:'mobile'},
  scopeCandidateId:sessionCandidate.id,
  mutationAccess:'execute',
});
assert.equal((mobile.result as any).formFactor,'mobile');
assert.equal((mobile.result as any).viewport.width,390);
assert.equal((mobile.result as any).generation,1);
assert.ok(viewportChangeCount>=1);

const dark=await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.setColorScheme,
  input:{id:liveId,colorScheme:'dark'},
  scopeCandidateId:sessionCandidate.id,
  mutationAccess:'execute',
});
assert.equal((dark.result as any).colorScheme,'dark');
assert.equal((dark.result as any).generation,1);
assert.ok(colorChangeCount>=2);

const captured=await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.capture,
  input:{id:liveId,request:{mode:'viewport',format:'png'}},
});
assert.equal((captured.result as any).captured,true);
assert.equal((captured.result as any).settling.settled,true);
assert.equal((captured.result as any).evidence.viewport.width,390);
assert.equal((captured.result as any).validationAuthority,false);
assert.equal((captured.result as any).releaseAuthority,false);
assert.equal(lastCaptureDarkMode,true);
assert.equal(captureCount,1);
assert.equal(reloadCount,0);

await assert.rejects(tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.refresh,
  input:{id:liveId,url:targetUrl},
  scopeCandidateId:sessionCandidate.id,
  mutationAccess:'execute',
}),/scope resource does not match/i);

const refreshed=await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.refresh,
  input:{id:liveId,url:targetUrl},
  scopeCandidateId:targetCandidate.id,
  mutationAccess:'execute',
});
assert.equal((refreshed.result as any).refreshCount,1);
assert.equal((refreshed.result as any).generation,1);
assert.equal(reloadCount,1);

failedSessions.add((refreshed.result as any).browserSessionId);
const degraded=await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.probe,
  input:{id:liveId},
});
assert.equal((degraded.result as any).healthy,false);
assert.equal((degraded.result as any).status,'degraded');

const recovered1=await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.recover,
  input:{id:liveId,url:targetUrl},
  scopeCandidateId:targetCandidate.id,
  mutationAccess:'execute',
});
assert.equal((recovered1.result as any).generation,2);
assert.equal((recovered1.result as any).recoveryCount,1);
assert.equal((recovered1.result as any).status,'ready');
assert.equal(successfulLaunches,2);
assert.equal(closeCount,1);

failNextLaunch=true;
await assert.rejects(tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.recover,
  input:{id:liveId,url:targetUrl},
  scopeCandidateId:targetCandidate.id,
  mutationAccess:'execute',
}),/synthetic replacement launch failure/);
assert.equal(successfulLaunches,2);
assert.equal(closeCount,1);

const afterFailedReplacement=await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.probe,
  input:{id:liveId},
});
assert.equal((afterFailedReplacement.result as any).healthy,true);
assert.equal((afterFailedReplacement.result as any).generation,2);
assert.equal((afterFailedReplacement.result as any).recoveryCount,1);

const recovered2=await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.recover,
  input:{id:liveId,url:targetUrl},
  scopeCandidateId:targetCandidate.id,
  mutationAccess:'execute',
});
assert.equal((recovered2.result as any).generation,3);
assert.equal((recovered2.result as any).recoveryCount,2);

const recovered3=await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.recover,
  input:{id:liveId,url:targetUrl},
  scopeCandidateId:targetCandidate.id,
  mutationAccess:'execute',
});
assert.equal((recovered3.result as any).generation,4);
assert.equal((recovered3.result as any).recoveryCount,3);

const launchesBeforeBoundedFailure=launchAttempts;
await assert.rejects(tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.recover,
  input:{id:liveId,url:targetUrl},
  scopeCandidateId:targetCandidate.id,
  mutationAccess:'execute',
}),/recovery attempt limit/i);
assert.equal(launchAttempts,launchesBeforeBoundedFailure);

await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.stop,
  input:{id:liveId},
  scopeCandidateId:sessionCandidate.id,
  mutationAccess:'execute',
});
assert.equal(preview.status().livePreview.activeCount,0);
assert.equal(preview.status().activeSessionCount,0);

const launchesBeforeDenied=launchAttempts;
const denied=createToolRuntime({
  orchestration,
  scopeLock:lock,
  verifyCapability:()=>false,
  tools:preview.createToolRegistrations(lock),
});
await assert.rejects(denied.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.start,
  input:{id:liveId,url:targetUrl},
  scopeCandidateId:targetCandidate.id,
  mutationAccess:'execute',
}),(error:unknown)=>error instanceof ToolRuntimeCapabilityError);
assert.equal(launchAttempts,launchesBeforeDenied);

await tools.invoke({
  stepId:'build-step-0001',
  toolId:LIVE_PREVIEW_TOOL_IDS.start,
  input:{id:liveId,url:targetUrl},
  scopeCandidateId:targetCandidate.id,
  mutationAccess:'execute',
});
assert.equal(preview.status().livePreview.activeCount,1);
await preview.shutdown();
assert.equal(preview.status().livePreview.activeCount,0);
assert.equal(preview.status().activeSessionCount,0);

assert.ok(capabilityRequests.includes(LIVE_PREVIEW_TOOL_IDS.start+':NETWORK'));
assert.ok(capabilityRequests.includes(LIVE_PREVIEW_TOOL_IDS.refresh+':NETWORK'));
assert.ok(capabilityRequests.includes(LIVE_PREVIEW_TOOL_IDS.recover+':NETWORK'));
assert.ok(capabilityRequests.includes(LIVE_PREVIEW_TOOL_IDS.probe+':READ'));
assert.ok(capabilityRequests.includes(LIVE_PREVIEW_TOOL_IDS.capture+':READ'));
assert.ok(capabilityRequests.includes(LIVE_PREVIEW_TOOL_IDS.setFormFactor+':EXECUTE'));

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build69-live-preview-runtime/1',
  build:69,
  stableTarget:true,
  nativeHmrPreferred:true,
  hostForcedReloadForSourceChanges:false,
  healthProbe:true,
  explicitRefresh:true,
  boundedRecovery:true,
  replacementFailurePreservesActiveSession:true,
  deterministicFormFactors:true,
  deterministicColorScheme:true,
  boundedVisualSettling:true,
  settledCaptureOnly:true,
  toolRuntimeAndScopeLock:true,
  singleBrowserAuthority:true,
},null,2));
