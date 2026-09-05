import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'apps/studio/dist');
const assets = path.join(dist, 'assets');
assert.equal(fs.existsSync(dist), true, 'Studio dist is missing.');
assert.equal(fs.existsSync(assets), true, 'Studio assets directory is missing.');

const cssFiles = fs.readdirSync(assets).filter((name) => name.endsWith('.css')).sort();
assert.ok(cssFiles.length > 0, 'Vite did not emit Studio CSS.');
const css = cssFiles.map((name) => fs.readFileSync(path.join(assets, name), 'utf8')).join('\n');

for (const marker of [
  '.gd-workbench',
  '.gd-workbench__topbar',
  '.gd-workbench__activity',
  '.gd-workbench__sidebar',
  '.gd-workbench__editor',
  '.gd-workbench__panel',
  '.gd-workbench__status',
  '.studio-topbar',
  '.studio-activity',
  '.studio-sidebar',
  '.studio-editor',
  '.studio-panel',
  '.studio-statusbar',
]) assert.ok(css.includes(marker), `Built CSS omitted IDE layout marker: ${marker}`);

const jsFiles = fs.readdirSync(assets).filter((name) => name.endsWith('.js')).sort();
assert.ok(jsFiles.length > 0, 'Vite did not emit Studio JavaScript.');
const js = jsFiles.map((name) => fs.readFileSync(path.join(assets, name), 'utf8')).join('\n');
for (const marker of [
  'gd-ide-layout/1',
  'Developer Console',
  'Problems & Diagnostics',
  'Code Explorer',
  'Git Panel',
  'Layout state: memory only',
  'Local Runtime: Not connected',
]) assert.ok(js.includes(marker), `Built JavaScript omitted bounded layout marker: ${marker}`);

const sw = fs.readFileSync(path.join(dist, 'service-worker.js'), 'utf8');
assert.ok(sw.includes('gd-studio-shell-v30'), 'PWA cache did not advance to Build 30.');
for (const cssFile of cssFiles) {
  assert.ok(sw.includes(`./assets/${cssFile}`), `PWA shell omitted IDE layout CSS: ${cssFile}`);
}
for (const jsFile of jsFiles) {
  assert.ok(sw.includes(`./assets/${jsFile}`), `PWA shell omitted IDE layout JavaScript: ${jsFile}`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build30-ide-layout-dist/1',
  cssFiles,
  jsFiles,
  workbenchBundled: true,
  sixRegionsBundled: true,
  deferredSurfaceMarkersBundled: true,
  pwaCacheBuild: 30,
}, null, 2));
