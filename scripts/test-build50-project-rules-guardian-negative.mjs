import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const sourcePath = 'packages/plan/src/project-rules.ts';
const localIndexPath = 'apps/local/src/index.ts';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-project-rules.mjs'], { encoding: 'utf8' });
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
  expectFailure('AG480', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 49;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG482', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replace('bindProjectRules(', 'bindProjectRulesBroken('));
  });

  expectFailure('AG484', () => {
    fs.writeFileSync(sourcePath, `${originals.get(sourcePath)}\nfetch('https://example.invalid');\n`);
  });

  expectFailure('AG485', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.projectRulesAuthority.semanticInference = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG486', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.projectRulesAuthority.impactSimulation = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG487', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.decisionEngineAuthority.projectRules = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG488', () => {
    fs.writeFileSync(localIndexPath, `${originals.get(localIndexPath)}\nexport * from './project-rules.js';\n`);
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build50-project-rules-guardian-negative/1',
  probes: ['AG480','AG482','AG484','AG485','AG486','AG487','AG488'],
}, null, 2));
