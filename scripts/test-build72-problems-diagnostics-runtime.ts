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
  PROBLEMS_DIAGNOSTICS_TOOL_IDS,
  createProblemsDiagnostics,
  parseDiagnosticText,
} from '../packages/diagnostics/src/index.js';
import {
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
import { createProblemsDiagnosticsRuntime } from '../apps/local/src/problems-diagnostics-runtime.js';
import type { BrowserAdapterSession } from '../apps/local/src/preview-browser-adapter.js';

const parsed=parseDiagnosticText({
  source:'test',
  sourceRef:'test:vitest-output',
  text:'\u001b[31mError: expected true\u001b[0m\n    at file:///D:/repo/src/app.ts:12:4\n/tmp/repo/src/server.ts:7:2: warning: slow branch',
});
assert.equal(parsed.length,2);
assert.equal(parsed[0]!.location?.file,'D:/repo/src/app.ts');
assert.equal(parsed[0]!.location?.line,12);
assert.equal(parsed[1]!.location?.file,'/tmp/repo/src/server.ts');
assert.equal(parsed[1]!.severity,'warning');

const direct=createProblemsDiagnostics({
  workspaceId:'workspace:diagnostics-test',
  observations:[
    {
      source:'runtime',
      severity:'error',
      message:'ReferenceError: missingValue',
      sourceRef:'runtime:1',
      code:'reference-error',
      location:{file:'src/app.ts',line:12,column:4},
      evidenceRefs:['runtime:1'],
    },
    {
      source:'runtime',
      severity:'error',
      message:'ReferenceError: missingValue',
      sourceRef:'runtime:2',
      code:'reference-error',
      location:{file:'src/app.ts',line:12,column:4},
      evidenceRefs:['runtime:2'],
    },
    {
      source:'test',
      severity:'warning',
      message:'Assertion reported the same source location',
      sourceRef:'test:1',
      code:'assertion',
      location:{file:'src/app.ts',line:12,column:8},
    },
    {
      source:'browser',
      severity:'error',
      message:'GET /api failed',
      sourceRef:'browser:req-1',
      code:'http-500',
    },
  ],
});
assert.equal(direct.inputCount,4);
assert.equal(direct.deduplicatedCount,3);
assert.equal(direct.diagnostics.find((item)=>item.code==='reference-error')?.occurrences,2);
assert.deepEqual(direct.diagnostics.find((item)=>item.code==='reference-error')?.evidenceRefs,['runtime:1','runtime:2']);
assert.equal(direct.correlations.length,1);
assert.equal(direct.correlations[0]?.correlatedBy,'source-location');
assert.equal(direct.correlations[0]?.causationClaimed,false);
assert.equal(direct.diagnostics.filter((item)=>item.sourceCorrelated).length,2);
assert.equal(direct.unlocatedCount,1);
assert.equal(direct.topLevelSeverity,'error');
assert.equal(direct.groups.find((group)=>group.kind==='file'&&group.label==='src/app.ts')?.severity,'error');
assert.equal(direct.unmatchedDiagnosticsPreserved,true);
assert.equal(direct.rootCauseAuthority,false);
assert.equal(direct.autoFixAuthority,false);
assert.equal(direct.validationAuthority,false);

const intake=createPromptIntakeRecord({text:`
# Goal
Aggregate Problems and Diagnostics evidence.

# Requirements
- Combine runtime, browser, test, Preview and validation observations.
- Correlate explicit source locations without claiming root cause.

# Constraint
Problems and Diagnostics is read-only and cannot replace Validation Pipeline.

# Acceptance
Diagnostic aggregation is bounded, deterministic and READ-capability gated.
`});
const spec=compileRequirements({intake});
const graph=compileTaskGraph({spec});
const draft=createPlanAuthority({spec,graph});
const rules=bindProjectRules({
  plan:draft,
  workspaceId:'workspace:diagnostics-test',
  rules:[
    {key:'diagnostics.read-only',kind:'require',statement:'Diagnostics remain read-only.'},
    {key:'diagnostics.no-root-cause',kind:'forbid',statement:'Diagnostics cannot claim root cause.'},
  ],
});
const impact=simulateImpact({
  plan:draft,
  projectRules:rules,
  impacts:[{
    area:'Problems Diagnostics projection',
    effect:'positive',
    severity:'critical',
    summary:'Aggregates source-grounded evidence without new authority.',
    relatedRuleKeys:['diagnostics.read-only','diagnostics.no-root-cause'],
    relatedTaskIds:['task-0001'],
  }],
});
const plan=approvePlan({plan:draft});
const orchestration=orchestrateBuild({plan,projectRules:rules,impactSimulation:impact});
const step=orchestration.steps[0]!;
const scope=analyzeScope({
  orchestration,
  candidates:[{
    key:'diagnostics.context',
    buildStepId:step.id,
    resource:'problems-diagnostics:context',
    access:'execute',
    rationale:'Provide locked provenance context for read-only diagnostics.',
  }],
});
const lock=lockScope({orchestration,scope,candidateIds:[scope.candidates[0]!.id]});

const viewport:PreviewViewport=Object.freeze({width:1440,height:900,deviceScaleFactor:1});
const page:PreviewPageState=Object.freeze({
  schema:'gd-preview-page-state/1',
  build:68,
  sessionId:'diag-session',
  tabId:'diag-tab',
  url:'http://127.0.0.1:5173/',
  title:'Diagnostics fixture',
  readyState:'complete',
  viewport,
  document:Object.freeze({width:1440,height:1800,scrollX:0,scrollY:0}),
  accessibilityNodeCount:12,
  capturedAt:'2026-09-28T00:20:00.000Z',
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
      requestId:'req-fail',
      method:'GET',
      url:'https://example.test/api/items?token=%5Bredacted%5D',
      resourceType:'Fetch',
      status:500,
      mimeType:'application/json',
      startedAtMonotonic:1,
      finished:true,
      failed:null,
      redirect:false,
      metadataOnly:true,
      queryValuesRedacted:true,
    }),
  ]),
  console:Object.freeze([
    Object.freeze({sequence:2,level:'warn',text:'render warning',timestamp:2,truncated:false}),
  ]),
  errors:Object.freeze([
    Object.freeze({sequence:3,message:'ReferenceError: missingValue at src/app.ts:12:4',timestamp:3,truncated:false}),
  ]),
  networkDropped:1,
  consoleDropped:0,
  errorsDropped:0,
  capturedAt:'2026-09-28T00:20:01.000Z',
});

const descriptor:PreviewSessionDescriptor=Object.freeze({
  schema:'gd-preview-session/1',
  build:68,
  id:'diag-session',
  status:'ready',
  browserFamily:'chromium',
  browserExecutable:'/fake/chromium',
  isolatedProfile:true,
  profilePersistence:false,
  createdAt:'2026-09-28T00:20:00.000Z',
  viewport,
  tabIds:Object.freeze(['diag-tab']),
  toolRuntimeRequired:true,
  scopeLockRequiredForMutation:true,
  deterministicCleanup:true,
});

const fakeSession:BrowserAdapterSession={
  descriptor,
  async openTab():Promise<PreviewTabDescriptor>{throw new Error('Diagnostics must not open tabs.');},
  async closeTab(){throw new Error('Diagnostics must not close tabs.');},
  async navigate():Promise<PreviewTabDescriptor>{throw new Error('Diagnostics must not navigate.');},
  async pageState(){return page;},
  async capture(_tabId:string,_request:VisualEvidenceRequest):Promise<VisualEvidence>{throw new Error('Diagnostics must not capture.');},
  async upload():Promise<PreviewUploadResult>{throw new Error('Diagnostics must not upload.');},
  async download():Promise<PreviewDownloadResult>{throw new Error('Diagnostics must not download.');},
  async telemetrySnapshot(tabId:string){
    assert.equal(tabId,'diag-tab');
    return snapshot;
  },
  async close(){},
};

let sessionReads=0;
const diagnostics=createProblemsDiagnosticsRuntime({
  host:{
    getBrowserSession(sessionId){
      sessionReads+=1;
      assert.equal(sessionId,'diag-session');
      return fakeSession;
    },
  },
  now:()=> '2026-09-28T00:20:02.000Z',
});
assert.deepEqual(diagnostics.status(),{
  schema:'gd-problems-diagnostics-runtime/1',
  build:72,
  ready:true,
  readOnly:true,
  aggregationAuthority:true,
  correlationAuthority:true,
  telemetryOwner:'preview-bridge',
  validationOwner:'validation-pipeline',
  secondCollector:false,
  persistentStorage:false,
  rootCauseAuthority:false,
  autoFixAuthority:false,
  mutationAuthority:false,
  validationAuthority:false,
  releaseAuthority:false,
});

const capabilities:string[]=[];
const tools=createToolRuntime({
  orchestration,
  scopeLock:lock,
  verifyCapability:(request)=>{capabilities.push(request.toolId+':'+request.capability);return true;},
  tools:diagnostics.createToolRegistrations(lock),
});

const result=await tools.invoke({
  stepId:step.id,
  toolId:PROBLEMS_DIAGNOSTICS_TOOL_IDS.aggregate,
  input:{
    preview:{sessionId:'diag-session',tabId:'diag-tab'},
    textDiagnostics:[{
      source:'test',
      sourceRef:'test:compiler',
      text:'src/app.ts:12:4: error TS2304: Cannot find name missingValue',
    }],
    validations:[{
      schema:'gd-validation-pipeline/1',
      status:'validated',
      immutable:true,
      deterministic:true,
      validationPipeline:true,
      mutationAuthorized:false,
      workspaceId:'workspace:diagnostics-test',
      id:'validation-fixture',
      criteria:[{
        criterionId:'validation-criterion-0001',
        statement:'Preview displays expected customer list.',
        evidenceKind:'preview',
        sourceRef:'preview:customer-list',
        passed:false,
      }],
    }],
    previewCaptureReports:[{
      schema:'gd-preview-bridge-capture-report/1',
      build:70,
      readOnly:true,
      provenance:{workspaceId:'workspace:diagnostics-test',runId:'preview-run'},
      capture:{
        status:'inconclusive',
        livePreviewId:'preview-test',
        generation:2,
        failureCode:'visual-settling-timeout',
        failureMessage:'Preview did not visually settle in the bounded window.',
      },
    }],
    maxEntries:64,
  },
});
const value=result.result as any;
assert.equal(result.mutationAuthorized,false);
assert.equal(value.schema,'gd-problems-diagnostics-report/1');
assert.equal(value.build,72);
assert.equal(value.readOnly,true);
assert.equal(value.aggregationAuthority,true);
assert.equal(value.correlationAuthority,true);
assert.equal(value.rootCauseAuthority,false);
assert.equal(value.autoFixAuthority,false);
assert.equal(value.validationAuthority,false);
assert.equal(value.snapshot.topLevelSeverity,'error');
assert.ok(value.snapshot.sourceCounts.browser>=2);
assert.ok(value.snapshot.sourceCounts.test>=1);
assert.ok(value.snapshot.sourceCounts.preview>=2);
assert.ok(value.snapshot.diagnostics.some((item:any)=>item.code==='http-500'));
assert.ok(value.snapshot.diagnostics.some((item:any)=>item.code==='telemetry-dropped'));
assert.ok(value.snapshot.diagnostics.some((item:any)=>item.code==='validation-criterion-0001'));
assert.ok(value.snapshot.diagnostics.some((item:any)=>item.code==='visual-settling-timeout'));
assert.ok(value.snapshot.correlations.some((item:any)=>item.file==='src/app.ts'&&item.line===12));
assert.equal(value.sourceStats.previewBridge,true);
assert.equal(value.sourceStats.validationRecords,1);
assert.equal(value.sourceStats.diagnosticTextInputs,1);
assert.equal(value.sourceStats.previewCaptureReports,1);
assert.equal(value.sourceStats.previewTelemetryDropped,1);
assert.equal(value.provenance.workspaceId,orchestration.workspaceId);
assert.equal(value.provenance.runId,result.id);
assert.equal(value.provenance.scopeLockId,lock.id);
assert.equal(sessionReads,1);
assert.ok(capabilities.includes(PROBLEMS_DIAGNOSTICS_TOOL_IDS.aggregate+':READ'));

const denied=createToolRuntime({
  orchestration,
  scopeLock:lock,
  verifyCapability:()=>false,
  tools:diagnostics.createToolRegistrations(lock),
});
await assert.rejects(denied.invoke({
  stepId:step.id,
  toolId:PROBLEMS_DIAGNOSTICS_TOOL_IDS.aggregate,
  input:{textDiagnostics:[{source:'test',sourceRef:'test:denied',text:'src/x.ts:1:1: error: denied'}]},
}),(error:unknown)=>error instanceof ToolRuntimeCapabilityError);

await assert.rejects(tools.invoke({
  stepId:step.id,
  toolId:PROBLEMS_DIAGNOSTICS_TOOL_IDS.aggregate,
  input:{validations:[{
    schema:'gd-validation-pipeline/1',
    status:'validated',
    immutable:true,
    deterministic:true,
    validationPipeline:true,
    mutationAuthorized:false,
    workspaceId:'workspace:another',
    id:'wrong-workspace',
    criteria:[],
  }]},
}),/different workspace/i);

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build72-problems-diagnostics-runtime/1',
  build:72,
  ansiSafeTextParsing:true,
  crossPlatformSourceLocations:true,
  deterministicDeduplication:true,
  occurrencePreservation:true,
  sourceLocationCorrelation:true,
  correlationIsNotCausation:true,
  worstSeverityPropagation:true,
  unmatchedDiagnosticsPreserved:true,
  previewBridgeReuse:true,
  validationProjection:true,
  captureFailureProjection:true,
  readCapability:true,
  automaticProvenance:true,
  rootCauseAuthority:false,
  autoFixAuthority:false,
  uiDeferred:true,
},null,2));
