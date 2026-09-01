import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(p, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const runtime = read('diagnostic/minimal-runtime.js');
const settings = read('settings/config.js');

assert.equal(manifest.version, '2.6.80');
assert.match(manifest.version_name, /Build 80 · Diagnostic FAB Injection/);
assert.equal(pkg.candidate, '2.6.80');
assert.ok(settings.includes("VERSION = '2.6.80'"));

assert.ok(!('background' in manifest), 'Build80 must have no service worker/background runtime');
assert.ok(!('permissions' in manifest), 'Build80 must have no general permissions');
assert.ok(!('optional_permissions' in manifest), 'Build80 must have no optional permissions');
assert.ok(!('optional_host_permissions' in manifest), 'Build80 must have no optional host permissions');
assert.deepEqual(manifest.host_permissions, ['https://lovable.dev/*', 'https://*.lovable.dev/*']);

assert.equal(manifest.content_scripts?.length, 1);
const block = manifest.content_scripts[0];
assert.deepEqual(block.js, ['diagnostic/minimal-runtime.js']);
assert.deepEqual(block.matches, ['https://lovable.dev/*', 'https://*.lovable.dev/*']);
assert.equal(block.run_at, 'document_start');
assert.equal(block.all_frames, false);

for (const forbidden of [
  'innerHTML', 'insertAdjacentHTML', 'document.write(',
  'new MutationObserver', '.observe(', 'setInterval(', 'setTimeout(', 'requestAnimationFrame(',
  'chrome.runtime', 'chrome.storage', 'fetch(', 'XMLHttpRequest', 'WebSocket',
  'EventSource', 'BroadcastChannel', 'SharedWorker', 'Worker(',
  'querySelectorAll(', 'getBoundingClientRect(', 'getComputedStyle('
]) {
  assert.ok(!runtime.includes(forbidden), `Build80 diagnostic runtime must not contain ${forbidden}`);
}

for (const required of [
  "document.createElement('div')",
  "document.createElement('button')",
  "document.createElement('style')",
  "attachShadow({ mode: 'open' })",
  "style.textContent =",
  "button.textContent = 'LD'",
  "button.addEventListener('click'",
  "root.appendChild(host)",
  "data-lovable-decrypter-diagnostic",
  "2.6.80-loaded"
]) assert.ok(runtime.includes(required), `missing ${required}`);

assert.match(pkg.notes, /Trusted-Types-safe/);
assert.match(pkg.notes, /Host access is limited explicitly to lovable\.dev/);
assert.match(pkg.notes, /never innerHTML/);
assert.match(pkg.notes, /no background service worker/);

console.log('Build80 Diagnostic FAB Injection contract OK');
