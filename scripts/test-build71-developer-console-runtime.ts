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
  DEVELOPER_CONSOLE_TOOL_IDS,
  normalizeDeveloperConsoleQuery,
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
import { createDeveloperConsoleRuntime } from '../apps/local/src/developer-console-runtime.js';
import type { BrowserAdapterSession } from '../apps/local/src/preview-browser-adapter.js';

const intake=createPromptIntakeRecord({text:`
# Goal
Expose a bounded read-only developer console over Preview Bridge telemetry.

# Requirements
- Filter console, network and runtime-error events.
- Tail telemetry by monotonic sequence cursor.
- Preserve Preview Bridge privacy and provenance.

# Constraint
Developer Console cannot mutate the browser or create another telemetry collector.

# Acceptance
Queries are bounded, complete across cursors and READ-capability gated.
`});
const spec=compileRequirements({intake});
const graph=compileTaskGraph({spec});
const draft=createPlanAuthority({spec,graph});
const rules=bindProjectRules({
  plan:draft,
  workspaceId:'workspace:developer-console-test',
  rules:[
    {key:'console.read-only',kind:'require',statement:'Developer Console remains read-only.'},
    {key:'console.source',kind:'require',statement:'Preview Bridge owns telemetry collection.'},
  ],
});
const impact=simulateImpact({
  plan:draft,
  projectRules:rules,
  impacts:[{
    area:'Developer Console projection',
    effect:'positive',
    severity:'critical',
    summary:'Adds bounded filtering without creating browser authority.',
    relatedRuleKeys:['console.read-only','console.source'],
    relatedTaskIds:['task-0001'],
  }],
});
const plan=approvePlan({plan:draft});
const orchestration=orchestrateBuild({plan,projectRules:rules,impactSimulation:impact});
const step=orchestration.steps[0]!;
const scope=analyzeScope({
  orchestration,
  candidates:[{
    key:'developer-console.context',
    buildStepId:step.id,
    resource:'developer-console:context',
    access:'execute',
    rationale:'Provide a canonical locked provenance context for read-only console tools.',
  }],
});
const lock=lockScope({orchestration,scope,candidateIds:[scope.candidates[0]!.id]});

const viewport:PreviewViewport=Object.freeze({width:1440,height:900,deviceScaleFactor:1});
const page:PreviewPageState=Object.freeze({
  schema:'gd-preview-page-state/1',
  build:68,
  sessionId:'console-session',
  tabId:'console-tab',
  url:'http://127.0.0.1:5173/',
  title:'Developer Console fixture',
  readyState:'complete',
  viewport,
  document:Object.freeze({width:1440,height:1800,scrollX:0,scrollY:0}),
  accessibilityNodeCount:14,
  capturedAt:'2026-09-27T23:58:00.000Z',
  readOnlyEvidence:true,
  arbitraryScriptExecution:false,
});

const snapshot:PreviewBridgeAdapterSnapshot=Object.freeze({
  page,
  dom:Object.freeze({
    nodeCount:30,
    elementCount:20,
    interactiveElementCount:4,
    formControlCount:1,
    iframeCount:0,
    shadowRootCount:0,
    truncated:false,
    maxNodes:20000,
  }),
  network:Object.freeze([
    Object.freeze({
      sequence:1,
      requestId:'req-1',
      method:'GET',
      url:'https://example.test/api/list?token=%5Bredacted%5D',
      resourceType:'Fetch',
      status:200,
      mimeType:'application/json',
      startedAtMonotonic:1,
      finished:true,
      failed:null,
      redirect:false,
      metadataOnly:true,
      queryValuesRedacted:true,
    }),
    Object.freeze({
      sequence:5,
      requestId:'req-5',
      method:'POST',
      url:'https://example.test/api/private?secret=%5Bredacted%5D',
      resourceType:'Fetch',
      status:500,
      mimeType:'application/json',
      startedAtMonotonic:5,
      finished:true,
      failed:'server failed',
      redirect:false,
      metadataOnly:true,
      queryValuesRedacted:true,
    }),
  ]),
  console:Object.freeze([
    Object.freeze({sequence:2,level:'log',text:'application ready',timestamp:2,truncated:false}),
    Object.freeze({sequence:6,level:'warn',text:'slow render warning',timestamp:6,truncated:false}),
  ]),
  errors:Object.freeze([
    Object.freeze({sequence:3,message:'ReferenceError: missingValue',timestamp:3,truncated:false}),
  ]),
  networkDropped:7,
  consoleDropped:2,
  errorsDropped:1,
  capturedAt:'2026-09-27T23:58:01.000Z',
});

const descriptor:PreviewSessionDescriptor=Object.freeze({
  schema:'gd-preview-session/1',
  build:68,
  id:'console-session',
  status:'ready',
  browserFamily:'chromium',
  browserExecutable:'/fake/chromium',
  isolatedProfile:true,
  profilePersistence:false,
  createdAt:'2026-09-27T23:58:00.000Z',
  viewport,
  tabIds:Object.freeze(['console-tab']),
  toolRuntimeRequired:true,
  scopeLockRequiredForMutation:true,
  deterministicCleanup:true,
});

const fakeSession:BrowserAdapterSession={
  descriptor,
  async openTab():Promise<PreviewTabDescriptor>{throw new Error('Developer Console must not open tabs.');},
  async closeTab(){throw new Error('Developer Console must not close tabs.');},
  async navigate():Promise<PreviewTabDescriptor>{throw new Error('Developer Console must not navigate.');},
  async pageState(){return page;},
  async capture(_tabId:string,_request:VisualEvidenceRequest):Promise<VisualEvidence>{throw new Error('Developer Console must not capture.');},
  async upload():Promise<PreviewUploadResult>{throw new Error('Developer Console must not upload.');},
  async download():Promise<PreviewDownloadResult>{throw new Error('Developer Console must not download.');},
  async telemetrySnapshot(tabId:string){
    assert.equal(tabId,'console-tab');
    return snapshot;
  },
  async close(){},
};

let sessionReads=0;
const consoleRuntime=createDeveloperConsoleRuntime({
  host:{
    getBrowserSession(sessionId){
      sessionReads+=1;
      assert.equal(sessionId,'console-session');
      return fakeSession;
    },
  },
});
assert.equal(consoleRuntime.build,71);
assert.deepEqual(consoleRuntime.status(),{
  schema:'gd-developer-console-runtime/1',
  build:71,
  ready:true,
  readOnly:true,
  bounded:true,
  streamingByCursor:true,
  telemetryOwner:'preview-bridge',
  secondCollector:false,
  hostExecutionSeparated:true,
  persistentStorage:false,
  mutationAuthority:false,
  browserAuthority:false,
  diagnosticsAuthority:false,
  validationAuthority:false,
  releaseAuthority:false,
});

const capabilities:string[]=[];
const tools=createToolRuntime({
  orchestration,
  scopeLock:lock,
  verifyCapability:(request)=>{capabilities.push(request.toolId+':'+request.capability);return true;},
  tools:consoleRuntime.createToolRegistrations(lock),
});

const first=await tools.invoke({
  stepId:step.id,
  toolId:DEVELOPER_CONSOLE_TOOL_IDS.query,
  input:{sessionId:'console-session',tabId:'console-tab',query:{limit:2}},
});
const firstValue=first.result as any;
assert.equal(first.mutationAuthorized,false);
assert.deepEqual(firstValue.entries.map((entry:any)=>entry.sequence),[1,2]);
assert.equal(firstValue.nextAfterSequence,2);
assert.equal(firstValue.latestSequence,6);
assert.equal(firstValue.truncated,true);
assert.deepEqual(firstValue.dropped,{network:7,console:2,errors:1});
assert.equal(firstValue.credentialsIncluded,false);
assert.equal(firstValue.requestHeadersIncluded,false);
assert.equal(firstValue.responseHeadersIncluded,false);
assert.equal(firstValue.bodiesIncluded,false);
assert.equal(firstValue.provenance.workspaceId,orchestration.workspaceId);
assert.equal(firstValue.provenance.runId,first.id);
assert.equal(firstValue.provenance.scopeLockId,lock.id);

const second=await tools.invoke({
  stepId:step.id,
  toolId:DEVELOPER_CONSOLE_TOOL_IDS.query,
  input:{sessionId:'console-session',tabId:'console-tab',query:{afterSequence:firstValue.nextAfterSequence,limit:2}},
});
const secondValue=second.result as any;
assert.deepEqual(secondValue.entries.map((entry:any)=>entry.sequence),[3,5]);
assert.equal(secondValue.nextAfterSequence,5);

const third=await tools.invoke({
  stepId:step.id,
  toolId:DEVELOPER_CONSOLE_TOOL_IDS.query,
  input:{sessionId:'console-session',tabId:'console-tab',query:{afterSequence:5,limit:2}},
});
assert.deepEqual((third.result as any).entries.map((entry:any)=>entry.sequence),[6]);

const descending=await tools.invoke({
  stepId:step.id,
  toolId:DEVELOPER_CONSOLE_TOOL_IDS.query,
  input:{sessionId:'console-session',tabId:'console-tab',query:{limit:2,order:'desc'}},
});
assert.deepEqual((descending.result as any).entries.map((entry:any)=>entry.sequence),[2,1]);
assert.equal((descending.result as any).nextAfterSequence,2);

const networkErrors=await tools.invoke({
  stepId:step.id,
  toolId:DEVELOPER_CONSOLE_TOOL_IDS.query,
  input:{sessionId:'console-session',tabId:'console-tab',query:{sources:['network'],minStatus:400}},
});
assert.deepEqual((networkErrors.result as any).entries.map((entry:any)=>entry.sequence),[5]);
assert.equal((networkErrors.result as any).entries[0].level,'error');
assert.equal((networkErrors.result as any).entries[0].url.includes('private'),true);
assert.equal((networkErrors.result as any).entries[0].url.includes('super-secret'),false);

const postOnly=await tools.invoke({
  stepId:step.id,
  toolId:DEVELOPER_CONSOLE_TOOL_IDS.query,
  input:{sessionId:'console-session',tabId:'console-tab',query:{methods:['POST']}},
});
assert.deepEqual((postOnly.result as any).entries.map((entry:any)=>entry.sequence),[5]);

const errorLevel=await tools.invoke({
  stepId:step.id,
  toolId:DEVELOPER_CONSOLE_TOOL_IDS.query,
  input:{sessionId:'console-session',tabId:'console-tab',query:{levels:['error']}},
});
assert.deepEqual((errorLevel.result as any).entries.map((entry:any)=>entry.sequence),[3,5]);

const textFilter=await tools.invoke({
  stepId:step.id,
  toolId:DEVELOPER_CONSOLE_TOOL_IDS.query,
  input:{sessionId:'console-session',tabId:'console-tab',query:{text:'missingvalue'}},
});
assert.deepEqual((textFilter.result as any).entries.map((entry:any)=>entry.sequence),[3]);

const summary=await tools.invoke({
  stepId:step.id,
  toolId:DEVELOPER_CONSOLE_TOOL_IDS.summary,
  input:{sessionId:'console-session',tabId:'console-tab'},
});
const summaryValue=summary.result as any;
assert.equal(summary.mutationAuthorized,false);
assert.deepEqual(summaryValue.totals,{network:2,console:2,errors:1});
assert.deepEqual(summaryValue.dropped,{network:7,console:2,errors:1});
assert.equal(summaryValue.latestSequence,6);
assert.equal(summaryValue.diagnosticsAuthority,false);
assert.equal(summaryValue.browserAuthority,false);
assert.equal(summaryValue.provenance.runId,summary.id);

await assert.rejects(tools.invoke({
  stepId:step.id,
  toolId:DEVELOPER_CONSOLE_TOOL_IDS.query,
  input:{sessionId:'console-session',tabId:'console-tab',provenance:{runId:'forged'}},
}),/input fields are invalid/i);

assert.throws(()=>normalizeDeveloperConsoleQuery({limit:257}),/limit is invalid/i);
assert.throws(()=>normalizeDeveloperConsoleQuery({minStatus:500,maxStatus:400}),/status range is invalid/i);
assert.throws(()=>normalizeDeveloperConsoleQuery({sources:['storage']}),/source is invalid/i);

const denied=createToolRuntime({
  orchestration,
  scopeLock:lock,
  verifyCapability:()=>false,
  tools:consoleRuntime.createToolRegistrations(lock),
});
await assert.rejects(denied.invoke({
  stepId:step.id,
  toolId:DEVELOPER_CONSOLE_TOOL_IDS.summary,
  input:{sessionId:'console-session',tabId:'console-tab'},
}),(error:unknown)=>error instanceof ToolRuntimeCapabilityError);

assert.ok(capabilities.includes(DEVELOPER_CONSOLE_TOOL_IDS.query+':READ'));
assert.ok(capabilities.includes(DEVELOPER_CONSOLE_TOOL_IDS.summary+':READ'));
assert.ok(sessionReads>=8);

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build71-developer-console-runtime/1',
  build:71,
  singleTelemetryOwner:true,
  readCapability:true,
  boundedQuery:true,
  cursorCompleteness:true,
  descendingPresentationWithoutCursorLoss:true,
  sourceLevelMethodStatusTextFilters:true,
  droppedAccounting:true,
  automaticProvenance:true,
  privacyBoundaryPreserved:true,
  uiDeferred:true,
},null,2));
