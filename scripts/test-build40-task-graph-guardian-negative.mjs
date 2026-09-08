import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-task-graph.mjs';
const policyPath = 'architecture.guardian.json';
const sourcePath = 'packages/plan/src/task-graph.ts';
const originalPolicy = fs.readFileSync(policyPath, 'utf8');
const originalSource = fs.readFileSync(sourcePath, 'utf8');

function runGuardian(expectedCode) {
  const result = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Guardian unexpectedly accepted negative probe ${expectedCode}.`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, new RegExp(expectedCode), `Expected ${expectedCode} in Guardian output.`);
}

try {
  const inferencePolicy = JSON.parse(originalPolicy);
  inferencePolicy.taskGraphCompilerAuthority.dependencyInference = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(inferencePolicy, null, 2)}\n`);
  runGuardian('AG383');
  fs.writeFileSync(policyPath, originalPolicy);

  fs.writeFileSync(sourcePath, `${originalSource}\nvoid fetch('https://example.invalid');\n`);
  runGuardian('AG384');
  fs.writeFileSync(sourcePath, originalSource);

  fs.writeFileSync(sourcePath, originalSource.replace('compileTaskGraph(', 'compileTaskGraphBroken('));
  runGuardian('AG382');
  fs.writeFileSync(sourcePath, originalSource);

  const ownershipPolicy = JSON.parse(originalPolicy);
  ownershipPolicy.taskGraphCompilerAuthority.hierarchicalContextBuild = 40;
  fs.writeFileSync(policyPath, `${JSON.stringify(ownershipPolicy, null, 2)}\n`);
  runGuardian('AG387');
} finally {
  fs.writeFileSync(policyPath, originalPolicy);
  fs.writeFileSync(sourcePath, originalSource);
}

const final = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
assert.equal(final.status, 0, `Guardian did not recover after negative probes:\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build40-task-graph-guardian-negative/1',
  probes: ['AG383','AG384','AG382','AG387'],
  restored: true,
}, null, 2));
