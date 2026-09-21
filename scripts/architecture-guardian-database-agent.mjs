import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.databaseAgentAuthority;
const agentRule = policy.agentRuntimeAuthority;
const toolRule = policy.toolRuntimeAuthority;
const dbRule = policy.databaseAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 61 || rule.minimumBuild !== 61 || policy.phaseGates?.databaseAgentBuild !== 61
  || rule.ownerPackage !== '@github-decrypter/ai' || rule.ownerSource !== 'packages/ai/src/database-agent.ts'
  || rule.schema !== 'gd-database-agent/1' || rule.sourceAgentRuntimeSchema !== 'gd-agent-runtime/1'
  || rule.sourceToolRuntimeSchema !== 'gd-tool-runtime/1' || rule.mode !== 'BUILD'
) {
  violations.push({ code: 'AG590', message: 'Build 61 Database Agent policy is missing or inactive.' });
} else {
  const aiPackage = json('packages/ai/package.json');
  const rootPackage = json('package.json');
  const packageRule = policy.packageRules?.['@github-decrypter/ai'];
  const expectedExports = policy.currentBuild >= 62
    ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts', './coding-agent': './src/coding-agent.ts', './database-agent': './src/database-agent.ts', './testing-agent': './src/testing-agent.ts' }
    : {
      '.': './src/index.ts',
      './agent-runtime': './src/agent-runtime.ts',
      './planner-agent': './src/planner-agent.ts',
      './coding-agent': './src/coding-agent.ts',
      './database-agent': './src/database-agent.ts',
    };
  const expectedDependencies = {
    '@github-decrypter/plan': 'workspace:*',
    '@github-decrypter/tools': 'workspace:*',
  };
  if (
    aiPackage.name !== '@github-decrypter/ai' || versionBuild(aiPackage.version) === null || versionBuild(aiPackage.version) < 61
    || JSON.stringify(aiPackage.exports) !== JSON.stringify(expectedExports)
    || JSON.stringify(aiPackage.dependencies ?? {}) !== JSON.stringify(expectedDependencies)
    || versionBuild(rootPackage.version) === null || versionBuild(rootPackage.version) < 61
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/plan','@github-decrypter/tools'])
  ) violations.push({ code: 'AG591', message: 'Build 61 package/root export or dependency boundary drifted.' });

  const source = read('packages/ai/src/database-agent.ts');
  for (const marker of [
    'DATABASE_AGENT_BUILD = 61',
    "DATABASE_AGENT_SCHEMA = 'gd-database-agent/1'",
    "DATABASE_AGENT_SOURCE_RUNTIME_SCHEMA = 'gd-agent-runtime/1'",
    "DATABASE_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1'",
    "DATABASE_AGENT_ID = 'pitts'",
    "DATABASE_AGENT_NAME = 'Pitts'",
    "DATABASE_AGENT_ROLE = 'backend-computational-core'",
    'executeDatabaseAgent(',
    'assertCanonicalDatabaseAgentExecution(',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG592', message: 'Database Agent core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalAgentRuntime(',
    'getAgentRuntimeDescriptor(DATABASE_AGENT_ID)',
    'createToolRuntime(',
    'assertAllowedCapabilities(',
    'assertToolInvocationBoundary(',
    'canonicalDatabaseMaterial(',
    'sourceInvocationDigest',
    'sourceCompletionDigest',
    'databaseDigest',
    'sha256Hex(',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG593', message: 'Database Agent identity/Tool Runtime binding is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(source)) {
    violations.push({ code: 'AG594', message: 'Build 61 gained direct environment, database transport, shell or filesystem authority.' });
  }

  if (
    JSON.stringify(rule.allowedCapabilities) !== JSON.stringify(['READ','DATABASE_WRITE'])
    || JSON.stringify(rule.blockedCapabilities) !== JSON.stringify(['WRITE','EXECUTE','NETWORK','GIT_WRITE','DESTRUCTIVE','SECRETS'])
    || rule.namedAgentBinding !== true || rule.databaseAgent !== true || rule.databaseSpecialization !== true
    || rule.databaseWriteDelegated !== true || rule.toolRuntimeConsumer !== true || rule.toolRuntimeDelegation !== true
    || rule.toolRuntimeSovereign !== true || rule.buildOrchestratorConsumer !== true
    || rule.scopeLockRequiredForDatabaseWrite !== true || rule.capabilityVerifierRequired !== true
    || rule.mutationAuthorityOwnedByToolRuntime !== true || rule.deterministicBinding !== true
    || rule.environmentNeutral !== true
  ) violations.push({ code: 'AG595', message: 'Database Agent delegated execution boundary drifted.' });

  for (const field of [
    'directDatabaseAuthority','productionDatabaseMutationAuthority','directMutationAuthority','capabilityGrantAuthority',
    'approvalAuthority','scopeAuthority','codingAgentAuthority','testingAgentAuthority','reviewAgentAuthority',
    'agentOrchestratorAuthority','backendProviderAuthority','secretsAuthority','automaticAgentSelection','orchestration',
    'checkpointAuthority','validationAuthority','scheduling','jobCreation','persistence','networkAuthority',
    'filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
  ]) if (rule[field] !== false) violations.push({ code: 'AG595', message: 'Database Agent policy gained forbidden authority.', detail: field });
  for (const field of ['agentExecution','toolExecution','execution']) {
    if (rule[field] !== true) violations.push({ code: 'AG595', message: 'Database Agent delegated execution contract is inactive.', detail: field });
  }

  if (
    rule.agentId !== 'pitts' || rule.agentName !== 'Pitts' || rule.agentRole !== 'backend-computational-core'
    || rule.testingAgentBuild !== 62 || rule.reviewAgentBuild !== 63 || rule.agentOrchestratorBuild !== 64
    || rule.backendProviderContractBuild !== 80
  ) violations.push({ code: 'AG596', message: 'Database Agent identity or downstream ownership drifted.' });

  if (
    !toolRule || toolRule.minimumBuild !== 53 || toolRule.schema !== 'gd-tool-runtime/1'
    || toolRule.capabilityVerifierRequired !== true || toolRule.capabilityGrantAuthority !== false
    || toolRule.scopeLockRequired !== true || toolRule.handlerDispatch !== true || toolRule.toolExecution !== true
    || !toolRule.requiredCapabilities?.includes('DATABASE_WRITE')
  ) violations.push({ code: 'AG597', message: 'Build 61 no longer preserves Tool Runtime DATABASE_WRITE sovereignty.' });
  if (
    !agentRule || agentRule.minimumBuild !== 58 || agentRule.databaseAgentBuild !== 61
    || agentRule.orchestration !== false || agentRule.agentExecution !== false || agentRule.toolExecution !== false
    || agentRule.capabilityGrantAuthority !== false || agentRule.viktorIsAgent !== false
  ) violations.push({ code: 'AG597', message: 'Build 61 no longer preserves Agent Runtime identity-only authority.' });
  if (!dbRule || dbRule.minimumBuild !== 11 || dbRule.ownerRoot !== 'apps/local' || dbRule.engineImport !== 'node:sqlite') {
    violations.push({ code: 'AG597', message: 'Build 61 no longer preserves Build 11 local database engine ownership.' });
  }

  const localIndex = read('apps/local/src/index.ts');
  const studioSource = exists('apps/studio/src') ? fs.readdirSync(path.join(root, 'apps/studio/src'), { recursive: true, withFileTypes: false })
    .filter((entry) => typeof entry === 'string' && /\.[jt]sx?$/.test(entry))
    .map((entry) => read('apps/studio/src/' + entry)).join('\n') : '';
  if (localIndex.includes('@github-decrypter/ai/database-agent') || studioSource.includes('@github-decrypter/ai/database-agent')) {
    violations.push({ code: 'AG598', message: 'Build 61 prematurely introduced Local Runtime or Studio Database Agent transport.' });
  }

  for (const required of [
    'packages/ai/src/database-agent.ts',
    'docs/architecture/DATABASE_AGENT.md',
    'docs/builds/BUILD_61_DATABASE_AGENT.md',
    'scripts/architecture-guardian-database-agent.mjs',
    'scripts/test-build61-database-agent.mjs',
    'scripts/test-build61-database-agent-runtime.ts',
    'scripts/test-build61-database-agent-guardian-negative.mjs',
    'scripts/tsconfig.build61-tests.json',
    '.github/workflows/build61-database-agent.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG599', message: 'Required Build 61 artifact is missing.', detail: required });

  const architectureDoc = read('docs/architecture/DATABASE_AGENT.md');
  const buildDoc = read('docs/builds/BUILD_61_DATABASE_AGENT.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (
    !architectureDoc.includes('Database Agent != database authority')
    || !architectureDoc.includes('Database Agent != Coding Agent')
    || !architectureDoc.includes('Database Agent != production database mutation authority')
    || !architectureDoc.includes('Database Agent != Agent Orchestrator')
    || !buildDoc.includes('Pitts')
    || !buildDoc.includes('Build 62 — Testing Agent')
    || !roadmap.includes('61. **Database Agent**')
  ) violations.push({ code: 'AG599', message: 'Build 61 documentation does not preserve database/tool/coding/orchestration boundaries.' });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-database-agent-report/1',
  currentBuild: policy.currentBuild,
  databaseAgentSchema: rule?.schema ?? null,
  agentId: rule?.agentId ?? null,
  databaseWriteDelegated: rule?.databaseWriteDelegated ?? null,
  directDatabaseAuthority: rule?.directDatabaseAuthority ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
