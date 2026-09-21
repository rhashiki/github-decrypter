import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.testingAgentAuthority;
const agentRule = policy.agentRuntimeAuthority;
const toolRule = policy.toolRuntimeAuthority;
const checkpointRule = policy.checkpointEngineAuthority;
const validationRule = policy.validationPipelineAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

function sourceFiles(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  const stack = [absoluteRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && /\.(?:[cm]?[jt]sx?)$/.test(entry.name)) files.push(absolute);
    }
  }
  return files;
}

if (
  !rule || policy.currentBuild < 62 || rule.minimumBuild !== 62 || policy.phaseGates?.testingAgentBuild !== 62
  || rule.ownerPackage !== '@github-decrypter/ai' || rule.ownerSource !== 'packages/ai/src/testing-agent.ts'
  || rule.schema !== 'gd-testing-agent/1' || rule.sourceAgentRuntimeSchema !== 'gd-agent-runtime/1'
  || rule.sourceToolRuntimeSchema !== 'gd-tool-runtime/1' || rule.sourceCheckpointSchema !== 'gd-checkpoint-engine/1'
  || rule.sourceValidationSchema !== 'gd-validation-pipeline/1' || rule.mode !== 'BUILD'
) {
  violations.push({ code: 'AG600', message: 'Build 62 Testing Agent policy is missing or inactive.' });
} else {
  const aiPackage = json('packages/ai/package.json');
  const rootPackage = json('package.json');
  const packageRule = policy.packageRules?.['@github-decrypter/ai'];
  const expectedExports = {
    '.': './src/index.ts',
    './agent-runtime': './src/agent-runtime.ts',
    './planner-agent': './src/planner-agent.ts',
    './coding-agent': './src/coding-agent.ts',
    './database-agent': './src/database-agent.ts',
    './testing-agent': './src/testing-agent.ts',
  };
  const expectedDependencies = {
    '@github-decrypter/plan': 'workspace:*',
    '@github-decrypter/tools': 'workspace:*',
  };
  if (
    aiPackage.name !== '@github-decrypter/ai' || versionBuild(aiPackage.version) === null || versionBuild(aiPackage.version) < 62
    || JSON.stringify(aiPackage.exports) !== JSON.stringify(expectedExports)
    || JSON.stringify(aiPackage.dependencies ?? {}) !== JSON.stringify(expectedDependencies)
    || versionBuild(rootPackage.version) === null || versionBuild(rootPackage.version) < 62
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/plan','@github-decrypter/tools'])
  ) violations.push({ code: 'AG601', message: 'Build 62 package/root export or dependency boundary drifted.' });

  const source = read('packages/ai/src/testing-agent.ts');
  for (const marker of [
    'TESTING_AGENT_BUILD = 62',
    "TESTING_AGENT_SCHEMA = 'gd-testing-agent/1'",
    "TESTING_AGENT_SOURCE_RUNTIME_SCHEMA = 'gd-agent-runtime/1'",
    "TESTING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1'",
    "TESTING_AGENT_SOURCE_CHECKPOINT_SCHEMA = 'gd-checkpoint-engine/1'",
    "TESTING_AGENT_SOURCE_VALIDATION_SCHEMA = 'gd-validation-pipeline/1'",
    "TESTING_AGENT_ID = 'samuel'",
    "TESTING_AGENT_NAME = 'Samuel'",
    "TESTING_AGENT_ROLE = 'qa-testing'",
    'executeTestingAgent(',
    'assertCanonicalTestingAgentExecution(',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG602', message: 'Testing Agent core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalAgentRuntime(',
    'getAgentRuntimeDescriptor(TESTING_AGENT_ID)',
    'createToolRuntime(',
    'createCheckpoint(',
    'assertCanonicalCheckpoint(',
    'createValidation(',
    'assertCanonicalValidation(',
    'observed: invocation.result',
    'sourceValidationDigest',
    'completionEligible: validation.completionEligible',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG603', message: 'Testing Agent runtime/checkpoint/validation binding is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(source)) {
    violations.push({ code: 'AG604', message: 'Build 62 gained direct environment, network, browser, shell, database or filesystem authority.' });
  }

  if (
    JSON.stringify(rule.allowedCapabilities) !== JSON.stringify(['READ','EXECUTE'])
    || JSON.stringify(rule.blockedCapabilities) !== JSON.stringify(['WRITE','NETWORK','DATABASE_WRITE','GIT_WRITE','DESTRUCTIVE','SECRETS'])
    || JSON.stringify(rule.evidenceKinds) !== JSON.stringify(['tool-result','test'])
    || rule.namedAgentBinding !== true || rule.testingAgent !== true || rule.interactiveQA !== true
    || rule.behavioralFlowExecution !== true || rule.boundedFlowExecution !== true
    || rule.singleFlowPerExecution !== true || rule.singleCriterionPerFlow !== true
    || rule.explicitAcceptanceRequired !== true || rule.observedResultBoundToToolResult !== true
    || rule.semanticInference !== false || rule.evidenceFabricationAuthority !== false
    || rule.toolRuntimeConsumer !== true || rule.toolRuntimeSovereign !== true
    || rule.checkpointEngineConsumer !== true || rule.checkpointEngineSovereign !== true
    || rule.validationPipelineConsumer !== true || rule.validationPipelineSovereign !== true
    || rule.completionEligibilityOwnedByValidation !== true || rule.scopeLockRequiredForExecute !== true
    || rule.capabilityVerifierRequired !== true || rule.mutationAuthorityOwnedByToolRuntime !== true
    || rule.deterministicBinding !== true || rule.environmentNeutral !== true
  ) violations.push({ code: 'AG605', message: 'Testing Agent bounded Interactive QA policy drifted.' });

  for (const field of [
    'checkpointAuthority','validationAuthority','unrestrictedAutomation','browserAutomationAuthority','previewAuthority',
    'capabilityGrantAuthority','approvalAuthority','scopeAuthority','directMutationAuthority','codingAgentAuthority',
    'databaseAgentAuthority','reviewAgentAuthority','agentOrchestratorAuthority','automaticAgentSelection','orchestration',
    'scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority','databaseAuthority',
    'studioTransport','localRuntimeTransport',
  ]) if (rule[field] !== false) violations.push({ code: 'AG605', message: 'Testing Agent policy gained forbidden authority.', detail: field });
  for (const field of ['agentExecution','toolExecution','execution']) {
    if (rule[field] !== true) violations.push({ code: 'AG605', message: 'Testing Agent bounded execution contract is inactive.', detail: field });
  }

  if (
    rule.agentId !== 'samuel' || rule.agentName !== 'Samuel' || rule.agentRole !== 'qa-testing'
    || rule.reviewAgentBuild !== 63 || rule.agentOrchestratorBuild !== 64
    || rule.previewRuntimeBuild !== 68 || rule.previewBridgeBuild !== 70
    || !agentRule || agentRule.agentCount !== 9 || agentRule.viktorIsAgent !== false
    || !Array.isArray(agentRule.agentIds) || !agentRule.agentIds.includes('samuel')
  ) violations.push({ code: 'AG606', message: 'Testing Agent identity or downstream ownership boundary drifted.' });

  if (
    !toolRule || toolRule.schema !== 'gd-tool-runtime/1' || toolRule.denyByDefault !== true
    || toolRule.capabilityVerifierRequired !== true || toolRule.capabilityGrantAuthority !== false
    || toolRule.scopeLockRequired !== true || toolRule.mutationAuthorized !== false
    || !checkpointRule || checkpointRule.schema !== 'gd-checkpoint-engine/1' || checkpointRule.checkpoints !== true
    || checkpointRule.toolExecution !== false || checkpointRule.execution !== false
    || !validationRule || validationRule.schema !== 'gd-validation-pipeline/1'
    || validationRule.testingAgentBuild !== 62 || validationRule.testingAgentAuthority !== false
    || validationRule.validationPipeline !== true || validationRule.failClosed !== true
    || validationRule.semanticInference !== false || validationRule.toolExecution !== false
    || validationRule.externalFlowExecution !== false || validationRule.completionEligibilityRequiresPass !== true
  ) violations.push({ code: 'AG607', message: 'Testing Agent upstream sovereign authority contract drifted.' });

  for (const absolute of sourceFiles('apps')) {
    const active = fs.readFileSync(absolute, 'utf8');
    if (active.includes('@github-decrypter/ai/testing-agent') || active.includes('/testing-agent')) {
      violations.push({ code: 'AG608', message: 'Testing Agent transport/application integration arrived before its owning later Build.', detail: path.relative(root, absolute) });
    }
  }

  const architectureDoc = read('docs/architecture/TESTING_AGENT.md');
  const buildDoc = read('docs/builds/BUILD_62_TESTING_AGENT.md');
  const workflow = read('.github/workflows/build62-testing-agent.yml');
  for (const phrase of [
    'Testing Agent != Validation Pipeline',
    'Testing Agent != unrestricted automation',
    'Testing Agent != browser automation authority',
    'Samuel',
    'Build 63',
    'Build 64',
  ]) if (!architectureDoc.includes(phrase)) violations.push({ code: 'AG609', message: 'Testing Agent architecture documentation is incomplete.', detail: phrase });
  if (!buildDoc.includes('Build 62 — Testing Agent') || !buildDoc.includes('Build 63 — Review Agent')) {
    violations.push({ code: 'AG609', message: 'Build 62 documentation is missing or has wrong successor ownership.' });
  }
  if (!workflow.includes('pnpm run guardian') || !workflow.includes('pnpm run ci')
      || !workflow.includes('guard-viktor-explicit-activation.mjs') || !workflow.includes('test-build5-rebrand.mjs')) {
    violations.push({ code: 'AG609', message: 'Build 62 workflow does not preserve the required accumulated gate.' });
  }
}

if (violations.length) {
  console.error(JSON.stringify({ ok:false, schema:'gd-architecture-guardian-testing-agent-report/1', violations }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok:true,
  schema:'gd-architecture-guardian-testing-agent-report/1',
  build:62,
  agentId:'samuel',
  interactiveQA:true,
  unrestrictedAutomation:false,
  browserAutomationAuthority:false,
  validationPipelineSovereign:true,
},null,2));
