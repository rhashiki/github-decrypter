import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-requirement-compiler.mjs';
const policyPath = 'architecture.guardian.json';
const sourcePath = 'packages/plan/src/index.ts';
const originalPolicy = fs.readFileSync(policyPath, 'utf8');
const originalSource = fs.readFileSync(sourcePath, 'utf8');

function runGuardian(expectedCode) {
  const result = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Guardian unexpectedly accepted negative probe ${expectedCode}.`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, new RegExp(expectedCode), `Expected ${expectedCode} in Guardian output.`);
}

try {
  const semanticPolicy = JSON.parse(originalPolicy);
  semanticPolicy.requirementCompilerAuthority.semanticInterpretation = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(semanticPolicy, null, 2)}\n`);
  runGuardian('AG375');
  fs.writeFileSync(policyPath, originalPolicy);

  fs.writeFileSync(sourcePath, `${originalSource}\nvoid fetch('https://example.invalid');\n`);
  runGuardian('AG374');
  fs.writeFileSync(sourcePath, originalSource);

  fs.writeFileSync(sourcePath, originalSource.replace('compileRequirements(', 'compileRequirementsBroken('));
  runGuardian('AG372');
  fs.writeFileSync(sourcePath, originalSource);

  const digestPolicy = JSON.parse(originalPolicy);
  digestPolicy.requirementCompilerAuthority.sourceDigestBinding = 'none';
  fs.writeFileSync(policyPath, `${JSON.stringify(digestPolicy, null, 2)}\n`);
  runGuardian('AG373');
  fs.writeFileSync(policyPath, originalPolicy);

  const ownershipPolicy = JSON.parse(originalPolicy);
  ownershipPolicy.requirementCompilerAuthority.taskGraphCompilerBuild = 39;
  fs.writeFileSync(policyPath, `${JSON.stringify(ownershipPolicy, null, 2)}\n`);
  runGuardian('AG377');
} finally {
  fs.writeFileSync(policyPath, originalPolicy);
  fs.writeFileSync(sourcePath, originalSource);
}

const final = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
assert.equal(final.status, 0, `Guardian did not recover after negative probes:\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build39-requirement-compiler-guardian-negative/1',
  probes: ['AG375','AG374','AG372','AG373','AG377'],
  restored: true,
}, null, 2));
