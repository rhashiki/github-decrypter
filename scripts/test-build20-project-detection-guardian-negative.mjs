import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-project-detection.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Project Detection Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const contractPath = path.join(root, 'packages/workspace/src/index.ts');
const contractOriginal = fs.readFileSync(contractPath, 'utf8');
try {
  fs.writeFileSync(contractPath, contractOriginal.replace("export const PROJECT_DETECTION_SCHEMA = 'gd-project-detection/1' as const;", ''));
  expect('AG181');
} finally { fs.writeFileSync(contractPath, contractOriginal); }

const detectorPath = path.join(root, 'apps/local/src/project-detector.ts');
const detectorOriginal = fs.readFileSync(detectorPath, 'utf8');
try {
  fs.writeFileSync(detectorPath, detectorOriginal.replace('readFileSync', 'writeFileSync'));
  expect('AG183');
} finally { fs.writeFileSync(detectorPath, detectorOriginal); }

try {
  fs.writeFileSync(detectorPath, `${detectorOriginal}\nexport const forbiddenEnumeration = 'readdirSync';\n`);
  expect('AG184');
} finally { fs.writeFileSync(detectorPath, detectorOriginal); }

try {
  fs.writeFileSync(detectorPath, `${detectorOriginal}\nexport const forbiddenNetwork = 'fetch(';\n`);
  expect('AG185');
} finally { fs.writeFileSync(detectorPath, detectorOriginal); }

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const forbiddenProjectDetectionEndpoint = '/v1/project-detection';\n`);
  expect('AG186');
} finally { fs.writeFileSync(serverPath, serverOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.projectDetectionAuthority.readOnly = false;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG189');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Project Detection Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build20-project-detection-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
