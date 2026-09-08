import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-token-abstraction.mjs';
const policyPath = 'architecture.guardian.json';
const sourcePath = 'packages/context/src/token-abstraction.ts';
const originalPolicy = fs.readFileSync(policyPath, 'utf8');
const originalSource = fs.readFileSync(sourcePath, 'utf8');

function runGuardian(expectedCode) {
  const result = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Guardian unexpectedly accepted negative probe ${expectedCode}.`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, new RegExp(expectedCode), `Expected ${expectedCode} in Guardian output.`);
}

try {
  const tokenizerPolicy = JSON.parse(originalPolicy);
  tokenizerPolicy.tokenAbstractionAuthority.tokenizerExecution = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(tokenizerPolicy, null, 2)}\n`);
  runGuardian('AG415');
  fs.writeFileSync(policyPath, originalPolicy);

  fs.writeFileSync(sourcePath, `${originalSource}\nvoid fetch('https://example.invalid');\n`);
  runGuardian('AG414');
  fs.writeFileSync(sourcePath, originalSource);

  fs.writeFileSync(sourcePath, originalSource.replace('abstractTokenWindow(', 'abstractTokenWindowBroken('));
  runGuardian('AG412');
  fs.writeFileSync(sourcePath, originalSource);

  const sourcePolicy = JSON.parse(originalPolicy);
  sourcePolicy.tokenAbstractionAuthority.contextContinuationBuild = 43;
  fs.writeFileSync(policyPath, `${JSON.stringify(sourcePolicy, null, 2)}\n`);
  runGuardian('AG413');
  fs.writeFileSync(policyPath, originalPolicy);

  const downstreamPolicy = JSON.parse(originalPolicy);
  downstreamPolicy.tokenAbstractionAuthority.conversationEngineBuild = 43;
  fs.writeFileSync(policyPath, `${JSON.stringify(downstreamPolicy, null, 2)}\n`);
  runGuardian('AG417');
} finally {
  fs.writeFileSync(policyPath, originalPolicy);
  fs.writeFileSync(sourcePath, originalSource);
}

const final = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
assert.equal(final.status, 0, `Guardian did not recover after negative probes:\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build43-token-abstraction-guardian-negative/1',
  probes: ['AG415','AG414','AG412','AG413','AG417'],
  restored: true,
}, null, 2));
