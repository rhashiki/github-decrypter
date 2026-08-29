import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const config = fs.readFileSync('settings/config.js', 'utf8');
const entry = fs.readFileSync('background/service-worker-entry.js', 'utf8');
const runtime = fs.readFileSync('background/project-state-runtime.js', 'utf8');
const coreSource = fs.readFileSync('content/project-state-graph-core.js', 'utf8');
const graphSource = fs.readFileSync('content/unified-project-state-graph.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/ld-project-state/index.ts', 'utf8');
const build26 = fs.readFileSync('content/lovable-workspace-deep-read.js', 'utf8');

const versionParts = String(manifest.version || '').split('.').map(Number);
assert.equal(versionParts[0], 2);
assert.equal(versionParts[1], 4);
assert.ok(versionParts[2] >= 27, 'Current v2.4 build must not regress below Build 27');
assert.match(config, /export const VERSION = '2\.4\.\d+'/);
assert.match(config, /TRUST_PROTOCOL_VERSION = '2\.4\.21'/);

const boot = manifest.content_scripts[0].js;
const deepIndex = boot.indexOf('content/lovable-workspace-deep-read.js');
const coreIndex = boot.indexOf('content/project-state-graph-core.js');
const graphIndex = boot.indexOf('content/unified-project-state-graph.js');
const intelligenceIndex = boot.indexOf('content/project-intelligence.js');
assert.ok(deepIndex >= 0 && coreIndex > deepIndex && graphIndex > coreIndex);
assert.ok(intelligenceIndex > graphIndex);

assert.match(entry, /installProjectStateRuntime/);
assert.match(runtime, /ld2-project-state/);
assert.match(runtime, /action !== 'inspect'/);
assert.match(graphSource, /LD2_REPO_CACHE_WARM/);
assert.match(graphSource, /chrome\.storage\.session/);
assert.match(graphSource, /LovableDecrypterWorkspaceDeepRead\.readFile/);
assert.match(graphSource, /secretNames/);
assert.match(graphSource, /Secret values are never included/);
assert.doesNotMatch(graphSource, /localStorage\.setItem/);

assert.match(build26, /writeFiles: false/);
assert.match(edge, /ld-supabase-project-state\/1/);
assert.match(edge, /\/config\/auth/);
assert.match(edge, /\/functions/);
assert.match(edge, /\/secrets/);
assert.match(edge, /supabase_migrations\.schema_migrations/);
assert.match(edge, /client_id_present: Boolean/);
assert.match(edge, /client_secret_present: Boolean/);
assert.match(edge, /secret_values_read: false/);
assert.match(edge, /writes: false/);
assert.doesNotMatch(edge, /external_google_secret\s*[,}]/);
assert.doesNotMatch(edge, /external_google_client_id\s*[,}]/);
assert.doesNotMatch(edge, /\/functions\/deploy/);
assert.doesNotMatch(edge, /method:\s*"PATCH"/);
assert.doesNotMatch(edge, /method:\s*"DELETE"/);

const context = {
  window: {},
  crypto: webcrypto,
  TextEncoder,
  Uint8Array,
  console
};
context.window.window = context.window;
vm.runInNewContext(coreSource, context, { filename: 'project-state-graph-core.js' });
const core = context.window.LovableDecrypterProjectStateGraphCore;
assert.ok(core);

assert.deepEqual(
  [...core.expectedMigrationVersions([
    { path: 'supabase/migrations/20260801000000_init.sql' },
    { path: 'supabase/migrations/20260802000000_auth.sql' },
    { path: 'src/App.tsx' }
  ])],
  ['20260801000000', '20260802000000']
);

assert.deepEqual(
  [...core.expectedEdgeFunctionSlugs([
    { path: 'supabase/functions/payments/index.ts' },
    { path: 'supabase/functions/google-callback/index.ts' },
    { path: 'supabase/functions/payments/helper.ts' }
  ])],
  ['google-callback', 'payments']
);

const backendOk = core.reconcileBackendRefs({
  lovableRef: 'abcdefghijklmnopqrst',
  mappedRef: 'abcdefghijklmnopqrst',
  inspectedRef: 'abcdefghijklmnopqrst'
});
assert.equal(backendOk.state, 'consistent');

const backendBad = core.reconcileBackendRefs({
  lovableRef: 'abcdefghijklmnopqrst',
  mappedRef: 'zyxwvutsrqponmlkjihg'
});
assert.equal(backendBad.state, 'mismatch');

const sameRevision = await core.reconcileFiles({
  workspaceFiles: [{ path: 'src/App.tsx', size: 3 }],
  githubFiles: [{ path: 'src/App.tsx', type: 'blob', size: 3, sha: 'a'.repeat(40) }],
  workspaceRevision: 'b'.repeat(40),
  githubRevision: 'b'.repeat(40)
});
assert.equal(sameRevision.counts.same, 1);

const bytes = new TextEncoder().encode('abc');
const blobSha = await core.gitBlobSha1(bytes);
assert.equal(blobSha, 'f2ba8f84ab5c1bce84a7b441cb1959cfc7093b7f');

const compared = await core.reconcileFiles({
  workspaceFiles: [
    { path: 'src/App.tsx', size: 3 },
    { path: 'supabase/functions/new-fn/index.ts', size: 2 },
    { path: '.env', size: 20, sensitive: true }
  ],
  githubFiles: [
    { path: 'src/App.tsx', type: 'blob', size: 3, sha: blobSha },
    { path: 'src/Old.tsx', type: 'blob', size: 3, sha: 'c'.repeat(40) },
    { path: '.env', type: 'blob', size: 20, sha: 'd'.repeat(40) }
  ],
  workspaceRevision: 'ref:HEAD',
  githubRevision: 'e'.repeat(40),
  readWorkspaceBytes: async path => {
    if (path === '.env') throw new Error('sensitive');
    return bytes;
  }
});
assert.equal(compared.entries.find(x => x.path === 'src/App.tsx').state, 'same');
assert.equal(compared.entries.find(x => x.path === 'src/Old.tsx').state, 'github_only');
assert.equal(compared.entries.find(x => x.path === 'supabase/functions/new-fn/index.ts').state, 'lovable_only');
assert.equal(compared.entries.find(x => x.path === '.env').state, 'unknown');

const sets = core.reconcileSets(['a','b'], ['b','c']);
assert.deepEqual([...sets.missing], ['a']);
assert.deepEqual([...sets.remoteOnly], ['c']);
assert.deepEqual([...sets.matched], ['b']);

console.log(JSON.stringify({
  ok: true,
  build: 27,
  version: manifest.version,
  trust_protocol: '2.4.21',
  graph_schema: 'ld-project-state-graph/1',
  supabase_state_schema: 'ld-supabase-project-state/1',
  secret_values_exposed: false,
  automatic_repair: false
}, null, 2));
