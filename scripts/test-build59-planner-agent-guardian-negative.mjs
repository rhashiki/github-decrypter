import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const aiPackagePath = 'packages/ai/package.json';
const sourcePath = 'packages/ai/src/planner-agent.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/PLANNER_AGENT.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [aiPackagePath, fs.readFileSync(aiPackagePath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-planner-agent.mjs'], { encoding: 'utf8' });
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
  expectFailure('AG570', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 58;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG571', () => {
    const manifest = JSON.parse(originals.get(aiPackagePath));
    delete manifest.exports['./planner-agent'];
    fs.writeFileSync(aiPackagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  });
  expectFailure('AG572', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('createPlannerAgentBrief(', 'createPlannerAgentBriefBroken('));
  });
  expectFailure('AG573', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('canonicalPlanMaterial(', 'canonicalPlanMaterialBroken('));
  });
  expectFailure('AG574', () => {
    fs.writeFileSync(sourcePath, `${originals.get(sourcePath)}\nfetch('https://example.invalid');\n`);
  });
  expectFailure('AG575', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.plannerAgentAuthority.draftPlanRequired = false;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG576', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.plannerAgentAuthority.agentOrchestratorBuild = 59;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG577', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.agentRuntimeAuthority.agentExecution = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG578', () => {
    fs.writeFileSync(localIndexPath, `${originals.get(localIndexPath)}\nexport * from '@github-decrypter/ai/planner-agent';\n`);
  });
  expectFailure('AG579', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build59-planner-agent-guardian-negative/1',
  probes: ['AG570','AG571','AG572','AG573','AG574','AG575','AG576','AG577','AG578','AG579'],
}, null, 2));
