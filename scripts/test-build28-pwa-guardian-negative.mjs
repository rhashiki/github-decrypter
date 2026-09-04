import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-pwa.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `PWA Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const manifestPath = path.join(root, 'apps/studio/public/manifest.webmanifest');
const manifestOriginal = fs.readFileSync(manifestPath, 'utf8');
try {
  const manifest = JSON.parse(manifestOriginal);
  manifest.start_url = 'https://example.com/';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  expect('AG261');
} finally { fs.writeFileSync(manifestPath, manifestOriginal); }

const pwaPath = path.join(root, 'apps/studio/src/pwa.ts');
const pwaOriginal = fs.readFileSync(pwaPath, 'utf8');
try {
  fs.writeFileSync(pwaPath, pwaOriginal.replace("STUDIO_PWA_SCOPE = './'", "STUDIO_PWA_SCOPE = '../'"));
  expect('AG262');
} finally { fs.writeFileSync(pwaPath, pwaOriginal); }

const vitePath = path.join(root, 'apps/studio/vite.config.ts');
const viteOriginal = fs.readFileSync(vitePath, 'utf8');
try {
  fs.writeFileSync(vitePath, viteOriginal.replace("PWA_CACHE_PREFIX = 'gd-studio-shell-'", "PWA_CACHE_PREFIX = 'unsafe-shell-'"));
  expect('AG263');
} finally { fs.writeFileSync(vitePath, viteOriginal); }

try {
  fs.writeFileSync(vitePath, viteOriginal.replace('requestUrl.origin !== self.location.origin', 'false'));
  expect('AG264');
} finally { fs.writeFileSync(vitePath, viteOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.studioAuthority.projectDataPersistence = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG265');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.studioAuthority.productionPackaging = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG266');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const packagePath = path.join(root, 'apps/studio/package.json');
const packageOriginal = fs.readFileSync(packagePath, 'utf8');
try {
  const pkg = JSON.parse(packageOriginal);
  pkg.devDependencies['vite-plugin-pwa'] = '1.0.0';
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  expect('AG267');
} finally { fs.writeFileSync(packagePath, packageOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.studioAuthority.designSystemBuild = 28;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG268');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const docsPath = path.join(root, 'docs/builds/BUILD_28_PWA.md');
const docsBackup = `${docsPath}.negative`;
try {
  fs.renameSync(docsPath, docsBackup);
  expect('AG269');
} finally {
  if (fs.existsSync(docsBackup)) fs.renameSync(docsBackup, docsPath);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `PWA Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build28-pwa-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
