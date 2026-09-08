import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-context-continuation.mjs';
const policyPath = 'architecture.guardian.json';
const sourcePath = 'packages/context/src/continuation.ts';
const originalPolicy = fs.readFileSync(policyPath, 'utf8');
const originalSource = fs.readFileSync(sourcePath, 'utf8');

function runGuardian(expectedCode) {
  const result = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Guardian unexpectedly accepted negative probe ${expectedCode}.`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, new RegExp(expectedCode), `Expected ${expectedCode} in Guardian output.`);
}

try {
  const tokenPolicy = JSON.parse(originalPolicy);
  tokenPolicy.contextContinuationAuthority.tokenAbstraction = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(tokenPolicy, null, 2)}\n`);
  runGuardian('AG405');
  fs.writeFileSync(policyPath, originalPolicy);

  fs.writeFileSync(sourcePath, `${originalSource}\nvoid fetch('https://example.invalid');\n`);
  runGuardian('AG404');
  fs.writeFileSync(sourcePath, originalSource);

  fs.writeFileSync(sourcePath, originalSource.replace('compileContextContinuation(', 'compileContextContinuationBroken('));
  runGuardian('AG402');
  fs.writeFileSync(sourcePath, originalSource);

  const sourcePolicy = JSON.parse(originalPolicy);
  sourcePolicy.contextContinuationAuthority.hierarchicalContextBuild = 42;
  fs.writeFileSync(policyPath, `${JSON.stringify(sourcePolicy, null, 2)}\n`);
  runGuardian('AG403');
  fs.writeFileSync(policyPath, originalPolicy);

  const downstreamPolicy = JSON.parse(originalPolicy);
  downstreamPolicy.contextContinuationAuthority.tokenAbstractionBuild = 42;
  fs.writeFileSync(policyPath, `${JSON.stringify(downstreamPolicy, null, 2)}\n`);
  runGuardian('AG407');
} finally {
  fs.writeFileSync(policyPath, originalPolicy);
  fs.writeFileSync(sourcePath, originalSource);
}

const final = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
assert.equal(final.status, 0, `Guardian did not recover after negative probes:\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build42-context-continuation-guardian-negative/1',
  probes: ['AG405','AG404','AG402','AG403','AG407'],
  restored: true,
}, null, 2));
