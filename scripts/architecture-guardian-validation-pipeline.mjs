import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.validationPipelineAuthority;
const checkpointRule = policy.checkpointEngineAuthority;
const toolRule = policy.toolRuntimeAuthority;
const scopeRule = policy.scopeLockAuthority;
const capabilityRule = policy.capabilityAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 57 || rule.minimumBuild !== 57 || policy.phaseGates?.validationPipelineBuild !== 57
  || rule.ownerPackage !== '@github-decrypter/tools' || rule.ownerSource !== 'packages/tools/src/validation.ts'
  || rule.buildOrchestratorBuild !== 52 || rule.toolRuntimeBuild !== 53 || rule.scopeIntelligenceBuild !== 54
  || rule.scopeLockBuild !== 55 || rule.checkpointEngineBuild !== 56 || rule.testingAgentBuild !== 62
  || rule.schema !== 'gd-validation-pipeline/1' || rule.sourceCheckpointSchema !== 'gd-checkpoint-engine/1'
  || rule.mode !== 'BUILD'
) {
  violations.push({ code: 'AG550', message: 'Build 57 Validation Pipeline policy is missing or inactive.' });
} else {
  const toolsPackage = json('packages/tools/package.json');
  const rootPackage = json('package.json');
  const toolsVersion = versionBuild(toolsPackage.version);
  const rootBuild = versionBuild(rootPackage.version);
  const packageRule = policy.packageRules?.['@github-decrypter/tools'];
  if (
    toolsPackage.name !== '@github-decrypter/tools' || toolsVersion === null || toolsVersion < 57
    || JSON.stringify(toolsPackage.exports) !== JSON.stringify({ '.': './src/index.ts', './checkpoint': './src/checkpoint.ts', './validation': './src/validation.ts' })
    || JSON.stringify(toolsPackage.dependencies ?? {}) !== JSON.stringify({ '@github-decrypter/build': 'workspace:*', '@github-decrypter/scope': 'workspace:*' })
    || rootBuild === null || rootBuild < 57 || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/build','@github-decrypter/scope'])
  ) violations.push({ code: 'AG551', message: 'Build 57 package/root identity, export or dependency boundary drifted.' });

  const source = read('packages/tools/src/validation.ts');
  for (const marker of [
    'VALIDATION_PIPELINE_BUILD = 57',
    "VALIDATION_PIPELINE_SCHEMA = 'gd-validation-pipeline/1'",
    "VALIDATION_PIPELINE_SOURCE_CHECKPOINT_SCHEMA = 'gd-checkpoint-engine/1'",
    "VALIDATION_PIPELINE_MODE = 'BUILD'",
    'VALIDATION_PIPELINE_MAX_CRITERIA = 256',
    'createValidation(',
    'assertCanonicalValidation(',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG552', message: 'Validation Pipeline core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalCheckpoint(',
    'canonicalValidationMaterial(',
    'VALIDATION_PIPELINE_EVIDENCE_KINDS',
    'VALIDATION_PIPELINE_OPERATORS',
    'acceptanceCriteriaRequired: true',
    'observedEvidenceRequired: true',
    'failClosed: true',
    'behavioralValidation: true',
    'completionEligible: verdict === \'passed\'',
    'sha256Hex(',
    'Object.freeze({',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG553', message: 'Validation Pipeline evidence, verdict or deterministic identity binding is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bfs\.|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(source)) {
    violations.push({ code: 'AG554', message: 'Build 57 gained direct environment, transport, mutation or unrestricted execution authority.' });
  }
  for (const field of [
    'testingAgentAuthority','viktorCommunicationAuthority','capabilityGrantAuthority','mutationAuthorized','toolExecution',
    'externalFlowExecution','execution','checkpoints','restoreExecution','scheduling','jobCreation','persistence',
    'networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
  ]) if (rule[field] !== false) violations.push({ code: 'AG554', message: 'Validation Pipeline policy gained forbidden authority.', detail: field });

  if (rule.digestAlgorithm !== 'sha256' || rule.maxCriteria !== 256
      || JSON.stringify(rule.evidenceKinds) !== JSON.stringify(['tool-result','test','diagnostic','preview'])
      || JSON.stringify(rule.operators) !== JSON.stringify(['equals','not-equals','truthy','falsy','exists','contains'])
      || rule.deterministic !== true || rule.environmentNeutral !== true || rule.workspaceScoped !== true
      || rule.checkpointRequired !== true || rule.checkpointReadOnlyPreserved !== true
      || rule.acceptanceCriteriaRequired !== true || rule.observedEvidenceRequired !== true
      || rule.explicitEvidenceOnly !== true || rule.semanticInference !== false || rule.failClosed !== true
      || rule.behavioralValidation !== true || rule.validationPipeline !== true
      || rule.completionEligibilityRequiresPass !== true || rule.interactiveQAFoundation !== true) {
    violations.push({ code: 'AG555', message: 'Validation Pipeline acceptance/evidence/verdict boundary drifted.' });
  }

  if (rule.testingAgentBuild !== 62 || rule.testingAgentAuthority !== false || rule.viktorCommunicationAuthority !== false
      || !source.includes('testingAgentBuild: 62') || !source.includes('testingAgentAuthority: false')
      || !source.includes('viktorCommunicationAuthority: false') || !source.includes('externalFlowExecution: false')) {
    violations.push({ code: 'AG556', message: 'Validation Pipeline prematurely owns Testing Agent, Viktor or external flow execution concerns.' });
  }

  if (!checkpointRule || checkpointRule.minimumBuild !== 56 || checkpointRule.validationPipelineBuild !== 57
      || checkpointRule.validationPipeline !== false || checkpointRule.checkpoints !== true || checkpointRule.execution !== false) {
    violations.push({ code: 'AG557', message: 'Build 57 no longer preserves Checkpoint Engine ownership and non-validation authority.' });
  }
  if (!toolRule || toolRule.minimumBuild !== 53 || toolRule.validationPipelineBuild !== 57 || toolRule.toolExecution !== true
      || toolRule.execution !== true || toolRule.validationPipeline !== false || toolRule.capabilityGrantAuthority !== false) {
    violations.push({ code: 'AG557', message: 'Build 57 no longer preserves Tool Runtime execution ownership.' });
  }
  if (!scopeRule || scopeRule.minimumBuild !== 55 || scopeRule.validationPipelineBuild !== 57 || scopeRule.scopeLock !== true
      || scopeRule.validationPipeline !== false || scopeRule.mutationAuthorized !== false) {
    violations.push({ code: 'AG557', message: 'Build 57 no longer preserves Scope Lock ownership.' });
  }
  if (!capabilityRule || capabilityRule.minimumBuild !== 15 || capabilityRule.denyByDefault !== true) {
    violations.push({ code: 'AG557', message: 'Build 57 no longer preserves Capability Security authority.' });
  }

  const localIndex = read('apps/local/src/index.ts');
  const studioSource = exists('apps/studio/src') ? fs.readdirSync(path.join(root, 'apps/studio/src'), { recursive: true, withFileTypes: false })
    .filter((entry) => typeof entry === 'string' && /\.[jt]sx?$/.test(entry))
    .map((entry) => read(`apps/studio/src/${entry}`)).join('\n') : '';
  if (localIndex.includes('@github-decrypter/tools/validation') || localIndex.includes('./validation-pipeline.js')
      || studioSource.includes('@github-decrypter/tools/validation')) {
    violations.push({ code: 'AG558', message: 'Build 57 prematurely introduced Local Runtime or Studio validation transport.' });
  }

  for (const required of [
    'packages/tools/src/validation.ts',
    'docs/architecture/VALIDATION_PIPELINE.md',
    'docs/builds/BUILD_57_VALIDATION_PIPELINE.md',
    'scripts/architecture-guardian-validation-pipeline.mjs',
    'scripts/test-build57-validation-pipeline.mjs',
    'scripts/test-build57-validation-pipeline-runtime.ts',
    'scripts/test-build57-validation-pipeline-guardian-negative.mjs',
    'scripts/tsconfig.build57-tests.json',
    '.github/workflows/build57-validation-pipeline.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG559', message: 'Required Build 57 artifact is missing.', detail: required });

  const amendment = read('docs/product/CONSTITUTION_AMENDMENT_001_NORTH_STAR.md');
  const mapping = read('docs/product/NORTH_STAR_ROADMAP_MAPPING.md');
  const architectureDoc = read('docs/architecture/VALIDATION_PIPELINE.md');
  const buildDoc = read('docs/builds/BUILD_57_VALIDATION_PIPELINE.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!amendment.includes('Interactive QA is constrained validation execution')
      || !mapping.includes('Build 57 — Validation Pipeline') || !mapping.includes('Build 62 — Testing Agent')
      || !mapping.includes('Viktor may communicate validation results but may not report completion before canonical validation succeeds')
      || !architectureDoc.includes('validation != tool execution') || !architectureDoc.includes('validation != agent authority')
      || !architectureDoc.includes('completionEligible') || !buildDoc.includes('Build 62 — Testing Agent')
      || !roadmap.includes('57. **Validation Pipeline**')) {
    violations.push({ code: 'AG559', message: 'Build 57 documentation does not preserve North Star Interactive QA and downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-validation-pipeline-report/1',
  currentBuild: policy.currentBuild,
  validationSchema: rule?.schema ?? null,
  failClosed: rule?.failClosed ?? null,
  behavioralValidation: rule?.behavioralValidation ?? null,
  validationPipeline: rule?.validationPipeline ?? null,
  testingAgentAuthority: rule?.testingAgentAuthority ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);