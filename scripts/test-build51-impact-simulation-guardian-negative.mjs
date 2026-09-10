import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const sourcePath = 'packages/plan/src/impact-simulation.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/IMPACT_SIMULATION.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-impact-simulation.mjs'], { encoding: 'utf8' });
}

function restore() {
  for (const [path, content] of originals) fs.writeFileSync(path, content);
}

function expectFailure(code, mutate) {
  restore();
  mutate();
  const result = runGuardian();
  assert.notEqual(result.status, 0, `Guardian unexpectedly passed negative probe ${code}.`);
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(code));
}

try {
  expectFailure('AG490', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 50;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG492', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replace('simulateImpact(', 'simulateImpactBroken('));
  });

  expectFailure('AG494', () => {
    fs.writeFileSync(sourcePath, `${originals.get(sourcePath)}\nfetch('https://example.invalid');\n`);
  });

  expectFailure('AG495', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.impactSimulationAuthority.semanticInference = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG496', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.impactSimulationAuthority.buildOrchestration = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG497', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.projectRulesAuthority.impactSimulation = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG498', () => {
    fs.writeFileSync(localIndexPath, `${originals.get(localIndexPath)}\nexport * from './impact-simulation.js';\n`);
  });

  expectFailure('AG499', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build51-impact-simulation-guardian-negative/1',
  probes: ['AG490','AG492','AG494','AG495','AG496','AG497','AG498','AG499'],
}, null, 2));
