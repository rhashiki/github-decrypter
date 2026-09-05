import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.designSystemAuthority;
const violations = [];

const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));

if (!rule || policy.currentBuild < 29 || rule.minimumBuild !== 29 || policy.phaseGates?.designSystemBuild !== 29) {
  violations.push({ code: 'AG270', message: 'Build 29 Unified Design System authority is missing or inactive.' });
} else {
  let uiPackage = null;
  let studioPackage = null;
  try { uiPackage = JSON.parse(read('packages/ui/package.json')); }
  catch { violations.push({ code: 'AG271', message: 'UI package manifest is missing or invalid.' }); }
  try { studioPackage = JSON.parse(read('apps/studio/package.json')); }
  catch { violations.push({ code: 'AG275', message: 'Studio package manifest is missing or invalid.' }); }

  if (uiPackage) {
    const versionMatch = /^0\.0\.(\d+)$/.exec(String(uiPackage.version ?? ''));
    const versionBuild = versionMatch ? Number(versionMatch[1]) : -1;
    if (
      uiPackage.name !== '@github-decrypter/ui'
      || versionBuild < 29
      || uiPackage.exports?.['.'] !== './src/index.ts'
      || uiPackage.exports?.['./styles.css'] !== './src/styles.css'
      || uiPackage.peerDependencies?.react !== '19.2.7'
      || uiPackage.devDependencies?.['@types/react'] !== '19.2.18'
      || uiPackage.scripts?.typecheck !== 'tsc -p tsconfig.json'
    ) violations.push({ code: 'AG271', message: 'Canonical UI package contract is invalid.' });
  }

  const tokens = read('packages/ui/src/tokens.ts');
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
    "family: 'Inter, ui-sans-serif",
    "focus: '0 0 0 3px rgba(88, 166, 255, 0.32)'",
  ]) if (!tokens.includes(marker)) violations.push({ code: 'AG272', message: 'Semantic design-token invariant is missing.', detail: marker });

  const css = read('packages/ui/src/styles.css');
  for (const marker of [
    '[data-gd-theme="dark"]',
    '--gd-color-canvas:',
    '--gd-color-surface:',
    '--gd-color-text:',
    '--gd-color-text-muted:',
    '--gd-color-accent:',
    '--gd-space-lg:',
    '--gd-radius-lg:',
    '--gd-font-family:',
    '--gd-shadow-focus:',
    '.gd-card',
    '.gd-badge',
    '.gd-button',
    '.gd-stack',
    '.gd-status',
    ':focus-visible',
  ]) if (!css.includes(marker)) violations.push({ code: 'AG273', message: 'Shared CSS design-system invariant is missing.', detail: marker });
  if (/\.studio-|\.ide-|\.editor-|\.terminal-|\.sidebar-|\.activity-bar/.test(css) || /!important/.test(css)) {
    violations.push({ code: 'AG273', message: 'Reusable UI CSS contains app/IDE-specific layout or unscoped override authority.' });
  }

  const primitives = read('packages/ui/src/primitives.tsx');
  for (const marker of [
    'export function Card',
    'export function Badge',
    'export function Button',
    'export function Stack',
    'export function Status',
    'export function SectionHeading',
    "type = 'button'",
    "aria-hidden=\"true\"",
    "`gd-card--${tone}`",
    "`gd-button--${variant}`",
  ]) if (!primitives.includes(marker)) violations.push({ code: 'AG274', message: 'React UI primitive invariant is missing.', detail: marker });
  for (const forbidden of [
    /\bwindow\b/,
    /\bdocument\b/,
    /\bfetch\s*\(/,
    /\bWebSocket\b/,
    /\bXMLHttpRequest\b/,
    /\blocalStorage\b/,
    /\bindexedDB\b/,
    /@github-decrypter\/(?:studio|extension|local)/,
  ]) if (forbidden.test(`${tokens}\n${primitives}`)) {
    violations.push({ code: 'AG274', message: 'UI package crossed environment/application authority.', detail: String(forbidden) });
  }

  const main = read('apps/studio/src/main.tsx');
  const app = read('apps/studio/src/App.tsx');
  const localCss = read('apps/studio/src/styles.css');
  const identity = read('apps/studio/src/index.ts');
  if (
    studioPackage?.dependencies?.['@github-decrypter/ui'] !== 'workspace:*'
    || !main.includes("import '@github-decrypter/ui/styles.css'")
    || !app.includes("from '@github-decrypter/ui'")
    || !app.includes('<Card') || !app.includes('<Badge') || !app.includes('<Status')
    || !identity.includes('designSystem: DESIGN_SYSTEM_ID')
    || !identity.includes('designSystemSchema: DESIGN_SYSTEM_SCHEMA')
    || !localCss.includes('var(--gd-')
    || /#[0-9a-fA-F]{3,8}\b/.test(localCss)
  ) violations.push({ code: 'AG275', message: 'Studio is not consistently consuming the canonical design system.' });

  const sourceSurface = [tokens, primitives, css, app, localCss].join('\n');
  if (
    rule.ideLayoutBuild !== 30 || policy.phaseGates?.ideLayoutBuild !== 30
    || rule.ideLayoutAuthority !== false || rule.workspaceLayoutAuthority !== false
    || /\bgd-(?:sidebar|editor|terminal|activity-bar|panel-resizer)\b/.test(sourceSurface)
    || exists('apps/studio/src/ide-layout.tsx')
    || exists('apps/studio/src/IDELayout.tsx')
    || !app.includes('IDE Layout') || !app.includes('Build 30')
  ) violations.push({ code: 'AG276', message: 'Build 30 IDE layout authority arrived during Build 29 or its deferral marker disappeared.' });

  if (
    rule.ownerPackage !== '@github-decrypter/ui'
    || rule.ownerRoot !== 'packages/ui'
    || rule.studioConsumer !== '@github-decrypter/studio'
    || rule.schema !== 'gd-ui-tokens/1'
    || rule.cssVariablePrefix !== '--gd-'
    || rule.componentClassPrefix !== 'gd-'
    || rule.theme !== 'dark'
    || rule.semanticTokens !== true || rule.reactPrimitives !== true || rule.focusVisible !== true
    || rule.environmentNeutral !== true
    || rule.networkAuthority !== false || rule.storageAuthority !== false || rule.filesystemAuthority !== false
    || rule.localRuntimeTransport !== false || rule.githubProviderAccess !== false || rule.externalTransport !== false
  ) violations.push({ code: 'AG277', message: 'Machine-readable design-system authority was broadened or weakened.' });

  const uiRule = policy.packageRules?.['@github-decrypter/ui'];
  const studioRule = policy.appRules?.['@github-decrypter/studio'];
  if (
    !uiRule || uiRule.environmentNeutral !== true
    || JSON.stringify(uiRule.allowedWorkspaceDependencies) !== JSON.stringify([])
    || !studioRule?.allowedWorkspaceDependencies?.includes('@github-decrypter/ui')
    || !studioRule?.allowedWorkspaceDependencies?.includes('@github-decrypter/protocol')
  ) violations.push({ code: 'AG278', message: 'Package/app dependency authority for the design system is invalid.' });

  for (const required of [
    'packages/ui/src/tokens.ts',
    'packages/ui/src/primitives.tsx',
    'packages/ui/src/styles.css',
    'docs/architecture/UNIFIED_DESIGN_SYSTEM.md',
    'docs/builds/BUILD_29_UNIFIED_DESIGN_SYSTEM.md',
    'scripts/test-build29-unified-design-system.mjs',
    'scripts/test-build29-unified-design-system-runtime.tsx',
    'scripts/test-build29-unified-design-system-dist.mjs',
    'scripts/test-build29-design-system-guardian-negative.mjs',
    'scripts/tsconfig.build29-tests.json',
    '.github/workflows/build29-unified-design-system.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG279', message: 'Required Build 29 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-design-system-report/1',
  currentBuild: policy.currentBuild,
  ownerPackage: rule?.ownerPackage ?? null,
  schemaVersion: rule?.schema ?? null,
  semanticTokens: rule?.semanticTokens ?? null,
  reactPrimitives: rule?.reactPrimitives ?? null,
  ideLayoutAuthority: rule?.ideLayoutAuthority ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
