import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const aiPackagePath = 'packages/ai/package.json';
const sourcePath = 'packages/ai/src/agent-runtime.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/AGENT_RUNTIME.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [aiPackagePath, fs.readFileSync(aiPackagePath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-agent-runtime.mjs'], { encoding: 'utf8' });
}
function restore() { for (const [file, content] of originals) fs.writeFileSync(file, content); }
function expectFailure(code, mutate) {
  restore();
  mutate();
  const result = runGuardian();
  assert.notEqual(result.status, 0, `Guardian unexpectedly passed negative probe ${code}.`);
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(code));
}

try {
  expectFailure('AG560', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 57;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG561', () => {
    const manifest = JSON.parse(originals.get(aiPackagePath));
    delete manifest.exports['./agent-runtime'];
    fs.writeFileSync(aiPackagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  });
  expectFailure('AG562', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('createAgentRuntimeRegistry(', 'createAgentRuntimeRegistryBroken('));
  });
  expectFailure('AG563', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replace("name: 'Ramon'", "name: 'Viktor'"));
  });
  expectFailure('AG564', () => {
    fs.writeFileSync(sourcePath, `${originals.get(sourcePath)}\nfetch('https://example.invalid');\n`);
  });
  expectFailure('AG565', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.agentRuntimeAuthority.agentCount = 10;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG566', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.agentRuntimeAuthority.agentOrchestratorBuild = 58;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG567', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.aiProviderAuthority.agentAuthority = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG568', () => {
    fs.writeFileSync(localIndexPath, `${originals.get(localIndexPath)}\nexport * from '@github-decrypter/ai/agent-runtime';\n`);
  });
  expectFailure('AG569', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build58-agent-runtime-guardian-negative/1',
  probes: ['AG560','AG561','AG562','AG563','AG564','AG565','AG566','AG567','AG568','AG569'],
}, null, 2));
