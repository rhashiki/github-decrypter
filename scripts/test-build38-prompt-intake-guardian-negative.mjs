import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-prompt-intake.mjs';
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
  semanticPolicy.promptIntakeAuthority.semanticInterpretation = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(semanticPolicy, null, 2)}\n`);
  runGuardian('AG365');
  fs.writeFileSync(policyPath, originalPolicy);

  fs.writeFileSync(sourcePath, `${originalSource}\nvoid fetch('https://example.invalid');\n`);
  runGuardian('AG364');
  fs.writeFileSync(sourcePath, originalSource);

  fs.writeFileSync(sourcePath, originalSource.replace('createPromptIntakeRecord(', 'createPromptIntakeRecordBroken('));
  runGuardian('AG362');
  fs.writeFileSync(sourcePath, originalSource);

  const ownershipPolicy = JSON.parse(originalPolicy);
  ownershipPolicy.promptIntakeAuthority.requirementCompilerBuild = 38;
  fs.writeFileSync(policyPath, `${JSON.stringify(ownershipPolicy, null, 2)}\n`);
  runGuardian('AG367');
} finally {
  fs.writeFileSync(policyPath, originalPolicy);
  fs.writeFileSync(sourcePath, originalSource);
}

const final = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
assert.equal(final.status, 0, `Guardian did not recover after negative probes:\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build38-prompt-intake-guardian-negative/1',
  probes: ['AG365','AG364','AG362','AG367'],
  restored: true,
}, null, 2));
