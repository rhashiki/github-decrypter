import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.reviewAgentAuthority;
const agentRule = policy.agentRuntimeAuthority;
const codingRule = policy.codingAgentAuthority;
const databaseRule = policy.databaseAgentAuthority;
const testingRule = policy.testingAgentAuthority;
const integrityRule = policy.architecturalIntegrity;
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
  !rule || policy.currentBuild < 63 || rule.minimumBuild !== 63 || policy.phaseGates?.reviewAgentBuild !== 63
  || rule.ownerPackage !== '@github-decrypter/ai' || rule.ownerSource !== 'packages/ai/src/review-agent.ts'
  || rule.schema !== 'gd-review-agent/1' || rule.sourceAgentRuntimeSchema !== 'gd-agent-runtime/1'
  || rule.mode !== 'BUILD'
) {
  violations.push({ code: 'AG610', message: 'Build 63 Review Agent policy is missing or inactive.' });
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
    './review-agent': './src/review-agent.ts',
  };
  const expectedDependencies = {
    '@github-decrypter/plan': 'workspace:*',
    '@github-decrypter/tools': 'workspace:*',
  };
  if (
    aiPackage.name !== '@github-decrypter/ai' || versionBuild(aiPackage.version) === null || versionBuild(aiPackage.version) < 63
    || JSON.stringify(aiPackage.exports) !== JSON.stringify(expectedExports)
    || JSON.stringify(aiPackage.dependencies ?? {}) !== JSON.stringify(expectedDependencies)
    || versionBuild(rootPackage.version) === null || versionBuild(rootPackage.version) < 63
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/plan','@github-decrypter/tools'])
  ) violations.push({ code: 'AG611', message: 'Build 63 package/root export or dependency boundary drifted.' });

  const source = read('packages/ai/src/review-agent.ts');
  for (const marker of [
    'REVIEW_AGENT_BUILD = 63',
    "REVIEW_AGENT_SCHEMA = 'gd-review-agent/1'",
    "REVIEW_AGENT_SOURCE_RUNTIME_SCHEMA = 'gd-agent-runtime/1'",
    "REVIEW_AGENT_ID = 'weizenbaum'",
    "REVIEW_AGENT_NAME = 'Weizenbaum'",
    "REVIEW_AGENT_ROLE = 'reviewer-critic'",
    'createReviewAgentReport(',
    'assertCanonicalReviewAgentReport(',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG612', message: 'Review Agent core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalAgentRuntime(',
    'getAgentRuntimeDescriptor(REVIEW_AGENT_ID)',
    'assertCanonicalCodingAgentExecution(',
    'assertCanonicalDatabaseAgentExecution(',
    'assertCanonicalTestingAgentExecution(',
    'sourceVerdictReadOnlyPreserved: true',
    'sourceCompletionEligibilityReadOnlyPreserved: true',
    'reviewAdvisoryOnly: true',
    'vetoAuthority: false',
    'approvalAuthority: false',
    'completionAuthority: false',
    'architectureEnforcementAuthority: false',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG613', message: 'Review Agent canonical-source/advisory binding is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(source)) {
    violations.push({ code: 'AG614', message: 'Build 63 gained direct environment, tool, network, browser, shell, database or filesystem authority.' });
  }

  if (
    JSON.stringify(rule.targetKinds) !== JSON.stringify(['coding','database','testing'])
    || JSON.stringify(rule.categories) !== JSON.stringify(['correctness','security','architecture','maintainability','testing'])
    || JSON.stringify(rule.severities) !== JSON.stringify(['info','warning','error','critical'])
    || rule.maxFindings !== 256
    || rule.namedAgentBinding !== true || rule.reviewAgent !== true || rule.reviewSpecialization !== true
    || rule.reviewAdvisoryOnly !== true || rule.sourceCanonicalRequired !== true || rule.sourceReadOnlyPreserved !== true
    || rule.explicitFindingsOnly !== true || rule.semanticInference !== false
    || rule.sourceVerdictReadOnlyPreserved !== true || rule.sourceCompletionEligibilityReadOnlyPreserved !== true
    || rule.deterministic !== true || rule.environmentNeutral !== true
  ) violations.push({ code: 'AG615', message: 'Review Agent advisory review policy drifted.' });

  for (const field of [
    'vetoAuthority','approvalAuthority','completionAuthority','validationAuthority','checkpointAuthority',
    'architectureEnforcementAuthority','capabilityGrantAuthority','scopeAuthority','directMutationAuthority',
    'codingAgentAuthority','databaseAgentAuthority','testingAgentAuthority','agentOrchestratorAuthority',
    'automaticAgentSelection','orchestration','agentExecution','toolExecution','execution','scheduling',
    'jobCreation','persistence','networkAuthority','filesystemAuthority','databaseAuthority','studioTransport',
    'localRuntimeTransport',
  ]) if (rule[field] !== false) violations.push({ code: 'AG615', message: 'Review Agent policy gained forbidden authority.', detail: field });

  if (
    rule.agentId !== 'weizenbaum' || rule.agentName !== 'Weizenbaum' || rule.agentRole !== 'reviewer-critic'
    || rule.agentOrchestratorBuild !== 64
    || !agentRule || agentRule.agentCount !== 9 || agentRule.viktorIsAgent !== false
    || !Array.isArray(agentRule.agentIds) || !agentRule.agentIds.includes('weizenbaum')
  ) violations.push({ code: 'AG616', message: 'Review Agent identity or downstream ownership boundary drifted.' });

  if (
    !codingRule || codingRule.reviewAgentAuthority !== false
    || !databaseRule || databaseRule.reviewAgentAuthority !== false
    || !testingRule || testingRule.reviewAgentAuthority !== false
    || !integrityRule || integrityRule.heimdallActivationBuild !== 64
    || integrityRule.deterministicGuardianBuild !== 9
    || integrityRule.silentArchitecturalChangeAllowed !== false
  ) violations.push({ code: 'AG617', message: 'Review Agent upstream/architectural separation drifted.' });

  for (const absolute of sourceFiles('apps')) {
    const active = fs.readFileSync(absolute, 'utf8');
    if (active.includes('@github-decrypter/ai/review-agent') || active.includes('/review-agent')) {
      violations.push({ code: 'AG618', message: 'Review Agent application/orchestration integration arrived before Build 64.', detail: path.relative(root, absolute) });
    }
  }

  const architectureDoc = read('docs/architecture/REVIEW_AGENT.md');
  const buildDoc = read('docs/builds/BUILD_63_REVIEW_AGENT.md');
  const workflow = read('.github/workflows/build63-review-agent.yml');
  for (const phrase of [
    'Review Agent != Architecture Guardian',
    'Review Agent != Validation Pipeline',
    'Review Agent != approval or veto authority',
    'Review Agent != mutation authority',
    'Weizenbaum',
    'Build 64',
  ]) if (!architectureDoc.includes(phrase)) violations.push({ code: 'AG619', message: 'Review Agent architecture documentation is incomplete.', detail: phrase });
  if (!buildDoc.includes('Build 63 — Review Agent') || !buildDoc.includes('Build 64 — Agent Orchestrator')) {
    violations.push({ code: 'AG619', message: 'Build 63 documentation is missing or has wrong successor ownership.' });
  }
  if (!workflow.includes('pnpm run guardian') || !workflow.includes('pnpm run ci')
      || !workflow.includes('guard-viktor-explicit-activation.mjs') || !workflow.includes('test-build5-rebrand.mjs')) {
    violations.push({ code: 'AG619', message: 'Build 63 workflow does not preserve the required accumulated gate.' });
  }
}

if (violations.length) {
  console.error(JSON.stringify({ ok:false, schema:'gd-architecture-guardian-review-agent-report/1', violations }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok:true,
  schema:'gd-architecture-guardian-review-agent-report/1',
  build:63,
  agentId:'weizenbaum',
  advisoryOnly:true,
  vetoAuthority:false,
  architectureEnforcementAuthority:false,
},null,2));
