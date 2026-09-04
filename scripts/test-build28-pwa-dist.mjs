import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'apps/studio/dist');
const read = (relative) => fs.readFileSync(path.join(dist, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(dist, relative));

for (const required of [
  'index.html',
  'manifest.webmanifest',
  'service-worker.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
]) assert.ok(exists(required), `Missing built PWA artifact: ${required}`);

const manifest = JSON.parse(read('manifest.webmanifest'));
const index = read('index.html');
const sw = read('service-worker.js');

assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.ok(index.includes('rel="manifest"'));
assert.ok(sw.includes("const CACHE_PREFIX = \"gd-studio-shell-\""));
assert.ok(sw.includes("const CACHE_NAME = \"gd-studio-shell-v28\""));
assert.ok(sw.includes("request.method !== 'GET'"));
assert.ok(sw.includes('requestUrl.origin !== self.location.origin'));
assert.ok(sw.includes("request.mode === 'navigate'"));
assert.ok(sw.includes('SHELL_URL_SET.has(shellUrl)'));
assert.ok(sw.includes('caches.match(INDEX_URL)'));
assert.doesNotMatch(sw, /127\.0\.0\.1:43110|localhost:43110/);
assert.doesNotMatch(sw, /https:\/\/(?:api\.)?github\.com/);
assert.doesNotMatch(sw, /localStorage|indexedDB/);

const assetDir = path.join(dist, 'assets');
const builtAssets = fs.existsSync(assetDir)
  ? fs.readdirSync(assetDir).filter((name) => !name.endsWith('.map')).sort()
  : [];
assert.ok(builtAssets.length > 0, 'Vite did not emit hashed application assets.');
for (const asset of builtAssets) {
  assert.ok(sw.includes(`./assets/${asset}`), `Service worker shell inventory omitted built asset: ${asset}`);
}

function pngDimensions(relative) {
  const bytes = fs.readFileSync(path.join(dist, relative));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${relative} is not a PNG.`);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}
assert.deepEqual(pngDimensions('icons/icon-192.png'), { width: 192, height: 192 });
assert.deepEqual(pngDimensions('icons/icon-512.png'), { width: 512, height: 512 });

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build28-pwa-dist/1',
  builtAssets,
  manifestIncluded: true,
  serviceWorkerIncluded: true,
  hashedAssetsPrecached: true,
  offlineNavigationFallback: true,
  iconDimensions: [192, 512],
  privilegedHostsAbsent: true,
}, null, 2));
