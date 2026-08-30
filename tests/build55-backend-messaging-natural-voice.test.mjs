import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('release/runtime-package.json', 'utf8'));
const settings = fs.readFileSync('settings/config.js', 'utf8');
const entry = fs.readFileSync('background/service-worker-entry.js', 'utf8');
const runtime = fs.readFileSync('background/messaging-runtime.js', 'utf8');
const client = fs.readFileSync('ui/backend-messaging-v55.js', 'utf8');
const backend = fs.readFileSync('supabase/functions/ld-messaging/index.ts', 'utf8');
const parts = value => String(value).split('.').map(Number);
const atLeast = (value, floor) => {
  const a = parts(value), b = parts(floor);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return true;
};

assert.ok(atLeast(manifest.version, '2.5.55'), `unexpected successor version ${manifest.version}`);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));

const app = manifest.content_scripts.find(item => Array.isArray(item.js) && item.js.includes('ui/backend-messaging-v55.js'));
assert.ok(app, 'Build55 client missing from manifest');
assert.ok(!app.js.includes('ui/voice-feedback.js'), 'legacy local voice catalog must not load');
assert.ok(app.js.indexOf('ui/backend-messaging-v55.js') > app.js.indexOf('ui/update-center-v54.js'), 'Build55 must load after Build54');

for (const token of [
  'installMessagingRuntime',
  'LD2_MESSAGE_RESOLVE',
  'LD2_MESSAGE_NORMALIZE',
  'LD2_MESSAGE_HEALTH',
  '/ld-messaging',
  'x-license-key',
  'x-decrypter-client-version'
]) assert.ok(runtime.includes(token) || entry.includes(token), `missing ${token}`);

for (const token of [
  'LovableDecrypterMessaging',
  'backendAuthority:true',
  'localCatalog:false',
  'SpeechSynthesisUtterance',
  'pickNaturalVoice',
  'MutationObserver',
  "type:'LD2_MESSAGE_NORMALIZE'",
  "type:'LD2_MESSAGE_RESOLVE'"
]) assert.ok(client.includes(token), `client missing ${token}`);

assert.ok(!client.includes('const MESSAGES'), 'Build55 must not ship a local message catalog');
assert.ok(!client.includes('github-success\': \'Conexão'), 'Build55 must not embed backend catalog strings in the client');
assert.ok(!/XMLHttpRequest|sendBeacon/.test(client), 'Build55 must not add invasive network hooks');
assert.ok(!/\bfetch\s*\(/.test(client), 'Build55 UI must route backend calls through the service worker');

for (const token of [
  "schema: 'ld-message/2'",
  'const CATALOG',
  'const NORMALIZERS',
  'validateLicense',
  'ld-license-validate',
  'preferNatural: true',
  "authority: 'backend'",
  "build: 55"
]) assert.ok(backend.includes(token), `backend missing ${token}`);

console.log('Build55 Backend Messaging & Natural Voice cumulative contract OK');
