import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const aiPackagePath = 'packages/ai/package.json';
const sourcePath = 'packages/ai/src/review-agent.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/REVIEW_AGENT.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [aiPackagePath, fs.readFileSync(aiPackagePath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-review-agent.mjs'], { encoding: 'utf8' });
}
function restore() { for (const [file, content] of originals) fs.writeFileSync(file, content); }
function expectFailure(code, mutate) {
  restore();
  mutate();
  const result = runGuardian();
  assert.notEqual(result.status, 0, 'Guardian unexpectedly passed negative probe ' + code + '.');
  assert.match(result.stdout + '\n' + result.stderr, new RegExp(code));
}

try {
  expectFailure('AG610', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 62;
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG611', () => {
    const manifest = JSON.parse(originals.get(aiPackagePath));
    delete manifest.exports['./review-agent'];
    fs.writeFileSync(aiPackagePath, JSON.stringify(manifest, null, 2) + '\n');
  });
  expectFailure('AG612', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('createReviewAgentReport(', 'createReviewAgentReportBroken('));
  });
  expectFailure('AG613', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('assertCanonicalTestingAgentExecution(', 'assertCanonicalTestingAgentExecutionBroken('));
  });
  expectFailure('AG614', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath) + "\nimport 'node:child_process';\n");
  });
  expectFailure('AG615', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.reviewAgentAuthority.vetoAuthority = true;
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG616', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.reviewAgentAuthority.agentOrchestratorBuild = 63;
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG617', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.architecturalIntegrity.heimdallActivationBuild = 63;
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG618', () => {
    fs.writeFileSync(localIndexPath, originals.get(localIndexPath) + "\nexport * from '@github-decrypter/ai/review-agent';\n");
  });
  expectFailure('AG619', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, 'Guardian did not return green after restoration:\n' + final.stdout + '\n' + final.stderr);
console.log(JSON.stringify({
  ok:true,
  schema:'gd-build63-review-agent-guardian-negative/1',
  probes:['AG610','AG611','AG612','AG613','AG614','AG615','AG616','AG617','AG618','AG619'],
},null,2));
