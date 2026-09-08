import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const chatPkg = JSON.parse(read('packages/chat/package.json'));
const localPkg = JSON.parse(read('apps/local/package.json'));
const policy = JSON.parse(read('architecture.guardian.json'));
const source = read('packages/chat/src/attachments.ts');
const store = read('apps/local/src/attachment-store.ts');
const localIndex = read('apps/local/src/index.ts');

assert.equal(chatPkg.name, '@github-decrypter/chat');
assert.equal(chatPkg.version, '0.0.45');
assert.equal(chatPkg.exports?.['./attachments'], './src/attachments.ts');
assert.equal(localPkg.version, '0.0.45');
assert.equal(policy.currentBuild, 45);

for (const marker of [
  'ATTACHMENT_BUILD = 45',
  "ATTACHMENT_SCHEMA = 'gd-attachment/1'",
  "ATTACHMENT_INGESTION_SCHEMA = 'gd-attachment-ingestion/1'",
  'ATTACHMENT_MAX_BYTES = 33_554_432',
  "'image'",
  "'document'",
  "'code'",
  "'log'",
  "'screenshot'",
  "'structured-data'",
  "'audio'",
  "'media'",
  'ingestAttachment(',
  'verifyAttachmentPayload(',
  'attachmentIngestion: true',
  'conversationContextShared: true',
  'voiceContextShared: true',
  'voiceTransport: false',
  'speechToText: false',
  'ocr: false',
  'contentInterpretation: false',
  'providerExecution: false',
  'mentionResolution: false',
  'jobCreation: false',
  'persistenceMutation: false',
  "subtle.digest('SHA-256'",
]) assert.ok(source.includes(marker), `missing Build 45 attachment marker: ${marker}`);

assert.doesNotMatch(source, /(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\()/);
assert.doesNotMatch(source, /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/);
assert.doesNotMatch(source, /@github-decrypter\/(?:tools|git|github-provider|studio|extension|local)/);
assert.doesNotMatch(source, /\b(?:transcribe|recognizeSpeech|runOcr|extractText|resolveMention|runTool|executeJob)\s*\(/i);

for (const marker of [
  'LOCAL_ATTACHMENT_STORE_BUILD = 45',
  "LOCAL_ATTACHMENT_STORE_SCHEMA = 'gd-local-attachment-store/1'",
  'LOCAL_ATTACHMENT_STORE_MAX_ITEMS_PER_CONVERSATION = 256',
  'class LocalAttachmentStore',
  'verifyAttachmentPayload({ attachment, bytes })',
  'this.#conversations.get(attachment.conversationId)',
  'conversation.workspaceId !== attachment.workspaceId',
  'renameSync(temporaryDirectory, finalDirectory)',
  "writeFileSync(join(temporaryDirectory, 'content.bin')",
  "writeFileSync(\n      join(temporaryDirectory, 'metadata.json')",
]) assert.ok(store.includes(marker), `missing Build 45 local-store marker: ${marker}`);
assert.ok(localIndex.includes("export * from './attachment-store.js';"));
assert.doesNotMatch(store, /\bgd_jobs\b|DurableJobEngine|CapabilitySecurityAuthority|\/v1\//);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build45-attachment-engine-static/1',
  build: 45,
  attachmentKinds: 8,
  maxBytes: 33_554_432,
  durableLocalStore: true,
  conversationContextShared: true,
  voiceContextShared: true,
  voiceTransport: false,
  speechToText: false,
  ocr: false,
  providerExecution: false,
  mentionResolution: false,
}, null, 2));
