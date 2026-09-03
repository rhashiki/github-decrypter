import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const exists = (relative) => fs.existsSync(path.join(root, relative));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));

const expectedApps = ['extension', 'local', 'studio'];
const expectedPackages = ['ai', 'build', 'chat', 'context', 'git', 'plan', 'preview', 'protocol', 'scope', 'shared', 'tools', 'ui', 'workspace'];

for (const file of ['package.json', 'pnpm-workspace.yaml', 'tsconfig.base.json', '.npmrc']) {
  assert.ok(exists(file), `missing monorepo root file: ${file}`);
}

const rootPackage = json('package.json');
assert.equal(rootPackage.name, 'github-decrypter');
assert.equal(rootPackage.private, true);
assert.match(String(rootPackage.packageManager || ''), /^pnpm@/);
assert.equal(rootPackage.scripts?.['check:build6'], 'node scripts/test-build6-monorepo-foundation.mjs');
assert.ok(rootPackage.scripts?.typecheck, 'root typecheck command is required');

const versionMatch = String(rootPackage.version || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
assert.ok(versionMatch, 'root package version must be numeric semver');
const [, majorText, minorText, patchText] = versionMatch;
const versionTuple = [Number(majorText), Number(minorText), Number(patchText)];
const atLeastBuild6 =
  versionTuple[0] > 0 ||
  versionTuple[1] > 0 ||
  versionTuple[2] >= 6;
assert.ok(atLeastBuild6, 'root package version must not regress below 0.0.6');

const workspace = read('pnpm-workspace.yaml');
assert.match(workspace, /apps\/\*/);
assert.match(workspace, /packages\/\*/);

const baseTsconfig = json('tsconfig.base.json');
assert.equal(baseTsconfig.compilerOptions?.strict, true);
assert.equal(baseTsconfig.compilerOptions?.noEmit, true);
assert.equal(baseTsconfig.compilerOptions?.module, 'NodeNext');

const actualApps = fs.readdirSync('apps', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const actualPackages = fs.readdirSync('packages', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const app of expectedApps) {
  assert.ok(actualApps.includes(app), `foundational app boundary missing: ${app}`);
  const prefix = `apps/${app}`;
  const manifest = json(`${prefix}/package.json`);
  assert.equal(manifest.name, `@github-decrypter/${app}`);
  assert.equal(manifest.private, true);
  assert.ok(manifest.scripts?.typecheck, `${manifest.name} must expose typecheck`);
  assert.equal(json(`${prefix}/tsconfig.json`).extends, '../../tsconfig.base.json');
  const source = read(`${prefix}/src/index.ts`);
  assert.ok(
    !/from\s+['"]\.\.\/\.\.\/(?:core|background|content|runtime)/.test(source),
    `${manifest.name} must not bind directly to inherited migration roots`,
  );
}

for (const pkg of expectedPackages) {
  assert.ok(actualPackages.includes(pkg), `foundational package boundary missing: ${pkg}`);
  const prefix = `packages/${pkg}`;
  const manifest = json(`${prefix}/package.json`);
  assert.equal(manifest.name, `@github-decrypter/${pkg}`);
  assert.equal(manifest.private, true);
  assert.equal(manifest.exports, './src/index.ts');
  assert.ok(manifest.scripts?.typecheck, `${manifest.name} must expose typecheck`);
  assert.equal(json(`${prefix}/tsconfig.json`).extends, '../../tsconfig.base.json');
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-monorepo-foundation/2',
  foundationalApps: expectedApps,
  foundationalPackages: expectedPackages,
  allowsRoadmapEvolution: true,
}, null, 2));
