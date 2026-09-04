import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-repository-launcher.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Repository Launcher Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const contentPath = path.join(root, 'apps/extension/browser/content-script.js');
const contentOriginal = fs.readFileSync(contentPath, 'utf8');
try {
  fs.writeFileSync(contentPath, contentOriginal.replace("nwo[1] !== segments[1]", 'false'));
  expect('AG243');
} finally { fs.writeFileSync(contentPath, contentOriginal); }

try {
  fs.writeFileSync(contentPath, `${contentOriginal}\nvoid location.search;\n`);
  expect('AG243');
} finally { fs.writeFileSync(contentPath, contentOriginal); }

try {
  fs.writeFileSync(contentPath, contentOriginal.replace("button.textContent = 'GD';", "button.innerHTML = '<b>GD</b>';"));
  expect('AG244');
} finally { fs.writeFileSync(contentPath, contentOriginal); }

const workerPath = path.join(root, 'apps/extension/browser/service-worker.js');
const workerOriginal = fs.readFileSync(workerPath, 'utf8');
try {
  fs.writeFileSync(workerPath, workerOriginal.replace(
    'void chrome.tabs.create({ url: target.toString() });',
    "void chrome.tabs.create({ url: 'https://example.com/' });",
  ));
  expect('AG245');
} finally { fs.writeFileSync(workerPath, workerOriginal); }

const launcherPath = path.join(root, 'apps/extension/browser/launcher.js');
const launcherOriginal = fs.readFileSync(launcherPath, 'utf8');
try {
  fs.writeFileSync(launcherPath, `${launcherOriginal}\nfetch('https://example.com');\n`);
  expect('AG246');
} finally { fs.writeFileSync(launcherPath, launcherOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.extensionAuthority.studioLaunch = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG248');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const launcherHtml = path.join(root, 'apps/extension/browser/launcher.html');
const launcherBackup = `${launcherHtml}.build26-negative`;
try {
  fs.renameSync(launcherHtml, launcherBackup);
  expect('AG249');
} finally {
  if (fs.existsSync(launcherBackup)) fs.renameSync(launcherBackup, launcherHtml);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Repository Launcher Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build26-repository-launcher-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
