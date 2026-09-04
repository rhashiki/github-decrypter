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

const policy = JSON.parse(fs.readFileSync('architecture.guardian.json', 'utf8')) as { currentBuild: number };
const contentSource = fs.readFileSync('apps/extension/browser/content-script.js', 'utf8');
const workerSource = fs.readFileSync('apps/extension/browser/service-worker.js', 'utf8');

assert.ok(GITHUB_EXTENSION_BUILD >= 25);
assert.ok(policy.currentBuild >= 25);
assert.match(GITHUB_EXTENSION_VERSION, /^0\.0\.\d+$/);
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
        callback?.();
      },
    },
  };
  const document = {
    addEventListener(type: string, callback: () => void) { documentListeners.set(type, callback); },
    querySelector() { return null; },
    getElementById() { return null; },
    documentElement: { appendChild() {} },
  };
  const sandbox = {
    chrome, document, location: locationState,
    addEventListener(type: string, callback: () => void) { windowListeners.set(type, callback); },
    Date, Object, RegExp, Set,
  };
  vm.runInNewContext(contentSource, sandbox, { filename: 'content-script.js' });
  return { sent, windowListeners, documentListeners, locationState };
}

const githubContent = runContent('https://github.com', '/example-org/example-repo');
assert.equal(githubContent.sent.length, 1);
assert.equal(githubContent.sent[0]?.type, 'gd.extension.page-context');
assert.equal(githubContent.sent[0]?.origin, 'https://github.com');
assert.equal(githubContent.sent[0]?.pathname, '/example-org/example-repo');
assert.equal(typeof githubContent.sent[0]?.observedAt, 'string');
assert.equal(JSON.stringify(githubContent.sent).includes('must-not-cross'), false);
assert.equal(JSON.stringify(githubContent.sent).includes('secret'), false);

const hashListener = githubContent.windowListeners.get('hashchange');
assert.ok(hashListener);
hashListener();
assert.equal(githubContent.sent.length, 1, 'same pathname/context must be deduplicated');

githubContent.locationState.pathname = '/example-org/another-repo';
const turboListener = githubContent.documentListeners.get('turbo:load');
assert.ok(turboListener);
turboListener();
assert.equal(githubContent.sent.at(-1)?.pathname, '/example-org/another-repo');

const foreignContent = runContent('https://example.com', '/example-org/example-repo');
assert.equal(foreignContent.sent.length, 0, 'non-GitHub origin must not emit bridge context');

let messageListener: ((message: Record<string, unknown>, sender: Record<string, unknown>, sendResponse: (value: unknown) => void) => boolean) | null = null;
const titles: Array<{ tabId: number; title: string }> = [];
const workerChrome = {
  runtime: {
    id: 'gd-extension-test-id',
    getURL(path: string) { return `chrome-extension://gd-extension-test-id/${path}`; },
    onMessage: { addListener(listener: typeof messageListener) { messageListener = listener; } },
  },
  action: { setTitle(value: { tabId: number; title: string }) { titles.push({ ...value }); return Promise.resolve(); } },
  tabs: { create() { return Promise.resolve(); } },
};
vm.runInNewContext(workerSource, { chrome: workerChrome, URL, Date, Number, Object, RegExp, Set }, { filename: 'service-worker.js' });
assert.ok(messageListener);

function deliver(message: Record<string, unknown>, sender: Record<string, unknown>) {
  let response: unknown;
  messageListener!(message, sender, (value) => { response = JSON.parse(JSON.stringify(value)); });
  return response as Record<string, unknown> | undefined;
}

const trustedSender = { id: 'gd-extension-test-id', url: 'https://github.com/example-org/example-repo?tab=readme', tab: { id: 7 } };
const hello = deliver({ schema: 'gd-extension-bridge/1', type: 'gd.extension.hello' }, trustedSender);
assert.equal(hello?.schema, 'gd-extension-bridge/1');
assert.equal(hello?.ok, true);
assert.equal(hello?.networkAuthority, false);
assert.equal(hello?.durableExecution, false);
if (policy.currentBuild === 25) assert.equal(hello?.repositoryLauncher, false);

const validContext = deliver({
  schema: 'gd-extension-bridge/1', type: 'gd.extension.page-context', origin: 'https://github.com',
  pathname: '/example-org/example-repo', observedAt: '2026-09-04T16:00:00.000Z',
}, trustedSender);
assert.equal(validContext?.ok, true);
assert.ok(titles.some((entry) => entry.tabId === 7));

assert.equal(deliver({ schema: 'gd-extension-bridge/1', type: 'gd.extension.hello' }, {
  id: 'different-extension', url: 'https://github.com/example-org/example-repo', tab: { id: 7 },
}), undefined);
assert.equal(deliver({ schema: 'gd-extension-bridge/1', type: 'gd.extension.hello' }, {
  id: 'gd-extension-test-id', url: 'https://evil.example/example-org/example-repo', tab: { id: 7 },
}), undefined);
assert.equal(deliver({
  schema: 'gd-extension-bridge/1', type: 'gd.extension.page-context', origin: 'https://github.com',
  pathname: '/other/repo', observedAt: '2026-09-04T16:00:00.000Z',
}, trustedSender), undefined);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build25-github-chrome-extension-runtime/2',
  bridgeSchema: 'gd-extension-bridge/1',
  githubOnly: true,
  queryAndFragmentExcluded: true,
  spaNavigationObserved: true,
  trustedSenderValidation: true,
  senderPathBinding: true,
  networkAuthority: false,
  durableExecution: false,
  currentBuild: policy.currentBuild,
}, null, 2));
