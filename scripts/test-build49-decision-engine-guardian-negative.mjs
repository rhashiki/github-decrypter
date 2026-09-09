import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const sourcePath = 'packages/plan/src/decision.ts';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-decision-engine.mjs'], { encoding: 'utf8' });
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
  expectFailure('AG470', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 48;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG472', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replace('resolveDecision(', 'resolveDecisionBroken('));
  });

  expectFailure('AG474', () => {
    fs.writeFileSync(sourcePath, `${originals.get(sourcePath)}\nfetch('https://example.invalid');\n`);
  });

  expectFailure('AG475', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.decisionEngineAuthority.semanticInference = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG476', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.decisionEngineAuthority.projectRules = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build49-decision-engine-guardian-negative/1',
  probes: ['AG470','AG472','AG474','AG475','AG476'],
}, null, 2));
