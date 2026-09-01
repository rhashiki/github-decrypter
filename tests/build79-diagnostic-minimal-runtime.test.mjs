import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(p, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const updater = read('updates/update-manager.js');
const currentBuild = Number(String(manifest.version || '').split('.')[2] || 0);

assert.ok(currentBuild >= 79, `Build79 contract requires successor >=79, got ${manifest.version}`);
assert.equal(pkg.candidate, manifest.version);
assert.ok(!('background' in manifest), 'Diagnostic runtime must have no service worker/background runtime');
assert.ok(!('permissions' in manifest), 'Diagnostic runtime must have no general permissions');
assert.ok(!('optional_permissions' in manifest), 'Diagnostic runtime must have no optional permissions');
assert.ok(!('optional_host_permissions' in manifest), 'Diagnostic runtime must have no optional host permissions');
assert.ok(!('web_accessible_resources' in manifest), 'Diagnostic runtime must expose no runtime resources');
assert.equal(manifest.content_scripts?.length, 1, 'Diagnostic runtime must inject exactly one content script block');
assert.deepEqual(manifest.content_scripts[0].js, ['diagnostic/minimal-runtime.js']);
assert.deepEqual(manifest.content_scripts[0].matches, ['https://lovable.dev/*', 'https://*.lovable.dev/*']);
assert.deepEqual(pkg.paths, ['manifest.json','assets','diagnostic','updates/update-manager.js']);
for (const forbiddenRoot of ['background','content','core','settings','storage','tools','ui']) {
  assert.ok(pkg.forbidden_roots.includes(forbiddenRoot), `forbidden root missing: ${forbiddenRoot}`);
}
assert.ok(!pkg.forbidden_roots.includes('diagnostic'));
assert.ok(!manifest.content_scripts[0].js.includes('updates/update-manager.js'));
assert.ok(!updater.includes('import '));
assert.ok(!updater.includes('chrome.'));
assert.ok(!updater.includes('fetch('));
assert.ok(!updater.includes('setInterval('));
assert.ok(!updater.includes('setTimeout('));

console.log(`Build79 Diagnostic Minimal Runtime cumulative contract OK on Build ${currentBuild}`);
