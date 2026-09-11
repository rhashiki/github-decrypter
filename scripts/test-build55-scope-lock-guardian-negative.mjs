import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const scopePackagePath = 'packages/scope/package.json';
const toolsPackagePath = 'packages/tools/package.json';
const lockSourcePath = 'packages/scope/src/lock.ts';
const toolsSourcePath = 'packages/tools/src/index.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/SCOPE_LOCK.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [scopePackagePath, fs.readFileSync(scopePackagePath, 'utf8')],
  [toolsPackagePath, fs.readFileSync(toolsPackagePath, 'utf8')],
  [lockSourcePath, fs.readFileSync(lockSourcePath, 'utf8')],
  [toolsSourcePath, fs.readFileSync(toolsSourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-scope-lock.mjs'], { encoding: 'utf8' });
}

function restore() {
  for (const [file, content] of originals) fs.writeFileSync(file, content);
}

function expectFailure(code, mutate) {
  restore();
  mutate();
  const result = runGuardian();
  assert.notEqual(result.status, 0, `Guardian unexpectedly passed negative probe ${code}.`);
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(code));
}

try {
  expectFailure('AG530', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 54;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG531', () => {
    const manifest = JSON.parse(originals.get(toolsPackagePath));
    delete manifest.dependencies['@github-decrypter/scope'];
    fs.writeFileSync(toolsPackagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  });

  expectFailure('AG532', () => {
    fs.writeFileSync(lockSourcePath, originals.get(lockSourcePath).replace('lockScope(', 'lockScopeBroken('));
  });

  expectFailure('AG533', () => {
    fs.writeFileSync(lockSourcePath, originals.get(lockSourcePath).replaceAll('canonicalLockMaterial(', 'canonicalLockMaterialBroken('));
  });

  expectFailure('AG534', () => {
    fs.writeFileSync(lockSourcePath, `${originals.get(lockSourcePath)}\nfetch('https://example.invalid');\n`);
  });

  expectFailure('AG535', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.scopeLockAuthority.capabilityGrantAuthority = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG536', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.scopeLockAuthority.checkpoints = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG537', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.toolRuntimeAuthority.capabilityVerifierRequired = false;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG538', () => {
    fs.writeFileSync(localIndexPath, `${originals.get(localIndexPath)}\nexport * from '@github-decrypter/scope/lock';\n`);
  });

  expectFailure('AG539', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build55-scope-lock-guardian-negative/1',
  probes: ['AG530','AG531','AG532','AG533','AG534','AG535','AG536','AG537','AG538','AG539'],
}, null, 2));
