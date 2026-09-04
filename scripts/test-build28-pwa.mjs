import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const studioPackage = json('apps/studio/package.json');
const manifest = json('apps/studio/public/manifest.webmanifest');
const html = read('apps/studio/index.html');
const main = read('apps/studio/src/main.tsx');
const pwa = read('apps/studio/src/pwa.ts');
const vite = read('apps/studio/vite.config.ts');
const identity = read('apps/studio/src/index.ts');

assert.equal(policy.currentBuild, 28);
assert.equal(policy.phaseGates.pwaBuild, 28);
assert.equal(rootPackage.version, '0.0.28');
assert.equal(studioPackage.version, '0.0.28');
assert.equal(manifest.name, 'GitHub Decrypter Studio');
assert.equal(manifest.short_name, 'GitHub Decrypter');
assert.equal(manifest.id, './');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.prefer_related_applications, false);
assert.deepEqual(manifest.icons.map(({ src, sizes, type }) => ({ src, sizes, type })), [
  { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
]);

for (const marker of [
  'rel="manifest" href="./manifest.webmanifest"',
  'name="theme-color"',
  'apple-mobile-web-app-capable',
]) assert.ok(html.includes(marker), `Missing PWA HTML marker: ${marker}`);

for (const marker of [
  "import { registerStudioPwa } from './pwa.js'",
  "window.addEventListener('load'",
  'void registerStudioPwa()',
]) assert.ok(main.includes(marker), `Missing PWA bootstrap marker: ${marker}`);

for (const marker of [
  "STUDIO_PWA_SERVICE_WORKER = './service-worker.js'",
  "STUDIO_PWA_SCOPE = './'",
  "'serviceWorker' in navigator",
  'navigator.serviceWorker.register',
  "updateViaCache: 'none'",
]) assert.ok(pwa.includes(marker), `Missing PWA registration marker: ${marker}`);

for (const marker of [
  "PWA_CACHE_PREFIX = 'gd-studio-shell-'",
  "PWA_CACHE_NAME = `${PWA_CACHE_PREFIX}v28`",
  "name: 'gd-studio-pwa-shell'",
  "apply: 'build'",
  "fileName: 'service-worker.js'",
  "request.method !== 'GET'",
  'requestUrl.origin !== self.location.origin',
  'SHELL_URL_SET.has(shellUrl)',
  'caches.match(INDEX_URL)',
]) assert.ok(vite.includes(marker), `Missing PWA build/service-worker marker: ${marker}`);

assert.ok(identity.includes('pwa: true'));
assert.ok(identity.includes('offlineAppShell: true'));
assert.equal(policy.studioAuthority.serviceWorker, true);
assert.equal(policy.studioAuthority.webAppManifest, true);
assert.equal(policy.studioAuthority.installable, true);
assert.equal(policy.studioAuthority.appShellCache, true);
assert.equal(policy.studioAuthority.offlineAppShell, true);
assert.equal(policy.studioAuthority.sameOriginShellFetch, true);
assert.equal(policy.studioAuthority.networkAuthority, false);
assert.equal(policy.studioAuthority.storageAuthority, false);
assert.equal(policy.studioAuthority.projectDataPersistence, false);
assert.equal(policy.studioAuthority.repositoryContextPersistence, false);
assert.equal(policy.studioAuthority.localRuntimeTransport, false);
assert.equal(policy.studioAuthority.githubProviderDirectAccess, false);
assert.equal(policy.studioAuthority.productionPackaging, false);
assert.equal(policy.studioAuthority.pwaProductionPackagingBuild, 122);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build28-pwa-static/1',
  build: 28,
  installable: true,
  offlineAppShell: true,
  sameOriginShellFetch: true,
  iconSizes: [192, 512],
  projectDataPersistence: false,
  localRuntimeTransport: false,
  productionPackaging: false,
}, null, 2));
