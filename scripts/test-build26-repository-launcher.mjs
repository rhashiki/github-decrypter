import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));

const policy = json('architecture.guardian.json');
const rule = policy.extensionAuthority;
const manifest = json('manifest.json');
const extensionPackage = json('apps/extension/package.json');
const contract = read('apps/extension/src/index.ts');
const content = read(rule.contentScript);
const worker = read(rule.serviceWorker);
const launcherHtml = read(rule.launcherPage);
const launcherScript = read(rule.launcherScript);

assert.equal(policy.currentBuild, 26);
assert.equal(policy.phaseGates.repositoryLauncherBuild, 26);
assert.equal(policy.phaseGates.studioReactBuild, 27);
assert.equal(rule.repositoryDetection, true);
assert.equal(rule.repositoryIdentitySource, 'github-meta+pathname');
assert.equal(rule.fab, true);
assert.equal(rule.openInFlow, true);
assert.equal(rule.extensionOwnedLauncher, true);
assert.equal(rule.connectionStatus, 'extension-bridge');
assert.equal(rule.studioLaunch, false);
assert.equal(rule.networkAuthority, false);
assert.equal(rule.secretAuthority, false);
assert.equal(rule.localRuntimeDirectTransport, false);
assert.equal(rule.contextPersistence, false);
assert.equal(rule.externalHosts, false);

assert.equal(manifest.version, '0.0.26');
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.host_permissions, ['https://github.com/*']);
assert.equal(manifest.permissions, undefined);
assert.equal(extensionPackage.version, '0.0.26');

for (const marker of [
  'GITHUB_EXTENSION_BUILD = 26', "GITHUB_EXTENSION_VERSION = '0.0.26'",
  "'gd.extension.repository-context'", "'gd.extension.open-repository'", "'gd.extension.launcher-status'",
  'GitHubRepositoryIdentity', 'detectGitHubRepositoryFromPage', 'repositoryLauncher: true', 'studioReady: false',
]) assert.ok(contract.includes(marker), `missing Build 26 contract marker: ${marker}`);

for (const marker of [
  'octolytics-dimension-repository_nwo', 'function detectRepository()', "nwo[0] !== segments[0]", "nwo[1] !== segments[1]",
  "FAB_ID = 'gd-repository-launcher-fab'", "document.createElement('button')", "button.textContent = 'GD'",
  'Open in GitHub Decrypter', 'document.documentElement.appendChild(button)', 'OPEN_REPOSITORY_TYPE',
]) assert.ok(content.includes(marker), `missing content launcher marker: ${marker}`);
assert.doesNotMatch(content, /location\.(?:search|hash)\b/);
assert.doesNotMatch(content, /\.innerHTML\s*=|insertAdjacentHTML|document\.write\s*\(/);

for (const marker of [
  'function validRepository(repository, senderUrl)', 'function trustedLauncherSender(sender)',
  'chrome.runtime.getURL(LAUNCHER_PAGE)', "target.searchParams.set('owner'", "target.searchParams.set('repo'",
  'chrome.tabs.create({ url: target.toString() })', 'repositoryLauncher: true', 'studioReady: false',
]) assert.ok(worker.includes(marker), `missing worker launcher marker: ${marker}`);

assert.match(launcherHtml, /Repository Launcher/);
assert.match(launcherHtml, /launcher\.js/);
assert.match(launcherScript, /gd\.extension\.launcher-status/);
assert.match(launcherScript, /params\.get\('owner'\)/);
assert.match(launcherScript, /params\.get\('repo'\)/);

const browser = `${content}\n${worker}\n${launcherScript}`;
for (const forbidden of [
  /\bfetch\s*\(/, /\bWebSocket\s*\(/, /\bXMLHttpRequest\b/, /chrome\.storage/,
  /localStorage/, /indexedDB/, /127\.0\.0\.1|localhost|43110/,
]) assert.doesNotMatch(browser, forbidden);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build26-repository-launcher-static/1',
  build: 26,
  repositoryDetection: 'github-meta+pathname',
  fab: true,
  openInFlow: true,
  extensionOwnedLauncher: true,
  connectionStatus: 'extension-bridge',
  studioLaunch: false,
  networkAuthority: false,
  contextPersistence: false,
}, null, 2));
