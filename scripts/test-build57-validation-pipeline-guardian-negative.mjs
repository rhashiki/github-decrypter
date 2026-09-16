import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const toolsPackagePath = 'packages/tools/package.json';
const sourcePath = 'packages/tools/src/validation.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/VALIDATION_PIPELINE.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [toolsPackagePath, fs.readFileSync(toolsPackagePath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-validation-pipeline.mjs'], { encoding: 'utf8' });
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
  expectFailure('AG550', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 56;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG551', () => {
    const manifest = JSON.parse(originals.get(toolsPackagePath));
    delete manifest.exports['./validation'];
    fs.writeFileSync(toolsPackagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  });
  expectFailure('AG552', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('createValidation(', 'createValidationBroken('));
  });
  expectFailure('AG553', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('canonicalValidationMaterial(', 'canonicalValidationMaterialBroken('));
  });
  expectFailure('AG554', () => {
    fs.writeFileSync(sourcePath, `${originals.get(sourcePath)}\nfetch('https://example.invalid');\n`);
  });
  expectFailure('AG555', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.validationPipelineAuthority.failClosed = false;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG556', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.validationPipelineAuthority.testingAgentAuthority = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG557', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.checkpointEngineAuthority.validationPipeline = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });
  expectFailure('AG558', () => {
    fs.writeFileSync(localIndexPath, `${originals.get(localIndexPath)}\nexport * from '@github-decrypter/tools/validation';\n`);
  });
  expectFailure('AG559', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build57-validation-pipeline-guardian-negative/1',
  probes: ['AG550','AG551','AG552','AG553','AG554','AG555','AG556','AG557','AG558','AG559'],
}, null, 2));