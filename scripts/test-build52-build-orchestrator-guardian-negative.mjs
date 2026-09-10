import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const packagePath = 'packages/build/package.json';
const sourcePath = 'packages/build/src/index.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/BUILD_ORCHESTRATOR.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [packagePath, fs.readFileSync(packagePath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);

function runGuardian() {
  return spawnSync(process.execPath, ['scripts/architecture-guardian-build-orchestrator.mjs'], { encoding: 'utf8' });
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
  expectFailure('AG500', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.currentBuild = 51;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG501', () => {
    const manifest = JSON.parse(originals.get(packagePath));
    manifest.version = '0.0.51';
    fs.writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  });

  expectFailure('AG502', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replace('orchestrateBuild(', 'orchestrateBuildBroken('));
  });

  expectFailure('AG503', () => {
    fs.writeFileSync(sourcePath, originals.get(sourcePath).replaceAll('canonicalOrchestrationMaterial(', 'canonicalOrchestrationMaterialBroken('));
  });

  expectFailure('AG504', () => {
    fs.writeFileSync(sourcePath, `${originals.get(sourcePath)}\nfetch('https://example.invalid');\n`);
  });

  expectFailure('AG505', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.buildOrchestratorAuthority.explicitTransition = false;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG506', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.buildOrchestratorAuthority.toolExecution = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG507', () => {
    const policy = JSON.parse(originals.get(policyPath));
    policy.impactSimulationAuthority.buildOrchestration = true;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  });

  expectFailure('AG508', () => {
    fs.writeFileSync(localIndexPath, `${originals.get(localIndexPath)}\nexport * from '@github-decrypter/build';\n`);
  });

  expectFailure('AG509', () => {
    fs.writeFileSync(architectureDocPath, '# drifted\n');
  });
} finally {
  restore();
}

const final = runGuardian();
assert.equal(final.status, 0, `Guardian did not return green after restoration:\n${final.stdout}\n${final.stderr}`);
console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build52-build-orchestrator-guardian-negative/1',
  probes: ['AG500','AG501','AG502','AG503','AG504','AG505','AG506','AG507','AG508','AG509'],
}, null, 2));
