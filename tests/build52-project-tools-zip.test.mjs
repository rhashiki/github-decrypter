import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('release/runtime-package.json', 'utf8'));
const settings = fs.readFileSync('settings/config.js', 'utf8');
const js = fs.readFileSync('ui/project-tools-v52.js', 'utf8');
const css = fs.readFileSync('ui/project-tools-v52.css', 'utf8');
const parts = value => String(value).split('.').map(Number);
const atLeast = (value, floor) => {
  const a = parts(value), b = parts(floor);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return true;
};

assert.ok(atLeast(manifest.version, '2.5.52'), `unexpected successor version ${manifest.version}`);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));

const app = manifest.content_scripts.find(item => Array.isArray(item.js) && item.js.includes('ui/project-tools-v52.js'));
assert.ok(app, 'Build52 project tools missing from manifest');
assert.ok(app.css.includes('ui/project-tools-v52.css'), 'Build52 CSS missing');
assert.ok(app.js.indexOf('ui/project-tools-v52.js') > app.js.indexOf('ui/engineering-suite-v51.js'), 'Build52 must load after Build51');

for (const token of [
  'LovableDecrypterProjectTools',
  "registry.register('zip'",
  "type:'LD2_GITHUB_ZIP_BYTES'",
  'new Uint8Array(bytes)',
  "type:'application/zip'",
  'Baixar ZIP do projeto',
  "data-ld52-action=\"workspace\"",
  "data-ld52-action=\"github-sync\"",
  "data-ld52-action=\"cloud-migrator\"",
  "data-ld52-action=\"lovable-new-project\""
]) assert.ok(js.includes(token), `missing ${token}`);

assert.ok(js.includes('URL.createObjectURL(blob)'));
assert.ok(js.includes('URL.revokeObjectURL(url)'));
assert.ok(js.includes('providerInstalled'), 'Build52 provider must be idempotent for successor registrations');
assert.ok(!js.includes("addEventListener('ld48:action-registered', installProvider)"), 'Build52 must not recursively re-register from its own registry event');
assert.ok(!/\bfetch\s*\(/.test(js), 'Build52 must use existing runtime instead of direct network calls');
assert.ok(!/XMLHttpRequest|sendBeacon/.test(js), 'Build52 must not add invasive network hooks');
assert.ok(!js.includes('updates/latest.json'), 'Build52 must not publish or rewrite OTA metadata');
assert.ok(css.includes('.ld52-overlay'));
assert.ok(css.includes('@media(max-width:560px)'));

console.log('Build52 Project Tools & ZIP Export cumulative contract OK');
