import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('release/runtime-package.json', 'utf8'));
const config = fs.readFileSync('settings/config.js', 'utf8');
const js = fs.readFileSync('ui/settings-v53.js', 'utf8');
const css = fs.readFileSync('ui/settings-v53.css', 'utf8');
const build52 = fs.readFileSync('ui/project-tools-v52.js', 'utf8');
const parts = value => String(value).split('.').map(Number);
const atLeast = (value, floor) => {
  const a = parts(value), b = parts(floor);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return true;
};

assert.ok(atLeast(manifest.version, '2.5.53'), `unexpected successor version ${manifest.version}`);
assert.equal(pkg.candidate, manifest.version);
assert.ok(config.includes(`VERSION = '${manifest.version}'`));

const app = manifest.content_scripts.find(item => Array.isArray(item.js) && item.js.includes('ui/settings-v53.js'));
assert.ok(app, 'Build53 settings missing from manifest');
assert.ok(app.css.includes('ui/settings-v53.css'), 'Build53 CSS missing');
assert.ok(app.js.indexOf('ui/settings-v53.js') > app.js.indexOf('ui/project-tools-v52.js'), 'Build53 must load after Build52');

for (const token of [
  'LovableDecrypterSettings',
  "registry.register('settings'",
  "type:'LD2_SETTINGS_GET'",
  "type:'LD2_SETTINGS_PATCH'",
  'data-ld53-background',
  'data-ld53-density',
  'data-ld53-motion',
  'data-ld53-sounds',
  'data-ld53-gateway',
  'data-ld53-max-files',
  'data-ld53-context',
  'data-ld53-rules',
  "integrationCard('github'",
  "integrationCard('supabase'",
  "integrationCard('gemini'",
  "integrationCard('lovable'"
]) assert.ok(js.includes(token), `missing ${token}`);

for (const token of ["density:'comfortable'", "motion:'full'", "background:'glass'"])
  assert.ok(config.includes(token), `settings config missing ${token}`);
assert.ok(config.includes("['comfortable','compact']"));
assert.ok(config.includes("['full','reduced']"));
assert.ok(config.includes("['glass','solid']"));
assert.ok(config.includes('merged.agent.maxFiles=clampInt'));
assert.ok(config.includes('merged.agent.maxContextBytes=clampInt'));

assert.ok(js.includes('providerInstalled'), 'settings provider must be idempotent');
assert.ok(!js.includes('type="password"'), 'Build53 must not duplicate credential inputs from integrations');
assert.ok(!/\bfetch\s*\(/.test(js), 'Build53 must use authoritative runtime/provider APIs');
assert.ok(!/XMLHttpRequest|sendBeacon/.test(js), 'Build53 must not add invasive network hooks');
assert.ok(!js.includes('updates/latest.json'), 'Build53 must not publish OTA metadata');
assert.ok(!build52.includes("addEventListener('ld48:action-registered', installProvider)"), 'Build52 recursive provider listener must remain removed');

assert.ok(css.includes('#ld2-root[data-ld53-background=solid]'));
assert.ok(css.includes('#ld2-root[data-ld53-motion=reduced]'));
assert.ok(css.includes('#ld2-root[data-ld53-density=compact]'));
assert.ok(css.includes('@media(max-width:560px)'));

console.log('Build53 Settings & Preferences cumulative contract OK');
