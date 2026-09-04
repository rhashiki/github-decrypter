import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-studio.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Studio Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const packagePath = path.join(root, 'apps/studio/package.json');
const packageOriginal = fs.readFileSync(packagePath, 'utf8');
try {
  const pkg = JSON.parse(packageOriginal);
  pkg.dependencies.react = '18.3.1';
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  expect('AG251');
} finally { fs.writeFileSync(packagePath, packageOriginal); }

const contextPath = path.join(root, 'apps/studio/src/studio-context.ts');
const contextOriginal = fs.readFileSync(contextPath, 'utf8');
try {
  fs.writeFileSync(contextPath, contextOriginal.replace("allowed = new Set(['owner', 'repo'])", "allowed = new Set(['owner', 'repo', 'token'])"));
  expect('AG253');
} finally { fs.writeFileSync(contextPath, contextOriginal); }

const appPath = path.join(root, 'apps/studio/src/App.tsx');
const appOriginal = fs.readFileSync(appPath, 'utf8');
try {
  fs.writeFileSync(appPath, `${appOriginal}\nvoid fetch('https://example.com');\n`);
  expect('AG255');
} finally { fs.writeFileSync(appPath, appOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.currentBuild = 27;
  policy.studioAuthority.serviceWorker = false;
  policy.studioAuthority.webAppManifest = false;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG256');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.studioAuthority.localRuntimeTransport = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG257');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.appRules['@github-decrypter/studio'].allowedWorkspaceDependencies.push('@github-decrypter/github-provider');
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG258');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const htmlPath = path.join(root, 'apps/studio/index.html');
const htmlBackup = `${htmlPath}.build27-negative`;
try {
  fs.renameSync(htmlPath, htmlBackup);
  expect('AG254');
} finally {
  if (fs.existsSync(htmlBackup)) fs.renameSync(htmlBackup, htmlPath);
}

const docsPath = path.join(root, 'docs/builds/BUILD_27_REACT_STUDIO_FOUNDATION.md');
const docsBackup = `${docsPath}.build27-negative`;
if (fs.existsSync(docsPath)) {
  try {
    fs.renameSync(docsPath, docsBackup);
    expect('AG259');
  } finally {
    if (fs.existsSync(docsBackup)) fs.renameSync(docsBackup, docsPath);
  }
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Studio Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build27-react-studio-guardian-negative/2',
  owningBuild: 27,
  pwaPrematurityStillRejected: true,
  rejected,
  restoredTreePasses: true,
}, null, 2));
