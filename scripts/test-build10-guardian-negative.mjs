import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-apps.mjs');

function runExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `App Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `App Guardian did not report ${code}.\n${result.stdout}\n${result.stderr}`);
}

const browserProbe = path.join(root, 'apps/local/src/__guardian_browser_probe.ts');
try {
  fs.writeFileSync(browserProbe, 'export const browserLeak = window.location.href;\n');
  runExpecting('AG035');
} finally {
  fs.rmSync(browserProbe, { force: true });
}

const manifestPath = path.join(root, 'apps/local/package.json');
const originalManifest = fs.readFileSync(manifestPath, 'utf8');
try {
  const manifest = JSON.parse(originalManifest);
  manifest.dependencies['@github-decrypter/tools'] = 'workspace:*';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  runExpecting('AG033');
} finally {
  fs.writeFileSync(manifestPath, originalManifest);
}

try {
  const manifest = JSON.parse(originalManifest);
  manifest.dependencies.express = '^5.0.0';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  runExpecting('AG034');
} finally {
  fs.writeFileSync(manifestPath, originalManifest);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `App Guardian did not recover after probes.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build10-guardian-negative/1',
  rejected: ['AG035', 'AG033', 'AG034'],
  restoredTreePasses: true,
}, null, 2));
