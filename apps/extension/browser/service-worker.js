'use strict';

const BRIDGE_SCHEMA = 'gd-extension-bridge/1';
const ALLOWED_ORIGIN = 'https://github.com';
const EXTENSION_BUILD = 26;
const EXTENSION_VERSION = '0.0.26';
const HELLO_TYPE = 'gd.extension.hello';
const PAGE_CONTEXT_TYPE = 'gd.extension.page-context';
const REPOSITORY_CONTEXT_TYPE = 'gd.extension.repository-context';
const OPEN_REPOSITORY_TYPE = 'gd.extension.open-repository';
const LAUNCHER_STATUS_TYPE = 'gd.extension.launcher-status';
const LAUNCHER_PAGE = 'apps/extension/browser/launcher.html';
const REPOSITORY_PART = /^[A-Za-z0-9_.-]{1,100}$/;
const RESERVED_TOP_LEVEL = new Set([
  'about', 'apps', 'collections', 'contact', 'copilot', 'codespaces', 'enterprise',
  'events', 'explore', 'features', 'issues', 'login', 'logout', 'marketplace',
  'new', 'notifications', 'organizations', 'orgs', 'pricing', 'pulls', 'search',
  'security', 'settings', 'site', 'sponsors', 'signup', 'topics', 'trending', 'users',
]);

function trustedGitHubSender(sender) {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== 'string') return null;
  let url;
  try { url = new URL(sender.url); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password) return null;
  return url;
}

function trustedLauncherSender(sender) {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== 'string') return false;
  const expected = new URL(chrome.runtime.getURL(LAUNCHER_PAGE));
  let actual;
  try { actual = new URL(sender.url); } catch { return false; }
  return actual.origin === expected.origin && actual.pathname === expected.pathname;
}

function validPathname(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 2048
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function validObservedAt(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validRepository(repository, senderUrl) {
  if (!repository || typeof repository !== 'object') return null;
  const owner = typeof repository.owner === 'string' ? repository.owner.trim() : '';
  const name = typeof repository.name === 'string' ? repository.name.trim() : '';
  if (!REPOSITORY_PART.test(owner) || !REPOSITORY_PART.test(name) || RESERVED_TOP_LEVEL.has(owner.toLowerCase())) return null;
  const segments = senderUrl.pathname.split('/').filter(Boolean);
  if (segments.length < 2 || segments[0] !== owner || segments[1] !== name) return null;
  const fullName = `${owner}/${name}`;
  if (repository.fullName !== fullName) return null;
  if (repository.url !== `${ALLOWED_ORIGIN}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`) return null;
  return Object.freeze({ owner, name, fullName, url: repository.url });
}

function helloResponse() {
  return Object.freeze({
    schema: BRIDGE_SCHEMA,
    ok: true,
    build: EXTENSION_BUILD,
    version: EXTENSION_VERSION,
    role: 'lightweight-github-bridge',
    repositoryLauncher: true,
    connection: 'extension-bridge',
    studioReady: false,
    networkAuthority: false,
    durableExecution: false,
  });
}

function openLauncher(repository) {
  const target = new URL(chrome.runtime.getURL(LAUNCHER_PAGE));
  target.searchParams.set('owner', repository.owner);
  target.searchParams.set('repo', repository.name);
  void chrome.tabs.create({ url: target.toString() });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || message.schema !== BRIDGE_SCHEMA) return false;

  if (message.type === LAUNCHER_STATUS_TYPE) {
    if (!trustedLauncherSender(sender)) return false;
    sendResponse(helloResponse());
    return false;
  }

  const senderUrl = trustedGitHubSender(sender);
  if (!senderUrl) return false;

  if (message.type === HELLO_TYPE) {
    sendResponse(helloResponse());
    return false;
  }

  if (message.origin !== ALLOWED_ORIGIN || !validPathname(message.pathname)) return false;
  if (senderUrl.origin !== message.origin || senderUrl.pathname !== message.pathname) return false;

  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId) || tabId < 0) return false;

  if (message.type === PAGE_CONTEXT_TYPE) {
    if (!validObservedAt(message.observedAt)) return false;
    void chrome.action.setTitle({ tabId, title: 'GitHub Decrypter — GitHub bridge active' });
    sendResponse(helloResponse());
    return false;
  }

  if (message.type === REPOSITORY_CONTEXT_TYPE) {
    if (!validObservedAt(message.observedAt)) return false;
    const repository = validRepository(message.repository, senderUrl);
    if (!repository) return false;
    void chrome.action.setTitle({ tabId, title: `Open ${repository.fullName} in GitHub Decrypter` });
    sendResponse(helloResponse());
    return false;
  }

  if (message.type === OPEN_REPOSITORY_TYPE) {
    const repository = validRepository(message.repository, senderUrl);
    if (!repository) return false;
    openLauncher(repository);
    sendResponse(helloResponse());
    return false;
  }

  return false;
});
