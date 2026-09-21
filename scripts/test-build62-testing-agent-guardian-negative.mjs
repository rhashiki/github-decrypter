import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const aiPackagePath = 'packages/ai/package.json';
const sourcePath = 'packages/ai/src/testing-agent.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/TESTING_AGENT.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [aiPackagePath, fs.readFileSync(aiPackagePath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-testing-agent.mjs'], { encoding: 'utf8' });
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
  expectFailure('AG600', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 61;
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG601', () => {
    const manifest = JSON.parse(originals.get(aiPackagePath));
    delete manifest.exports['./testing-agent'];
    fs.writeFileSync(aiPackagePath, JSON.stringify(manifest, null, 2) + '\n');
  });
  expectFailure('AG602', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('executeTestingAgent(', 'executeTestingAgentBroken('));
  });
  expectFailure('AG603', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('createCheckpoint(', 'createCheckpointBroken('));
  });
  expectFailure('AG604', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath) + "\nimport 'node:child_process';\n");
  });
  expectFailure('AG605', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.testingAgentAuthority.allowedCapabilities.push('NETWORK');
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG606', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.testingAgentAuthority.previewRuntimeBuild = 62;
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG607', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.validationPipelineAuthority.testingAgentAuthority = true;
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG608', () => {
    fs.writeFileSync(localIndexPath, originals.get(localIndexPath) + "\nexport * from '@github-decrypter/ai/testing-agent';\n");
  });
  expectFailure('AG609', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, 'Guardian did not return green after restoration:\n' + final.stdout + '\n' + final.stderr);
console.log(JSON.stringify({
  ok:true,
  schema:'gd-build62-testing-agent-guardian-negative/1',
  probes:['AG600','AG601','AG602','AG603','AG604','AG605','AG606','AG607','AG608','AG609'],
},null,2));
