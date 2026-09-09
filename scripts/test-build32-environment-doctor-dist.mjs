import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'apps/studio/dist');
const assets = path.join(dist, 'assets');
assert.equal(fs.existsSync(dist), true, 'Studio dist is missing.');
assert.equal(fs.existsSync(assets), true, 'Studio assets directory is missing.');

const jsFiles = fs.readdirSync(assets).filter((name) => name.endsWith('.js')).sort();
const cssFiles = fs.readdirSync(assets).filter((name) => name.endsWith('.css')).sort();
assert.ok(jsFiles.length > 0, 'Vite did not emit Studio JavaScript.');
assert.ok(cssFiles.length > 0, 'Vite did not emit Studio CSS.');

const js = jsFiles.map((name) => fs.readFileSync(path.join(assets, name), 'utf8')).join('\n');
const css = cssFiles.map((name) => fs.readFileSync(path.join(assets, name), 'utf8')).join('\n');
for (const marker of [
  'gd-environment-doctor/1',
  'http://127.0.0.1:43110/v1/environment-doctor',
  'Check Local Runtime',
  'Continue without checking',
  'Environment ready',
  'Environment needs attention',
  'Local Runtime: ',
]) assert.ok(js.includes(marker), `Built JavaScript omitted Environment Doctor marker: ${marker}`);
for (const marker of ['.studio-doctor', '.studio-doctor-grid', '.studio-doctor-actions', '.studio-doctor-check']) {
  assert.ok(css.includes(marker), `Built CSS omitted Environment Doctor marker: ${marker}`);
}

const sw = fs.readFileSync(path.join(dist, 'service-worker.js'), 'utf8');
const cacheMatch = sw.match(/gd-studio-shell-v(\d+)/);
assert.ok(cacheMatch, 'PWA cache marker is missing.');
const cacheBuild = Number(cacheMatch[1]);
const studioPackage = JSON.parse(fs.readFileSync(path.join(root, 'apps/studio/package.json'), 'utf8'));
const studioVersionMatch = String(studioPackage.version ?? '').match(/^0\.0\.(\d+)$/);
assert.ok(studioVersionMatch, `expected pre-V1 Studio version, got ${String(studioPackage.version)}`);
const studioBuild = Number(studioVersionMatch[1]);
assert.ok(cacheBuild >= 32, `PWA cache regressed below Build 32: ${cacheBuild}.`);
assert.equal(cacheBuild, studioBuild, `PWA cache Build ${cacheBuild} must match Studio Build ${studioBuild}.`);
assert.equal(sw.includes('127.0.0.1:43110/v1/environment-doctor'), false, 'Service worker must not own or prefetch the Local Runtime diagnostic endpoint.');
for (const jsFile of jsFiles) assert.ok(sw.includes(`./assets/${jsFile}`), `PWA shell omitted JavaScript asset: ${jsFile}`);
for (const cssFile of cssFiles) assert.ok(sw.includes(`./assets/${cssFile}`), `PWA shell omitted CSS asset: ${cssFile}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build32-environment-doctor-dist/2',
  jsFiles,
  cssFiles,
  doctorBundled: true,
  pwaCacheBuild: cacheBuild,
  studioBuild,
  forwardCompatibleCacheGate: true,
  serviceWorkerOwnsDoctorEndpoint: false,
}, null, 2));
