import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const pkg = JSON.parse(read('packages/chat/package.json'));
const policy = JSON.parse(read('architecture.guardian.json'));
const source = read('packages/chat/src/mentions.ts');
const versionMatch = typeof pkg.version === 'string' ? pkg.version.match(/^0\.0\.(\d+)$/) : null;
const packageBuild = versionMatch ? Number(versionMatch[1]) : null;

assert.equal(policy.currentBuild, 46);
assert.equal(pkg.name, '@github-decrypter/chat');
assert.equal(packageBuild, 46);
assert.equal(pkg.exports?.['./mentions'], './src/mentions.ts');
assert.deepEqual(pkg.dependencies ?? {}, {
  '@github-decrypter/ai': 'workspace:*',
  '@github-decrypter/context': 'workspace:*',
  '@github-decrypter/workspace': 'workspace:*',
});

for (const marker of [
  'CONTEXT_MENTIONS_BUILD = 46',
  "CONTEXT_MENTION_SCHEMA = 'gd-context-mention/1'",
  "CONTEXT_MENTION_TARGET_SCHEMA = 'gd-context-mention-target/1'",
  "CONTEXT_MENTION_RESOLUTION_SCHEMA = 'gd-context-mention-resolution/1'",
  'CONTEXT_MENTION_MAX_ITEMS = 64',
  'CONTEXT_MENTION_MAX_CATALOG_ITEMS = 4096',
  'CONTEXT_MENTION_MAX_REFERENCE_CHARACTERS = 2048',
  'CONTEXT_MENTION_MAX_LABEL_CHARACTERS = 256',
  "'file'",
  "'folder'",
  "'repository'",
  "'commit'",
  "'branch'",
  "'pull-request'",
  "'issue'",
  "'database'",
  "'preview'",
  "'terminal'",
  'resolveContextMentions(',
  'assertConversationRecord(input.conversation)',
  "message.role !== 'user'",
  'explicitCatalogOnly: true',
  'exactReferenceMatch: true',
  'structuredReferencesOnly: true',
  'textualMentionParsing: false',
  'contentMaterialization: false',
  'sourceReads: false',
  'filesystemRead: false',
  'gitRead: false',
  'githubRead: false',
  'databaseRead: false',
  'previewRead: false',
  'terminalRead: false',
  'attachmentIngestion: false',
  'providerExecution: false',
  'jobCreation: false',
  'persistenceMutation: false',
  'networkAuthority: false',
  'projectMemory: false',
]) assert.ok(source.includes(marker), `missing Build 46 context-mention marker: ${marker}`);

assert.doesNotMatch(source, /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/);
assert.doesNotMatch(source, /(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\()/);
assert.doesNotMatch(source, /@github-decrypter\/(?:tools|git|github-provider|github-app|studio|extension|local)/);
assert.doesNotMatch(source, /\b(?:readFile|readdir|glob|grep|git\s*\(|runSql|queryDatabase|readTerminal|readPreview|executeJob|createJob|generateText)\s*\(/i);

const rule = policy.contextMentionsAuthority;
assert.ok(rule);
assert.deepEqual(rule.kinds, ['file','folder','repository','commit','branch','pull-request','issue','database','preview','terminal']);
assert.equal(rule.explicitCatalogOnly, true);
assert.equal(rule.exactReferenceMatch, true);
assert.equal(rule.structuredReferencesOnly, true);
assert.equal(rule.textualMentionParsing, false);
assert.equal(rule.contentMaterialization, false);
assert.equal(rule.sourceReads, false);
assert.equal(rule.jobCreation, false);
assert.equal(rule.persistenceMutation, false);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build46-context-mentions-static/1',
  build: 46,
  package: '@github-decrypter/chat',
  kinds: rule.kinds.length,
  explicitCatalogOnly: rule.explicitCatalogOnly,
  contentMaterialization: rule.contentMaterialization,
  sourceReads: rule.sourceReads,
  jobCreation: rule.jobCreation,
}, null, 2));
