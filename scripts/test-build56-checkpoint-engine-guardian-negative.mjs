import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const toolsPackagePath = 'packages/tools/package.json';
const checkpointSourcePath = 'packages/tools/src/checkpoint.ts';
const toolsSourcePath = 'packages/tools/src/index.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/CHECKPOINT_ENGINE.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [toolsPackagePath, fs.readFileSync(toolsPackagePath, 'utf8')],
  [checkpointSourcePath, fs.readFileSync(checkpointSourcePath, 'utf8')],
  [toolsSourcePath, fs.readFileSync(toolsSourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-checkpoint-engine.mjs'], { encoding: 'utf8' });
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
  expectFailure('AG540', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 55;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG541', () => {
    const manifest = JSON.parse(originals.get(toolsPackagePath));
    delete manifest.exports['./checkpoint'];
    fs.writeFileSync(toolsPackagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  });
  expectFailure('AG542', () => {
    fs.writeFileSync(checkpointSourcePath, originals.get(checkpointSourcePath).replace('createCheckpoint(', 'createCheckpointBroken('));
  });
  expectFailure('AG543', () => {
    fs.writeFileSync(checkpointSourcePath, originals.get(checkpointSourcePath).replaceAll('canonicalCompletionMaterial(', 'canonicalCompletionMaterialBroken('));
  });
  expectFailure('AG544', () => {
    fs.writeFileSync(checkpointSourcePath, `${originals.get(checkpointSourcePath)}\nfetch('https://example.invalid');\n`);
  });
  expectFailure('AG545', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.checkpointEngineAuthority.resultDigestBinding = false;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG546', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.checkpointEngineAuthority.validationPipeline = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG547', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.jobAuthority.minimumBuild = 56;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG548', () => {
    fs.writeFileSync(localIndexPath, `${originals.get(localIndexPath)}\nexport * from '@github-decrypter/tools/checkpoint';\n`);
  });
  expectFailure('AG549', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build56-checkpoint-engine-guardian-negative/1',
  probes: ['AG540','AG541','AG542','AG543','AG544','AG545','AG546','AG547','AG548','AG549'],
}, null, 2));