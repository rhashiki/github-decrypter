import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const json=(file)=>JSON.parse(read(file));
const versionBuild=(value)=>Number(String(value||'').match(/^0\.0\.(\d+)$/)?.[1]||-1);

for(const file of [
  'packages/preview/src/index.ts',
  'apps/local/src/preview-telemetry.ts',
  'apps/local/src/preview-browser-adapter.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'apps/local/src/preview-bridge-runtime.ts',
  'docs/architecture/PREVIEW_BRIDGE.md',
  'docs/builds/BUILD_70_PREVIEW_BRIDGE.md',
  'docs/research/BUILD_70_SOURCE_TRIAGE.md',
  'scripts/architecture-guardian-preview-bridge.mjs',
  'scripts/test-build70-preview-bridge-runtime.ts',
  'scripts/test-build70-preview-bridge-guardian-negative.mjs',
  'scripts/tsconfig.build70-tests.json',
]) assert.ok(fs.existsSync(file),'Build 70 artifact missing: '+file);

const policy=json('architecture.guardian.json');
const root=json('package.json');
const previewPkg=json('packages/preview/package.json');
const localPkg=json('apps/local/package.json');
const contract=read('packages/preview/src/index.ts');
const telemetry=read('apps/local/src/preview-telemetry.ts');
const adapter=read('apps/local/src/preview-browser-adapter.ts');
const browserRuntime=read('apps/local/src/preview-browser-runtime.ts');
const bridge=read('apps/local/src/preview-bridge-runtime.ts');
const triage=read('docs/research/BUILD_70_SOURCE_TRIAGE.md');
const roadmap=read('docs/product/ROADMAP_V1.md');

assert.ok(policy.currentBuild>=70);
assert.ok(versionBuild(root.version)>=70);
assert.ok(versionBuild(previewPkg.version)>=70);
assert.ok(versionBuild(localPkg.version)>=70);
assert.equal(policy.phaseGates.previewBridgeBuild,70);

const rule=policy.previewBridgeAuthority;
assert.equal(rule.minimumBuild,70);
assert.equal(rule.browserRuntimeBuild,68);
assert.equal(rule.livePreviewBuild,69);
assert.equal(rule.readOnly,true);
assert.equal(rule.bounded,true);
assert.equal(rule.telemetryPersistentPerTab,true);
assert.equal(rule.networkMetadataEvidence,true);
assert.equal(rule.captureMetadataEvidence,true);
assert.equal(rule.automaticTaskRunProvenance,true);
assert.equal(rule.maxNetworkEntries,128);
assert.equal(rule.maxConsoleEntries,128);
assert.equal(rule.maxErrorEntries,64);
assert.equal(rule.networkQueryValuesRedacted,true);
assert.equal(rule.requestHeadersCaptured,false);
assert.equal(rule.responseHeadersCaptured,false);
assert.equal(rule.requestBodiesCaptured,false);
assert.equal(rule.responseBodiesCaptured,false);
assert.equal(rule.cookiesCaptured,false);
assert.equal(rule.storageCaptured,false);
assert.equal(rule.unsafeEvaluate,false);
assert.equal(rule.browserInteraction,false);
assert.equal(rule.mutationAuthority,false);
assert.equal(rule.validationAuthority,false);
assert.equal(rule.releaseAuthority,false);
assert.equal(rule.readCapabilityOnly,true);
assert.equal(rule.secondBrowserRuntimeAllowed,false);
assert.equal(rule.browserBridgeClassification,'direct-candidate');
assert.equal(rule.browserBridgeLicense,'MIT');
assert.equal(rule.electrobunClassification,'reference-only');
assert.equal(rule.electrobunLicenseDeclared,false);

for(const marker of [
  'PREVIEW_BRIDGE_BUILD = 70',
  "PREVIEW_BRIDGE_SCHEMA = 'gd-preview-bridge/1'",
  "PREVIEW_BRIDGE_CAPTURE_REPORT_SCHEMA = 'gd-preview-bridge-capture-report/1'",
  'PREVIEW_BRIDGE_MAX_NETWORK_ENTRIES = 128',
  'PREVIEW_BRIDGE_MAX_DOM_NODES = 20_000',
  'requestHeadersRead: false',
  'responseBodyRead: false',
  'cookiesRead: false',
  'unsafeEvaluate: false',
]) assert.ok(contract.includes(marker),'Missing Preview Bridge contract marker: '+marker);

for(const marker of [
  'class BoundedTelemetryRing',
  'sanitizeTelemetryUrl(',
  "parsed.searchParams.append(key, '[redacted]')",
  'latestByRequest',
  'network.replace(',
]) assert.ok(telemetry.includes(marker),'Missing Preview telemetry marker: '+marker);

for(const marker of [
  'telemetrySnapshot?(tabId: string)',
  "Network.requestWillBeSent",
  "Runtime.consoleAPICalled",
  "Runtime.exceptionThrown",
  "DOM.getFlattenedDocument",
]) assert.ok(adapter.includes(marker),'Missing Preview Bridge adapter marker: '+marker);

assert.ok(browserRuntime.includes('createPreviewBridgeRuntime('));
assert.ok(browserRuntime.includes('previewBridge.createToolRegistrations(scopeLock)'));
assert.ok(browserRuntime.includes('captureLivePreview: livePreview.captureForBridge'));

for(const marker of [
  "requiredCapabilities: Object.freeze(['READ'] as const)",
  'taskId: context.step.sourceTaskId',
  'runId: context.invocationId',
  "status: 'failed'",
  "status: 'inconclusive'",
  "status: 'success'",
  'evidenceDataOmitted: true',
]) assert.ok(bridge.includes(marker),'Missing Preview Bridge runtime marker: '+marker);

assert.equal(/createChromiumCdpAdapter|child_process|\bspawn\s*\(|\bfetch\s*\(|\bWebSocket\b/.test(bridge),false);
assert.equal(read('apps/local/src/index.ts').includes('preview-bridge-runtime'),false);
assert.ok(triage.includes('License: **MIT**'));
assert.ok(triage.includes('Classification: **reference-only**'));
assert.ok(roadmap.includes('70. **Preview Bridge** — ✅ —'));

assert.ok(root.scripts.guardian.includes('architecture-guardian-preview-bridge.mjs'));
assert.ok(root.scripts['check:build70']);
assert.ok(root.scripts.ci.includes('check:build70'));

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build70-preview-bridge-static/1',
  build:70,
  boundedTelemetry:true,
  privacyMinimized:true,
  automaticProvenance:true,
  captureStatus:true,
  nextBuild:71,
},null,2));
