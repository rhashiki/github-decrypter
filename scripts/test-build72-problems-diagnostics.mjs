import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const json=(file)=>JSON.parse(read(file));
const versionBuild=(value)=>Number(String(value||'').match(/^0\.0\.(\d+)$/)?.[1]||-1);

for(const file of [
  'packages/diagnostics/package.json',
  'packages/diagnostics/src/index.ts',
  'apps/local/src/problems-diagnostics-runtime.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'docs/architecture/PROBLEMS_DIAGNOSTICS.md',
  'docs/builds/BUILD_72_PROBLEMS_DIAGNOSTICS.md',
  'docs/research/BUILD_72_SOURCE_TRIAGE.md',
  'scripts/architecture-guardian-problems-diagnostics.mjs',
  'scripts/test-build72-problems-diagnostics-runtime.ts',
  'scripts/test-build72-problems-diagnostics-guardian-negative.mjs',
  'scripts/tsconfig.build72-tests.json',
]) assert.ok(fs.existsSync(file),'Build 72 artifact missing: '+file);

const policy=json('architecture.guardian.json');
const root=json('package.json');
const diagnosticsPkg=json('packages/diagnostics/package.json');
const localPkg=json('apps/local/package.json');
const contract=read('packages/diagnostics/src/index.ts');
const runtime=read('apps/local/src/problems-diagnostics-runtime.ts');
const browserRuntime=read('apps/local/src/preview-browser-runtime.ts');
const triage=read('docs/research/BUILD_72_SOURCE_TRIAGE.md');
const roadmap=read('docs/product/ROADMAP_V1.md');

assert.ok(policy.currentBuild>=72);
assert.ok(versionBuild(root.version)>=72);
assert.ok(versionBuild(diagnosticsPkg.version)>=72);
assert.ok(versionBuild(localPkg.version)>=72);
assert.equal(policy.phaseGates.problemsDiagnosticsBuild,72);
assert.equal(diagnosticsPkg.name,'@github-decrypter/diagnostics');
assert.equal(diagnosticsPkg.exports,'./src/index.ts');
assert.deepEqual(diagnosticsPkg.dependencies??{},{});
assert.equal(policy.packageRules['@github-decrypter/diagnostics'].environmentNeutral,true);
assert.deepEqual(policy.packageRules['@github-decrypter/diagnostics'].allowedWorkspaceDependencies,[]);
assert.equal(localPkg.dependencies['@github-decrypter/diagnostics'],'workspace:*');

const rule=policy.problemsDiagnosticsAuthority;
assert.equal(rule.minimumBuild,72);
assert.equal(rule.previewBridgeBuild,70);
assert.equal(rule.developerConsoleBuild,71);
assert.equal(rule.validationPipelineBuild,57);
assert.deepEqual(rule.sources,['runtime','browser','test','preview','validation']);
assert.deepEqual(rule.severities,['info','warning','error']);
assert.equal(rule.maxInputs,4096);
assert.equal(rule.maxEntries,512);
assert.equal(rule.maxDiagnosticTextCharacters,24000);
assert.equal(rule.bounded,true);
assert.equal(rule.deterministic,true);
assert.equal(rule.sourceGrounded,true);
assert.equal(rule.deduplication,true);
assert.equal(rule.sourceLocationCorrelation,true);
assert.equal(rule.correlationIsNotCausation,true);
assert.equal(rule.unmatchedDiagnosticsPreserved,true);
assert.equal(rule.worstSeverityPropagation,true);
assert.equal(rule.telemetryOwner,'preview-bridge');
assert.equal(rule.secondCollectorAllowed,false);
assert.equal(rule.validationOwner,'validation-pipeline');
assert.equal(rule.validationRecordVerificationAuthority,false);
assert.equal(rule.aggregationAuthority,true);
assert.equal(rule.correlationAuthority,true);
assert.equal(rule.rootCauseAuthority,false);
assert.equal(rule.rootCauseOwnerBuild,106);
assert.equal(rule.autoFixAuthority,false);
assert.equal(rule.mutationAuthority,false);
assert.equal(rule.validationAuthority,false);
assert.equal(rule.releaseAuthority,false);
assert.equal(rule.persistentStorage,false);
assert.equal(rule.readCapabilityOnly,true);
assert.equal(rule.uiDeferred,true);
assert.equal(rule.rosDiagnosticsLicense,'BSD-3-Clause');
assert.equal(rule.agentIdeLicense,'MIT');
assert.equal(rule.externalRuntimeDependency,false);

for(const marker of [
  'PROBLEMS_DIAGNOSTICS_BUILD = 72',
  "PROBLEMS_DIAGNOSTICS_SCHEMA = 'gd-problems-diagnostics/1'",
  "PROBLEMS_DIAGNOSTICS_REPORT_SCHEMA = 'gd-problems-diagnostics-report/1'",
  'PROBLEMS_DIAGNOSTIC_MAX_INPUTS = 4096',
  'PROBLEMS_DIAGNOSTIC_MAX_ENTRIES = 512',
  'parseDiagnosticText(',
  'createProblemsDiagnostics(',
  'unmatchedDiagnosticsPreserved: true',
  'worstSeverityPropagation: true',
  'correlationIsNotCausation: true',
  'rootCauseAuthority: false',
  'autoFixAuthority: false',
]) assert.ok(contract.includes(marker),'Missing Build 72 contract marker: '+marker);

assert.equal(/\bnode:|\bprocess\.|\bfetch\s*\(|\bWebSocket\b|\bchild_process\b|\bfs\./.test(contract),false);

for(const marker of [
  'createProblemsDiagnosticsRuntime(',
  "telemetryOwner: 'preview-bridge'",
  "validationOwner: 'validation-pipeline'",
  'secondCollector: false',
  "requiredCapabilities: Object.freeze(['READ'] as const)",
  'session.telemetrySnapshot',
  'parseDiagnosticText(',
  'createProblemsDiagnostics(',
  'rootCauseAuthority: false',
  'autoFixAuthority: false',
]) assert.ok(runtime.includes(marker),'Missing Build 72 runtime marker: '+marker);

assert.equal(/createChromiumCdpAdapter|CdpClient|Network\.enable|Runtime\.enable|child_process|\bspawn\s*\(|\bfetch\s*\(|\bWebSocket\b/.test(runtime),false);
assert.equal(/rootCauseAuthority:\s*true|autoFixAuthority:\s*true|mutationAuthority:\s*true|validationAuthority:\s*true/.test(runtime+contract),false);
assert.ok(browserRuntime.includes('createProblemsDiagnosticsRuntime('));
assert.ok(browserRuntime.includes('problemsDiagnostics.createToolRegistrations(scopeLock)'));
assert.ok(browserRuntime.includes('problemsDiagnostics: problemsDiagnostics.status()'));
assert.ok(triage.includes('ros/diagnostics'));
assert.ok(triage.includes('dreamsxin/agent-ide'));
assert.ok(roadmap.includes('72. **Problems & Diagnostics** — ✅ —'));

assert.ok(root.scripts.guardian.includes('architecture-guardian-problems-diagnostics.mjs'));
assert.ok(root.scripts['check:build72']);
assert.ok(root.scripts.ci.includes('check:build72'));

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build72-problems-diagnostics-static/1',
  build:72,
  aggregation:true,
  sourceCorrelation:true,
  rootCauseAuthority:false,
  validationAuthority:false,
  uiDeferred:true,
  nextBuild:73,
},null,2));
