import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.agentRuntimeAuthority;
const providerRule = policy.aiProviderAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

const expectedIds = ['ramon','leonardo','strachey','licklider','pitts','weizenbaum','samuel','seymour','fukushima'];
const expectedNames = ['Ramon','Leonardo','Strachey','Licklider','Pitts','Weizenbaum','Samuel','Seymour','Fukushima'];
const expectedRoles = [
  'orchestrator','architect','builder-programmer','frontend-human-interface',
  'backend-computational-core','reviewer-critic','qa-testing','mentor-professor','visual-perception',
];

if (
  !rule || policy.currentBuild < 58 || rule.minimumBuild !== 58 || policy.phaseGates?.agentRuntimeBuild !== 58
  || rule.ownerPackage !== '@github-decrypter/ai' || rule.ownerSource !== 'packages/ai/src/agent-runtime.ts'
  || rule.schema !== 'gd-agent-runtime/1' || rule.teamId !== 'vortex-ars-ai' || rule.agentCount !== 9
) {
  violations.push({ code: 'AG560', message: 'Build 58 Agent Runtime policy is missing or inactive.' });
} else {
  const aiPackage = json('packages/ai/package.json');
  const rootPackage = json('package.json');
  const packageRule = policy.packageRules?.['@github-decrypter/ai'];
  const expectedExports = policy.currentBuild >= 59
    ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts' }
    : { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts' };
  const expectedDependencies = policy.currentBuild >= 59 ? { '@github-decrypter/plan': 'workspace:*' } : {};
  const expectedWorkspaceDependencies = policy.currentBuild >= 59 ? ['@github-decrypter/plan'] : [];
  if (
    aiPackage.name !== '@github-decrypter/ai' || versionBuild(aiPackage.version) === null || versionBuild(aiPackage.version) < 58
    || JSON.stringify(aiPackage.exports) !== JSON.stringify(expectedExports)
    || JSON.stringify(aiPackage.dependencies ?? {}) !== JSON.stringify(expectedDependencies)
    || versionBuild(rootPackage.version) === null || versionBuild(rootPackage.version) < 58
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(expectedWorkspaceDependencies)
  ) violations.push({ code: 'AG561', message: 'Build 58 package/root identity, export or dependency boundary drifted.' });

  const source = read('packages/ai/src/agent-runtime.ts');
  for (const marker of [
    'AGENT_RUNTIME_BUILD = 58',
    "AGENT_RUNTIME_SCHEMA = 'gd-agent-runtime/1'",
    "AGENT_RUNTIME_TEAM_ID = 'vortex-ars-ai'",
    'AGENT_RUNTIME_COUNT = 9',
    'createAgentRuntimeRegistry(',
    'assertCanonicalAgentRuntime(',
    'listAgentRuntimeDescriptors(',
    'getAgentRuntimeDescriptor(',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG562', message: 'Agent Runtime core contract is incomplete.', detail: marker });

  for (const id of expectedIds) if (!source.includes(`id: '${id}'`)) {
    violations.push({ code: 'AG563', message: 'Canonical Agent Runtime id is missing.', detail: id });
  }
  for (const name of expectedNames) if (!source.includes(`name: '${name}'`)) {
    violations.push({ code: 'AG563', message: 'Canonical Agent Runtime name is missing.', detail: name });
  }
  for (const role of expectedRoles) if (!source.includes(`'${role}'`)) {
    violations.push({ code: 'AG563', message: 'Canonical Agent Runtime role is missing.', detail: role });
  }
  if (source.includes("name: 'Viktor'") || source.includes("id: 'viktor'")) {
    violations.push({ code: 'AG563', message: 'Viktor must not be registered as a tenth agent.' });
  }

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(source)) {
    violations.push({ code: 'AG564', message: 'Build 58 gained direct environment, transport, mutation or unrestricted execution authority.' });
  }
  for (const field of [
    'automaticSelection','orchestration','agentExecution','toolExecution','execution',
    'capabilityGrantAuthority','approvalAuthority','scopeAuthority','mutationAuthorized',
    'scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority',
    'databaseAuthority','studioTransport','localRuntimeTransport',
  ]) if (rule[field] !== false) violations.push({ code: 'AG564', message: 'Agent Runtime policy gained forbidden authority.', detail: field });

  if (
    rule.namedAgentSystem !== true || rule.identityRegistry !== true || rule.roleMetadata !== true
    || rule.specialtyMetadata !== true || rule.responsibilityMetadata !== true || rule.authorityLimitsExplicit !== true
    || rule.coordinatedTeamFoundation !== true || rule.viktorIsAgent !== false
    || rule.deterministic !== true || rule.environmentNeutral !== true
    || JSON.stringify(rule.agentIds) !== JSON.stringify(expectedIds)
    || JSON.stringify(rule.agentNames) !== JSON.stringify(expectedNames)
    || JSON.stringify(rule.roles) !== JSON.stringify(expectedRoles)
  ) violations.push({ code: 'AG565', message: 'Agent Runtime canonical identity/metadata boundary drifted.' });

  if (
    rule.plannerAgentBuild !== 59 || rule.codingAgentBuild !== 60 || rule.databaseAgentBuild !== 61
    || rule.testingAgentBuild !== 62 || rule.reviewAgentBuild !== 63 || rule.agentOrchestratorBuild !== 64
    || !source.includes('plannerAgentBuild: 59') || !source.includes('codingAgentBuild: 60')
    || !source.includes('databaseAgentBuild: 61') || !source.includes('testingAgentBuild: 62')
    || !source.includes('reviewAgentBuild: 63') || !source.includes('agentOrchestratorBuild: 64')
  ) violations.push({ code: 'AG566', message: 'Build 58 prematurely changed downstream specialized-agent ownership.' });

  if (!providerRule || providerRule.minimumBuild !== 33 || providerRule.agentRuntimeBuild !== 58
      || providerRule.agentAuthority !== false || providerRule.runtimeExecution !== false
      || providerRule.toolAuthority !== false) {
    violations.push({ code: 'AG567', message: 'Build 58 no longer preserves AI Provider API non-agent authority.' });
  }

  const localIndex = read('apps/local/src/index.ts');
  const studioSource = exists('apps/studio/src') ? fs.readdirSync(path.join(root, 'apps/studio/src'), { recursive: true, withFileTypes: false })
    .filter((entry) => typeof entry === 'string' && /\.[jt]sx?$/.test(entry))
    .map((entry) => read(`apps/studio/src/${entry}`)).join('\n') : '';
  if (localIndex.includes('@github-decrypter/ai/agent-runtime') || studioSource.includes('@github-decrypter/ai/agent-runtime')) {
    violations.push({ code: 'AG568', message: 'Build 58 prematurely introduced Local Runtime or Studio Agent Runtime transport.' });
  }

  for (const required of [
    'packages/ai/src/agent-runtime.ts',
    'docs/architecture/AGENT_RUNTIME.md',
    'docs/builds/BUILD_58_AGENT_RUNTIME.md',
    'scripts/architecture-guardian-agent-runtime.mjs',
    'scripts/test-build58-agent-runtime.mjs',
    'scripts/test-build58-agent-runtime-runtime.ts',
    'scripts/test-build58-agent-runtime-guardian-negative.mjs',
    'scripts/tsconfig.build58-tests.json',
    '.github/workflows/build58-agent-runtime.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG569', message: 'Required Build 58 artifact is missing.', detail: required });

  const amendment = read('docs/product/CONSTITUTION_AMENDMENT_001_NORTH_STAR.md');
  const manifesto = read('docs/product/NORTH_STAR_MANIFESTO.md');
  const mapping = read('docs/product/NORTH_STAR_ROADMAP_MAPPING.md');
  const architectureDoc = read('docs/architecture/AGENT_RUNTIME.md');
  const buildDoc = read('docs/builds/BUILD_58_AGENT_RUNTIME.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!amendment.includes('Agent identity/personality never grants capability or security authority')
      || !manifesto.includes('## 5. Equipe de agentes') || !manifesto.includes('Software Architect')
      || !mapping.includes('Named Agent System') || !mapping.includes('Build 58 — Agent Runtime')
      || !architectureDoc.includes('agent identity != execution authority') || !architectureDoc.includes('Viktor is not an agent')
      || !buildDoc.includes('Ramon') || !buildDoc.includes('Fukushima')
      || !roadmap.includes('58. **Agent Runtime**')) {
    violations.push({ code: 'AG569', message: 'Build 58 documentation does not preserve Named Agent System and Viktor boundaries.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-agent-runtime-report/1',
  currentBuild: policy.currentBuild,
  agentRuntimeSchema: rule?.schema ?? null,
  agentCount: rule?.agentCount ?? null,
  viktorIsAgent: rule?.viktorIsAgent ?? null,
  agentExecution: rule?.agentExecution ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
