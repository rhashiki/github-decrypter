import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const studioPackage = json('apps/studio/package.json');
const identity = read('apps/studio/src/index.ts');
const context = read('apps/studio/src/studio-context.ts');
const main = read('apps/studio/src/main.tsx');
const app = read('apps/studio/src/App.tsx');
const html = read('apps/studio/index.html');
const vite = read('apps/studio/vite.config.ts');

assert.equal(policy.currentBuild, 27);
assert.equal(policy.phaseGates.studioReactBuild, 27);
assert.equal(policy.phaseGates.pwaBuild, 28);
assert.equal(policy.phaseGates.designSystemBuild, 29);
assert.equal(policy.phaseGates.ideLayoutBuild, 30);
assert.equal(rootPackage.version, '0.0.27');
assert.equal(studioPackage.version, '0.0.27');
assert.equal(studioPackage.dependencies.react, '19.2.7');
assert.equal(studioPackage.dependencies['react-dom'], '19.2.7');
assert.equal(studioPackage.devDependencies.vite, '8.2.2');
assert.equal(studioPackage.devDependencies['@vitejs/plugin-react'], '6.1.1');
assert.equal(studioPackage.dependencies['@github-decrypter/protocol'], 'workspace:*');

for (const marker of [
  'STUDIO_BUILD = 27',
  "STUDIO_VERSION = '0.0.27'",
  "STUDIO_LAUNCH_SCHEMA = 'gd-studio-launch/1'",
  'parseStudioLaunchContext',
]) assert.ok(context.includes(marker), `Missing Studio context marker: ${marker}`);

for (const marker of ["framework: 'React 19'", "bundler: 'Vite 8'", 'Client-only React Studio foundation']) {
  assert.ok(identity.includes(marker), `Missing Studio identity marker: ${marker}`);
}
for (const marker of ["createRoot(root).render", '<StrictMode>', "document.getElementById('root')"]) {
  assert.ok(main.includes(marker), `Missing React bootstrap marker: ${marker}`);
}
assert.ok(app.includes('React Studio foundation ready'));
assert.ok(app.includes('Build 28'));
assert.ok(app.includes('Not connected'));
assert.ok(html.includes('id="root"'));
assert.ok(html.includes('/src/main.tsx'));
assert.ok(vite.includes('plugins: [react()]'));
assert.ok(vite.includes("host: '127.0.0.1'"));

const source = [identity, context, main, app, html, vite].join('\n');
for (const forbidden of [
  /\bfetch\s*\(/,
  /\bWebSocket\s*\(/,
  /\bXMLHttpRequest\b/,
  /\blocalStorage\b/,
  /\bindexedDB\b/,
  /navigator\.serviceWorker/,
  /@github-decrypter\/(?:github-provider|github-app|git|workspace|shared)/,
]) assert.doesNotMatch(source, forbidden);

assert.equal(policy.studioAuthority.clientOnly, true);
assert.equal(policy.studioAuthority.ssr, false);
assert.equal(policy.studioAuthority.reactServerComponents, false);
assert.equal(policy.studioAuthority.networkAuthority, false);
assert.equal(policy.studioAuthority.storageAuthority, false);
assert.equal(policy.studioAuthority.serviceWorker, false);
assert.equal(policy.studioAuthority.webAppManifest, false);
assert.equal(policy.studioAuthority.localRuntimeTransport, false);
assert.equal(policy.studioAuthority.githubProviderDirectAccess, false);
assert.equal(policy.studioAuthority.extensionDirectAccess, false);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build27-react-studio-foundation-static/1',
  build: 27,
  framework: 'React 19',
  reactVersion: studioPackage.dependencies.react,
  bundler: 'Vite 8',
  viteVersion: studioPackage.devDependencies.vite,
  clientOnly: true,
  repositoryLaunchContext: true,
  pwa: false,
  localRuntimeTransport: false,
  networkAuthority: false,
}, null, 2));
