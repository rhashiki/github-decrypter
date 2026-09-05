import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));
const versionBuild = (value) => Number(/^0\.0\.(\d+)$/.exec(String(value))?.[1] ?? -1);

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const uiPackage = json('packages/ui/package.json');
const studioPackage = json('apps/studio/package.json');
const tokens = read('packages/ui/src/tokens.ts');
const primitives = read('packages/ui/src/primitives.tsx');
const uiCss = read('packages/ui/src/styles.css');
const studioMain = read('apps/studio/src/main.tsx');
const studioApp = read('apps/studio/src/App.tsx');
const studioCss = read('apps/studio/src/styles.css');
const ideLayoutActive = policy.currentBuild >= 30;

assert.ok(policy.currentBuild >= 29);
assert.equal(policy.phaseGates.designSystemBuild, 29);
assert.equal(policy.phaseGates.ideLayoutBuild, 30);
assert.ok(versionBuild(rootPackage.version) >= 29);
assert.equal(uiPackage.name, '@github-decrypter/ui');
assert.ok(versionBuild(uiPackage.version) >= 29);
assert.equal(uiPackage.peerDependencies.react, '19.2.7');
assert.equal(uiPackage.exports['./styles.css'], './src/styles.css');
assert.ok(versionBuild(studioPackage.version) >= 29);
assert.equal(studioPackage.dependencies['@github-decrypter/ui'], 'workspace:*');

for (const marker of [
  "DESIGN_SYSTEM_SCHEMA = 'gd-ui-tokens/1'",
  'DESIGN_SYSTEM_BUILD = 29',
  'designTokens = Object.freeze',
  "canvas: '#0d1117'",
  "surface: '#161b22'",
  "accent: '#58a6ff'",
  "success: '#3fb950'",
  "warning: '#d29922'",
  "danger: '#f85149'",
]) assert.ok(tokens.includes(marker), `Missing design token marker: ${marker}`);

for (const marker of [
  'export function Card',
  'export function Badge',
  'export function Button',
  'export function Stack',
  'export function Status',
  'export function SectionHeading',
]) assert.ok(primitives.includes(marker), `Missing UI primitive marker: ${marker}`);

for (const marker of [
  '--gd-color-canvas:',
  '--gd-color-surface:',
  '--gd-color-text:',
  '--gd-color-accent:',
  '--gd-space-lg:',
  '--gd-radius-lg:',
  '--gd-font-family:',
  '.gd-card',
  '.gd-button',
  '.gd-status',
  ':focus-visible',
]) assert.ok(uiCss.includes(marker), `Missing shared CSS marker: ${marker}`);

assert.ok(studioMain.includes("import '@github-decrypter/ui/styles.css'"));
assert.ok(studioApp.includes("from '@github-decrypter/ui'"));
assert.ok(studioApp.includes('<Card'));
assert.ok(studioApp.includes('<Badge'));
assert.ok(studioApp.includes('<Status'));
assert.ok(studioCss.includes('var(--gd-'));
assert.doesNotMatch(studioCss, /#[0-9a-fA-F]{3,8}\b/);
assert.equal(policy.designSystemAuthority.ownerPackage, '@github-decrypter/ui');
assert.equal(policy.designSystemAuthority.semanticTokens, true);
assert.equal(policy.designSystemAuthority.reactPrimitives, true);
assert.equal(policy.designSystemAuthority.environmentNeutral, true);
assert.equal(policy.designSystemAuthority.ideLayoutAuthority, ideLayoutActive);
assert.equal(policy.designSystemAuthority.workspaceLayoutAuthority, ideLayoutActive);
assert.equal(policy.designSystemAuthority.networkAuthority, false);
assert.equal(policy.designSystemAuthority.storageAuthority, false);
assert.equal(policy.designSystemAuthority.localRuntimeTransport, false);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build29-unified-design-system-static/2',
  owningBuild: 29,
  currentBuild: policy.currentBuild,
  tokenSchema: 'gd-ui-tokens/1',
  canonicalPackage: '@github-decrypter/ui',
  studioConsumer: true,
  semanticTokens: true,
  reactPrimitives: ['Card', 'Badge', 'Button', 'Stack', 'Status', 'SectionHeading'],
  focusVisible: true,
  laterIdeLayoutAllowed: ideLayoutActive,
}, null, 2));
