import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-design-system.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Design System Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.designSystemAuthority.minimumBuild = 30;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG270');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const uiPackagePath = path.join(root, 'packages/ui/package.json');
const uiPackageOriginal = fs.readFileSync(uiPackagePath, 'utf8');
try {
  const pkg = JSON.parse(uiPackageOriginal);
  pkg.version = '0.0.28';
  fs.writeFileSync(uiPackagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  expect('AG271');
} finally { fs.writeFileSync(uiPackagePath, uiPackageOriginal); }

const tokensPath = path.join(root, 'packages/ui/src/tokens.ts');
const tokensOriginal = fs.readFileSync(tokensPath, 'utf8');
try {
  fs.writeFileSync(tokensPath, tokensOriginal.replace("DESIGN_SYSTEM_SCHEMA = 'gd-ui-tokens/1'", "DESIGN_SYSTEM_SCHEMA = 'broken'"));
  expect('AG272');
} finally { fs.writeFileSync(tokensPath, tokensOriginal); }

const cssPath = path.join(root, 'packages/ui/src/styles.css');
const cssOriginal = fs.readFileSync(cssPath, 'utf8');
try {
  fs.writeFileSync(cssPath, `${cssOriginal}\n.studio-sidebar { display: block !important; }\n`);
  expect('AG273');
} finally { fs.writeFileSync(cssPath, cssOriginal); }

const primitivesPath = path.join(root, 'packages/ui/src/primitives.tsx');
const primitivesOriginal = fs.readFileSync(primitivesPath, 'utf8');
try {
  fs.writeFileSync(primitivesPath, `${primitivesOriginal}\nvoid window.location;\n`);
  expect('AG274');
} finally { fs.writeFileSync(primitivesPath, primitivesOriginal); }

const studioPackagePath = path.join(root, 'apps/studio/package.json');
const studioPackageOriginal = fs.readFileSync(studioPackagePath, 'utf8');
try {
  const pkg = JSON.parse(studioPackageOriginal);
  delete pkg.dependencies['@github-decrypter/ui'];
  fs.writeFileSync(studioPackagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  expect('AG275');
} finally { fs.writeFileSync(studioPackagePath, studioPackageOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.designSystemAuthority.ideLayoutAuthority = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG276');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.designSystemAuthority.networkAuthority = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG277');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  const policy = JSON.parse(policyOriginal);
  policy.packageRules['@github-decrypter/ui'].allowedWorkspaceDependencies.push('@github-decrypter/protocol');
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG278');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const docsPath = path.join(root, 'docs/builds/BUILD_29_UNIFIED_DESIGN_SYSTEM.md');
const docsBackup = `${docsPath}.negative`;
try {
  fs.renameSync(docsPath, docsBackup);
  expect('AG279');
} finally {
  if (fs.existsSync(docsBackup)) fs.renameSync(docsBackup, docsPath);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Design System Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build29-design-system-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
