import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.codingAgentAuthority;
const agentRule = policy.agentRuntimeAuthority;
const toolRule = policy.toolRuntimeAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 60 || rule.minimumBuild !== 60 || policy.phaseGates?.codingAgentBuild !== 60
  || rule.ownerPackage !== '@github-decrypter/ai' || rule.ownerSource !== 'packages/ai/src/coding-agent.ts'
  || rule.schema !== 'gd-coding-agent/1' || rule.sourceAgentRuntimeSchema !== 'gd-agent-runtime/1'
  || rule.sourceToolRuntimeSchema !== 'gd-tool-runtime/1' || rule.mode !== 'BUILD'
) {
  violations.push({ code: 'AG580', message: 'Build 60 Coding Agent policy is missing or inactive.' });
} else {
  const aiPackage = json('packages/ai/package.json');
  const rootPackage = json('package.json');
  const packageRule = policy.packageRules?.['@github-decrypter/ai'];
  const expectedExports = {
    '.': './src/index.ts',
    './agent-runtime': './src/agent-runtime.ts',
    './planner-agent': './src/planner-agent.ts',
    './coding-agent': './src/coding-agent.ts',
  };
  const expectedDependencies = {
    '@github-decrypter/plan': 'workspace:*',
    '@github-decrypter/tools': 'workspace:*',
  };
  if (
    aiPackage.name !== '@github-decrypter/ai' || versionBuild(aiPackage.version) === null || versionBuild(aiPackage.version) < 60
    || JSON.stringify(aiPackage.exports) !== JSON.stringify(expectedExports)
    || JSON.stringify(aiPackage.dependencies ?? {}) !== JSON.stringify(expectedDependencies)
    || versionBuild(rootPackage.version) === null || versionBuild(rootPackage.version) < 60
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/plan','@github-decrypter/tools'])
  ) violations.push({ code: 'AG581', message: 'Build 60 package/root export or dependency boundary drifted.' });

  const source = read('packages/ai/src/coding-agent.ts');
  for (const marker of [
    'CODING_AGENT_BUILD = 60',
    "CODING_AGENT_SCHEMA = 'gd-coding-agent/1'",
    "CODING_AGENT_SOURCE_RUNTIME_SCHEMA = 'gd-agent-runtime/1'",
    "CODING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1'",
    "CODING_AGENT_ID = 'strachey'",
    "CODING_AGENT_NAME = 'Strachey'",
    "CODING_AGENT_ROLE = 'builder-programmer'",
    'executeCodingAgent(',
    'assertCanonicalCodingAgentExecution(',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG582', message: 'Coding Agent core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalAgentRuntime(',
    'getAgentRuntimeDescriptor(CODING_AGENT_ID)',
    'createToolRuntime(',
    'assertAllowedCapabilities(',
    'assertToolInvocationBoundary(',
    'canonicalCodingMaterial(',
    'sourceInvocationDigest',
    'sourceCompletionDigest',
    'codingDigest',
    'sha256Hex(',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG583', message: 'Coding Agent identity/Tool Runtime binding is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(source)) {
    violations.push({ code: 'AG584', message: 'Build 60 gained direct environment, transport or mutation authority.' });
  }

  if (
    JSON.stringify(rule.allowedCapabilities) !== JSON.stringify(['READ','WRITE','EXECUTE','NETWORK'])
    || JSON.stringify(rule.blockedCapabilities) !== JSON.stringify(['DATABASE_WRITE','GIT_WRITE','DESTRUCTIVE','SECRETS'])
    || rule.namedAgentBinding !== true || rule.codingAgent !== true || rule.implementationSpecialization !== true
    || rule.toolRuntimeConsumer !== true || rule.toolRuntimeDelegation !== true || rule.toolRuntimeSovereign !== true
    || rule.buildOrchestratorConsumer !== true || rule.scopeLockRequiredForMutation !== true
    || rule.capabilityVerifierRequired !== true || rule.mutationAuthorityOwnedByToolRuntime !== true
    || rule.deterministicBinding !== true || rule.environmentNeutral !== true
  ) violations.push({ code: 'AG585', message: 'Coding Agent delegated execution boundary drifted.' });

  for (const field of [
    'directMutationAuthority','capabilityGrantAuthority','approvalAuthority','scopeAuthority','databaseAgentAuthority',
    'testingAgentAuthority','reviewAgentAuthority','agentOrchestratorAuthority','automaticAgentSelection','orchestration',
    'checkpointAuthority','validationAuthority','scheduling','jobCreation','persistence','networkAuthority',
    'filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
  ]) if (rule[field] !== false) violations.push({ code: 'AG585', message: 'Coding Agent policy gained forbidden authority.', detail: field });
  for (const field of ['agentExecution','toolExecution','execution']) {
    if (rule[field] !== true) violations.push({ code: 'AG585', message: 'Coding Agent delegated execution contract is inactive.', detail: field });
  }

  if (
    rule.agentId !== 'strachey' || rule.agentName !== 'Strachey' || rule.agentRole !== 'builder-programmer'
    || rule.databaseAgentBuild !== 61 || rule.testingAgentBuild !== 62 || rule.reviewAgentBuild !== 63
    || rule.agentOrchestratorBuild !== 64
  ) violations.push({ code: 'AG586', message: 'Coding Agent identity or downstream specialized-agent ownership drifted.' });

  if (
    !toolRule || toolRule.minimumBuild !== 53 || toolRule.schema !== 'gd-tool-runtime/1'
    || toolRule.capabilityVerifierRequired !== true || toolRule.capabilityGrantAuthority !== false
    || toolRule.scopeLockRequired !== true || toolRule.handlerDispatch !== true || toolRule.toolExecution !== true
  ) violations.push({ code: 'AG587', message: 'Build 60 no longer preserves Tool Runtime sovereignty.' });
  if (
    !agentRule || agentRule.minimumBuild !== 58 || agentRule.codingAgentBuild !== 60
    || agentRule.orchestration !== false || agentRule.agentExecution !== false || agentRule.toolExecution !== false
    || agentRule.capabilityGrantAuthority !== false || agentRule.viktorIsAgent !== false
  ) violations.push({ code: 'AG587', message: 'Build 60 no longer preserves Agent Runtime identity-only authority.' });

  const localIndex = read('apps/local/src/index.ts');
  const studioSource = exists('apps/studio/src') ? fs.readdirSync(path.join(root, 'apps/studio/src'), { recursive: true, withFileTypes: false })
    .filter((entry) => typeof entry === 'string' && /\.[jt]sx?$/.test(entry))
    .map((entry) => read('apps/studio/src/' + entry)).join('\n') : '';
  if (localIndex.includes('@github-decrypter/ai/coding-agent') || studioSource.includes('@github-decrypter/ai/coding-agent')) {
    violations.push({ code: 'AG588', message: 'Build 60 prematurely introduced Local Runtime or Studio Coding Agent transport.' });
  }

  for (const required of [
    'packages/ai/src/coding-agent.ts',
    'docs/architecture/CODING_AGENT.md',
    'docs/builds/BUILD_60_CODING_AGENT.md',
    'scripts/architecture-guardian-coding-agent.mjs',
    'scripts/test-build60-coding-agent.mjs',
    'scripts/test-build60-coding-agent-runtime.ts',
    'scripts/test-build60-coding-agent-guardian-negative.mjs',
    'scripts/tsconfig.build60-tests.json',
    '.github/workflows/build60-coding-agent.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG589', message: 'Required Build 60 artifact is missing.', detail: required });

  const architectureDoc = read('docs/architecture/CODING_AGENT.md');
  const buildDoc = read('docs/builds/BUILD_60_CODING_AGENT.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (
    !architectureDoc.includes('Coding Agent != Tool Runtime')
    || !architectureDoc.includes('Coding Agent != Database Agent')
    || !architectureDoc.includes('Coding Agent != Agent Orchestrator')
    || !buildDoc.includes('Strachey')
    || !buildDoc.includes('Build 61 — Database Agent')
    || !roadmap.includes('60. **Coding Agent**')
  ) violations.push({ code: 'AG589', message: 'Build 60 documentation does not preserve coding/tool/database/orchestration boundaries.' });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-coding-agent-report/1',
  currentBuild: policy.currentBuild,
  codingSchema: rule?.schema ?? null,
  agentId: rule?.agentId ?? null,
  agentExecution: rule?.agentExecution ?? null,
  directMutationAuthority: rule?.directMutationAuthority ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
