'use strict';

const BRIDGE_SCHEMA = 'gd-extension-bridge/1';
const ALLOWED_ORIGIN = 'https://github.com';
const EXTENSION_BUILD = 25;
const EXTENSION_VERSION = '0.0.25';
const HELLO_TYPE = 'gd.extension.hello';
const PAGE_CONTEXT_TYPE = 'gd.extension.page-context';
const pageContexts = new Map();

function trustedGitHubSender(sender) {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== 'string') return null;
  let url;
  try { url = new URL(sender.url); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password) return null;
  return url;
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

function helloResponse() {
  return Object.freeze({
    schema: BRIDGE_SCHEMA,
    ok: true,
    build: EXTENSION_BUILD,
    version: EXTENSION_VERSION,
    role: 'lightweight-github-bridge',
    repositoryLauncher: false,
    networkAuthority: false,
    durableExecution: false,
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || message.schema !== BRIDGE_SCHEMA) return false;

  const senderUrl = trustedGitHubSender(sender);
  if (!senderUrl) return false;

  if (message.type === HELLO_TYPE) {
    sendResponse(helloResponse());
    return false;
  }

  if (message.type !== PAGE_CONTEXT_TYPE) return false;
  if (message.origin !== ALLOWED_ORIGIN || !validPathname(message.pathname) || !validObservedAt(message.observedAt)) {
    return false;
  }
  if (senderUrl.origin !== message.origin || senderUrl.pathname !== message.pathname) return false;

  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId) || tabId < 0) return false;
  pageContexts.set(tabId, Object.freeze({
    origin: ALLOWED_ORIGIN,
    pathname: message.pathname,
    observedAt: new Date(Date.parse(message.observedAt)).toISOString(),
  }));

  void chrome.action.setTitle({ tabId, title: 'GitHub Decrypter — GitHub bridge active' });
  sendResponse(helloResponse());
  return false;
});

chrome.tabs?.onRemoved?.addListener((tabId) => {
  pageContexts.delete(tabId);
});
