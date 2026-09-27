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
  PREVIEW_BRIDGE_CAPABILITIES,
  PREVIEW_BRIDGE_TOOL_IDS,
  livePreviewTargetScopeResource,
  previewBrowserScopeResource,
  previewUrlScopeResource,
  normalizePreviewUrl,
  type PreviewBridgeAdapterSnapshot,
  type PreviewDownloadResult,
  type PreviewPageState,
  type PreviewSessionDescriptor,
  type PreviewTabDescriptor,
  type PreviewUploadResult,
  type PreviewViewport,
  type VisualEvidence,
  type VisualEvidenceRequest,
} from '../packages/preview/src/index.js';
import { createPreviewBrowserRuntime, PREVIEW_TOOL_IDS } from '../apps/local/src/preview-browser-runtime.js';
import { createPreviewTelemetryCollector, sanitizeTelemetryUrl } from '../apps/local/src/preview-telemetry.js';
import type {
  BrowserAdapterLaunchOptions,
  BrowserAdapterSession,
  PreviewBrowserAdapter,
} from '../apps/local/src/preview-browser-adapter.js';

const collector=createPreviewTelemetryCollector();
for(let index=0;index<130;index+=1){
  collector.requestStarted({
    requestId:'req-'+index,
    method:'GET',
    url:'https://example.test/api?token=secret-'+index+'&page='+index+'#fragment',
    resourceType:'Fetch',
    timestamp:index,
  });
}
assert.equal(collector.network.size,128);
assert.equal(collector.network.dropped,2);
const firstLive=collector.network.values()[0]!;
assert.equal(firstLive.requestId,'req-2');
assert.ok(firstLive.url.includes('token=%5Bredacted%5D'));
assert.ok(firstLive.url.includes('page=%5Bredacted%5D'));
assert.equal(firstLive.url.includes('secret-'),false);
assert.equal(firstLive.url.includes('#fragment'),false);
collector.responseReceived({requestId:'req-129',status:204,mimeType:'application/json'});
collector.requestFinished('req-129');
const last=collector.network.values().at(-1)!;
assert.equal(last.status,204);
assert.equal(last.finished,true);

const redirectCollector=createPreviewTelemetryCollector();
redirectCollector.requestStarted({requestId:'redirect',method:'GET',url:'https://example.test/start'});
redirectCollector.responseReceived({requestId:'redirect',status:302,mimeType:'text/html'});
redirectCollector.requestFinished('redirect');
redirectCollector.requestStarted({requestId:'redirect',method:'GET',url:'https://example.test/final',redirect:true});
redirectCollector.responseReceived({requestId:'redirect',status:200,mimeType:'text/html'});
redirectCollector.requestFinished('redirect');
assert.equal(redirectCollector.network.values().length,2);
assert.equal(redirectCollector.network.values()[0]?.status,302);
assert.equal(redirectCollector.network.values()[1]?.status,200);
assert.equal(redirectCollector.network.values()[1]?.redirect,true);

collector.consoleEntry({level:'log',text:'x'.repeat(3000),timestamp:10});
collector.runtimeError({message:'y'.repeat(3000),timestamp:11});
assert.equal(collector.console.values()[0]?.text.length,2048);
assert.equal(collector.console.values()[0]?.truncated,true);
assert.equal(collector.errors.values()[0]?.message.length,2048);
assert.equal(collector.errors.values()[0]?.truncated,true);
assert.equal(sanitizeTelemetryUrl('https://user:pass@example.test/a?secret=abc#x').includes('user:pass'),false);

const intake=createPromptIntakeRecord({text:`
# Goal
Expose bounded Preview telemetry for generated-app QA.

# Requirements
- Read DOM structure, network metadata, console and runtime errors.
- Carry capture status with task and run provenance.
- Never expose request bodies, response bodies, headers, cookies or storage.

# Constraint
Preview Bridge is read-only and cannot create browser authority.

# Acceptance
Bridge evidence is bounded, privacy-minimized and provenance-bound.
`});
const spec=compileRequirements({intake});
const graph=compileTaskGraph({spec});
const draft=createPlanAuthority({spec,graph});
const rules=bindProjectRules({
  plan:draft,
  workspaceId:'workspace:preview-bridge-test',
  rules:[
    {key:'bridge.read',kind:'require',statement:'Preview Bridge remains read-only.'},
    {key:'bridge.privacy',kind:'require',statement:'Sensitive browser state is excluded.'},
  ],
});
const impact=simulateImpact({
  plan:draft,
  projectRules:rules,
  impacts:[{
    area:'Preview telemetry',
    effect:'positive',
    severity:'critical',
    summary:'Adds bounded browser evidence with deterministic provenance.',
    relatedRuleKeys:['bridge.read','bridge.privacy'],
    relatedTaskIds:['task-0001'],
  }],
});
const plan=approvePlan({plan:draft});
const orchestration=orchestrateBuild({plan,projectRules:rules,impactSimulation:impact});
const step=orchestration.steps[0]!;

const rawUrl=normalizePreviewUrl('http://127.0.0.1:5173/');
const liveUrl=normalizePreviewUrl('http://127.0.0.1:5173/live');
const unstableUrl=normalizePreviewUrl('http://127.0.0.1:5173/unstable');
const scope=analyzeScope({
  orchestration,
  candidates:[
    {key:'browser.session',buildStepId:step.id,resource:previewBrowserScopeResource(),access:'execute',rationale:'Start raw Preview browser session.'},
    {key:'browser.url',buildStepId:step.id,resource:previewUrlScopeResource(rawUrl),access:'execute',rationale:'Open raw Preview target.'},
    {key:'live.target',buildStepId:step.id,resource:livePreviewTargetScopeResource('preview:bridge',liveUrl),access:'execute',rationale:'Start stable Live Preview target.'},
    {key:'live.unstable',buildStepId:step.id,resource:livePreviewTargetScopeResource('preview:unstable',unstableUrl),access:'execute',rationale:'Start unstable Live Preview fixture.'},
  ],
});
const lock=lockScope({orchestration,scope,candidateIds:scope.candidates.map((candidate)=>candidate.id)});
const candidate=(resource:string)=>scope.candidates.find((item)=>item.resource===resource)!;

let sessionOrdinal=0;
let closeCount=0;
let monotonic=0;
const now=()=>new Date(Date.UTC(2026,8,27,23,0,sessionOrdinal)).toISOString();

function fakeSession(options:BrowserAdapterLaunchOptions, ordinal:number):BrowserAdapterSession{
  const sessionId='bridge-session-'+ordinal;
  const tabId='bridge-tab-'+ordinal;
  let url=rawUrl;
  let viewport:PreviewViewport=options.viewport;
  let stateCalls=0;
  let open=false;

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
    viewport,
    tabIds:Object.freeze(open?[tabId]:[]),
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
    url,
    title:'Bridge fixture',
    createdAt:now(),
  });
  const page=():PreviewPageState=>{
    stateCalls+=1;
    const unstable=url.includes('/unstable');
    const height=unstable?viewport.height+stateCalls:viewport.height*2;
    return Object.freeze({
      schema:'gd-preview-page-state/1',
      build:68,
      sessionId,
      tabId,
      url,
      title:'Bridge fixture',
      readyState:'complete',
      viewport,
      document:Object.freeze({width:viewport.width,height,scrollX:0,scrollY:0}),
      accessibilityNodeCount:17,
      capturedAt:now(),
      readOnlyEvidence:true,
      arbitraryScriptExecution:false,
    });
  };

  return {
    get descriptor(){ return descriptor(); },
    async openTab(nextUrl){ url=nextUrl; open=true; return tab(); },
    async closeTab(){ open=false; },
    async navigate(_id,nextUrl){ url=nextUrl; return tab(); },
    async pageState(){ return page(); },
    async capture(_id,request:VisualEvidenceRequest):Promise<VisualEvidence>{
      const data=Buffer.from('bridge-image');
      return Object.freeze({
        schema:'gd-visual-evidence/1',
        build:68,
        sessionId,
        tabId,
        url,
        mode:request.mode,
        format:request.format,
        selector:request.selector??null,
        viewport,
        width:viewport.width,
        height:viewport.height,
        bytes:data.byteLength,
        dataBase64:data.toString('base64'),
        capturedAt:now(),
        readOnly:true,
        inline:true,
        persisted:false,
        interactionAuthority:false,
        validationAuthority:false,
      });
    },
    async upload():Promise<PreviewUploadResult>{ throw new Error('not used'); },
    async download():Promise<PreviewDownloadResult>{ throw new Error('not used'); },
    async setViewport(_id,next){ viewport=next; },
    async setColorScheme(){},
    async reload(){ return tab(); },
    async telemetrySnapshot():Promise<PreviewBridgeAdapterSnapshot>{
      const network=Object.freeze([Object.freeze({
        sequence:1,
        requestId:'req-live',
        method:'GET',
        url:'https://example.test/api?token=%5Bredacted%5D',
        resourceType:'Fetch',
        status:200,
        mimeType:'application/json',
        startedAtMonotonic:1,
        finished:true,
        failed:null,
        redirect:false,
        metadataOnly:true as const,
        queryValuesRedacted:true as const,
      })]);
      return Object.freeze({
        page:page(),
        dom:Object.freeze({
          nodeCount:20,
          elementCount:12,
          interactiveElementCount:3,
          formControlCount:2,
          iframeCount:0,
          shadowRootCount:1,
          truncated:false,
          maxNodes:20000 as const,
        }),
        network,
        console:Object.freeze([Object.freeze({sequence:2,level:'log',text:'ready',timestamp:2,truncated:false})]),
        errors:Object.freeze([]),
        networkDropped:4,
        consoleDropped:0,
        errorsDropped:0,
        capturedAt:now(),
      });
    },
    async close(){ closeCount+=1; open=false; },
  };
}

const adapter:PreviewBrowserAdapter={
  family:'chromium',
  async launch(options){
    sessionOrdinal+=1;
    return fakeSession(options,sessionOrdinal);
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
assert.equal(preview.status().previewBridge.build,70);
assert.equal(preview.status().previewBridge.readOnly,true);
assert.equal(preview.status().previewBridge.bodiesCaptured,false);
assert.equal(preview.status().previewBridge.cookiesCaptured,false);

const capabilityRequests:string[]=[];
const tools=createToolRuntime({
  orchestration,
  scopeLock:lock,
  verifyCapability:(request)=>{capabilityRequests.push(request.toolId+':'+request.capability);return true;},
  tools:preview.createToolRegistrations(lock),
});

const rawSession=await tools.invoke({
  stepId:step.id,
  toolId:PREVIEW_TOOL_IDS.startSession,
  input:{viewport:'desktop'},
  scopeCandidateId:candidate(previewBrowserScopeResource()).id,
  mutationAccess:'execute',
});
const rawSessionId=(rawSession.result as any).id as string;
const rawTab=await tools.invoke({
  stepId:step.id,
  toolId:PREVIEW_TOOL_IDS.openTab,
  input:{sessionId:rawSessionId,url:rawUrl},
  scopeCandidateId:candidate(previewUrlScopeResource(rawUrl)).id,
  mutationAccess:'execute',
});
const rawTabId=(rawTab.result as any).id as string;

const snapshot=await tools.invoke({
  stepId:step.id,
  toolId:PREVIEW_BRIDGE_TOOL_IDS.snapshot,
  input:{sessionId:rawSessionId,tabId:rawTabId},
});
const snapshotValue=snapshot.result as any;
assert.equal(snapshot.mutationAuthorized,false);
assert.equal(snapshotValue.readOnly,true);
assert.equal(snapshotValue.bounded,true);
assert.equal(snapshotValue.credentialsIncluded,false);
assert.equal(snapshotValue.bodiesIncluded,false);
assert.equal(snapshotValue.capabilities.requestHeadersRead,false);
assert.equal(snapshotValue.capabilities.responseBodyRead,false);
assert.equal(snapshotValue.capabilities.cookiesRead,false);
assert.equal(snapshotValue.capabilities.unsafeEvaluate,false);
assert.equal(snapshotValue.dom.nodeCount,20);
assert.equal(snapshotValue.network[0].url.includes('secret'),false);
assert.equal(snapshotValue.dropped.network,4);
assert.equal(snapshotValue.provenance.workspaceId,orchestration.workspaceId);
assert.equal(snapshotValue.provenance.orchestrationId,orchestration.id);
assert.equal(snapshotValue.provenance.buildStepId,step.id);
assert.equal(snapshotValue.provenance.taskId,step.sourceTaskId);
assert.equal(snapshotValue.provenance.requirementId,step.requirementId);
assert.equal(snapshotValue.provenance.runId,snapshot.id);
assert.equal(snapshotValue.provenance.scopeLockId,lock.id);

await assert.rejects(tools.invoke({
  stepId:step.id,
  toolId:PREVIEW_BRIDGE_TOOL_IDS.snapshot,
  input:{sessionId:rawSessionId,tabId:rawTabId,provenance:{runId:'forged'}},
}),/input fields are invalid/i);

await tools.invoke({
  stepId:step.id,
  toolId:LIVE_PREVIEW_TOOL_IDS.start,
  input:{id:'preview:bridge',url:liveUrl,formFactor:'desktop',colorScheme:'dark'},
  scopeCandidateId:candidate(livePreviewTargetScopeResource('preview:bridge',liveUrl)).id,
  mutationAccess:'execute',
});

const successReport=await tools.invoke({
  stepId:step.id,
  toolId:PREVIEW_BRIDGE_TOOL_IDS.captureReport,
  input:{id:'preview:bridge',request:{mode:'viewport',format:'png'}},
});
const successValue=successReport.result as any;
assert.equal(successReport.mutationAuthorized,false);
assert.equal(successValue.capture.status,'success');
assert.equal(successValue.capture.deviceScaleFactor,1);
assert.equal(successValue.capture.mode,'viewport');
assert.equal(successValue.capture.format,'png');
assert.ok(successValue.capture.bytes>0);
assert.equal(successValue.capture.settlingSucceeded,true);
assert.equal(successValue.capture.evidenceInlineAvailable,true);
assert.equal(successValue.capture.evidenceDataOmitted,true);
assert.equal('dataBase64' in successValue.capture,false);
assert.equal(successValue.provenance.runId,successReport.id);
assert.equal(successValue.validationAuthority,false);
assert.equal(successValue.releaseAuthority,false);

await tools.invoke({
  stepId:step.id,
  toolId:LIVE_PREVIEW_TOOL_IDS.start,
  input:{id:'preview:unstable',url:unstableUrl,formFactor:'desktop',colorScheme:'light'},
  scopeCandidateId:candidate(livePreviewTargetScopeResource('preview:unstable',unstableUrl)).id,
  mutationAccess:'execute',
});
const inconclusive=await tools.invoke({
  stepId:step.id,
  toolId:PREVIEW_BRIDGE_TOOL_IDS.captureReport,
  input:{id:'preview:unstable',request:{mode:'full-page',format:'jpeg',quality:80}},
});
assert.equal((inconclusive.result as any).capture.status,'inconclusive');
assert.equal((inconclusive.result as any).capture.settlingSucceeded,false);
assert.equal((inconclusive.result as any).capture.failureCode,'visual_not_settled');
assert.equal((inconclusive.result as any).capture.evidenceInlineAvailable,false);

const failed=await tools.invoke({
  stepId:step.id,
  toolId:PREVIEW_BRIDGE_TOOL_IDS.captureReport,
  input:{id:'preview:missing',request:{mode:'viewport',format:'png'}},
});
assert.equal((failed.result as any).capture.status,'failed');
assert.equal((failed.result as any).capture.failureCode,'capture_failed');
assert.match((failed.result as any).capture.failureMessage,/Unknown Live Preview session/i);

const denied=createToolRuntime({
  orchestration,
  scopeLock:lock,
  verifyCapability:()=>false,
  tools:preview.createToolRegistrations(lock),
});
await assert.rejects(denied.invoke({
  stepId:step.id,
  toolId:PREVIEW_BRIDGE_TOOL_IDS.snapshot,
  input:{sessionId:rawSessionId,tabId:rawTabId},
}),(error:unknown)=>error instanceof ToolRuntimeCapabilityError);

assert.ok(capabilityRequests.includes(PREVIEW_BRIDGE_TOOL_IDS.snapshot+':READ'));
assert.ok(capabilityRequests.includes(PREVIEW_BRIDGE_TOOL_IDS.captureReport+':READ'));
assert.deepEqual(PREVIEW_BRIDGE_CAPABILITIES.requestHeadersRead,false);
assert.deepEqual(PREVIEW_BRIDGE_CAPABILITIES.browserInteraction,false);

await preview.shutdown();
assert.equal(preview.status().activeSessionCount,0);
assert.ok(closeCount>=3);

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build70-preview-bridge-runtime/1',
  build:70,
  boundedRingEviction:true,
  redirectCorrelation:true,
  queryValuesRedacted:true,
  structuredDomEvidence:true,
  persistentTabTelemetry:true,
  automaticToolProvenance:true,
  captureSuccessFailureInconclusive:true,
  readOnly:true,
  secondBrowserRuntime:false,
},null,2));
