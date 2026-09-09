import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const sourcePath = 'packages/plan/src/project-rules.ts';
const storePath = 'apps/local/src/project-rules-store.ts';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [storePath, fs.readFileSync(storePath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-project-rules.mjs'], { encoding:'utf8' });
}
function restore() { for (const [path, content] of originals) fs.writeFileSync(path, content); }
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
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replace('PROJECT_RULES_MAX_RULES = 256', 'PROJECT_RULES_MAX_RULES = 255'));
  });
  expectFailure('AG484', () => {
    fs.writeFileSync(storePath, `${originals.get(storePath)}\nvoid ({ enqueue() {} }).enqueue();\n`);
  });
  expectFailure('AG485', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replace('semanticEvaluation: false', 'semanticEvaluation: true'));
  });
  expectFailure('AG486', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.projectRulesAuthority.impactSimulationApplied = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
} finally {
  restore();
}
const final = runGuardian();
assert.equal(final.status, 0, `Project Rules Guardian did not recover after negative probes:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({ ok:true, schema:'gd-build50-project-rules-guardian-negative/1', probes:['AG480','AG482','AG484','AG485','AG486'] }, null, 2));
