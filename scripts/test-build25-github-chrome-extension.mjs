import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));

const policy = json('architecture.guardian.json');
const rule = policy.extensionAuthority;
const manifest = json('manifest.json');
const extensionPackage = json('apps/extension/package.json');
const contract = read('apps/extension/src/index.ts');
const worker = read('apps/extension/browser/service-worker.js');
const content = read('apps/extension/browser/content-script.js');

assert.ok(policy.currentBuild >= 25);
assert.equal(policy.phaseGates.extensionActivationBuild, 25);
assert.equal(policy.phaseGates.repositoryLauncherBuild, 26);
assert.equal(rule.minimumBuild, 25);
assert.equal(rule.repositoryLauncherBuild, 26);
assert.equal(rule.studioReactBuild, 27);
assert.equal(rule.bridgeSchema, 'gd-extension-bridge/1');
assert.deepEqual(rule.hostAllowlist, ['https://github.com/*']);
assert.equal(rule.lightweightBridge, true);
assert.equal(rule.statelessPageContext, true);
assert.equal(rule.networkAuthority, false);
assert.equal(rule.secretAuthority, false);
assert.equal(rule.durableExecution, false);
assert.equal(rule.repositoryDetection, false);
assert.equal(rule.fab, false);
assert.equal(rule.openInFlow, false);
assert.equal(rule.studioLaunch, false);
assert.equal(rule.localRuntimeDirectTransport, false);
assert.equal(rule.contentDomMutation, false);
assert.equal(rule.contextPersistence, false);
assert.equal(rule.externalHosts, false);

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, 'GitHub Decrypter');
if (policy.currentBuild === 25) assert.equal(manifest.version, '0.0.25');
assert.equal(manifest.background?.service_worker, rule.serviceWorker);
assert.deepEqual(manifest.host_permissions, rule.hostAllowlist);
assert.equal(manifest.permissions, undefined);
assert.equal(manifest.content_scripts?.length, 1);
assert.deepEqual(manifest.content_scripts[0]?.matches, rule.hostAllowlist);
assert.deepEqual(manifest.content_scripts[0]?.js, [rule.contentScript]);
assert.equal(manifest.content_scripts[0]?.run_at, 'document_idle');

assert.equal(extensionPackage.version, '0.0.25');
assert.deepEqual(Object.keys(extensionPackage.dependencies ?? {}), ['@github-decrypter/protocol']);

for (const marker of [
  "GITHUB_EXTENSION_BUILD = 25",
  "GITHUB_EXTENSION_VERSION = '0.0.25'",
  "GITHUB_EXTENSION_BRIDGE_SCHEMA = 'gd-extension-bridge/1'",
  "GITHUB_EXTENSION_ALLOWED_ORIGIN = 'https://github.com'",
  "'gd.extension.hello'",
  "'gd.extension.page-context'",
  'repositoryLauncher: false',
  'networkAuthority: false',
  'durableExecution: false',
]) assert.ok(contract.includes(marker), `missing extension contract marker: ${marker}`);

for (const marker of [
  "BRIDGE_SCHEMA = 'gd-extension-bridge/1'",
  "ALLOWED_ORIGIN = 'https://github.com'",
  'sender.id !== chrome.runtime.id',
  "url.hostname !== 'github.com'",
  'senderUrl.pathname !== message.pathname',
  'chrome.runtime.onMessage.addListener',
  'chrome.action.setTitle',
]) assert.ok(worker.includes(marker), `missing service-worker invariant: ${marker}`);

for (const marker of [
  "BRIDGE_SCHEMA = 'gd-extension-bridge/1'",
  "ALLOWED_ORIGIN = 'https://github.com'",
  'location.origin !== ALLOWED_ORIGIN',
  'chrome.runtime.sendMessage(context',
  "document.addEventListener('turbo:load'",
]) assert.ok(content.includes(marker), `missing content-script invariant: ${marker}`);

const browserSource = `${worker}\n${content}`;
for (const forbidden of [
  /\bfetch\s*\(/,
  /\bWebSocket\s*\(/,
  /\bXMLHttpRequest\b/,
  /chrome\.storage/,
  /localStorage/,
  /indexedDB/,
  /document\.createElement\s*\(/,
  /\.appendChild\s*\(/,
  /chrome\.tabs\.create\s*\(/,
  /window\.open\s*\(/,
  /127\.0\.0\.1|localhost|43110/,
]) assert.doesNotMatch(browserSource, forbidden);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build25-github-chrome-extension-static/1',
  build: 25,
  currentBuild: policy.currentBuild,
  manifestVersion: manifest.manifest_version,
  extensionVersion: manifest.version,
  bridgeSchema: rule.bridgeSchema,
  hosts: rule.hostAllowlist,
  lightweightBridge: true,
  statelessPageContext: true,
  networkAuthority: false,
  repositoryLauncher: false,
  repositoryDetection: false,
  contextPersistence: false,
}, null, 2));
