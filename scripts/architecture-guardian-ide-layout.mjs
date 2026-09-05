import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const policy = JSON.parse(read('architecture.guardian.json'));
const rule = policy.ideLayoutAuthority;
const violations = [];

if (!rule || policy.currentBuild < 30 || rule.minimumBuild !== 30 || policy.phaseGates?.ideLayoutBuild !== 30) {
  violations.push({ code: 'AG280', message: 'Build 30 IDE Layout authority is missing or inactive.' });
} else {
  const workbench = read('packages/ui/src/workbench.tsx');
  const uiIndex = read('packages/ui/src/index.ts');
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
    "data-sidebar-collapsed",
    "data-panel-collapsed",
  ]) if (!workbench.includes(marker)) violations.push({ code: 'AG281', message: 'Canonical workbench contract is incomplete.', detail: marker });
  if (!uiIndex.includes("export * from './workbench.js'")) {
    violations.push({ code: 'AG281', message: 'Workbench contract is not exported by @github-decrypter/ui.' });
  }
  for (const forbidden of [
    /\bwindow\b/, /\bdocument\b/, /\bfetch\s*\(/, /\bWebSocket\b/, /\bXMLHttpRequest\b/,
    /\blocalStorage\b/, /\bindexedDB\b/, /@github-decrypter\/(?:studio|extension|local)/,
  ]) if (forbidden.test(workbench)) violations.push({ code: 'AG281', message: 'Workbench primitive crossed environment/application authority.', detail: String(forbidden) });

  const uiCss = read('packages/ui/src/styles.css');
  for (const marker of [
    '.gd-workbench {',
    'grid-template-areas:',
    '.gd-workbench__topbar',
    '.gd-workbench__activity',
    '.gd-workbench__sidebar',
    '.gd-workbench__editor',
    '.gd-workbench__panel',
    '.gd-workbench__status',
    '.gd-workbench__tabs',
    '[data-sidebar-collapsed="true"]',
    '[data-panel-collapsed="true"]',
    '@media (max-width: 760px)',
  ]) if (!uiCss.includes(marker)) violations.push({ code: 'AG282', message: 'Workbench layout CSS invariant is missing.', detail: marker });
  if (/!important/.test(uiCss)) violations.push({ code: 'AG282', message: 'Workbench CSS must not require !important overrides.' });

  const app = read('apps/studio/src/App.tsx');
  for (const marker of [
    '<Workbench',
    '<WorkbenchTopBar',
    '<WorkbenchActivityBar',
    '<WorkbenchSidebar',
    '<WorkbenchEditor',
    '<WorkbenchPanel',
    '<WorkbenchStatusBar',
    '<WorkbenchTabBar',
    'studio-sidebar',
    'studio-editor',
    'studio-panel',
    'studio-statusbar',
  ]) if (!app.includes(marker)) violations.push({ code: 'AG283', message: 'Studio IDE layout composition is incomplete.', detail: marker });

  const studioCss = read('apps/studio/src/styles.css');
  for (const marker of [
    '.studio-topbar',
    '.studio-activity',
    '.studio-sidebar',
    '.studio-editor',
    '.studio-panel',
    '.studio-statusbar',
  ]) if (!studioCss.includes(marker)) violations.push({ code: 'AG283', message: 'Studio layout composition CSS is incomplete.', detail: marker });
  if (/#[0-9a-fA-F]{3,8}\b/.test(studioCss)) violations.push({ code: 'AG283', message: 'Studio layout bypasses semantic design tokens with hardcoded hex colors.' });

  if (
    !app.includes('useState')
    || !app.includes('setSidebarCollapsed')
    || !app.includes('setPanelCollapsed')
    || !app.includes('aria-controls="studio-sidebar"')
    || !app.includes('aria-controls="studio-panel"')
    || rule.layoutStatePersistence !== false
    || policy.studioAuthority?.layoutStatePersistence !== false
    || /\blocalStorage\b|\bindexedDB\b|\bsessionStorage\b/.test(app)
  ) violations.push({ code: 'AG284', message: 'Build 30 layout state must be bounded, accessible and memory-only.' });

  for (const [marker, expected] of [
    ['Developer Console', 71],
    ['Problems & Diagnostics', 72],
    ['Code Explorer', 73],
    ['Terminal', 75],
    ['Git Panel', 76],
  ]) {
    if (!app.includes(marker) || !app.includes(`build: ${expected}`)) {
      violations.push({ code: 'AG285', message: 'Deferred feature surface lost its owning Build marker.', detail: `${marker}:${expected}` });
    }
  }
  if (
    rule.structuralOnly !== true || rule.featurePanelsOperational !== false
    || /\bmonaco\b|\bxterm\b|\bterminal\.write\b|\bexecuteCommand\b|\bgetWorkspaceFiles\b/.test(app)
  ) violations.push({ code: 'AG285', message: 'Build 30 activated a feature panel instead of structural layout only.' });

  if (
    rule.ownerRoot !== 'apps/studio'
    || rule.componentPackage !== '@github-decrypter/ui'
    || rule.schema !== 'gd-ide-layout/1'
    || JSON.stringify(rule.requiredRegions) !== JSON.stringify(['topbar','activity','sidebar','editor','panel','statusbar'])
    || rule.collapsibleSidebar !== true || rule.collapsiblePanel !== true || rule.responsive !== true
    || rule.networkAuthority !== false || rule.storageAuthority !== false || rule.filesystemAuthority !== false
    || rule.localRuntimeTransport !== false || rule.githubProviderAccess !== false || rule.extensionAccess !== false
    || rule.externalTransport !== false
  ) violations.push({ code: 'AG286', message: 'Machine-readable IDE layout authority was broadened or weakened.' });

  if (
    rule.designSystemBuild !== 29 || rule.onboardingBuild !== 31 || rule.environmentDoctorBuild !== 32
    || rule.developerConsoleBuild !== 71 || rule.problemsDiagnosticsBuild !== 72 || rule.codeExplorerBuild !== 73
    || rule.terminalBuild !== 75 || rule.gitPanelBuild !== 76
    || (policy.currentBuild === 30 && (exists('apps/studio/src/onboarding.tsx') || exists('apps/studio/src/Onboarding.tsx')))
    || exists('apps/studio/src/environment-doctor.tsx') || exists('apps/studio/src/EnvironmentDoctor.tsx')
  ) violations.push({ code: 'AG287', message: 'Build 30 crossed into a later Studio feature authority.' });

  let rootPackage = null;
  let studioPackage = null;
  let uiPackage = null;
  try { rootPackage = JSON.parse(read('package.json')); } catch {}
  try { studioPackage = JSON.parse(read('apps/studio/package.json')); } catch {}
  try { uiPackage = JSON.parse(read('packages/ui/package.json')); } catch {}
  const identity = read('apps/studio/src/index.ts');
  const context = read('apps/studio/src/studio-context.ts');
  const vite = read('apps/studio/vite.config.ts');
  const rootBuild = Number.parseInt(String(rootPackage?.version ?? '').split('.')[2] ?? '', 10);
  const studioBuild = Number.parseInt(String(studioPackage?.version ?? '').split('.')[2] ?? '', 10);
  const uiBuild = Number.parseInt(String(uiPackage?.version ?? '').split('.')[2] ?? '', 10);
  if (
    !Number.isInteger(rootBuild) || rootBuild < 30
    || studioBuild !== rootBuild
    || !Number.isInteger(uiBuild) || uiBuild < 30
    || !context.includes(`STUDIO_BUILD = ${rootBuild}`)
    || !context.includes(`STUDIO_VERSION = '0.0.${rootBuild}'`)
    || !identity.includes('ideLayoutSchema: IDE_LAYOUT_SCHEMA') || !identity.includes('ideLayoutBuild: IDE_LAYOUT_BUILD')
    || !identity.includes('layoutStatePersistence: false')
    || !vite.includes(`PWA_CACHE_NAME = \`${'${PWA_CACHE_PREFIX}'}v${rootBuild}\``)
    || policy.studioAuthority?.ideLayout !== true || policy.studioAuthority?.workspaceLayout !== true
    || policy.designSystemAuthority?.ideLayoutAuthority !== true || policy.designSystemAuthority?.workspaceLayoutAuthority !== true
  ) violations.push({ code: 'AG288', message: 'Build 30 identity/version/PWA/design-system integration is inconsistent.' });

  for (const required of [
    'packages/ui/src/workbench.tsx',
    'docs/architecture/IDE_LAYOUT.md',
    'docs/builds/BUILD_30_IDE_LAYOUT.md',
    'scripts/architecture-guardian-ide-layout.mjs',
    'scripts/test-build30-ide-layout.mjs',
    'scripts/test-build30-ide-layout-runtime.tsx',
    'scripts/test-build30-ide-layout-dist.mjs',
    'scripts/test-build30-ide-layout-guardian-negative.mjs',
    'scripts/tsconfig.build30-tests.json',
    '.github/workflows/build30-ide-layout.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG289', message: 'Required Build 30 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-ide-layout-report/1',
  currentBuild: policy.currentBuild,
  layoutSchema: rule?.schema ?? null,
  structuralOnly: rule?.structuralOnly ?? null,
  requiredRegions: rule?.requiredRegions ?? null,
  layoutStatePersistence: rule?.layoutStatePersistence ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
