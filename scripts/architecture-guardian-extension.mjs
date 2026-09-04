import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.extensionAuthority;
const violations = [];

function read(relative) {
  const absolute = path.join(root, relative);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

function exists(relative) {
  return fs.existsSync(path.join(root, relative));
}

if (!rule || rule.ownerRoot !== 'apps/extension' || rule.minimumBuild !== 25) {
  violations.push({ code: 'AG230', message: 'GitHub Chrome Extension authority policy is missing or invalid.' });
} else {
  let manifest = null;
  try { manifest = JSON.parse(read('manifest.json')); }
  catch { violations.push({ code: 'AG231', message: 'Chrome extension manifest is missing or invalid JSON.' }); }

  if (manifest) {
    const contentScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
    const firstContent = contentScripts[0] ?? {};
    if (
      manifest.manifest_version !== rule.manifestVersion
      || manifest.name !== 'GitHub Decrypter'
      || manifest.version !== '0.0.25'
      || manifest.background?.service_worker !== rule.serviceWorker
      || JSON.stringify(manifest.host_permissions ?? []) !== JSON.stringify(rule.hostAllowlist)
      || contentScripts.length !== 1
      || JSON.stringify(firstContent.matches ?? []) !== JSON.stringify(rule.hostAllowlist)
      || JSON.stringify(firstContent.js ?? []) !== JSON.stringify([rule.contentScript])
      || firstContent.run_at !== 'document_idle'
    ) {
      violations.push({ code: 'AG231', message: 'Build 25 manifest boundary is missing or broader than authorized.' });
    }
    if (Array.isArray(manifest.permissions) && manifest.permissions.length > 0) {
      violations.push({ code: 'AG231', message: 'Build 25 requires no optional Chrome permissions.' });
    }
  }

  const contract = read('apps/extension/src/index.ts');
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
  ]) {
    if (!contract.includes(marker)) violations.push({ code: 'AG232', message: 'Extension bridge contract invariant missing.', detail: marker });
  }
  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bWebSocket\s*\(|\bXMLHttpRequest\b/.test(contract)) {
    violations.push({ code: 'AG232', message: 'Extension contract gained forbidden execution/network authority.' });
  }

  const serviceWorker = read(rule.serviceWorker);
  const contentScript = read(rule.contentScript);
  const browserSource = `${serviceWorker}\n${contentScript}`;

  for (const marker of [
    "BRIDGE_SCHEMA = 'gd-extension-bridge/1'",
    "ALLOWED_ORIGIN = 'https://github.com'",
  ]) {
    if (!serviceWorker.includes(marker) || !contentScript.includes(marker)) {
      violations.push({ code: 'AG233', message: 'Browser bridge schema/origin invariant missing.', detail: marker });
    }
  }
  for (const forbidden of [
    /\bfetch\s*\(/,
    /\bWebSocket\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bchrome\.storage\b/,
    /\blocalStorage\b/,
    /\bindexedDB\b/,
    /\bchrome\.cookies\b/,
    /\bchrome\.identity\b/,
    /\bchrome\.downloads\b/,
    /\bchrome\.nativeMessaging\b/,
    /127\.0\.0\.1|localhost|43110/,
  ]) {
    if (forbidden.test(browserSource)) {
      violations.push({ code: 'AG233', message: 'Build 25 browser bridge gained network, secret or persistence authority.', detail: String(forbidden) });
    }
  }

  for (const forbidden of [
    /document\.createElement\s*\(/,
    /\.appendChild\s*\(/,
    /\.insertAdjacentHTML\s*\(/,
    /\.innerHTML\s*=/,
    /\bFAB\b/,
    /open in github decrypter/i,
    /chrome\.tabs\.create\s*\(/,
    /window\.open\s*\(/,
  ]) {
    if (forbidden.test(browserSource)) {
      violations.push({ code: 'AG234', message: 'Repository Launcher/UI authority arrived before Build 26.', detail: String(forbidden) });
    }
  }

  for (const marker of [
    'sender.id !== chrome.runtime.id',
    "url.protocol !== 'https:'",
    "url.hostname !== 'github.com'",
    'senderUrl.origin !== message.origin',
    'senderUrl.pathname !== message.pathname',
  ]) {
    if (!serviceWorker.includes(marker)) violations.push({ code: 'AG235', message: 'Extension sender/context trust invariant missing.', detail: marker });
  }

  for (const forbidden of [
    /\bdetectRepository\s*\(/,
    /\bparseRepository\s*\(/,
    /\brepositoryOwner\b/,
    /\brepositoryName\b/,
    /data-hovercard-type=["']repository["']/,
    /\/repos\//,
  ]) {
    if (forbidden.test(browserSource)) {
      violations.push({ code: 'AG236', message: 'Repository detection arrived before Build 26.', detail: String(forbidden) });
    }
  }

  if (!contentScript.includes("location.origin !== ALLOWED_ORIGIN")
    || !contentScript.includes("document.addEventListener('turbo:load'")
    || !contentScript.includes('chrome.runtime.sendMessage(context')) {
    violations.push({ code: 'AG237', message: 'GitHub page bridge lifecycle invariant missing.' });
  }
  if (!serviceWorker.includes('chrome.runtime.onMessage.addListener')
    || !serviceWorker.includes('chrome.action.setTitle')) {
    violations.push({ code: 'AG237', message: 'Extension service-worker bridge invariant missing.' });
  }

  if (
    rule.repositoryLauncherBuild !== 26
    || rule.studioReactBuild !== 27
    || rule.manifestVersion !== 3
    || rule.bridgeSchema !== 'gd-extension-bridge/1'
    || JSON.stringify(rule.hostAllowlist) !== JSON.stringify(['https://github.com/*'])
    || rule.lightweightBridge !== true
    || rule.statelessPageContext !== true
    || rule.networkAuthority !== false
    || rule.secretAuthority !== false
    || rule.durableExecution !== false
    || rule.repositoryDetection !== false
    || rule.fab !== false
    || rule.openInFlow !== false
    || rule.studioLaunch !== false
    || rule.localRuntimeDirectTransport !== false
    || rule.contentDomMutation !== false
    || rule.contextPersistence !== false
    || rule.externalHosts !== false
    || policy.phaseGates.extensionActivationBuild !== 25
    || policy.phaseGates.repositoryLauncherBuild !== 26
  ) {
    violations.push({ code: 'AG238', message: 'Build 25 machine-readable extension boundaries were weakened.' });
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const required of [
      'apps/extension/package.json',
      'apps/extension/src/index.ts',
      rule.serviceWorker,
      rule.contentScript,
      'docs/architecture/GITHUB_CHROME_EXTENSION.md',
      'docs/builds/BUILD_25_GITHUB_CHROME_EXTENSION.md',
      'scripts/test-build25-github-chrome-extension.mjs',
      'scripts/test-build25-github-chrome-extension-runtime.ts',
      'scripts/test-build25-extension-guardian-negative.mjs',
      'scripts/tsconfig.build25-tests.json',
      '.github/workflows/build25-github-chrome-extension.yml',
    ]) {
      if (!exists(required)) violations.push({ code: 'AG239', message: 'Required Build 25 artifact is missing.', detail: required });
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-extension-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  minimumBuild: rule?.minimumBuild ?? null,
  bridgeSchema: rule?.bridgeSchema ?? null,
  hostAllowlist: rule?.hostAllowlist ?? null,
  lightweightBridge: rule?.lightweightBridge ?? null,
  repositoryDetection: rule?.repositoryDetection ?? null,
  openInFlow: rule?.openInFlow ?? null,
  networkAuthority: rule?.networkAuthority ?? null,
  violations,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exit(1);
