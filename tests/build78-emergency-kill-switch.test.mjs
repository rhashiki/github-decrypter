import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8'));
const pkg = JSON.parse(fs.readFileSync('release/runtime-package.json','utf8'));
const config = fs.readFileSync('settings/config.js','utf8');

assert.equal(manifest.version,'2.6.78');
assert.match(manifest.version_name,/Emergency Kill Switch/);
assert.equal(pkg.candidate,'2.6.78');
assert.ok(config.includes("VERSION = '2.6.78'"));

for (const key of ['background','content_scripts','permissions','host_permissions','optional_host_permissions','web_accessible_resources','externally_connectable']) {
  assert.equal(Object.prototype.hasOwnProperty.call(manifest,key),false,`manifest must not contain ${key}`);
}

assert.deepEqual(pkg.paths,['manifest.json','assets','updates/update-manager.js']);
assert.ok(pkg.forbidden_roots.includes('background'));
assert.ok(pkg.forbidden_roots.includes('content'));
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('tools'));
assert.ok(pkg.forbidden_roots.includes('core'));
assert.ok(pkg.forbidden_roots.includes('settings'));
assert.ok(pkg.forbidden_roots.includes('storage'));
assert.match(pkg.notes,/no background service worker/i);
assert.match(pkg.notes,/no content scripts/i);
assert.match(pkg.notes,/cannot execute/i);

const updater = fs.readFileSync('updates/update-manager.js','utf8');
assert.ok(updater.length>0,'dormant updater artifact must exist for legacy packager compatibility');
const manifestText = fs.readFileSync('manifest.json','utf8');
assert.equal(manifestText.includes('updates/update-manager.js'),false,'dormant updater must not be referenced by manifest');

console.log('Build78 Emergency Kill Switch contract OK: extension runtime is inert');
