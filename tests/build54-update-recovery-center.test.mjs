import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('release/runtime-package.json', 'utf8'));
const settings = fs.readFileSync('settings/config.js', 'utf8');
const js = fs.readFileSync('ui/update-center-v54.js', 'utf8');
const css = fs.readFileSync('ui/update-center-v54.css', 'utf8');
const legacy = fs.readFileSync('ui/update-recovery.js', 'utf8');
const runtime = fs.readFileSync('background/update-recovery-runtime.js', 'utf8');

assert.equal(manifest.version, '2.5.54');
assert.match(manifest.version_name, /Build 54 · Update & Recovery Center/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));

const app = manifest.content_scripts.find(item => Array.isArray(item.js) && item.js.includes('ui/update-center-v54.js'));
assert.ok(app, 'Build54 Update Center missing from manifest');
assert.ok(app.css.includes('ui/update-center-v54.css'), 'Build54 CSS missing');
assert.ok(app.js.indexOf('ui/update-center-v54.js') > app.js.indexOf('ui/settings-v53.js'), 'Build54 must load after Build53');
assert.ok(app.js.indexOf('ui/update-recovery.js') < app.js.indexOf('ui/update-center-v54.js'), 'legacy validated repair motor must load before Build54 adapter');

for (const token of [
  'LovableDecrypterUpdateCenter',
  "registry.register('update'",
  "type:'LD2_RECOVERY_STATUS'",
  "type:'LD2_UPDATE_V2_CHANNEL_SET'",
  "type:'LD2_UPDATE_V2_CHECK'",
  "type:'LD2_UPDATE_V2_DOWNLOAD'",
  "type:'LD2_UPDATE_V2_NATIVE_APPLY'",
  "type:'LD2_UPDATE_V2_ROLLBACK_DOWNLOAD'",
  "type:'LD2_RECOVERY_CLEAR_DECRYPTER_CACHE'",
  'LovableDecrypterUpdateRecovery',
  'openRepairCenter',
  'openUpdateCenter',
  "channel !== 'stable'"
]) assert.ok(js.includes(token), `missing ${token}`);

for (const token of [
  'fetchSignedRelease',
  'signature_verified',
  'verification_token',
  'downloadUpdate',
  'createRecoverySnapshot',
  'backupSettingsRemote',
  "selected !== 'stable'",
  'previousVersion',
  'manual-reinstall-required',
  "status: 'pending'",
  "status: 'failed'"
]) assert.ok(runtime.includes(token), `authoritative update runtime missing ${token}`);

assert.ok(legacy.includes('window.LovableDecrypterUpdateRecovery = Object.freeze'));
assert.ok(legacy.includes('clearLovableCacheStorage'));
assert.ok(legacy.includes('unregisterLovableServiceWorkers'));
assert.ok(legacy.includes('clearLovableIndexedDb'));

assert.ok(js.includes('providerInstalled'), 'Build54 provider must be idempotent');
assert.ok(!/\bfetch\s*\(/.test(js), 'Build54 UI must not create a direct update network path');
assert.ok(!/XMLHttpRequest|sendBeacon/.test(js), 'Build54 must not add invasive network hooks');
assert.ok(!js.includes('updates/latest.json'), 'Build54 must not publish or rewrite OTA metadata');
assert.ok(!js.includes('updates/release.json'), 'Build54 must not publish or rewrite release metadata');
assert.ok(css.includes('.ld54-overlay'));
assert.ok(css.includes('@media(max-width:560px)'));

console.log('Build54 Update & Recovery Center contract OK');
