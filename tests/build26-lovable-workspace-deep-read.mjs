import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = fs.readFileSync('content/lovable-workspace-deep-read.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const config = fs.readFileSync('settings/config.js', 'utf8');

const versionParts = String(manifest.version || '').split('.').map(Number);
assert.equal(versionParts[0], 2);
assert.equal(versionParts[1], 4);
assert.ok(versionParts[2] >= 26, 'Current v2.4 build must preserve Build 26');
assert.match(config, /export const VERSION = '2\.4\.\d+'/);
assert.match(config, /export const TRUST_PROTOCOL_VERSION = '2\.4\.21'/);

const scripts = manifest.content_scripts?.[0]?.js || [];
const runtimeIndex = scripts.indexOf('content/lovable-project-runtime.js');
const deepIndex = scripts.indexOf('content/lovable-workspace-deep-read.js');
assert.ok(runtimeIndex >= 0 && deepIndex === runtimeIndex + 1, 'Deep Read must boot immediately after Project Runtime');

assert.match(source, /\/git\/files\?\$\{query\}/);
assert.match(source, /\/git\/file\?\$\{params\}/);
assert.match(source, /source:\s*'lovable_workspace'/);
assert.match(source, /writeFiles:\s*false/);
assert.match(source, /SENSITIVE_PATH/);
assert.match(source, /allowSensitive:\s*true/);
assert.match(source, /githubFallbackDownload/);
assert.match(source, /GitHub fallback/);
assert.doesNotMatch(source, /window\.fetch\s*=|globalThis\.fetch\s*=|XMLHttpRequest\.prototype|navigator\.sendBeacon\s*=/);
assert.doesNotMatch(source, /new\s+MutationObserver/);

const projectId = 'e882a8c3-09ca-4b54-8a6e-79b4f97cdbfe';
const token = 'header.payload.signature';
const files = [
  { path: 'src/index.js', size: 21, binary: false },
  { path: 'public/icon.bin', size: 4, binary: true },
  { path: 'supabase/migrations/001_init.sql', size: 24, binary: false },
  { path: '.env', size: 18, binary: false }
];
const bodies = new Map([
  ['src/index.js', new TextEncoder().encode("console.log('hello');\n")],
  ['public/icon.bin', Uint8Array.from([0, 255, 10, 20])],
  ['supabase/migrations/001_init.sql', new TextEncoder().encode('create table demo(id int);')],
  ['.env', new TextEncoder().encode('PRIVATE_VALUE=secret')]
]);

let anchorClicked = false;
const dispatched = [];
const local = {
  'firebase:authUser:test:[DEFAULT]': JSON.stringify({
    stsTokenManager: { accessToken: token }
  })
};
const localStorage = {
  ...local,
  getItem(key) { return this[key] ?? null; }
};

function response(body, {
  status = 200,
  contentType = 'application/octet-stream',
  json = false
} = {}) {
  const bytes = json ? new TextEncoder().encode(JSON.stringify(body)) : body;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => name.toLowerCase() === 'content-type' ? contentType : null },
    async json() { return JSON.parse(new TextDecoder().decode(bytes)); },
    async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }
  };
}

async function fetchMock(url) {
  const parsed = new URL(String(url));
  if (parsed.pathname.endsWith('/git/files')) {
    return response({ files, head_sha: 'abc123', complete: true }, { json: true, contentType: 'application/json' });
  }
  if (parsed.pathname.endsWith('/git/file')) {
    const path = parsed.searchParams.get('path');
    if (!bodies.has(path)) return response(new Uint8Array(), { status: 404 });
    return response(bodies.get(path));
  }
  return response(new Uint8Array(), { status: 404 });
}

const documentElement = { appendChild() {} };
const documentMock = {
  documentElement,
  addEventListener() {},
  getElementById() { return null; },
  createElement(tag) {
    if (tag !== 'a') return {};
    return {
      href: '',
      download: '',
      style: {},
      click() { anchorClicked = true; },
      remove() {}
    };
  }
};
const listeners = new Map();
const windowMock = {
  __LD2_LOVABLE_WORKSPACE_DEEP_READ__: false,
  LovableDecrypterV2: {
    getProjectId: () => projectId,
    runtime: async () => { throw new Error('GitHub fallback should not be used in happy path'); }
  },
  LovableDecrypterProjectRuntime: {
    getContext: () => ({
      project: { name: 'Fixture Project' },
      workspace: { id: 'workspace-fixture' },
      gitSync: { branch: 'main' }
    })
  },
  addEventListener(type, fn) { listeners.set(type, fn); },
  dispatchEvent(event) { dispatched.push(event); return true; }
};

class CustomEventMock {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
}

const context = {
  window: windowMock,
  globalThis: null,
  document: documentMock,
  location: { pathname: `/projects/${projectId}`, hash: '' },
  localStorage,
  indexedDB: { databases: async () => [] },
  fetch: fetchMock,
  URL,
  URLSearchParams,
  Blob,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  Uint32Array,
  DataView,
  ArrayBuffer,
  AbortController,
  CustomEvent: CustomEventMock,
  crypto: webcrypto,
  structuredClone,
  setTimeout,
  clearTimeout,
  addEventListener: windowMock.addEventListener.bind(windowMock),
  console
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'lovable-workspace-deep-read.js' });

const api = windowMock.LovableDecrypterWorkspaceDeepRead;
assert.ok(api);
assert.equal(api.capabilities.writeFiles, false);

const listed = await api.listFiles({ force: true });
assert.equal(listed.files.length, 4);
assert.equal(listed.ref, 'HEAD');
assert.equal(listed.revision, 'abc123');

const snapshot = await api.getSnapshot({ force: true });
assert.equal(snapshot.schema, 'ld-workspace-snapshot/1');
assert.equal(snapshot.source, 'lovable_workspace');
assert.equal(snapshot.projectId, projectId);
assert.equal(snapshot.workspaceId, 'workspace-fixture');
assert.equal(snapshot.complete, true);
assert.equal(snapshot.stats.fileCount, 4);
assert.equal(snapshot.stats.sensitiveFiles, 1);
assert.equal(snapshot.stats.categories.migrations, 1);
assert.match(snapshot.hash, /^[a-f0-9]{64}$/);
assert.equal(JSON.stringify(snapshot).includes(token), false);
assert.equal(JSON.stringify(snapshot).includes('PRIVATE_VALUE=secret'), false);

const secret = await api.readFile('.env');
assert.equal(secret.redacted, true);
assert.equal(secret.text, null);
assert.equal(secret.bytes, null);

const code = await api.readFile('src/index.js');
assert.equal(code.redacted, false);
assert.match(code.text, /hello/);

const zipResult = await api.downloadWorkspaceZip({ autoDownload: false });
assert.equal(zipResult.source, 'lovable_workspace');
assert.equal(zipResult.fileCount, 4);
assert.ok(zipResult.blob instanceof Blob);
const zipBytes = new Uint8Array(await zipResult.blob.arrayBuffer());
const zipView = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
assert.equal(zipView.getUint32(0, true), 0x04034b50);
assert.equal(zipView.getUint32(zipBytes.length - 22, true), 0x06054b50);
assert.equal(anchorClicked, false);
assert.ok(dispatched.some(event => event.type === 'ld2:workspace-snapshot'));
assert.ok(dispatched.some(event => event.type === 'ld2:workspace-zip-progress'));

console.log(JSON.stringify({
  ok: true,
  build: 26,
  current_version: manifest.version,
  source: 'lovable_workspace',
  files: snapshot.stats.fileCount,
  zipBytes: zipBytes.length,
  secretSnapshotLeak: false,
  globalNetworkMonkeypatch: false,
  githubFallbackPreserved: true
}, null, 2));
