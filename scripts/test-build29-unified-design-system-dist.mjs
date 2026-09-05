import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'apps/studio/dist');
const assets = path.join(dist, 'assets');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
assert.equal(fs.existsSync(dist), true, 'Studio dist is missing.');
assert.equal(fs.existsSync(assets), true, 'Studio assets directory is missing.');

const cssFiles = fs.readdirSync(assets).filter((name) => name.endsWith('.css')).sort();
assert.ok(cssFiles.length > 0, 'Vite did not emit design-system CSS.');
const css = cssFiles.map((name) => fs.readFileSync(path.join(assets, name), 'utf8')).join('\n');

for (const marker of [
  '--gd-color-canvas:',
  '--gd-color-surface:',
  '--gd-color-accent:',
  '--gd-space-lg:',
  '--gd-radius-lg:',
  '--gd-font-family:',
  '.gd-card',
  '.gd-badge',
  '.gd-button',
  '.gd-stack',
  '.gd-status',
  ':focus-visible',
]) assert.ok(css.includes(marker), `Built CSS omitted design-system marker: ${marker}`);

if (policy.currentBuild === 29) {
  assert.ok(css.includes('.studio-header'), 'Build 29 Studio composition marker is missing.');
  assert.doesNotMatch(css, /\.gd-workbench\b/);
}

const sw = fs.readFileSync(path.join(dist, 'service-worker.js'), 'utf8');
for (const cssFile of cssFiles) {
  assert.ok(sw.includes(`./assets/${cssFile}`), `PWA shell did not include built design-system CSS: ${cssFile}`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build29-unified-design-system-dist/2',
  owningBuild: 29,
  currentBuild: policy.currentBuild,
  cssFiles,
  semanticVariablesBundled: true,
  primitivesBundled: true,
  studioCompositionBundled: true,
  pwaShellIncludesDesignSystemCss: true,
  laterIdeLayoutAllowed: policy.currentBuild >= 30,
}, null, 2));
