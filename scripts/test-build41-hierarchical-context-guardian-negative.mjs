import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-hierarchical-context.mjs';
const policyPath = 'architecture.guardian.json';
const sourcePath = 'packages/context/src/index.ts';
const originalPolicy = fs.readFileSync(policyPath, 'utf8');
const originalSource = fs.readFileSync(sourcePath, 'utf8');

function runGuardian(expectedCode) {
  const result = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Guardian unexpectedly accepted negative probe ${expectedCode}.`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, new RegExp(expectedCode), `Expected ${expectedCode} in Guardian output.`);
}

try {
  const structuralPolicy = JSON.parse(originalPolicy);
  structuralPolicy.hierarchicalContextAuthority.dependencyAware = false;
  fs.writeFileSync(policyPath, `${JSON.stringify(structuralPolicy, null, 2)}\n`);
  runGuardian('AG393');
  fs.writeFileSync(policyPath, originalPolicy);

  fs.writeFileSync(sourcePath, `${originalSource}\nvoid fetch('https://example.invalid');\n`);
  runGuardian('AG394');
  fs.writeFileSync(sourcePath, originalSource);

  fs.writeFileSync(sourcePath, originalSource.replace('buildHierarchicalContext(', 'buildHierarchicalContextBroken('));
  runGuardian('AG392');
  fs.writeFileSync(sourcePath, originalSource);

  const ownershipPolicy = JSON.parse(originalPolicy);
  ownershipPolicy.hierarchicalContextAuthority.contextContinuationBuild = 41;
  fs.writeFileSync(policyPath, `${JSON.stringify(ownershipPolicy, null, 2)}\n`);
  runGuardian('AG397');
} finally {
  fs.writeFileSync(policyPath, originalPolicy);
  fs.writeFileSync(sourcePath, originalSource);
}

const final = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
assert.equal(final.status, 0, `Guardian did not recover after negative probes:\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build41-hierarchical-context-guardian-negative/1',
  probes: ['AG393','AG394','AG392','AG397'],
  restored: true,
}, null, 2));
