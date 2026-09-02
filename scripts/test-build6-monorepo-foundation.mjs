import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const exists = (relative) => fs.existsSync(path.join(root, relative));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));

const expectedApps = ['extension', 'local', 'studio'];
const expectedPackages = ['ai', 'build', 'chat', 'context', 'git', 'plan', 'preview', 'protocol', 'scope', 'shared', 'tools', 'ui', 'workspace'];

for (const file of ['package.json', 'pnpm-workspace.yaml', 'tsconfig.base.json', '.npmrc']) assert.ok(exists(file), `missing monorepo root file: ${file}`);

const rootPackage = json('package.json');
assert.equal(rootPackage.name, 'github-decrypter');
assert.equal(rootPackage.version, '0.0.6');
assert.equal(rootPackage.private, true);
assert.match(String(rootPackage.packageManager || ''), /^pnpm@/);
assert.equal(rootPackage.scripts?.['check:build6'], 'node scripts/test-build6-monorepo-foundation.mjs');
assert.ok(rootPackage.scripts?.typecheck, 'root typecheck command is required');

const workspace = read('pnpm-workspace.yaml');
assert.match(workspace, /apps\/\*/);
assert.match(workspace, /packages\/\*/);

const baseTsconfig = json('tsconfig.base.json');
assert.equal(baseTsconfig.compilerOptions?.strict, true);
assert.equal(baseTsconfig.compilerOptions?.noEmit, true);
assert.equal(baseTsconfig.compilerOptions?.module, 'NodeNext');

const actualApps = fs.readdirSync('apps', { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const actualPackages = fs.readdirSync('packages', { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
assert.deepEqual(actualApps, expectedApps);
assert.deepEqual(actualPackages, expectedPackages);

for (const app of expectedApps) {
  const prefix = `apps/${app}`;
  const manifest = json(`${prefix}/package.json`);
  assert.equal(manifest.name, `@github-decrypter/${app}`);
  assert.equal(manifest.private, true);
  assert.ok(manifest.scripts?.typecheck, `${manifest.name} must expose typecheck`);
  assert.ok(!manifest.dependencies || Object.keys(manifest.dependencies).length === 0, `${manifest.name} must remain dependency-free in Build 6`);
  assert.equal(json(`${prefix}/tsconfig.json`).extends, '../../tsconfig.base.json');
  const source = read(`${prefix}/src/index.ts`);
  assert.match(source, /placeholder/i, `${manifest.name} must remain an explicit placeholder in Build 6`);
  assert.ok(!/from\s+['"]\.\.\/\.\.\/(?:core|background|content|runtime)/.test(source), `${manifest.name} must not bind directly to inherited legacy roots`);
}

for (const pkg of expectedPackages) {
  const prefix = `packages/${pkg}`;
  const manifest = json(`${prefix}/package.json`);
  assert.equal(manifest.name, `@github-decrypter/${pkg}`);
  assert.equal(manifest.private, true);
  assert.equal(manifest.exports, './src/index.ts');
  assert.ok(manifest.scripts?.typecheck, `${manifest.name} must expose typecheck`);
  assert.ok(!manifest.dependencies || Object.keys(manifest.dependencies).length === 0, `${manifest.name} must remain dependency-free in Build 6`);
  assert.equal(json(`${prefix}/tsconfig.json`).extends, '../../tsconfig.base.json');
  assert.match(read(`${prefix}/src/index.ts`), /packageIdentity/);
}

for (const legacyRoot of ['core', 'background', 'content', 'runtime']) assert.ok(exists(legacyRoot), `inherited migration input unexpectedly removed: ${legacyRoot}/`);

for (const prematurePath of ['apps/studio/vite.config.ts', 'apps/studio/src/main.tsx', 'apps/studio/src/App.tsx', 'apps/local/src/daemon.ts', 'apps/extension/src/launcher.ts']) {
  assert.ok(!exists(prematurePath), `Build 6 must not implement later roadmap authority: ${prematurePath}`);
}

const manifest = json('manifest.json');
assert.equal(manifest.name, 'GitHub Decrypter');
assert.ok(!manifest.background);
assert.equal((manifest.content_scripts || []).length, 0);
assert.equal((manifest.host_permissions || []).length, 0);

console.log(JSON.stringify({ ok: true, schema: 'gd-monorepo-foundation/1', apps: expectedApps, packages: expectedPackages, legacyMigrationRootsPreserved: ['core', 'background', 'content', 'runtime'], featureAuthorityIntroduced: false }, null, 2));
