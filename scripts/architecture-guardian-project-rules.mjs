import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.projectRulesAuthority;
const planRule = policy.planAuthority;
const decisionRule = policy.decisionEngineAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (!rule || policy.currentBuild < 50 || rule.minimumBuild !== 50 || policy.phaseGates?.projectRulesBuild !== 50
    || rule.ownerPackage !== '@github-decrypter/plan' || rule.ownerSource !== 'packages/plan/src/project-rules.ts'
    || rule.runtimeOwnerRoot !== 'apps/local' || rule.runtimeStoreSource !== 'apps/local/src/project-rules-store.ts'
    || rule.schema !== 'gd-project-rules/1' || rule.storeSchema !== 'gd-local-project-rules-store/1'
    || rule.workspaceSchema !== 'gd-workspace/1') {
  violations.push({ code:'AG480', message:'Build 50 Project Rules policy is missing or inactive.' });
} else {
  const planPackage = json('packages/plan/package.json');
  const localPackage = json('apps/local/package.json');
  const rootPackage = json('package.json');
  if (versionBuild(planPackage.version) !== 50 || versionBuild(localPackage.version) !== 50 || versionBuild(rootPackage.version) !== 50
      || planPackage.exports?.['./project-rules'] !== './src/project-rules.ts'
      || localPackage.dependencies?.['@github-decrypter/plan'] !== 'workspace:*') {
    violations.push({ code:'AG481', message:'Build 50 package/root/Local Runtime identity drifted.' });
  }

  const source = read('packages/plan/src/project-rules.ts');
  for (const marker of [
    'PROJECT_RULES_BUILD = 50',
    "PROJECT_RULES_SCHEMA = 'gd-project-rules/1'",
    "PROJECT_RULE_SCHEMA = 'gd-project-rule/1'",
    "PROJECT_RULES_STAGE_SCHEMA = 'gd-project-rules-stage/1'",
    "PROJECT_RULES_WORKSPACE_SCHEMA = 'gd-workspace/1'",
    'PROJECT_RULES_MAX_RULES = 256',
    'createProjectRules(',
    'assertProjectRulesRecord(',
    'selectProjectRulesForStage(',
    'rulesDigest',
  ]) if (!source.includes(marker)) violations.push({ code:'AG482', message:'Project Rules core contract is incomplete.', detail:marker });

  const store = read('apps/local/src/project-rules-store.ts');
  const localIndex = read('apps/local/src/index.ts');
  for (const marker of [
    'LOCAL_PROJECT_RULES_STORE_BUILD = 50',
    "LOCAL_PROJECT_RULES_STORE_SCHEMA = 'gd-local-project-rules-store/1'",
    "LOCAL_PROJECT_RULES_METADATA_PREFIX = 'project-rules:'",
    'gd_workspaces',
    '.getMetadata(',
    '.setMetadata(',
    'storageRevision',
    'Workspace not found for Project Rules',
  ]) if (!store.includes(marker)) violations.push({ code:'AG483', message:'Local Project Rules Store contract is incomplete.', detail:marker });
  if (!localIndex.includes("export * from './project-rules-store.js'")) violations.push({ code:'AG483', message:'Local Project Rules Store is not exported.' });
  if (rule.localPersistence !== true || rule.persistenceMedium !== 'gd_metadata' || rule.databaseSchemaMutation !== false
      || rule.workspaceScoped !== true || rule.storageRevisionMonotonic !== true || rule.jobForeignKey !== false) {
    violations.push({ code:'AG483', message:'Project Rules persistence policy drifted.' });
  }

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bfs\.|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)) {
    violations.push({ code:'AG484', message:'Project Rules core is not environment-neutral.' });
  }
  if (/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\bchild_process\b|\bspawn\s*\(|\bexec\s*\(/.test(store)
      || /\.enqueue\s*\(|\.claimNext\s*\(|\.grant\s*\(|\.authorize\s*\(/.test(source + store)) {
    violations.push({ code:'AG484', message:'Project Rules gained transport, process, job or capability authority.' });
  }
  for (const [field, expected] of Object.entries({
    environmentNeutralCore:true, structuredRulesOnly:true, semanticInference:false, automaticComplianceDecision:false,
    planReadOnlyPreserved:true, decisionEngineCompatible:true, projectRules:true,
    networkAuthority:false, studioTransport:false, localRuntimeTransport:false, jobCreation:false, capabilityGrant:false,
  })) if (rule[field] !== expected) violations.push({ code:'AG484', message:'Project Rules authority boundary drifted.', detail:field });

  if (JSON.stringify(rule.categories) !== JSON.stringify(['architecture','dependency','code','database','testing','deployment','security','workflow'])
      || JSON.stringify(rule.directives) !== JSON.stringify(['require','forbid','prefer'])
      || JSON.stringify(rule.stages) !== JSON.stringify(['plan','decision','build'])
      || rule.maxRules !== 256 || rule.digestAlgorithm !== 'sha256') {
    violations.push({ code:'AG485', message:'Project Rules canonical vocabulary or bounds drifted.' });
  }
  for (const marker of ['mandatory: parsedDirective !== \'prefer\'', 'semanticInference: false', 'automaticComplianceDecision: false', 'semanticEvaluation: false']) {
    if (!source.includes(marker)) violations.push({ code:'AG485', message:'Project Rules explicit semantics are incomplete.', detail:marker });
  }

  const downstream = { impactSimulationBuild:51, buildOrchestratorBuild:52, toolRuntimeBuild:53, scopeIntelligenceBuild:54, scopeLockBuild:55, checkpointEngineBuild:56, validationPipelineBuild:57 };
  for (const [field, expected] of Object.entries(downstream)) if (rule[field] !== expected) violations.push({ code:'AG486', message:'Project Rules downstream ownership drifted.', detail:field });
  for (const [field, expected] of Object.entries({
    impactSimulationApplied:false, buildTransitionAuthorized:false, buildOrchestration:false, toolExecution:false,
    scopeIntelligence:false, scopeLock:false, checkpoints:false, validationPipeline:false, execution:false, scheduling:false,
  })) if (rule[field] !== expected) violations.push({ code:'AG486', message:'Project Rules prematurely owns a downstream concern.', detail:field });

  if (!planRule || planRule.minimumBuild !== 48 || planRule.runtimeEnforcedReadOnly !== true || planRule.buildTransitionAuthorized !== false
      || !decisionRule || decisionRule.minimumBuild !== 49 || decisionRule.projectRules !== false || decisionRule.buildTransitionAuthorized !== false) {
    violations.push({ code:'AG487', message:'Build 50 no longer preserves Plan Authority or Decision Engine ownership.' });
  }
  const identity = read('apps/local/src/identity.ts');
  if (!identity.includes('LOCAL_RUNTIME_BUILD = 50') || !identity.includes("LOCAL_RUNTIME_VERSION = '0.0.50'")
      || !identity.includes("'project-rules'") || !identity.includes("'workspace-project-constitution'")) {
    violations.push({ code:'AG487', message:'Local Runtime Build 50 identity is incomplete.' });
  }

  for (const required of [
    'packages/plan/src/project-rules.ts','apps/local/src/project-rules-store.ts','docs/architecture/PROJECT_RULES_ENGINE.md',
    'docs/builds/BUILD_50_PROJECT_RULES_ENGINE.md','scripts/architecture-guardian-project-rules.mjs',
    'scripts/test-build50-project-rules.mjs','scripts/test-build50-project-rules-runtime.ts',
    'scripts/test-build50-project-rules-guardian-negative.mjs','scripts/tsconfig.build50-tests.json',
    '.github/workflows/build50-project-rules-engine.yml',
  ]) if (!exists(required)) violations.push({ code:'AG488', message:'Required Build 50 artifact is missing.', detail:required });

  const scope = read('docs/product/V1_SCOPE.md');
  const architectureDoc = read('docs/architecture/PROJECT_RULES_ENGINE.md');
  const buildDoc = read('docs/builds/BUILD_50_PROJECT_RULES_ENGINE.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!scope.includes('project rules/constitution per workspace') || !scope.includes('impact simulation before approved execution when applicable')
      || !architectureDoc.includes('Build 51 — Impact Simulation') || !architectureDoc.includes('runtime-enforced read-only PLAN')
      || !buildDoc.includes('Build 51 — Impact Simulation') || !roadmap.includes('50. **Project Rules Engine**')) {
    violations.push({ code:'AG489', message:'Build 50 documentation does not preserve frozen Project Rules/Impact/PLAN boundaries.' });
  }
}

console.log(JSON.stringify({
  ok:violations.length===0,
  schema:'gd-architecture-guardian-project-rules-report/1',
  currentBuild:policy.currentBuild,
  projectRulesSchema:rule?.schema ?? null,
  workspaceScoped:rule?.workspaceScoped ?? null,
  semanticInference:rule?.semanticInference ?? null,
  impactSimulationApplied:rule?.impactSimulationApplied ?? null,
  buildTransitionAuthorized:rule?.buildTransitionAuthorized ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
