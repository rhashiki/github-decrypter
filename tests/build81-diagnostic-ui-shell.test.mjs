import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const runtime = read('diagnostic/ui-shell-runtime.js');

assert.equal(manifest.version, '2.6.81');
assert.match(manifest.version_name, /Build 81 · Diagnostic UI Shell/);
assert.equal(pkg.candidate, '2.6.81');

assert.ok(!('background' in manifest), 'Build81 must have no service worker/background runtime');
assert.ok(!('permissions' in manifest), 'Build81 must have no general permissions');
assert.ok(!('optional_permissions' in manifest), 'Build81 must have no optional permissions');
assert.ok(!('optional_host_permissions' in manifest), 'Build81 must have no optional host permissions');
assert.deepEqual(manifest.host_permissions, ['https://lovable.dev/*','https://*.lovable.dev/*']);

assert.equal(manifest.content_scripts?.length, 1, 'Build81 must inject exactly one content-script block');
const block = manifest.content_scripts[0];
assert.deepEqual(block.js, ['diagnostic/ui-shell-runtime.js']);
assert.deepEqual(block.matches, ['https://lovable.dev/*','https://*.lovable.dev/*']);
assert.equal(block.run_at, 'document_start');
assert.equal(block.all_frames, false);

assert.equal(manifest.web_accessible_resources?.length, 1);
assert.deepEqual(manifest.web_accessible_resources[0].resources, ['assets/fab.png']);

for (const forbidden of [
  'new MutationObserver', '.observe(', 'setInterval(', 'setTimeout(', 'requestAnimationFrame(',
  'chrome.storage', 'chrome.runtime.sendMessage', 'chrome.runtime.connect', 'chrome.runtime.onMessage',
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'BroadcastChannel', 'SharedWorker', 'Worker(',
  'querySelectorAll(', 'getBoundingClientRect(', 'getComputedStyle(', '.innerHTML', '.outerHTML', 'insertAdjacentHTML('
]) {
  assert.ok(!runtime.includes(forbidden), `Build81 runtime must not contain ${forbidden}`);
}

assert.ok(runtime.includes("chrome.runtime.getURL('assets/fab.png')"));
assert.ok(runtime.includes("attachShadow({ mode: 'open' })"));
assert.ok(runtime.includes("fab.addEventListener('click'"));
assert.ok(runtime.includes("close.addEventListener('click'"));
assert.ok(runtime.includes('LOVABLE DECRYPTER'));
assert.ok(runtime.includes('Chat IA'));
assert.ok(runtime.includes('GitHub'));
assert.ok(runtime.includes('Migrations'));
assert.ok(runtime.includes('Diagnóstico'));
assert.ok(runtime.includes('Execução temporariamente isolada'));
assert.ok(runtime.includes('Sem observers, timers, storage, rede ou service worker'));

assert.deepEqual(pkg.paths, ['manifest.json','assets','diagnostic','updates/update-manager.js']);
for (const forbiddenRoot of ['background','content','core','settings','storage','tools','ui']) {
  assert.ok(pkg.forbidden_roots.includes(forbiddenRoot), `forbidden root missing: ${forbiddenRoot}`);
}
assert.ok(!pkg.forbidden_roots.includes('diagnostic'));

console.log('Build81 Diagnostic UI Shell contract OK');
