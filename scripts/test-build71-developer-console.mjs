import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const json=(file)=>JSON.parse(read(file));
const versionBuild=(value)=>Number(String(value||'').match(/^0\.0\.(\d+)$/)?.[1]||-1);

for(const file of [
  'packages/preview/src/index.ts',
  'apps/local/src/developer-console-runtime.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'docs/architecture/DEVELOPER_CONSOLE.md',
  'docs/builds/BUILD_71_DEVELOPER_CONSOLE.md',
  'docs/research/BUILD_71_SOURCE_TRIAGE.md',
  'scripts/architecture-guardian-developer-console.mjs',
  'scripts/test-build71-developer-console-runtime.ts',
  'scripts/test-build71-developer-console-guardian-negative.mjs',
  'scripts/tsconfig.build71-tests.json',
  '.github/workflows/build71-developer-console.yml',
]) assert.ok(fs.existsSync(file),'Build 71 artifact missing: '+file);

const policy=json('architecture.guardian.json');
const root=json('package.json');
const previewPkg=json('packages/preview/package.json');
const localPkg=json('apps/local/package.json');
const contract=read('packages/preview/src/index.ts');
const runtime=read('apps/local/src/developer-console-runtime.ts');
const browserRuntime=read('apps/local/src/preview-browser-runtime.ts');
const triage=read('docs/research/BUILD_71_SOURCE_TRIAGE.md');
const roadmap=read('docs/product/ROADMAP_V1.md');

assert.ok(policy.currentBuild>=71);
assert.ok(versionBuild(root.version)>=71);
assert.ok(versionBuild(previewPkg.version)>=71);
assert.ok(versionBuild(localPkg.version)>=71);
assert.equal(policy.phaseGates.developerConsoleBuild,71);

const rule=policy.developerConsoleAuthority;
assert.equal(rule.minimumBuild,71);
assert.equal(rule.previewBridgeBuild,70);
assert.equal(rule.readOnly,true);
assert.equal(rule.bounded,true);
assert.equal(rule.streamingByCursor,true);
assert.deepEqual(rule.querySources,['console','network','runtime-error']);
assert.equal(rule.maxQueryLimit,256);
assert.equal(rule.telemetryOwner,'preview-bridge');
assert.equal(rule.secondCollectorAllowed,false);
assert.equal(rule.hostExecutionSeparated,true);
assert.equal(rule.persistentStorage,false);
assert.equal(rule.requestHeadersIncluded,false);
assert.equal(rule.responseHeadersIncluded,false);
assert.equal(rule.requestBodiesIncluded,false);
assert.equal(rule.responseBodiesIncluded,false);
assert.equal(rule.credentialsIncluded,false);
assert.equal(rule.browserInteraction,false);
assert.equal(rule.mutationAuthority,false);
assert.equal(rule.diagnosticsAuthority,false);
assert.equal(rule.validationAuthority,false);
assert.equal(rule.releaseAuthority,false);
assert.equal(rule.readCapabilityOnly,true);
assert.equal(rule.uiDeferred,true);
assert.equal(rule.edgeNetworkConsoleClassification,'direct-candidate');
assert.equal(rule.edgeNetworkConsoleLicense,'MIT');
assert.equal(rule.webConsoleCaptureClassification,'reference-only');
assert.equal(rule.devtoolsCloneClassification,'reference-only');
assert.equal(rule.devtoolsCloneLicenseVerified,false);
assert.equal(rule.devtoolsCloneCodeReuseAllowed,false);

for(const marker of [
  'DEVELOPER_CONSOLE_BUILD = 71',
  "DEVELOPER_CONSOLE_SCHEMA = 'gd-developer-console/1'",
  "DEVELOPER_CONSOLE_RESULT_SCHEMA = 'gd-developer-console-result/1'",
  'DEVELOPER_CONSOLE_MAX_LIMIT = 256',
  'normalizeDeveloperConsoleQuery(',
  'afterSequence',
  'streamingByCursor: true',
  'requestHeadersIncluded: false',
  'bodiesIncluded: false',
]) assert.ok(contract.includes(marker),'Missing Developer Console contract marker: '+marker);

for(const marker of [
  'createDeveloperConsoleRuntime(',
  "telemetryOwner: 'preview-bridge'",
  'secondCollector: false',
  "requiredCapabilities: Object.freeze(['READ'] as const)",
  'session.telemetrySnapshot',
  'normalizeEntries(',
  'query.afterSequence',
  'query.limit',
  'provenance(context)',
  'diagnosticsAuthority: false',
]) assert.ok(runtime.includes(marker),'Missing Developer Console runtime marker: '+marker);

assert.equal(/createChromiumCdpAdapter|CdpClient|Network\.enable|Runtime\.enable|child_process|\bspawn\s*\(|\bfetch\s*\(|\bWebSocket\b/.test(runtime),false);
assert.equal(/requestHeadersIncluded:\s*true|responseHeadersIncluded:\s*true|bodiesIncluded:\s*true|\b(?:requestHeaders|responseHeaders|requestBody|responseBody|cookies|localStorage|sessionStorage)\s*[:=.(\[]/.test(runtime),false);
assert.ok(browserRuntime.includes('createDeveloperConsoleRuntime('));
assert.ok(browserRuntime.includes('developerConsole.createToolRegistrations(scopeLock)'));
assert.ok(browserRuntime.includes('developerConsole: developerConsole.status()'));
assert.ok(triage.includes('microsoft/edge-devtools-network-console'));
assert.ok(triage.includes('AminAdineh/WebConsoleCapture'));
assert.ok(triage.includes('Sakil9051/devtools-clone'));
assert.ok(roadmap.includes('71. **Developer Console** — ✅'));

assert.ok(root.scripts.guardian.includes('architecture-guardian-developer-console.mjs'));
assert.ok(root.scripts['check:build71']);
assert.ok(root.scripts.ci.includes('check:build71'));

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build71-developer-console-static/1',
  build:71,
  telemetryOwner:'preview-bridge',
  cursorStreaming:true,
  boundedFiltering:true,
  readOnly:true,
  uiDeferred:true,
  nextBuild:72,
},null,2));
