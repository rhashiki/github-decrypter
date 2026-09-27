import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const json=(file)=>JSON.parse(read(file));
const versionBuild=(value)=>Number(String(value||'').match(/^0\.0\.(\d+)$/)?.[1]||-1);

for(const file of [
  'packages/preview/src/index.ts',
  'apps/local/src/preview-browser-adapter.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'apps/local/src/live-preview-runtime.ts',
  'docs/architecture/LIVE_PREVIEW.md',
  'docs/builds/BUILD_69_LIVE_PREVIEW.md',
  'docs/research/BUILD_69_SOURCE_TRIAGE.md',
  'scripts/architecture-guardian-live-preview.mjs',
  'scripts/test-build69-live-preview-runtime.ts',
  'scripts/test-build69-live-preview-guardian-negative.mjs',
  'scripts/tsconfig.build69-tests.json',
  '.github/workflows/build69-live-preview.yml',
]) assert.ok(fs.existsSync(file),'Build 69 artifact missing: '+file);

const policy=json('architecture.guardian.json');
const root=json('package.json');
const previewPkg=json('packages/preview/package.json');
const localPkg=json('apps/local/package.json');
const contract=read('packages/preview/src/index.ts');
const adapter=read('apps/local/src/preview-browser-adapter.ts');
const browserRuntime=read('apps/local/src/preview-browser-runtime.ts');
const liveRuntime=read('apps/local/src/live-preview-runtime.ts');
const triage=read('docs/research/BUILD_69_SOURCE_TRIAGE.md');
const roadmap=read('docs/product/ROADMAP_V1.md');

assert.ok(policy.currentBuild>=69);
assert.ok(versionBuild(root.version)>=69);
assert.ok(versionBuild(previewPkg.version)>=69);
assert.ok(versionBuild(localPkg.version)>=69);
assert.equal(policy.phaseGates.livePreviewBuild,69);

const rule=policy.livePreviewAuthority;
assert.equal(rule.minimumBuild,69);
assert.equal(rule.browserRuntimeBuild,68);
assert.equal(rule.nativeHmrPreferred,true);
assert.equal(rule.hmrOwner,'target-dev-server');
assert.equal(rule.hostReloadRequiredForSourceChange,false);
assert.equal(rule.healthProbe,true);
assert.equal(rule.readinessEvidenceBased,true);
assert.equal(rule.boundedRecovery,true);
assert.equal(rule.maxRecoveryAttempts,3);
assert.equal(rule.recoveryCreatesNewBrowserGeneration,true);
assert.equal(rule.failedRecoveryPreservesPriorSession,true);
assert.deepEqual(rule.deterministicFormFactors,['desktop','tablet','mobile']);
assert.deepEqual(rule.colorSchemes,['light','dark']);
assert.equal(rule.boundedVisualSettling,true);
assert.equal(rule.visualSettlingRequiredBeforeCapture,true);
assert.equal(rule.captureFailureMayPass,false);
assert.equal(rule.toolRuntimeRequired,true);
assert.equal(rule.scopeLockRequiredForMutation,true);
assert.equal(rule.secondBrowserRuntimeAllowed,false);
assert.equal(rule.flowentClassification,'reference-only');
assert.equal(rule.flowentLicenseDeclared,false);
assert.equal(rule.flowentCodeReuseAllowed,false);

for(const marker of [
  'LIVE_PREVIEW_BUILD = 69',
  "LIVE_PREVIEW_SCHEMA = 'gd-live-preview/1'",
  'LIVE_PREVIEW_TOOL_IDS',
  'LIVE_PREVIEW_MAX_RECOVERY_ATTEMPTS = 3',
  'normalizeLivePreviewSettlingPolicy(',
  'livePreviewTargetScopeResource(',
  'livePreviewSessionScopeResource(',
]) assert.ok(contract.includes(marker),'Missing Live Preview contract marker: '+marker);

for(const marker of [
  'setViewport?(tabId: string',
  'setColorScheme?(tabId: string',
  'reload?(tabId: string',
  'tabViewports',
  'tabColorSchemes',
  "Page.reload",
]) assert.ok(adapter.includes(marker),'Missing Live Preview adapter marker: '+marker);

assert.ok(browserRuntime.includes('createLivePreviewRuntime('));
assert.ok(browserRuntime.includes('livePreview.createToolRegistrations(scopeLock)'));
assert.ok(browserRuntime.includes('await livePreview.shutdown()'));

for(const marker of [
  "hmrOwner: 'target-dev-server'",
  'hostReloadRequiredForSourceChange: false',
  'record.recoveryCount >= LIVE_PREVIEW_MAX_RECOVERY_ATTEMPTS',
  'generation: record.generation + 1',
    'Object.assign(record, candidate)',
  'const settling = await settle(record)',
  'if (settling.settled)',
  'captured: evidence !== null',
]) assert.ok(liveRuntime.includes(marker),'Missing Live Preview runtime marker: '+marker);

assert.equal(/createChromiumCdpAdapter|child_process|\bspawn\s*\(|\bfetch\s*\(|\bWebSocket\b/.test(liveRuntime),false);
assert.equal(read('apps/local/src/index.ts').includes('live-preview-runtime'),false);
assert.ok(triage.includes('Classification: **reference-only**'));
assert.ok(triage.includes('License: **not declared in the repository at audit time**'));
assert.ok(roadmap.includes('69. **Live Preview** — ✅ —'));

assert.ok(root.scripts.guardian.includes('architecture-guardian-live-preview.mjs'));
assert.ok(root.scripts['check:build69']);
assert.ok(root.scripts.ci.includes('check:build69'));

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build69-live-preview-static/1',
  build:69,
  nativeHmrPreferred:true,
  healthProbe:true,
  boundedRecovery:true,
  deterministicFormFactors:true,
  boundedVisualSettling:true,
  flowent:'reference-only',
  nextBuild:70,
},null,2));
