import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const js = fs.readFileSync('ui/engineering-suite-v51.js', 'utf8');
const css = fs.readFileSync('ui/engineering-suite-v51.css', 'utf8');

assert.equal(manifest.version, '2.5.51');
assert.match(manifest.version_name, /Build 51 · Engineering Suite/);
const scripts = manifest.content_scripts.flatMap(x => x.js || []);
const styles = manifest.content_scripts.flatMap(x => x.css || []);
assert.ok(scripts.includes('ui/engineering-suite-v51.js'));
assert.ok(styles.includes('ui/engineering-suite-v51.css'));
assert.ok(scripts.indexOf('ui/engineering-suite-v51.js') > scripts.indexOf('ui/ui-kernel-v48.js'));
assert.ok(scripts.indexOf('ui/engineering-suite-v51.js') > scripts.indexOf('ui/project-intelligence-v50.js'));

for (const token of [
  'LovableDecrypterEngineeringSuite',
  'LovableDecrypterProjectStateGraph',
  'LovableDecrypterRecoveryDoctor',
  'LovableDecrypterBatchMode',
  'LovableDecrypterChat',
  'Scope Lock',
  'Shadow Build',
  'Regression Sentinel',
  'Validation Gate',
  "registry.register('decrypter-chat'",
  "registry.register('editor'",
  "registry.register('queue'",
  "registry.register('diagnostics'",
  "registry.register('cloud-migrator'"
]) assert.ok(js.includes(token), `missing ${token}`);

assert.ok(js.includes('data-ldc-mode'));
assert.ok(js.includes('deepCompare: true'));
assert.ok(js.includes('LD2_LICENSE_STATUS'));
assert.ok(!/\bfetch\s*\(/.test(js), 'Build 51 must not add fetch monkeypatch/network bypasses');
assert.ok(!/XMLHttpRequest|sendBeacon/.test(js), 'Build 51 must not add invasive global network hooks');
assert.ok(css.includes('.ld51-overlay'));
assert.ok(css.includes('@media(max-width:640px)'));

console.log('Build 51 Engineering Suite contract OK');
