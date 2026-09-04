import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.studioAuthority;
const violations = [];

const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));

if (!rule || policy.currentBuild < 27 || rule.minimumBuild !== 27) {
  violations.push({ code: 'AG250', message: 'React Studio authority policy is missing or inactive.' });
} else {
  let manifest = null;
  try { manifest = JSON.parse(read('apps/studio/package.json')); }
  catch { violations.push({ code: 'AG251', message: 'Studio package manifest is missing or invalid JSON.' }); }

  if (manifest) {
    const dependencies = manifest.dependencies ?? {};
    const devDependencies = manifest.devDependencies ?? {};
    const versionMatch = /^0\.0\.(\d+)$/.exec(manifest.version ?? '');
    const versionBuild = versionMatch ? Number(versionMatch[1]) : -1;
    if (
      manifest.name !== '@github-decrypter/studio'
      || versionBuild < 27
      || dependencies['@github-decrypter/protocol'] !== 'workspace:*'
      || dependencies.react !== '19.2.7'
      || dependencies['react-dom'] !== '19.2.7'
      || devDependencies.vite !== '8.2.2'
      || devDependencies['@vitejs/plugin-react'] !== '6.1.1'
      || manifest.scripts?.build !== 'vite build'
      || manifest.scripts?.dev !== 'vite --host 127.0.0.1'
    ) violations.push({ code: 'AG251', message: 'Build 27+ Studio dependency/toolchain boundary is invalid.' });
  }

  const identity = read('apps/studio/src/index.ts');
  for (const marker of [
    'launchSchema: STUDIO_LAUNCH_SCHEMA',
    'build: STUDIO_BUILD',
    'version: STUDIO_VERSION',
    "framework: 'React 19'",
    "bundler: 'Vite 8'",
    'Client-only React Studio',
  ]) if (!identity.includes(marker)) violations.push({ code: 'AG252', message: 'Studio identity invariant missing.', detail: marker });

  const context = read('apps/studio/src/studio-context.ts');
  const buildMatch = /STUDIO_BUILD = (\d+)/.exec(context);
  const studioBuild = buildMatch ? Number(buildMatch[1]) : -1;
  const studioVersionMatch = /STUDIO_VERSION = '0\.0\.(\d+)'/.exec(context);
  const studioVersionBuild = studioVersionMatch ? Number(studioVersionMatch[1]) : -1;
  for (const marker of [
    "STUDIO_LAUNCH_SCHEMA = 'gd-studio-launch/1'",
    'parseStudioLaunchContext',
    "allowed = new Set(['owner', 'repo'])",
    "params.getAll('owner').length !== 1",
    "params.getAll('repo').length !== 1",
    'RESERVED_TOP_LEVEL.has(normalizedOwner.toLowerCase())',
    'https://github.com/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(normalizedName)}',
  ]) if (!context.includes(marker)) violations.push({ code: 'AG253', message: 'Studio repository launch validation invariant missing.', detail: marker });
  if (studioBuild < 27 || studioVersionBuild !== studioBuild) {
    violations.push({ code: 'AG253', message: 'Studio build/version identity is invalid or regressed below Build 27.' });
  }

  const main = read('apps/studio/src/main.tsx');
  const app = read('apps/studio/src/App.tsx');
  const html = read('apps/studio/index.html');
  const vite = read('apps/studio/vite.config.ts');
  for (const marker of [
    "import { StrictMode } from 'react'",
    "import { createRoot } from 'react-dom/client'",
    "document.getElementById('root')",
    'createRoot(root).render',
    '<StrictMode>',
  ]) if (!main.includes(marker)) violations.push({ code: 'AG254', message: 'React Studio bootstrap invariant missing.', detail: marker });
  for (const marker of ['id="root"', '/src/main.tsx']) {
    if (!html.includes(marker)) violations.push({ code: 'AG254', message: 'Studio HTML entry invariant missing.', detail: marker });
  }
  for (const marker of ['react()', "host: '127.0.0.1'"]) {
    if (!vite.includes(marker)) violations.push({ code: 'AG254', message: 'Vite client foundation invariant missing.', detail: marker });
  }
  for (const marker of ['parseStudioLaunchContext(window.location.search)', 'Not connected']) {
    if (!app.includes(marker)) violations.push({ code: 'AG254', message: 'Studio foundation shell invariant missing.', detail: marker });
  }

  const runtimeSurface = [identity, context, main, app, html].join('\n');
  for (const forbidden of [
    /\bfetch\s*\(/,
    /\bWebSocket\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bchrome\./,
    /\blocalStorage\b/,
    /\bindexedDB\b/,
    /127\.0\.0\.1:43110|localhost:43110/,
    /@github-decrypter\/(?:github-provider|github-app|git|workspace|shared)/,
    /apps\/(?:local|extension)/,
  ]) if (forbidden.test(runtimeSurface)) {
    violations.push({ code: 'AG255', message: 'React Studio crossed into forbidden network, persistence, runtime or cross-app authority.', detail: String(forbidden) });
  }

  if (policy.currentBuild < rule.pwaBuild) {
    for (const forbiddenPath of [
      'apps/studio/public/manifest.webmanifest',
      'apps/studio/public/manifest.json',
      'apps/studio/manifest.webmanifest',
      'apps/studio/src/pwa.ts',
      'apps/studio/src/service-worker.ts',
      'apps/studio/src/service-worker.tsx',
      'apps/studio/src/sw.ts',
    ]) if (exists(forbiddenPath)) violations.push({ code: 'AG256', message: 'Build 28 PWA authority arrived before its owning build.', detail: forbiddenPath });
    if (/<link[^>]+rel=["']manifest["']/i.test(html) || /navigator\.serviceWorker/.test(`${main}\n${read('apps/studio/src/pwa.ts')}`)) {
      violations.push({ code: 'AG256', message: 'Build 28 PWA activation arrived before its owning build.' });
    }
  }

  for (const forbiddenPath of [
    'apps/studio/src/server.ts',
    'apps/studio/src/server.tsx',
    'apps/studio/src/entry-server.tsx',
  ]) if (exists(forbiddenPath)) violations.push({ code: 'AG256', message: 'Server/SSR authority is not authorized by the Studio foundation.', detail: forbiddenPath });
  if (/react-server|use server/i.test(`${runtimeSurface}\n${vite}`)) {
    violations.push({ code: 'AG256', message: 'React Server Component or SSR authority is not authorized.' });
  }

  const pwaExpected = policy.currentBuild >= rule.pwaBuild;
  if (
    rule.ownerRoot !== 'apps/studio'
    || rule.pwaBuild !== 28 || rule.designSystemBuild !== 29 || rule.ideLayoutBuild !== 30
    || rule.framework !== 'React 19' || rule.bundler !== 'Vite 8'
    || rule.clientOnly !== true || rule.ssr !== false || rule.reactServerComponents !== false
    || rule.repositoryLaunchContext !== true || rule.repositoryLaunchSchema !== 'gd-studio-launch/1'
    || rule.repositoryIdentityPublicOnly !== true
    || rule.networkAuthority !== false || rule.storageAuthority !== false
    || rule.serviceWorker !== pwaExpected || rule.webAppManifest !== pwaExpected
    || rule.localRuntimeTransport !== false || rule.githubProviderDirectAccess !== false
    || rule.extensionDirectAccess !== false || rule.contextPersistence !== false || rule.externalTransport !== false
    || policy.phaseGates.studioReactBuild !== 27 || policy.phaseGates.pwaBuild !== 28
    || policy.phaseGates.designSystemBuild !== 29 || policy.phaseGates.ideLayoutBuild !== 30
  ) violations.push({ code: 'AG257', message: 'Build 27+ machine-readable Studio boundaries were weakened.' });

  const studioRule = policy.appRules?.['@github-decrypter/studio'];
  if (
    !studioRule
    || JSON.stringify(studioRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/protocol'])
    || !Array.isArray(studioRule.allowedExternalDependencies)
    || !studioRule.allowedExternalDependencies.includes('react')
    || !studioRule.allowedExternalDependencies.includes('react-dom')
    || !studioRule.allowedExternalDependencies.includes('vite')
  ) violations.push({ code: 'AG258', message: 'Studio app dependency authority is missing or broader than declared.' });

  for (const required of [
    'apps/studio/index.html',
    'apps/studio/vite.config.ts',
    'apps/studio/src/main.tsx',
    'apps/studio/src/App.tsx',
    'apps/studio/src/studio-context.ts',
    'apps/studio/src/styles.css',
    'docs/architecture/REACT_STUDIO_FOUNDATION.md',
    'docs/builds/BUILD_27_REACT_STUDIO_FOUNDATION.md',
    'scripts/test-build27-react-studio-foundation.mjs',
    'scripts/test-build27-react-studio-runtime.ts',
    'scripts/test-build27-react-studio-guardian-negative.mjs',
    'scripts/tsconfig.build27-tests.json',
    '.github/workflows/build27-react-studio-foundation.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG259', message: 'Required Build 27 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-studio-report/2',
  currentBuild: policy.currentBuild,
  framework: rule?.framework ?? null,
  bundler: rule?.bundler ?? null,
  clientOnly: rule?.clientOnly ?? null,
  pwa: Boolean(rule?.serviceWorker && rule?.webAppManifest),
  networkAuthority: rule?.networkAuthority ?? null,
  localRuntimeTransport: rule?.localRuntimeTransport ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
