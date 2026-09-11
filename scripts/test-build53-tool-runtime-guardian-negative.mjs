import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const packagePath = 'packages/tools/package.json';
const sourcePath = 'packages/tools/src/index.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/TOOL_RUNTIME.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [packagePath, fs.readFileSync(packagePath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-tool-runtime.mjs'], { encoding: 'utf8' });
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
  expectFailure('AG510', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 52;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG511', () => {
    const manifest = JSON.parse(originals.get(packagePath));
    manifest.version = '0.0.52';
    fs.writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  });

  expectFailure('AG512', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replace('createToolRuntime(', 'createToolRuntimeBroken('));
  });

  expectFailure('AG513', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('canonicalInvocationMaterial(', 'canonicalInvocationMaterialBroken('));
  });

  expectFailure('AG514', () => {
    fs.writeFileSync(sourcePath, `${originals.get(sourcePath)}\nfetch('https://example.invalid');\n`);
  });

  expectFailure('AG515', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.toolRuntimeAuthority.capabilityVerifierRequired = false;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG516', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.toolRuntimeAuthority.scopeLock = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG517', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.buildOrchestratorAuthority.toolExecution = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG518', () => {
    fs.writeFileSync(localIndexPath, `${originals.get(localIndexPath)}\nexport * from '@github-decrypter/tools';\n`);
  });

  expectFailure('AG519', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build53-tool-runtime-guardian-negative/1',
  probes: ['AG510','AG511','AG512','AG513','AG514','AG515','AG516','AG517','AG518','AG519'],
}, null, 2));
