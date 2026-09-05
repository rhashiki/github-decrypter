import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-onboarding.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Onboarding Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.adaptiveProfileAuthority.minimumBuild = 32;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG290');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const profilePath = path.join(root, 'apps/studio/src/onboarding-profile.ts');
const profileOriginal = fs.readFileSync(profilePath, 'utf8');
try {
  fs.writeFileSync(profilePath, profileOriginal.replace("ADAPTIVE_USER_PROFILE_SCHEMA = 'gd-adaptive-user-profile/1'", "ADAPTIVE_USER_PROFILE_SCHEMA = 'broken'"));
  expect('AG291');
} finally { fs.writeFileSync(profilePath, profileOriginal); }

const flowPath = path.join(root, 'apps/studio/src/OnboardingFlow.tsx');
const flowOriginal = fs.readFileSync(flowPath, 'utf8');
try {
  fs.writeFileSync(flowPath, flowOriginal.replace('How much do you want to learn while we build?', 'Removed question'));
  expect('AG292');
} finally { fs.writeFileSync(flowPath, flowOriginal); }

const appPath = path.join(root, 'apps/studio/src/App.tsx');
const appOriginal = fs.readFileSync(appPath, 'utf8');
try {
  fs.writeFileSync(appPath, appOriginal.replace('<OnboardingFlow onComplete={setProfile} />', '<div />'));
  expect('AG293');
} finally { fs.writeFileSync(appPath, appOriginal); }

try {
  fs.writeFileSync(flowPath, `${flowOriginal}\nvoid localStorage.getItem('profile');\n`);
  expect('AG294');
} finally { fs.writeFileSync(flowPath, flowOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.adaptiveProfileAuthority.capabilitySource = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG295');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.adaptiveProfileAuthority.storageAuthority = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG296');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.adaptiveProfileAuthority.mentorEngine = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG297');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const studioPackagePath = path.join(root, 'apps/studio/package.json');
const studioPackageOriginal = fs.readFileSync(studioPackagePath, 'utf8');
try {
  const pkg = JSON.parse(studioPackageOriginal);
  pkg.version = '0.0.30';
  fs.writeFileSync(studioPackagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  expect('AG298');
} finally { fs.writeFileSync(studioPackagePath, studioPackageOriginal); }

const docsPath = path.join(root, 'docs/builds/BUILD_31_ONBOARDING.md');
const docsBackup = `${docsPath}.negative`;
try {
  fs.renameSync(docsPath, docsBackup);
  expect('AG299');
} finally {
  if (fs.existsSync(docsBackup)) fs.renameSync(docsBackup, docsPath);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Onboarding Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build31-onboarding-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
