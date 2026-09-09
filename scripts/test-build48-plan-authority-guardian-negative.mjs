import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const sourcePath = 'packages/plan/src/authority.ts';
const runtimePath = 'apps/local/src/plan-authority.ts';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [runtimePath, fs.readFileSync(runtimePath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-plan-authority.mjs'], { encoding: 'utf8' });
}

function expectFailure(code, mutate) {
  for (const [path, content] of originals) fs.writeFileSync(path, content);
  mutate();
  const result = runGuardian();
  assert.notEqual(result.status, 0, `Guardian unexpectedly passed negative probe ${code}.`);
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(code));
}

try {
  expectFailure('AG460', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 47;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG462', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replace('buildTransitionAuthorized: false', 'buildTransitionAuthorized: true'));
  });

  expectFailure('AG465', () => {
    fs.writeFileSync(runtimePath, originals.get(runtimePath).replace("  'GIT_WRITE',\n", ''));
  });

  expectFailure('AG466', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.planAuthority.decisionEngine = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
} finally {
  for (const [path, content] of originals) fs.writeFileSync(path, content);
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({ ok: true, schema: 'gd-build48-plan-authority-guardian-negative/1', probes: ['AG460','AG462','AG465','AG466'] }, null, 2));
