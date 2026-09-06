import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'apps/studio/dist');
const assets = path.join(dist, 'assets');
assert.equal(fs.existsSync(dist), true, 'Studio dist is missing.');
assert.equal(fs.existsSync(assets), true, 'Studio assets directory is missing.');

const studioPackage = JSON.parse(fs.readFileSync(path.join(root, 'apps/studio/package.json'), 'utf8'));
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const studioBuild = Number.parseInt(String(studioPackage.version).split('.')[2] ?? '', 10);
assert.ok(Number.isInteger(studioBuild) && studioBuild >= 30);

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
const boundedLayoutMarkers = [
  'gd-ide-layout/1',
  'Developer Console',
  'Problems & Diagnostics',
  'Code Explorer',
  'Git Panel',
  'data-sidebar-collapsed',
  'data-panel-collapsed',
];
const environmentDoctorActive = policy.currentBuild >= (policy.phaseGates?.environmentDoctorBuild ?? Number.POSITIVE_INFINITY);
if (environmentDoctorActive) boundedLayoutMarkers.push('Environment Doctor', 'Local Runtime: ');
else boundedLayoutMarkers.push('Local Runtime: Not connected');
for (const marker of boundedLayoutMarkers) {
  assert.ok(js.includes(marker), `Built JavaScript omitted bounded layout marker: ${marker}`);
}

const sw = fs.readFileSync(path.join(dist, 'service-worker.js'), 'utf8');
assert.ok(sw.includes(`gd-studio-shell-v${studioBuild}`), `PWA cache did not remain aligned with current Studio Build ${studioBuild}.`);
for (const cssFile of cssFiles) {
  assert.ok(sw.includes(`./assets/${cssFile}`), `PWA shell omitted IDE layout CSS: ${cssFile}`);
}
for (const jsFile of jsFiles) {
  assert.ok(sw.includes(`./assets/${jsFile}`), `PWA shell omitted IDE layout JavaScript: ${jsFile}`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build30-ide-layout-dist/3',
  owningBuild: 30,
  currentBuild: policy.currentBuild,
  studioBuild,
  cssFiles,
  jsFiles,
  workbenchBundled: true,
  sixRegionsBundled: true,
  deferredSurfaceMarkersBundled: true,
  environmentDoctorPhaseAware: true,
  pwaCacheAligned: true,
}, null, 2));
