import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-extension.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Extension Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const manifestPath = path.join(root, 'manifest.json');
const manifestOriginal = fs.readFileSync(manifestPath, 'utf8');
try {
  const manifest = JSON.parse(manifestOriginal);
  manifest.host_permissions.push('https://example.com/*');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  expect('AG231');
} finally { fs.writeFileSync(manifestPath, manifestOriginal); }

const contentPath = path.join(root, 'apps/extension/browser/content-script.js');
const contentOriginal = fs.readFileSync(contentPath, 'utf8');
try {
  fs.writeFileSync(contentPath, `${contentOriginal}\nfetch('https://github.com');\n`);
  expect('AG233');
} finally { fs.writeFileSync(contentPath, contentOriginal); }

const workerPath = path.join(root, 'apps/extension/browser/service-worker.js');
const workerOriginal = fs.readFileSync(workerPath, 'utf8');
try {
  fs.writeFileSync(workerPath, workerOriginal.replace('sender.id !== chrome.runtime.id', 'false'));
  expect('AG235');
} finally { fs.writeFileSync(workerPath, workerOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.extensionAuthority.networkAuthority = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG238');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Extension Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build25-extension-guardian-negative/2',
  currentPhaseAware: true,
  rejected,
  restoredTreePasses: true,
}, null, 2));
