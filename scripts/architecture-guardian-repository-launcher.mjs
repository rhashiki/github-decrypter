import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.extensionAuthority;
const violations = [];
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));

if (!rule || policy.currentBuild < 26 || rule.repositoryLauncherBuild !== 26) {
  violations.push({ code: 'AG240', message: 'Repository Launcher authority policy is missing or inactive.' });
} else {
  const manifest = JSON.parse(read('manifest.json'));
  if (manifest.version !== '0.0.26' || manifest.manifest_version !== 3
    || JSON.stringify(manifest.host_permissions ?? []) !== JSON.stringify(['https://github.com/*'])
    || Array.isArray(manifest.permissions)) {
    violations.push({ code: 'AG241', message: 'Build 26 manifest/version/permission boundary is invalid.' });
  }

  const contract = read('apps/extension/src/index.ts');
  for (const marker of [
    'GITHUB_EXTENSION_BUILD = 26', "GITHUB_EXTENSION_VERSION = '0.0.26'",
    "GITHUB_EXTENSION_LAUNCHER_PAGE = 'apps/extension/browser/launcher.html'",
    "'gd.extension.repository-context'", "'gd.extension.open-repository'", "'gd.extension.launcher-status'",
    'GitHubRepositoryIdentity', 'detectGitHubRepositoryFromPage', 'repositoryLauncher: true', "connection: 'extension-bridge'",
    'studioReady: false', 'networkAuthority: false', 'durableExecution: false',
  ]) if (!contract.includes(marker)) violations.push({ code: 'AG242', message: 'Repository Launcher contract invariant missing.', detail: marker });
  if (/\bfetch\s*\(|\bWebSocket\s*\(|\bXMLHttpRequest\b|\bnode:|\bprocess\./.test(contract)) {
    violations.push({ code: 'AG242', message: 'Repository Launcher contract gained forbidden execution/network authority.' });
  }

  const content = read(rule.contentScript);
  for (const marker of [
    'function detectRepository()', 'octolytics-dimension-repository_nwo', "nwo[0] !== segments[0]", "nwo[1] !== segments[1]",
    "RESERVED_TOP_LEVEL.has(owner.toLowerCase())", "type: REPOSITORY_CONTEXT_TYPE", 'repository,',
  ]) if (!content.includes(marker)) violations.push({ code: 'AG243', message: 'Fail-closed repository detection invariant missing.', detail: marker });
  if (/location\.(?:search|hash)\b/.test(content)) {
    violations.push({ code: 'AG243', message: 'GitHub query/hash data may not enter Repository Launcher context.' });
  }

  for (const marker of [
    "FAB_ID = 'gd-repository-launcher-fab'", "document.createElement('button')", "button.textContent = 'GD'",
    "button.setAttribute('aria-label', 'Open in GitHub Decrypter')", 'document.documentElement.appendChild(button)',
    'OPEN_REPOSITORY_TYPE', 'button.onclick = () =>',
  ]) if (!content.includes(marker)) violations.push({ code: 'AG244', message: 'Repository FAB invariant missing.', detail: marker });
  for (const forbidden of [/\.innerHTML\s*=/, /insertAdjacentHTML/, /document\.write\s*\(/, /eval\s*\(/, /new Function\s*\(/]) {
    if (forbidden.test(content)) violations.push({ code: 'AG244', message: 'Repository FAB uses an unsafe DOM/code injection primitive.', detail: String(forbidden) });
  }

  const worker = read(rule.serviceWorker);
  for (const marker of [
    "EXTENSION_BUILD = 26", "EXTENSION_VERSION = '0.0.26'", "OPEN_REPOSITORY_TYPE = 'gd.extension.open-repository'",
    'function validRepository(repository, senderUrl)', "segments[0] !== owner", "segments[1] !== name",
    'function trustedLauncherSender(sender)', 'chrome.runtime.getURL(LAUNCHER_PAGE)',
    'target.searchParams.set(\'owner\'', 'target.searchParams.set(\'repo\'', 'chrome.tabs.create({ url: target.toString() })',
  ]) if (!worker.includes(marker)) violations.push({ code: 'AG245', message: 'Validated extension-owned handoff invariant missing.', detail: marker });
  if (/chrome\.tabs\.create\s*\(\s*\{\s*url:\s*["']https?:/i.test(worker) || /window\.open\s*\(/.test(worker)) {
    violations.push({ code: 'AG245', message: 'Repository Launcher may only open its extension-owned launcher page.' });
  }

  const launcherHtml = read(rule.launcherPage);
  const launcherScript = read(rule.launcherScript);
  for (const marker of ['Repository Launcher', 'launcher.js', 'bridge-status', 'github-link']) {
    if (!launcherHtml.includes(marker)) violations.push({ code: 'AG246', message: 'Launcher page invariant missing.', detail: marker });
  }
  for (const marker of [
    "LAUNCHER_STATUS_TYPE = 'gd.extension.launcher-status'", "params.get('owner')", "params.get('repo')",
    'chrome.runtime.sendMessage', 'response.ok !== true', 'bridgeStatus.textContent',
  ]) if (!launcherScript.includes(marker)) violations.push({ code: 'AG246', message: 'Launcher status/handoff invariant missing.', detail: marker });
  const launcherSurface = `${launcherHtml}\n${launcherScript}`;
  for (const forbidden of [
    /<script[^>]+src=["']https?:/i, /<iframe\b/i, /<form\b/i, /\bfetch\s*\(/, /\bWebSocket\s*\(/,
    /\bXMLHttpRequest\b/, /chrome\.storage/, /localStorage/, /indexedDB/, /127\.0\.0\.1|localhost|43110/,
  ]) if (forbidden.test(launcherSurface)) violations.push({ code: 'AG246', message: 'Launcher page gained forbidden external/runtime/persistence authority.', detail: String(forbidden) });

  const browserSource = `${content}\n${worker}\n${launcherScript}`;
  for (const forbidden of [
    /\bfetch\s*\(/, /\bWebSocket\s*\(/, /\bXMLHttpRequest\b/, /chrome\.storage/, /localStorage/, /indexedDB/,
    /chrome\.cookies/, /chrome\.identity/, /chrome\.nativeMessaging/, /127\.0\.0\.1|localhost|43110/,
    /https?:\/\/(?!github\.com)/i,
  ]) if (forbidden.test(browserSource)) violations.push({ code: 'AG247', message: 'Repository Launcher crossed into forbidden network/secret/runtime authority.', detail: String(forbidden) });

  if (
    rule.repositoryDetection !== true || rule.repositoryIdentitySource !== 'github-meta+pathname'
    || rule.fab !== true || rule.openInFlow !== true || rule.extensionOwnedLauncher !== true
    || rule.connectionStatus !== 'extension-bridge' || rule.contentDomMutation !== true
    || rule.networkAuthority !== false || rule.secretAuthority !== false || rule.durableExecution !== false
    || rule.studioLaunch !== false || rule.localRuntimeDirectTransport !== false
    || rule.contextPersistence !== false || rule.externalHosts !== false
    || rule.launcherPage !== 'apps/extension/browser/launcher.html'
    || rule.launcherScript !== 'apps/extension/browser/launcher.js'
    || policy.phaseGates.repositoryLauncherBuild !== 26 || policy.phaseGates.studioReactBuild !== 27
  ) violations.push({ code: 'AG248', message: 'Build 26 machine-readable Repository Launcher boundaries were weakened.' });

  for (const required of [
    rule.launcherPage, rule.launcherScript, 'docs/architecture/REPOSITORY_LAUNCHER.md', 'docs/builds/BUILD_26_REPOSITORY_LAUNCHER.md',
    'scripts/test-build26-repository-launcher.mjs', 'scripts/test-build26-repository-launcher-runtime.ts',
    'scripts/test-build26-repository-launcher-guardian-negative.mjs', 'scripts/tsconfig.build26-tests.json',
    '.github/workflows/build26-repository-launcher.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG249', message: 'Required Build 26 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-repository-launcher-report/1',
  currentBuild: policy.currentBuild,
  repositoryDetection: rule?.repositoryDetection ?? null,
  fab: rule?.fab ?? null,
  openInFlow: rule?.openInFlow ?? null,
  studioLaunch: rule?.studioLaunch ?? null,
  networkAuthority: rule?.networkAuthority ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
