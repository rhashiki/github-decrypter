import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.studioAuthority;
const violations = [];

const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));

if (!rule || policy.currentBuild < 28 || policy.phaseGates?.pwaBuild !== 28 || rule.pwaBuild !== 28) {
  violations.push({ code: 'AG260', message: 'Build 28 PWA authority policy is missing or inactive.' });
} else {
  let manifest = null;
  try { manifest = JSON.parse(read('apps/studio/public/manifest.webmanifest')); }
  catch { violations.push({ code: 'AG261', message: 'Studio Web App Manifest is missing or invalid JSON.' }); }

  if (manifest) {
    const iconMap = new Map((manifest.icons ?? []).map((icon) => [icon.sizes, icon]));
    const icon192 = iconMap.get('192x192');
    const icon512 = iconMap.get('512x512');
    if (
      manifest.name !== 'GitHub Decrypter Studio'
      || manifest.short_name !== 'GitHub Decrypter'
      || manifest.id !== './'
      || manifest.start_url !== './'
      || manifest.scope !== './'
      || manifest.display !== 'standalone'
      || manifest.prefer_related_applications !== false
      || icon192?.src !== './icons/icon-192.png'
      || icon192?.type !== 'image/png'
      || icon512?.src !== './icons/icon-512.png'
      || icon512?.type !== 'image/png'
    ) violations.push({ code: 'AG261', message: 'Build 28 installability manifest boundary is invalid.' });
  }

  const html = read('apps/studio/index.html');
  const main = read('apps/studio/src/main.tsx');
  const pwa = read('apps/studio/src/pwa.ts');
  const vite = read('apps/studio/vite.config.ts');
  const app = read('apps/studio/src/App.tsx');
  const studioPackage = JSON.parse(read('apps/studio/package.json'));
  const versionMatch = /^0\.0\.(\d+)$/.exec(String(studioPackage.version ?? ''));
  const studioBuild = versionMatch ? Number(versionMatch[1]) : NaN;
  const cacheNameMarker = Number.isSafeInteger(studioBuild)
    ? `PWA_CACHE_NAME = \`\${PWA_CACHE_PREFIX}v${studioBuild}\``
    : null;

  for (const marker of [
    'rel="manifest" href="./manifest.webmanifest"',
    'name="theme-color"',
    'apple-mobile-web-app-capable',
  ]) if (!html.includes(marker)) violations.push({ code: 'AG262', message: 'Studio PWA HTML activation invariant missing.', detail: marker });

  for (const marker of [
    "import { registerStudioPwa } from './pwa.js'",
    "window.addEventListener('load'",
    'void registerStudioPwa()',
  ]) if (!main.includes(marker)) violations.push({ code: 'AG262', message: 'Studio PWA registration bootstrap invariant missing.', detail: marker });

  for (const marker of [
    "STUDIO_PWA_SERVICE_WORKER = './service-worker.js'",
    "STUDIO_PWA_SCOPE = './'",
    "'serviceWorker' in navigator",
    'navigator.serviceWorker.register',
    "updateViaCache: 'none'",
  ]) if (!pwa.includes(marker)) violations.push({ code: 'AG262', message: 'Studio service-worker registration invariant missing.', detail: marker });

  for (const marker of [
    "PWA_CACHE_PREFIX = 'gd-studio-shell-'",
    cacheNameMarker,
    "name: 'gd-studio-pwa-shell'",
    "apply: 'build'",
    "fileName: 'service-worker.js'",
    "'./manifest.webmanifest'",
    "'./icons/icon-192.png'",
    "'./icons/icon-512.png'",
    'studioPwaShellPlugin()',
  ].filter(Boolean)) if (!vite.includes(marker)) violations.push({ code: 'AG263', message: 'Vite PWA app-shell generation invariant missing.', detail: marker });

  for (const marker of [
    "request.method !== 'GET'",
    'requestUrl.origin !== self.location.origin',
    "request.mode === 'navigate'",
    'SHELL_URL_SET.has(shellUrl)',
    'caches.match(INDEX_URL)',
    'key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME',
    'self.skipWaiting()',
    'self.clients.claim()',
  ]) if (!vite.includes(marker)) violations.push({ code: 'AG264', message: 'Generated service-worker safety/offline invariant missing.', detail: marker });

  const privilegedSurface = [main, pwa, app].join('\n');
  for (const forbidden of [
    /\blocalStorage\b/,
    /\bindexedDB\b/,
    /\bWebSocket\b/,
    /\bXMLHttpRequest\b/,
    /127\.0\.0\.1:43110|localhost:43110/,
    /@github-decrypter\/(?:github-provider|github-app|git|workspace|shared)/,
    /apps\/(?:local|extension)/,
  ]) if (forbidden.test(privilegedSurface)) {
    violations.push({ code: 'AG265', message: 'Build 28 PWA crossed into project persistence, provider or Local Runtime authority.', detail: String(forbidden) });
  }

  if (
    rule.ownerRoot !== 'apps/studio'
    || rule.serviceWorker !== true || rule.webAppManifest !== true || rule.installable !== true
    || rule.appShellCache !== true || rule.offlineAppShell !== true || rule.sameOriginShellFetch !== true
    || rule.cacheNamePrefix !== 'gd-studio-shell-'
    || rule.manifestPath !== 'apps/studio/public/manifest.webmanifest'
    || rule.serviceWorkerOwner !== 'apps/studio/vite.config.ts'
    || JSON.stringify(rule.iconSizes) !== JSON.stringify([192, 512])
    || rule.networkAuthority !== false || rule.storageAuthority !== false
    || rule.projectDataPersistence !== false || rule.repositoryContextPersistence !== false
    || rule.contextPersistence !== false || rule.localRuntimeTransport !== false
    || rule.githubProviderDirectAccess !== false || rule.extensionDirectAccess !== false
    || rule.externalTransport !== false
  ) violations.push({ code: 'AG265', message: 'Build 28 machine-readable PWA data/authority boundaries were weakened.' });

  if (
    rule.pwaProductionPackagingBuild !== 122
    || policy.phaseGates?.pwaProductionPackagingBuild !== 122
    || rule.productionHosting !== false
    || rule.productionPackaging !== false
    || policy.phaseGates?.releaseAuthorityBuild !== 134
  ) violations.push({ code: 'AG266', message: 'Build 28 improperly claimed production packaging, hosting or release authority.' });

  const dependencies = {
    ...(studioPackage.dependencies ?? {}),
    ...(studioPackage.devDependencies ?? {}),
  };
  for (const forbiddenDependency of ['vite-plugin-pwa', 'workbox-build', 'workbox-window', 'workbox-core']) {
    if (dependencies[forbiddenDependency]) violations.push({ code: 'AG267', message: 'Build 28 introduced undeclared opaque PWA dependency.', detail: forbiddenDependency });
  }
  if (!Number.isSafeInteger(studioBuild) || studioBuild < 28) {
    violations.push({ code: 'AG267', message: 'Studio package version regressed below the PWA owning Build.' });
  }

  const designSystemPremature = policy.currentBuild < rule.designSystemBuild;
  const ideLayoutPremature = policy.currentBuild < rule.ideLayoutBuild;
  const environmentDoctorActive = policy.currentBuild >= (policy.phaseGates?.environmentDoctorBuild ?? Number.POSITIVE_INFINITY);
  if (
    rule.designSystemBuild !== 29 || rule.ideLayoutBuild !== 30
    || policy.phaseGates?.designSystemBuild !== 29 || policy.phaseGates?.ideLayoutBuild !== 30
    || (designSystemPremature && (!app.includes('Design System') || !app.includes('Build 29')))
    || (ideLayoutPremature && (!app.includes('IDE Layout') || !app.includes('Build 30')))
    || (!environmentDoctorActive && !app.includes('Not connected'))
    || (environmentDoctorActive && (!app.includes('Environment Doctor') || !app.includes('runtimeStatusLabel(environmentDoctorOutcome)')))
  ) violations.push({ code: 'AG268', message: 'Later Studio authority arrived before its phase gate or deferral markers disappeared.' });

  for (const required of [
    'apps/studio/public/manifest.webmanifest',
    'apps/studio/public/icons/icon-192.png',
    'apps/studio/public/icons/icon-512.png',
    'apps/studio/src/pwa.ts',
    'docs/architecture/PWA_FOUNDATION.md',
    'docs/builds/BUILD_28_PWA.md',
    'scripts/test-build28-pwa.mjs',
    'scripts/test-build28-pwa-runtime.ts',
    'scripts/test-build28-pwa-dist.mjs',
    'scripts/test-build28-pwa-guardian-negative.mjs',
    'scripts/tsconfig.build28-tests.json',
    '.github/workflows/build28-pwa.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG269', message: 'Required Build 28 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-pwa-report/2',
  currentBuild: policy.currentBuild,
  installable: rule?.installable ?? null,
  offlineAppShell: rule?.offlineAppShell ?? null,
  sameOriginShellFetch: rule?.sameOriginShellFetch ?? null,
  productionPackaging: rule?.productionPackaging ?? null,
  localRuntimeTransport: rule?.localRuntimeTransport ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
