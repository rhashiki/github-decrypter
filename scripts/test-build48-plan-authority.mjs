import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const rootPackage = json('package.json');
const planPackage = json('packages/plan/package.json');
const localPackage = json('apps/local/package.json');
const policy = json('architecture.guardian.json');
const source = read('packages/plan/src/authority.ts');
const runtime = read('apps/local/src/plan-authority.ts');
const localIndex = read('apps/local/src/index.ts');
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

const rootBuild = versionBuild(rootPackage.version);
const planBuild = versionBuild(planPackage.version);
assert.ok(rootBuild !== null && rootBuild >= 48);
assert.equal(planPackage.name, '@github-decrypter/plan');
assert.ok(planBuild !== null && planBuild >= 48);
assert.deepEqual(planPackage.exports, planBuild >= 50 ? {
  '.': './src/index.ts',
  './task-graph': './src/task-graph.ts',
  './authority': './src/authority.ts',
  './decision': './src/decision.ts',
  './project-rules': './src/project-rules.ts',
} : planBuild >= 49 ? {
  '.': './src/index.ts',
  './task-graph': './src/task-graph.ts',
  './authority': './src/authority.ts',
  './decision': './src/decision.ts',
} : {
  '.': './src/index.ts',
  './task-graph': './src/task-graph.ts',
  './authority': './src/authority.ts',
});
assert.deepEqual(planPackage.dependencies ?? {}, {});
assert.equal(localPackage.version, '0.0.48');
assert.equal(localPackage.dependencies['@github-decrypter/plan'], 'workspace:*');
assert.ok(localIndex.includes("export * from './plan-authority.js'"));

for (const marker of [
  'PLAN_AUTHORITY_BUILD = 48',
  "PLAN_AUTHORITY_SCHEMA = 'gd-plan-authority/1'",
  "PLAN_MODE = 'PLAN'",
  'createPlanAuthority(',
  'approvePlan(',
  'runtimeReadOnlyRequired: true',
  'buildTransitionAuthorized: false',
  'decisionEngineApplied: false',
  'projectRulesApplied: false',
  'impactSimulationApplied: false',
  'buildOrchestration: false',
  'toolExecution: false',
  'scopeLock: false',
]) assert.ok(source.includes(marker), `Missing Plan Authority marker: ${marker}`);

assert.doesNotMatch(source, /\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\b|\bdocument\b|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b/);
assert.ok(runtime.includes('PLAN_RUNTIME_AUTHORITY_BUILD = 48'));
assert.ok(runtime.includes("PLAN_RUNTIME_GUARD_SCHEMA = 'gd-plan-runtime-guard/1'"));
assert.ok(runtime.includes("'WRITE'"));
assert.ok(runtime.includes("'EXECUTE'"));
assert.ok(runtime.includes("'DATABASE_WRITE'"));
assert.ok(runtime.includes("'GIT_WRITE'"));
assert.ok(runtime.includes("'DESTRUCTIVE'"));
assert.ok(runtime.includes('assertPlanReadOnly('));
assert.doesNotMatch(runtime, /\.grant\s*\(|\.authorize\s*\(|\.enqueue\s*\(|\.claimNext\s*\(|child_process|spawn\s*\(|exec\s*\(/);

assert.ok(policy.currentBuild >= 48);
assert.equal(policy.phaseGates.planAuthorityBuild, 48);
assert.equal(policy.planAuthority.minimumBuild, 48);
assert.equal(policy.planAuthority.schema, 'gd-plan-authority/1');
assert.equal(policy.planAuthority.runtimeGuardSchema, 'gd-plan-runtime-guard/1');
assert.equal(policy.planAuthority.readOnly, true);
assert.equal(policy.planAuthority.runtimeEnforcedReadOnly, true);
assert.equal(policy.planAuthority.explicitApproval, true);
assert.equal(policy.planAuthority.buildTransitionAuthorized, false);
assert.equal(policy.planAuthority.decisionEngine, false);
assert.equal(policy.planAuthority.projectRules, false);
assert.equal(policy.planAuthority.toolExecution, false);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build48-plan-authority-static/1',
  build: 48,
  currentBuild: policy.currentBuild,
  planSchema: policy.planAuthority.schema,
  runtimeGuardSchema: policy.planAuthority.runtimeGuardSchema,
}, null, 2));
