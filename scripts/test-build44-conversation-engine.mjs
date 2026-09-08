import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const pkg = JSON.parse(read('packages/chat/package.json'));
const localPkg = JSON.parse(read('apps/local/package.json'));
const policy = JSON.parse(read('architecture.guardian.json'));
const source = read('packages/chat/src/index.ts');
const store = read('apps/local/src/conversation-store.ts');
const migrations = read('apps/local/src/database-migrations.ts');
const localIndex = read('apps/local/src/index.ts');
const server = read('apps/local/src/server.ts');
const versionMatch = typeof pkg.version === 'string' ? pkg.version.match(/^0\.0\.(\d+)$/) : null;
const packageBuild = versionMatch ? Number(versionMatch[1]) : null;

assert.equal(policy.currentBuild, 44);
assert.equal(pkg.name, '@github-decrypter/chat');
assert.equal(packageBuild, 44);
assert.deepEqual(pkg.dependencies ?? {}, {
  '@github-decrypter/ai': 'workspace:*',
  '@github-decrypter/context': 'workspace:*',
  '@github-decrypter/workspace': 'workspace:*',
});
assert.equal(localPkg.dependencies?.['@github-decrypter/chat'], 'workspace:*');

for (const marker of [
  'CONVERSATION_BUILD = 44',
  "CONVERSATION_SCHEMA = 'gd-conversation/1'",
  "CONVERSATION_MESSAGE_SCHEMA = 'gd-conversation-message/1'",
  "CONVERSATION_DISPATCH_SCHEMA = 'gd-conversation-dispatch/1'",
  "CONVERSATION_SOURCE_CONTEXT_SCHEMA = 'gd-token-abstraction/1'",
  'CONVERSATION_MAX_MESSAGES = 256',
  'createConversation(',
  'createConversationMessage(',
  'appendConversationMessage(',
  'compileConversationDispatch(',
  'conversationHistory: true',
  'persistentConversation: true',
  'jobLifecycleIndependent: true',
  'fullHistoryOrReject: true',
  'silentTruncation: false',
  'attachmentIngestion: false',
  'mentionResolution: false',
  'providerExecution: false',
  'persistenceMutation: false',
]) assert.ok(source.includes(marker), `missing Build 44 core marker: ${marker}`);

for (const marker of [
  'LOCAL_CONVERSATION_STORE_BUILD = 44',
  "LOCAL_CONVERSATION_STORE_SCHEMA = 'gd-local-conversation-store/1'",
  'class LocalConversationStore',
  'createLocalConversationStore(',
  'this.#database.transaction(',
]) assert.ok(store.includes(marker), `missing Build 44 store marker: ${marker}`);

for (const marker of [
  'MIGRATION_012_SQL',
  'CREATE TABLE gd_conversations',
  'CREATE TABLE gd_conversation_messages',
  "name: 'conversation-engine'",
  'version: 12',
]) assert.ok(migrations.includes(marker), `missing Build 44 migration marker: ${marker}`);
const migration12 = migrations.match(/const MIGRATION_012_SQL = `([\s\S]*?)`;/)?.[1] ?? '';
assert.ok(migration12);
assert.doesNotMatch(migration12, /\bjob_id\b/);
assert.doesNotMatch(migration12, /REFERENCES\s+gd_jobs/i);
assert.ok(localIndex.includes("export * from './conversation-store.js';"));
assert.doesNotMatch(server, /\/v1\/(?:conversation|conversations|chat)\b/i);

assert.doesNotMatch(source, /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/);
assert.doesNotMatch(source, /(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\()/);
assert.doesNotMatch(source, /\b(?:LocalDatabase|DatabaseSync|SecretsVault)\b/);
assert.doesNotMatch(source, /@github-decrypter\/(?:tools|git|github-provider|studio|extension|local)/);
assert.doesNotMatch(source, /\b(?:ingestAttachment|resolveMention|rememberProject|persistContextPack)\s*\(/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build44-conversation-engine-static/1',
  build: 44,
  package: '@github-decrypter/chat',
  packageBuild,
  persistentConversation: true,
  jobLifecycleIndependent: true,
  fullHistoryOrReject: true,
  silentTruncation: false,
  transport: false,
}, null, 2));
