import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('release/runtime-package.json', 'utf8'));
const settings = fs.readFileSync('settings/config.js', 'utf8');
const content = fs.readFileSync('content/content.js', 'utf8');
const app = manifest.content_scripts.find(item => Array.isArray(item.js) && item.js.includes('ui/ui-kernel-v48.js'));
const parts = value => String(value).split('.').map(Number);
const atLeast = (value, floor) => {
  const a = parts(value), b = parts(floor);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return true;
};

assert.ok(atLeast(manifest.version, '2.5.56'), `unexpected successor version ${manifest.version}`);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));
assert.ok(app, 'authoritative UI runtime missing');

const purged = [
  'ui/voice-feedback.js',
  'ui/unified-launcher.js',
  'ui/launcher-rail-v3.js',
  'ui/premium-engineering-ux.js',
  'ui/premium-project-tools.js',
  'ui/unified-launcher.css',
  'ui/unified-launcher-status.css',
  'ui/premium-engineering-ux.css',
  'ui/premium-project-tools.css',
  'ui/nexus-parity-v47.css'
];
for (const path of purged) {
  assert.equal(fs.existsSync(path), false, `purged artifact still exists: ${path}`);
  assert.equal(app.js.includes(path), false, `purged JS still referenced: ${path}`);
  assert.equal((app.css || []).includes(path), false, `purged CSS still referenced: ${path}`);
}

for (const required of [
  'ui/ui-kernel-v48.js',
  'ui/integrations-v49.js',
  'ui/project-intelligence-v50.js',
  'ui/engineering-suite-v51.js',
  'ui/project-tools-v52.js',
  'ui/settings-v53.js',
  'ui/update-center-v54.js',
  'ui/backend-messaging-v55.js',
  'ui/chat-activation-premium-v45.js',
  'ui/lightweight-runtime-delivery.js'
]) assert.ok(app.js.includes(required), `required successor missing: ${required}`);

assert.ok(!/setInterval\s*\(/.test(content), 'permanent project polling must be removed');
assert.ok(content.includes("window.navigation?.addEventListener?.('navigate', scheduleAnnounce)"), 'event-driven SPA navigation detection missing');
for (const event of ['popstate','hashchange','pageshow','focus'])
  assert.ok(content.includes(`addEventListener('${event}', scheduleAnnounce)`), `navigation event missing: ${event}`);
assert.ok(content.includes('queueMicrotask(announce)'), 'project announcements must be coalesced');
assert.ok(!/XMLHttpRequest|sendBeacon/.test(content), 'performance work must not add invasive network hooks');

const manifestText = JSON.stringify(manifest);
for (const token of ['BUILD 12 · Unified Launcher','LD38_PREMIUM_ENGINEERING','LD39_PREMIUM_PROJECT_TOOLS'])
  assert.ok(!manifestText.includes(token), `legacy marker leaked into manifest: ${token}`);

console.log('Build56 Legacy Purge + Performance cumulative contract OK');
