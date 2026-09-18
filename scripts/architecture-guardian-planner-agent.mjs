import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.plannerAgentAuthority;
const agentRule = policy.agentRuntimeAuthority;
const planRule = policy.planAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 59 || rule.minimumBuild !== 59 || policy.phaseGates?.plannerAgentBuild !== 59
  || rule.ownerPackage !== '@github-decrypter/ai' || rule.ownerSource !== 'packages/ai/src/planner-agent.ts'
  || rule.schema !== 'gd-planner-agent/1' || rule.sourceAgentRuntimeSchema !== 'gd-agent-runtime/1'
  || rule.sourcePlanSchema !== 'gd-plan-authority/1' || rule.mode !== 'PLAN'
) {
  violations.push({ code: 'AG570', message: 'Build 59 Planner Agent policy is missing or inactive.' });
} else {
  const aiPackage = json('packages/ai/package.json');
  const rootPackage = json('package.json');
  const packageRule = policy.packageRules?.['@github-decrypter/ai'];
  if (
    aiPackage.name !== '@github-decrypter/ai' || versionBuild(aiPackage.version) === null || versionBuild(aiPackage.version) < 59
    || JSON.stringify(aiPackage.exports) !== JSON.stringify({
      '.': './src/index.ts',
      './agent-runtime': './src/agent-runtime.ts',
      './planner-agent': './src/planner-agent.ts',
    })
    || JSON.stringify(aiPackage.dependencies ?? {}) !== JSON.stringify({ '@github-decrypter/plan': 'workspace:*' })
    || versionBuild(rootPackage.version) === null || versionBuild(rootPackage.version) < 59
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/plan'])
  ) violations.push({ code: 'AG571', message: 'Build 59 package/root export or dependency boundary drifted.' });

  const source = read('packages/ai/src/planner-agent.ts');
  for (const marker of [
    'PLANNER_AGENT_BUILD = 59',
    "PLANNER_AGENT_SCHEMA = 'gd-planner-agent/1'",
    "PLANNER_AGENT_SOURCE_RUNTIME_SCHEMA = 'gd-agent-runtime/1'",
    "PLANNER_AGENT_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1'",
    "PLANNER_AGENT_ID = 'leonardo'",
    "PLANNER_AGENT_NAME = 'Leonardo'",
    "PLANNER_AGENT_ROLE = 'architect'",
    'createPlannerAgentBrief(',
    'assertCanonicalPlannerAgentBrief(',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG572', message: 'Planner Agent core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalAgentRuntime(',
    'getAgentRuntimeDescriptor(PLANNER_AGENT_ID)',
    'assertCanonicalDraftPlan(',
    'canonicalPlanMaterial(',
    'canonicalPlannerMaterial(',
    'sourcePlanDigest',
    'plannerDigest',
    'sha256Hex(',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG573', message: 'Planner Agent identity/Plan Authority binding is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(source)) {
    violations.push({ code: 'AG574', message: 'Build 59 gained direct environment, transport or execution authority.' });
  }
  for (const field of [
    'semanticInference','planApprovalAuthority','decisionAuthority','projectRulesAuthority','impactSimulationAuthority',
    'buildTransitionAuthority','automaticAgentSelection','orchestration','agentExecution','toolExecution','execution',
    'capabilityGrantAuthority','approvalAuthority','scopeAuthority','mutationAuthorized','scheduling','jobCreation',
    'persistence','networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
  ]) if (rule[field] !== false) violations.push({ code: 'AG574', message: 'Planner Agent policy gained forbidden authority.', detail: field });

  if (
    rule.agentId !== 'leonardo' || rule.agentName !== 'Leonardo' || rule.agentRole !== 'architect'
    || rule.namedAgentBinding !== true || rule.plannerAgent !== true || rule.planningSpecialization !== true
    || rule.planAuthorityConsumer !== true || rule.draftPlanRequired !== true || rule.planningAdvisoryOnly !== true
    || rule.planReadOnlyPreserved !== true || rule.deterministic !== true || rule.environmentNeutral !== true
    || rule.digestAlgorithm !== 'sha256' || rule.maxTasks !== 4096
  ) violations.push({ code: 'AG575', message: 'Planner Agent canonical planning boundary drifted.' });

  if (
    rule.codingAgentBuild !== 60 || rule.databaseAgentBuild !== 61 || rule.testingAgentBuild !== 62
    || rule.reviewAgentBuild !== 63 || rule.agentOrchestratorBuild !== 64
  ) violations.push({ code: 'AG576', message: 'Planner Agent prematurely changed downstream specialized-agent ownership.' });

  if (
    !agentRule || agentRule.minimumBuild !== 58 || agentRule.plannerAgentBuild !== 59
    || agentRule.orchestration !== false || agentRule.agentExecution !== false || agentRule.toolExecution !== false
    || agentRule.capabilityGrantAuthority !== false || agentRule.viktorIsAgent !== false
  ) violations.push({ code: 'AG577', message: 'Build 59 no longer preserves Agent Runtime identity-only boundary.' });
  if (
    !planRule || planRule.minimumBuild !== 48 || planRule.buildTransitionAuthorized !== false
    || planRule.toolExecution !== false || planRule.execution !== false
  ) violations.push({ code: 'AG577', message: 'Build 59 no longer preserves Plan Authority ownership.' });

  const localIndex = read('apps/local/src/index.ts');
  const studioSource = exists('apps/studio/src') ? fs.readdirSync(path.join(root, 'apps/studio/src'), { recursive: true, withFileTypes: false })
    .filter((entry) => typeof entry === 'string' && /\.[jt]sx?$/.test(entry))
    .map((entry) => read(`apps/studio/src/${entry}`)).join('\n') : '';
  if (localIndex.includes('@github-decrypter/ai/planner-agent') || studioSource.includes('@github-decrypter/ai/planner-agent')) {
    violations.push({ code: 'AG578', message: 'Build 59 prematurely introduced Local Runtime or Studio Planner Agent transport.' });
  }

  for (const required of [
    'packages/ai/src/planner-agent.ts',
    'docs/architecture/PLANNER_AGENT.md',
    'docs/builds/BUILD_59_PLANNER_AGENT.md',
    'scripts/architecture-guardian-planner-agent.mjs',
    'scripts/test-build59-planner-agent.mjs',
    'scripts/test-build59-planner-agent-runtime.ts',
    'scripts/test-build59-planner-agent-guardian-negative.mjs',
    'scripts/tsconfig.build59-tests.json',
    '.github/workflows/build59-planner-agent.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG579', message: 'Required Build 59 artifact is missing.', detail: required });

  const architectureDoc = read('docs/architecture/PLANNER_AGENT.md');
  const buildDoc = read('docs/builds/BUILD_59_PLANNER_AGENT.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  const mapping = read('docs/product/NORTH_STAR_ROADMAP_MAPPING.md');
  if (
    !architectureDoc.includes('Planner Agent != Plan Authority')
    || !architectureDoc.includes('Planner Agent != agent orchestration')
    || !buildDoc.includes('Leonardo')
    || !buildDoc.includes('Build 60 — Coding Agent')
    || !roadmap.includes('59. **Planner Agent**')
    || !mapping.includes('Named Agent System')
  ) violations.push({ code: 'AG579', message: 'Build 59 documentation does not preserve planning/agent ownership boundaries.' });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-planner-agent-report/1',
  currentBuild: policy.currentBuild,
  plannerSchema: rule?.schema ?? null,
  agentId: rule?.agentId ?? null,
  planApprovalAuthority: rule?.planApprovalAuthority ?? null,
  orchestration: rule?.orchestration ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
