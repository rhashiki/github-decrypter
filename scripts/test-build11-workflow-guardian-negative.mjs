import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-workflow-write.mjs');
const workflow = path.join(root, '.github/workflows/cortex.yml');
const original = fs.readFileSync(workflow, 'utf8');

function runExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Workflow Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code} was not reported.\n${result.stdout}\n${result.stderr}`);
}

try {
  const broadenedStage = original.replace('git add graphify-out', 'git add .');
  assert.notEqual(broadenedStage, original);
  fs.writeFileSync(workflow, broadenedStage);
  runExpecting('AG078');
} finally {
  fs.writeFileSync(workflow, original);
}

try {
  const tagPush = original.replace('git push\n', 'git push --tags\n');
  assert.notEqual(tagPush, original);
  fs.writeFileSync(workflow, tagPush);
  runExpecting('AG079');
} finally {
  fs.writeFileSync(workflow, original);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Workflow Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build11-workflow-guardian-negative/1',
  workflow: '.github/workflows/cortex.yml',
  allowedWritePath: 'graphify-out/**',
  rejected: ['AG078', 'AG079'],
  releaseAuthority: false,
  restoredTreePasses: true,
}, null, 2));
