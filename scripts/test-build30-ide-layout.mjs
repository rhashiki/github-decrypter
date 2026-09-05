import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));
const buildOf = (version) => Number.parseInt(String(version).split('.')[2] ?? '', 10);

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const studioPackage = json('apps/studio/package.json');
const uiPackage = json('packages/ui/package.json');
const workbench = read('packages/ui/src/workbench.tsx');
const uiCss = read('packages/ui/src/styles.css');
const app = read('apps/studio/src/App.tsx');
const studioCss = read('apps/studio/src/styles.css');
const identity = read('apps/studio/src/index.ts');
const context = read('apps/studio/src/studio-context.ts');
const vite = read('apps/studio/vite.config.ts');

assert.ok(policy.currentBuild >= 30);
assert.equal(policy.phaseGates.ideLayoutBuild, 30);
const currentStudioBuild = buildOf(rootPackage.version);
assert.ok(currentStudioBuild >= 30);
assert.equal(buildOf(studioPackage.version), currentStudioBuild);
assert.ok(buildOf(uiPackage.version) >= 30);
assert.equal(policy.ideLayoutAuthority.schema, 'gd-ide-layout/1');
assert.equal(policy.ideLayoutAuthority.structuralOnly, true);
assert.equal(policy.ideLayoutAuthority.featurePanelsOperational, false);
assert.equal(policy.ideLayoutAuthority.layoutStatePersistence, false);
assert.deepEqual(policy.ideLayoutAuthority.requiredRegions, ['topbar','activity','sidebar','editor','panel','statusbar']);
assert.equal(policy.designSystemAuthority.ideLayoutAuthority, true);
assert.equal(policy.designSystemAuthority.workspaceLayoutAuthority, true);

for (const marker of [
  "IDE_LAYOUT_BUILD = 30",
  "IDE_LAYOUT_SCHEMA = 'gd-ide-layout/1'",
  'export function Workbench',
  'export function WorkbenchTopBar',
  'export function WorkbenchActivityBar',
  'export function WorkbenchSidebar',
  'export function WorkbenchEditor',
  'export function WorkbenchPanel',
  'export function WorkbenchStatusBar',
  'export function WorkbenchTabBar',
]) assert.ok(workbench.includes(marker), `Missing workbench marker: ${marker}`);

for (const marker of [
  '.gd-workbench {',
  '.gd-workbench__topbar',
  '.gd-workbench__activity',
  '.gd-workbench__sidebar',
  '.gd-workbench__editor',
  '.gd-workbench__panel',
  '.gd-workbench__status',
  '[data-sidebar-collapsed="true"]',
  '[data-panel-collapsed="true"]',
  '@media (max-width: 760px)',
]) assert.ok(uiCss.includes(marker), `Missing workbench CSS marker: ${marker}`);

for (const marker of [
  '<Workbench',
  '<WorkbenchTopBar',
  '<WorkbenchActivityBar',
  '<WorkbenchSidebar',
  '<WorkbenchEditor',
  '<WorkbenchPanel',
  '<WorkbenchStatusBar',
  '<WorkbenchTabBar',
  'setSidebarCollapsed',
  'setPanelCollapsed',
  'Developer Console',
  'Problems & Diagnostics',
  'Code Explorer',
  'Terminal',
  'Git Panel',
]) assert.ok(app.includes(marker), `Missing Studio layout marker: ${marker}`);

assert.ok(studioCss.includes('.studio-topbar'));
assert.ok(studioCss.includes('.studio-sidebar'));
assert.ok(studioCss.includes('.studio-editor'));
assert.ok(studioCss.includes('.studio-panel'));
assert.ok(studioCss.includes('.studio-statusbar'));
assert.doesNotMatch(studioCss, /#[0-9a-fA-F]{3,8}\b/);
assert.doesNotMatch(app, /\blocalStorage\b|\bindexedDB\b|\bsessionStorage\b|\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b/);
assert.ok(identity.includes('ideLayoutSchema: IDE_LAYOUT_SCHEMA'));
assert.ok(identity.includes('layoutStatePersistence: false'));
assert.ok(context.includes(`STUDIO_BUILD = ${currentStudioBuild}`));
assert.ok(vite.includes(`PWA_CACHE_NAME = \`${'${PWA_CACHE_PREFIX}'}v${currentStudioBuild}\``));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build30-ide-layout-static/1',
  owningBuild: 30,
  currentBuild: policy.currentBuild,
  layoutSchema: 'gd-ide-layout/1',
  regions: policy.ideLayoutAuthority.requiredRegions,
  structuralOnly: true,
  collapsibleSidebar: true,
  collapsiblePanel: true,
  responsive: true,
  featurePanelsOperational: false,
  layoutStatePersistence: false,
}, null, 2));
