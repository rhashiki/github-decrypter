import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const packagePath = 'packages/scope/package.json';
const sourcePath = 'packages/scope/src/index.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/SCOPE_INTELLIGENCE.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [packagePath, fs.readFileSync(packagePath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-scope-intelligence.mjs'], { encoding: 'utf8' });
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
  expectFailure('AG520', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 53;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG521', () => {
    const manifest = JSON.parse(originals.get(packagePath));
    manifest.version = '0.0.53';
    fs.writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  });

  expectFailure('AG522', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replace('analyzeScope(', 'analyzeScopeBroken('));
  });

  expectFailure('AG523', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('canonicalScopeMaterial(', 'canonicalScopeMaterialBroken('));
  });

  expectFailure('AG524', () => {
    fs.writeFileSync(sourcePath, `${originals.get(sourcePath)}\nfetch('https://example.invalid');\n`);
  });

  expectFailure('AG525', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.scopeIntelligenceAuthority.advisoryOnly = false;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG526', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.scopeIntelligenceAuthority.scopeLock = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG527', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.toolRuntimeAuthority.mutationAuthorized = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG528', () => {
    fs.writeFileSync(localIndexPath, `${originals.get(localIndexPath)}\nexport * from '@github-decrypter/scope';\n`);
  });

  expectFailure('AG529', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build54-scope-intelligence-guardian-negative/1',
  probes: ['AG520','AG521','AG522','AG523','AG524','AG525','AG526','AG527','AG528','AG529'],
}, null, 2));
