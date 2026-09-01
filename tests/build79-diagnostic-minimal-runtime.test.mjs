import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(p, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const runtime = read('diagnostic/minimal-runtime.js');
const updater = read('updates/update-manager.js');

assert.equal(manifest.version, '2.6.79');
assert.match(manifest.version_name, /Build 79 · Diagnostic Minimal Runtime/);
assert.equal(pkg.candidate, '2.6.79');

assert.ok(!('background' in manifest), 'Build79 must have no service worker/background runtime');
assert.ok(!('permissions' in manifest), 'Build79 must have no permissions');
assert.ok(!('host_permissions' in manifest), 'Build79 must have no host_permissions');
assert.ok(!('optional_permissions' in manifest), 'Build79 must have no optional_permissions');
assert.ok(!('optional_host_permissions' in manifest), 'Build79 must have no optional_host_permissions');
assert.ok(!('web_accessible_resources' in manifest), 'Build79 must expose no runtime resources');

assert.equal(manifest.content_scripts?.length, 1, 'Build79 must inject exactly one content script block');
const block = manifest.content_scripts[0];
assert.deepEqual(block.js, ['diagnostic/minimal-runtime.js']);
assert.deepEqual(block.matches, ['https://lovable.dev/*', 'https://*.lovable.dev/*']);
assert.equal(block.run_at, 'document_idle');
assert.equal(block.all_frames, false);

for (const forbidden of [
  'new MutationObserver', '.observe(', 'setInterval(', 'setTimeout(', 'requestAnimationFrame(',
  'chrome.runtime', 'chrome.storage', 'fetch(', 'XMLHttpRequest', 'WebSocket',
  'EventSource', 'BroadcastChannel', 'SharedWorker', 'Worker(',
  'querySelectorAll(', 'getBoundingClientRect(', 'getComputedStyle('
]) {
  assert.ok(!runtime.includes(forbidden), `Diagnostic runtime must not contain ${forbidden}`);
}

assert.ok(runtime.includes("attachShadow({ mode: 'open' })"));
assert.ok(runtime.includes("button.addEventListener('click'"));
assert.ok(runtime.includes("document.addEventListener('DOMContentLoaded', mount, { once: true })"));
assert.ok(runtime.includes("document.documentElement.appendChild(host)"));
assert.ok(runtime.includes('Sem service worker · sem rede · sem storage · sem polling · sem MutationObserver'));

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

console.log('Build79 Diagnostic Minimal Runtime contract OK');
