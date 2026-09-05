import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-ide-layout.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `IDE Layout Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.ideLayoutAuthority.minimumBuild = 31;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG280');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const workbenchPath = path.join(root, 'packages/ui/src/workbench.tsx');
const workbenchOriginal = fs.readFileSync(workbenchPath, 'utf8');
try {
  fs.writeFileSync(workbenchPath, workbenchOriginal.replace("IDE_LAYOUT_SCHEMA = 'gd-ide-layout/1'", "IDE_LAYOUT_SCHEMA = 'broken'"));
  expect('AG281');
} finally { fs.writeFileSync(workbenchPath, workbenchOriginal); }

const uiCssPath = path.join(root, 'packages/ui/src/styles.css');
const uiCssOriginal = fs.readFileSync(uiCssPath, 'utf8');
try {
  fs.writeFileSync(uiCssPath, uiCssOriginal.replace('.gd-workbench__status', '.gd-workbench__missing-status'));
  expect('AG282');
} finally { fs.writeFileSync(uiCssPath, uiCssOriginal); }

const appPath = path.join(root, 'apps/studio/src/App.tsx');
const appOriginal = fs.readFileSync(appPath, 'utf8');
try {
  fs.writeFileSync(appPath, appOriginal.replace('<WorkbenchStatusBar', '<div'));
  expect('AG283');
} finally { fs.writeFileSync(appPath, appOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.ideLayoutAuthority.layoutStatePersistence = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG284');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.ideLayoutAuthority.featurePanelsOperational = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG285');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.ideLayoutAuthority.networkAuthority = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG286');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.ideLayoutAuthority.onboardingBuild = 30;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG287');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const studioPackagePath = path.join(root, 'apps/studio/package.json');
const studioPackageOriginal = fs.readFileSync(studioPackagePath, 'utf8');
try {
  const pkg = JSON.parse(studioPackageOriginal);
  pkg.version = '0.0.29';
  fs.writeFileSync(studioPackagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  expect('AG288');
} finally { fs.writeFileSync(studioPackagePath, studioPackageOriginal); }

const docsPath = path.join(root, 'docs/builds/BUILD_30_IDE_LAYOUT.md');
const docsBackup = `${docsPath}.negative`;
try {
  fs.renameSync(docsPath, docsBackup);
  expect('AG289');
} finally {
  if (fs.existsSync(docsBackup)) fs.renameSync(docsBackup, docsPath);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `IDE Layout Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build30-ide-layout-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
