import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const aiPackagePath = 'packages/ai/package.json';
const sourcePath = 'packages/ai/src/database-agent.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/DATABASE_AGENT.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [aiPackagePath, fs.readFileSync(aiPackagePath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-database-agent.mjs'], { encoding: 'utf8' });
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
  expectFailure('AG590', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 60;
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG591', () => {
    const manifest = JSON.parse(originals.get(aiPackagePath));
    delete manifest.exports['./database-agent'];
    fs.writeFileSync(aiPackagePath, JSON.stringify(manifest, null, 2) + '\n');
  });
  expectFailure('AG592', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('executeDatabaseAgent(', 'executeDatabaseAgentBroken('));
  });
  expectFailure('AG593', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('createToolRuntime(', 'createToolRuntimeBroken('));
  });
  expectFailure('AG594', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath) + "\nimport 'node:sqlite';\n");
  });
  expectFailure('AG595', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.databaseAgentAuthority.allowedCapabilities.push('NETWORK');
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG596', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.databaseAgentAuthority.backendProviderContractBuild = 61;
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG597', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.toolRuntimeAuthority.capabilityGrantAuthority = true;
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');
  });
  expectFailure('AG598', () => {
    fs.writeFileSync(localIndexPath, originals.get(localIndexPath) + "\nexport * from '@github-decrypter/ai/database-agent';\n");
  });
  expectFailure('AG599', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, 'Guardian did not return green after restoration:\n' + final.stdout + '\n' + final.stderr);
console.log(JSON.stringify({
  ok:true,
  schema:'gd-build61-database-agent-guardian-negative/1',
  probes:['AG590','AG591','AG592','AG593','AG594','AG595','AG596','AG597','AG598','AG599'],
},null,2));
