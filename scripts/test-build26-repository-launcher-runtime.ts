import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  GITHUB_EXTENSION_BUILD,
  GITHUB_EXTENSION_VERSION,
  detectGitHubRepositoryFromPage,
  normalizeGitHubRepositoryIdentity,
} from '../apps/extension/src/index.js';

assert.equal(GITHUB_EXTENSION_BUILD, 26);
assert.equal(GITHUB_EXTENSION_VERSION, '0.0.26');
assert.deepEqual(
  detectGitHubRepositoryFromPage('https://github.com/example-org/example-repo/tree/main?token=hidden#fragment', 'example-org/example-repo'),
  {
    owner: 'example-org', name: 'example-repo', fullName: 'example-org/example-repo',
    url: 'https://github.com/example-org/example-repo',
  },
);
assert.equal(detectGitHubRepositoryFromPage('https://github.com/example-org/example-repo', null), null);
assert.equal(detectGitHubRepositoryFromPage('https://github.com/example-org/other', 'example-org/example-repo'), null);
assert.equal(detectGitHubRepositoryFromPage('https://github.com/settings/profile', 'settings/profile'), null);
assert.throws(() => normalizeGitHubRepositoryIdentity('settings', 'profile'), /reserved/i);

const contentSource = fs.readFileSync('apps/extension/browser/content-script.js', 'utf8');
const workerSource = fs.readFileSync('apps/extension/browser/service-worker.js', 'utf8');
const launcherSource = fs.readFileSync('apps/extension/browser/launcher.js', 'utf8');

type FakeElement = {
  id: string; type?: string; textContent: string; title: string; hidden: boolean;
  dataset: Record<string, string>; style: Record<string, string>; href?: string; className?: string;
  onclick?: (() => void) | null; attributes: Record<string, string>;
  setAttribute(name: string, value: string): void; remove(): void;
};

function runContent(pathname: string, canonicalNwo: string | null) {
  const sent: Array<Record<string, unknown>> = [];
  const elements = new Map<string, FakeElement>();
  const listeners = new Map<string, () => void>();
  const docListeners = new Map<string, () => void>();
  const locationState = { origin: 'https://github.com', pathname, search: '?secret=must-not-cross', hash: '#hidden' };

  const document = {
    querySelector(selector: string) {
      if (selector !== 'meta[name="octolytics-dimension-repository_nwo"]' || canonicalNwo === null) return null;
      return { getAttribute(name: string) { return name === 'content' ? canonicalNwo : null; } };
    },
    getElementById(id: string) { return elements.get(id) ?? null; },
    createElement(tag: string) {
      assert.equal(tag, 'button');
      const element: FakeElement = {
        id: '', textContent: '', title: '', hidden: false, dataset: {}, style: {}, attributes: {}, onclick: null,
        setAttribute(name, value) { this.attributes[name] = value; },
        remove() { if (this.id) elements.delete(this.id); },
      };
      return element;
    },
    documentElement: { appendChild(element: FakeElement) { if (element.id) elements.set(element.id, element); } },
    addEventListener(type: string, callback: () => void) { docListeners.set(type, callback); },
  };
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage(message: Record<string, unknown>, callback?: (value?: unknown) => void) {
        sent.push(JSON.parse(JSON.stringify(message)) as Record<string, unknown>);
        callback?.({ ok: true });
      },
    },
  };
  vm.runInNewContext(contentSource, {
    chrome, document, location: locationState,
    addEventListener(type: string, callback: () => void) { listeners.set(type, callback); },
    Date, Object, RegExp, Set,
  }, { filename: 'content-script.js' });
  return { sent, elements, listeners, docListeners, locationState };
}

const repoPage = runContent('/example-org/example-repo/tree/main', 'example-org/example-repo');
assert.equal(repoPage.sent.length, 2);
assert.equal(repoPage.sent[0]?.type, 'gd.extension.page-context');
assert.equal(repoPage.sent[1]?.type, 'gd.extension.repository-context');
assert.equal((repoPage.sent[1]?.repository as Record<string, unknown>)?.fullName, 'example-org/example-repo');
assert.equal(JSON.stringify(repoPage.sent).includes('must-not-cross'), false);
assert.equal(JSON.stringify(repoPage.sent).includes('hidden'), false);
const fab = repoPage.elements.get('gd-repository-launcher-fab');
assert.ok(fab);
assert.equal(fab.textContent, 'GD');
assert.match(fab.attributes['aria-label'] ?? '', /Open .*GitHub Decrypter/);
fab.onclick?.();
assert.equal(repoPage.sent.at(-1)?.type, 'gd.extension.open-repository');

const nonRepoPage = runContent('/settings/profile', null);
assert.equal(nonRepoPage.sent.length, 1);
assert.equal(nonRepoPage.elements.has('gd-repository-launcher-fab'), false);

let workerListener: ((message: Record<string, any>, sender: Record<string, any>, sendResponse: (value: unknown) => void) => boolean) | null = null;
const openedTabs: string[] = [];
const titles: string[] = [];
const workerChrome = {
  runtime: {
    id: 'gd-extension-test-id',
    getURL(path: string) { return `chrome-extension://gd-extension-test-id/${path}`; },
    onMessage: { addListener(listener: typeof workerListener) { workerListener = listener; } },
  },
  action: { setTitle(value: { title: string }) { titles.push(value.title); return Promise.resolve(); } },
  tabs: { create(value: { url: string }) { openedTabs.push(value.url); return Promise.resolve(); } },
};
vm.runInNewContext(workerSource, { chrome: workerChrome, URL, Date, Number, Object, RegExp, Set }, { filename: 'service-worker.js' });
assert.ok(workerListener);

function deliver(message: Record<string, any>, sender: Record<string, any>) {
  let response: any;
  workerListener!(message, sender, (value) => { response = JSON.parse(JSON.stringify(value)); });
  return response;
}

const sender = {
  id: 'gd-extension-test-id',
  url: 'https://github.com/example-org/example-repo/tree/main?ignored=yes',
  tab: { id: 12 },
};
const repository = {
  owner: 'example-org', name: 'example-repo', fullName: 'example-org/example-repo',
  url: 'https://github.com/example-org/example-repo',
};
const openResponse = deliver({
  schema: 'gd-extension-bridge/1', type: 'gd.extension.open-repository',
  origin: 'https://github.com', pathname: '/example-org/example-repo/tree/main', repository,
}, sender);
assert.equal(openResponse?.repositoryLauncher, true);
assert.equal(openResponse?.studioReady, false);
assert.equal(openResponse?.networkAuthority, false);
assert.equal(openedTabs.length, 1);
const launched = new URL(openedTabs[0]!);
assert.equal(launched.protocol, 'chrome-extension:');
assert.equal(launched.pathname, '/apps/extension/browser/launcher.html');
assert.equal(launched.searchParams.get('owner'), 'example-org');
assert.equal(launched.searchParams.get('repo'), 'example-repo');
assert.equal([...launched.searchParams.keys()].length, 2);

const beforeMismatch = openedTabs.length;
deliver({
  schema: 'gd-extension-bridge/1', type: 'gd.extension.open-repository',
  origin: 'https://github.com', pathname: '/example-org/example-repo/tree/main',
  repository: { ...repository, name: 'other', fullName: 'example-org/other', url: 'https://github.com/example-org/other' },
}, sender);
assert.equal(openedTabs.length, beforeMismatch, 'mismatched repository identity must fail closed');

const launcherSender = {
  id: 'gd-extension-test-id',
  url: 'chrome-extension://gd-extension-test-id/apps/extension/browser/launcher.html?owner=example-org&repo=example-repo',
};
const status = deliver({ schema: 'gd-extension-bridge/1', type: 'gd.extension.launcher-status' }, launcherSender);
assert.equal(status?.connection, 'extension-bridge');
assert.equal(status?.build, 26);
assert.equal(deliver({ schema: 'gd-extension-bridge/1', type: 'gd.extension.launcher-status' }, {
  id: 'gd-extension-test-id', url: 'chrome-extension://gd-extension-test-id/other.html',
}), undefined);

const launcherElements = new Map<string, any>([
  ['invalid', { hidden: true }], ['content', { hidden: true }], ['repository', { textContent: '' }],
  ['github-link', { href: '' }], ['bridge-status', { textContent: '', className: '' }],
]);
const launcherChrome = {
  runtime: {
    lastError: null,
    sendMessage(_message: unknown, callback: (value: unknown) => void) {
      callback({ schema: 'gd-extension-bridge/1', ok: true, build: 26 });
    },
  },
};
vm.runInNewContext(launcherSource, {
  chrome: launcherChrome,
  location: { search: '?owner=example-org&repo=example-repo' },
  document: { getElementById(id: string) { return launcherElements.get(id); } },
  URLSearchParams, Set, RegExp,
}, { filename: 'launcher.js' });
assert.equal(launcherElements.get('content').hidden, false);
assert.equal(launcherElements.get('repository').textContent, 'example-org/example-repo');
assert.equal(launcherElements.get('github-link').href, 'https://github.com/example-org/example-repo');
assert.match(launcherElements.get('bridge-status').textContent, /Connected · Build 26/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build26-repository-launcher-runtime/1',
  repositoryDetection: 'github-meta+pathname',
  falsePositiveFailsClosed: true,
  queryAndFragmentExcluded: true,
  fabRendered: true,
  openMessageValidated: true,
  extensionOwnedHandoff: true,
  launcherConnectionStatus: true,
  studioReady: false,
  networkAuthority: false,
  persistence: false,
}, null, 2));
