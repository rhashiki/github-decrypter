import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.planAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 48 || rule.minimumBuild !== 48 || policy.phaseGates?.planAuthorityBuild !== 48
  || rule.ownerPackage !== '@github-decrypter/plan' || rule.ownerSource !== 'packages/plan/src/authority.ts'
  || rule.runtimeOwnerRoot !== 'apps/local' || rule.runtimeGuardSource !== 'apps/local/src/plan-authority.ts'
  || rule.schema !== 'gd-plan-authority/1' || rule.runtimeGuardSchema !== 'gd-plan-runtime-guard/1'
  || rule.mode !== 'PLAN'
) {
  violations.push({ code: 'AG460', message: 'Build 48 Plan Authority policy is missing or inactive.' });
} else {
  const planPackage = json('packages/plan/package.json');
  const localPackage = json('apps/local/package.json');
  const localRule = policy.appRules?.['@github-decrypter/local'];
  const planBuild = versionBuild(planPackage.version);
  const requiredPlanExports = {
    '.': './src/index.ts',
    './task-graph': './src/task-graph.ts',
    './authority': './src/authority.ts',
  };
  if (
    planPackage.name !== '@github-decrypter/plan' || planBuild === null || planBuild < 48
    || Object.entries(requiredPlanExports).some(([key, value]) => planPackage.exports?.[key] !== value)
    || Object.keys(planPackage.dependencies ?? {}).length !== 0
  ) violations.push({ code: 'AG461', message: '@github-decrypter/plan package identity/required Build 48 exports drifted.' });
  if (versionBuild(localPackage.version) !== 48 || localPackage.dependencies?.['@github-decrypter/plan'] !== 'workspace:*'
      || !localRule?.allowedWorkspaceDependencies?.includes('@github-decrypter/plan')) {
    violations.push({ code: 'AG461', message: 'Local Runtime is not explicitly allowed to consume Plan Authority.' });
  }

  const source = read('packages/plan/src/authority.ts');
  for (const marker of [
    'PLAN_AUTHORITY_BUILD = 48',
    "PLAN_AUTHORITY_SCHEMA = 'gd-plan-authority/1'",
    "PLAN_AUTHORITY_SOURCE_SPEC_SCHEMA = 'gd-requirement-spec/1'",
    "PLAN_AUTHORITY_SOURCE_GRAPH_SCHEMA = 'gd-task-graph/1'",
    "PLAN_MODE = 'PLAN'",
    'createPlanAuthority(',
    'approvePlan(',
    'authorityDigest(',
    'runtimeReadOnlyRequired: true',
    'buildTransitionAuthorized: false',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG462', message: 'Plan Authority core contract is incomplete.', detail: marker });

  if (!source.includes('assertRequirementSpec(') || !source.includes('assertTaskGraph(')
      || !source.includes('source digests do not match') || !source.includes('topological order is invalid')
      || !source.includes('graph edges do not match task dependencies') || !source.includes('Object.freeze({')) {
    violations.push({ code: 'AG463', message: 'Plan Authority canonical source validation or immutability is incomplete.' });
  }

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\b|\bdocument\b|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bfs\.|\bchild_process\b/.test(source)) {
    violations.push({ code: 'AG464', message: 'Plan Authority core is not environment-neutral.' });
  }
  if (rule.environmentNeutralCore !== true || rule.networkAuthority !== false || rule.coreFilesystemAuthority !== false
      || rule.coreDatabaseAuthority !== false || rule.persistence !== false || rule.studioTransport !== false
      || rule.localRuntimeTransport !== false) {
    violations.push({ code: 'AG464', message: 'Plan Authority core gained transport, storage or environment authority.' });
  }

  const runtime = read('apps/local/src/plan-authority.ts');
  const localIndex = read('apps/local/src/index.ts');
  for (const marker of [
    'PLAN_RUNTIME_AUTHORITY_BUILD = 48',
    "PLAN_RUNTIME_GUARD_SCHEMA = 'gd-plan-runtime-guard/1'",
    'PLAN_MUTATING_CAPABILITIES',
    "'WRITE'",
    "'EXECUTE'",
    "'DATABASE_WRITE'",
    "'GIT_WRITE'",
    "'DESTRUCTIVE'",
    'evaluatePlanReadOnly(',
    'assertPlanReadOnly(',
    'PLAN is read-only',
  ]) if (!runtime.includes(marker)) violations.push({ code: 'AG465', message: 'Local Runtime PLAN read-only guard is incomplete.', detail: marker });
  if (/\.grant\s*\(|\.authorize\s*\(|\.enqueue\s*\(|\.claimNext\s*\(|\.complete\s*\(|\.fail\s*\(|spawn\s*\(|exec\s*\(/.test(runtime)) {
    violations.push({ code: 'AG465', message: 'PLAN runtime guard gained execution or capability-grant authority.' });
  }
  if (!localIndex.includes("export * from './plan-authority.js'")) violations.push({ code: 'AG465', message: 'PLAN runtime guard is not exported by Local Runtime.' });
  if (JSON.stringify(rule.mutatingCapabilitiesBlocked) !== JSON.stringify(['WRITE','EXECUTE','DATABASE_WRITE','GIT_WRITE','DESTRUCTIVE'])
      || rule.readOnly !== true || rule.runtimeEnforcedReadOnly !== true || rule.explicitApproval !== true) {
    violations.push({ code: 'AG465', message: 'PLAN runtime read-only policy drifted.' });
  }

  const downstream = {
    decisionEngineBuild: 49,
    projectRulesBuild: 50,
    impactSimulationBuild: 51,
    buildOrchestratorBuild: 52,
    toolRuntimeBuild: 53,
    scopeIntelligenceBuild: 54,
    scopeLockBuild: 55,
    checkpointEngineBuild: 56,
    validationPipelineBuild: 57,
  };
  for (const [field, expected] of Object.entries(downstream)) {
    if (rule[field] !== expected) violations.push({ code: 'AG466', message: 'Plan Authority downstream Build ownership drifted.', detail: field });
  }
  for (const [field, expected] of Object.entries({
    buildTransitionAuthorized: false,
    decisionEngine: false,
    projectRules: false,
    impactSimulation: false,
    buildOrchestration: false,
    toolExecution: false,
    scopeIntelligence: false,
    scopeLock: false,
    checkpoints: false,
    validationPipeline: false,
    execution: false,
    scheduling: false,
  })) {
    if (rule[field] !== expected) violations.push({ code: 'AG466', message: 'Plan Authority prematurely owns a downstream execution concern.', detail: field });
  }

  const rootPackage = json('package.json');
  const localIdentity = read('apps/local/src/identity.ts');
  const rootBuild = versionBuild(rootPackage.version);
  if (rootBuild === null || rootBuild < 48 || !localIdentity.includes('LOCAL_RUNTIME_BUILD = 48')
      || !localIdentity.includes("LOCAL_RUNTIME_VERSION = '0.0.48'") || !localIdentity.includes("'plan-authority'")
      || !localIdentity.includes("'plan-runtime-read-only'")) {
    violations.push({ code: 'AG467', message: 'Build 48 root/Local Runtime identity is inconsistent.' });
  }

  for (const required of [
    'packages/plan/src/authority.ts',
    'apps/local/src/plan-authority.ts',
    'docs/architecture/PLAN_AUTHORITY.md',
    'docs/builds/BUILD_48_PLAN_AUTHORITY.md',
    'scripts/architecture-guardian-plan-authority.mjs',
    'scripts/test-build48-plan-authority.mjs',
    'scripts/test-build48-plan-authority-runtime.ts',
    'scripts/test-build48-plan-authority-guardian-negative.mjs',
    'scripts/tsconfig.build48-tests.json',
    '.github/workflows/build48-plan-authority.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG468', message: 'Required Build 48 artifact is missing.', detail: required });

  const constitution = read('docs/product/PRODUCT_CONSTITUTION_V1.md');
  const scope = read('docs/product/V1_SCOPE.md');
  const architectureDoc = read('docs/architecture/PLAN_AUTHORITY.md');
  const buildDoc = read('docs/builds/BUILD_48_PLAN_AUTHORITY.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!constitution.includes('PLAN is enforced read-only by the runtime')
      || !scope.includes('runtime-enforced read-only PLAN')
      || !scope.includes('explicit transition from approved Plan to Build')
      || !architectureDoc.includes('Build 49 — Decision Engine')
      || !architectureDoc.includes('runtime-enforced read-only')
      || !buildDoc.includes('Build 49 — Decision Engine')
      || !roadmap.includes('48. **Plan Authority**')) {
    violations.push({ code: 'AG469', message: 'Build 48 documentation does not preserve constitutional PLAN boundaries or downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-plan-authority-report/1',
  currentBuild: policy.currentBuild,
  planSchema: rule?.schema ?? null,
  runtimeGuardSchema: rule?.runtimeGuardSchema ?? null,
  readOnly: rule?.readOnly ?? null,
  runtimeEnforcedReadOnly: rule?.runtimeEnforcedReadOnly ?? null,
  buildTransitionAuthorized: rule?.buildTransitionAuthorized ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
