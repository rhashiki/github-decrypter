import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-environment-doctor.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Environment Doctor Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.environmentDoctorAuthority.minimumBuild = 33;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG300');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const contractPath = path.join(root, 'packages/protocol/src/environment-doctor.ts');
const contractOriginal = fs.readFileSync(contractPath, 'utf8');
try {
  fs.writeFileSync(contractPath, contractOriginal.replace("ENVIRONMENT_DOCTOR_SCHEMA = 'gd-environment-doctor/1'", "ENVIRONMENT_DOCTOR_SCHEMA = 'broken'"));
  expect('AG301');
} finally { fs.writeFileSync(contractPath, contractOriginal); }

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, serverOriginal.replace("url.pathname === '/v1/environment-doctor'", "url.pathname === '/v1/broken-doctor'"));
  expect('AG302');
} finally { fs.writeFileSync(serverPath, serverOriginal); }

const clientPath = path.join(root, 'apps/studio/src/environment-doctor-client.ts');
const clientOriginal = fs.readFileSync(clientPath, 'utf8');
try {
  fs.writeFileSync(clientPath, clientOriginal.replace('http://127.0.0.1:43110/v1/environment-doctor', 'https://example.invalid/environment-doctor'));
  expect('AG303');
} finally { fs.writeFileSync(clientPath, clientOriginal); }

const appPath = path.join(root, 'apps/studio/src/App.tsx');
const appOriginal = fs.readFileSync(appPath, 'utf8');
try {
  const doctorJsx = '<EnvironmentDoctor\n              onOutcome={setEnvironmentDoctorOutcome}';
  assert.ok(appOriginal.includes(doctorJsx), 'AG304 probe precondition failed: Environment Doctor JSX marker is missing.');
  const mutatedApp = appOriginal.replace(doctorJsx, '<div\n              onOutcome={setEnvironmentDoctorOutcome}');
  assert.equal(mutatedApp.includes(doctorJsx), false, 'AG304 probe did not remove the Environment Doctor JSX marker.');
  fs.writeFileSync(appPath, mutatedApp);
  expect('AG304');
} finally { fs.writeFileSync(appPath, appOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.environmentDoctorAuthority.autoRepair = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG305');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.appRules['@github-decrypter/studio'].sourcePatternExceptions['\\bfetch\\s*\\('].push('apps/studio/src/App.tsx');
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG306');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.environmentDoctorAuthority.aiExecution = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG307');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const studioPackagePath = path.join(root, 'apps/studio/package.json');
const studioPackageOriginal = fs.readFileSync(studioPackagePath, 'utf8');
try {
  const pkg = JSON.parse(studioPackageOriginal);
  pkg.version = '0.0.31';
  fs.writeFileSync(studioPackagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  expect('AG308');
} finally { fs.writeFileSync(studioPackagePath, studioPackageOriginal); }

const docsPath = path.join(root, 'docs/builds/BUILD_32_ENVIRONMENT_DOCTOR.md');
const docsBackup = `${docsPath}.negative`;
try {
  fs.renameSync(docsPath, docsBackup);
  expect('AG309');
} finally {
  if (fs.existsSync(docsBackup)) fs.renameSync(docsBackup, docsPath);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Environment Doctor Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build32-environment-doctor-guardian-negative/2',
  rejected,
  deterministicAg304Probe: true,
  restoredTreePasses: true,
}, null, 2));
