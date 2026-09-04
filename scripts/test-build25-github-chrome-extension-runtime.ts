import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  GITHUB_EXTENSION_ALLOWED_ORIGIN,
  GITHUB_EXTENSION_BRIDGE_SCHEMA,
  GITHUB_EXTENSION_BUILD,
  GITHUB_EXTENSION_VERSION,
  normalizeGitHubExtensionPageUrl,
} from '../apps/extension/src/index.js';

const contentSource = fs.readFileSync('apps/extension/browser/content-script.js', 'utf8');
const workerSource = fs.readFileSync('apps/extension/browser/service-worker.js', 'utf8');

assert.equal(GITHUB_EXTENSION_BUILD, 25);
assert.equal(GITHUB_EXTENSION_VERSION, '0.0.25');
assert.equal(GITHUB_EXTENSION_BRIDGE_SCHEMA, 'gd-extension-bridge/1');
assert.equal(GITHUB_EXTENSION_ALLOWED_ORIGIN, 'https://github.com');

const normalized = normalizeGitHubExtensionPageUrl('https://github.com/example-org/example-repo?token=hidden#secret-fragment');
assert.deepEqual(normalized, { origin: 'https://github.com', pathname: '/example-org/example-repo' });
assert.throws(() => normalizeGitHubExtensionPageUrl('http://github.com/example-org/example-repo'), /canonical/);
assert.throws(() => normalizeGitHubExtensionPageUrl('https://gist.github.com/example'), /canonical/);
assert.throws(() => normalizeGitHubExtensionPageUrl('https://user:pass@github.com/example'), /canonical/);

function runContent(origin: string, pathname: string) {
  const sent: Array<Record<string, unknown>> = [];
  const windowListeners = new Map<string, () => void>();
  const documentListeners = new Map<string, () => void>();
  const locationState = { origin, pathname, search: '?token=must-not-cross', hash: '#secret' };
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage(message: Record<string, unknown>, callback: () => void) {
        sent.push(JSON.parse(JSON.stringify(message)) as Record<string, unknown>);
        callback();
      },
    },
  };
  const document = {
    addEventListener(type: string, callback: () => void) { documentListeners.set(type, callback); },
  };
  const sandbox = {
    chrome,
    document,
    location: locationState,
    addEventListener(type: string, callback: () => void) { windowListeners.set(type, callback); },
    Date,
    Object,
    RegExp,
  };
  vm.runInNewContext(contentSource, sandbox, { filename: 'content-script.js' });
  return { sent, windowListeners, documentListeners, locationState };
}

const githubContent = runContent('https://github.com', '/example-org/example-repo');
assert.equal(githubContent.sent.length, 1);
assert.deepEqual(githubContent.sent[0], {
  schema: 'gd-extension-bridge/1',
  type: 'gd.extension.page-context',
  origin: 'https://github.com',
  pathname: '/example-org/example-repo',
  observedAt: githubContent.sent[0]?.observedAt,
});
assert.equal(typeof githubContent.sent[0]?.observedAt, 'string');
assert.equal('search' in (githubContent.sent[0] ?? {}), false);
assert.equal('hash' in (githubContent.sent[0] ?? {}), false);
assert.equal(JSON.stringify(githubContent.sent).includes('must-not-cross'), false);
assert.equal(JSON.stringify(githubContent.sent).includes('secret'), false);

const hashListener = githubContent.windowListeners.get('hashchange');
assert.ok(hashListener);
hashListener();
assert.equal(githubContent.sent.length, 1, 'same pathname must be deduplicated');

githubContent.locationState.pathname = '/example-org/another-repo';
const turboListener = githubContent.documentListeners.get('turbo:load');
assert.ok(turboListener);
turboListener();
assert.equal(githubContent.sent.length, 2);
assert.equal(githubContent.sent[1]?.pathname, '/example-org/another-repo');

const foreignContent = runContent('https://example.com', '/example-org/example-repo');
assert.equal(foreignContent.sent.length, 0, 'non-GitHub origin must not emit bridge context');

let messageListener: ((message: Record<string, unknown>, sender: Record<string, unknown>, sendResponse: (value: unknown) => void) => boolean) | null = null;
const titles: Array<{ tabId: number; title: string }> = [];
const workerChrome = {
  runtime: {
    id: 'gd-extension-test-id',
    onMessage: {
      addListener(listener: typeof messageListener) { messageListener = listener; },
    },
  },
  action: {
    setTitle(value: { tabId: number; title: string }) { titles.push({ ...value }); return Promise.resolve(); },
  },
};
vm.runInNewContext(workerSource, { chrome: workerChrome, URL, Date, Number, Object, RegExp }, { filename: 'service-worker.js' });
assert.ok(messageListener);

function deliver(message: Record<string, unknown>, sender: Record<string, unknown>) {
  let response: unknown = undefined;
  const handled = messageListener!(message, sender, (value) => { response = JSON.parse(JSON.stringify(value)); });
  return { handled, response };
}

const trustedSender = {
  id: 'gd-extension-test-id',
  url: 'https://github.com/example-org/example-repo?tab=readme',
  tab: { id: 7 },
};

const hello = deliver({ schema: 'gd-extension-bridge/1', type: 'gd.extension.hello' }, trustedSender);
assert.equal(hello.handled, false);
assert.deepEqual(hello.response, {
  schema: 'gd-extension-bridge/1',
  ok: true,
  build: 25,
  version: '0.0.25',
  role: 'lightweight-github-bridge',
  repositoryLauncher: false,
  networkAuthority: false,
  durableExecution: false,
});

const validContext = deliver({
  schema: 'gd-extension-bridge/1',
  type: 'gd.extension.page-context',
  origin: 'https://github.com',
  pathname: '/example-org/example-repo',
  observedAt: '2026-09-04T16:00:00.000Z',
}, trustedSender);
assert.equal(validContext.handled, false);
assert.deepEqual(validContext.response, hello.response);
assert.deepEqual(titles, [{ tabId: 7, title: 'GitHub Decrypter — GitHub bridge active' }]);

const titleCount = titles.length;
const untrusted = deliver({ schema: 'gd-extension-bridge/1', type: 'gd.extension.hello' }, {
  id: 'different-extension',
  url: 'https://github.com/example-org/example-repo',
  tab: { id: 7 },
});
assert.equal(untrusted.response, undefined);

const foreignSender = deliver({ schema: 'gd-extension-bridge/1', type: 'gd.extension.hello' }, {
  id: 'gd-extension-test-id',
  url: 'https://evil.example/example-org/example-repo',
  tab: { id: 7 },
});
assert.equal(foreignSender.response, undefined);

const mismatchedPath = deliver({
  schema: 'gd-extension-bridge/1',
  type: 'gd.extension.page-context',
  origin: 'https://github.com',
  pathname: '/other/repo',
  observedAt: '2026-09-04T16:00:00.000Z',
}, trustedSender);
assert.equal(mismatchedPath.response, undefined);
assert.equal(titles.length, titleCount);

const unknownType = deliver({ schema: 'gd-extension-bridge/1', type: 'gd.extension.launch-repository' }, trustedSender);
assert.equal(unknownType.response, undefined);
assert.equal(titles.length, titleCount);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build25-github-chrome-extension-runtime/1',
  bridgeSchema: 'gd-extension-bridge/1',
  githubOnly: true,
  queryAndFragmentExcluded: true,
  spaNavigationObserved: true,
  duplicatePathSuppression: true,
  trustedSenderValidation: true,
  senderPathBinding: true,
  statelessServiceWorker: true,
  repositoryLauncher: false,
  networkAuthority: false,
  durableExecution: false,
}, null, 2));
