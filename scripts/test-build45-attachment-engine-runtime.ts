import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConversation, createConversationMessage } from '../packages/chat/src/index.js';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_SCHEMA,
  ingestAttachment,
  verifyAttachmentPayload,
} from '../packages/chat/src/attachments.js';
import { LocalDatabase } from '../apps/local/src/database.js';
import { LocalConversationStore } from '../apps/local/src/conversation-store.js';
import { LocalAttachmentStore } from '../apps/local/src/attachment-store.js';

const workspaceId = 'gd_ws_00000000-0000-4000-8000-000000000045';
const otherWorkspaceId = 'gd_ws_00000000-0000-4000-8000-000000000046';
const conversationId = 'gd_conv_00000000-0000-4000-8000-000000000045';
const messageId = 'gd_msg_00000000-0000-4000-8000-000000000045';
const attachmentId = 'gd_att_00000000-0000-4000-8000-000000000045';
const audioAttachmentId = 'gd_att_00000000-0000-4000-8000-000000000046';
const createdAt = '2026-09-08T18:30:00.000Z';
const nextAt = '2026-09-08T18:30:01.000Z';
const bytes = new TextEncoder().encode('{"ok":true,"build":45}');

const ingested = await ingestAttachment({
  id: attachmentId,
  conversationId,
  workspaceId,
  messageId,
  kind: 'structured-data',
  mediaType: 'application/json',
  name: 'fixture.json',
  bytes,
  createdAt: nextAt,
});
assert.equal(ingested.attachment.schema, ATTACHMENT_SCHEMA);
assert.equal(ingested.attachment.conversationId, conversationId);
assert.equal(ingested.attachment.workspaceId, workspaceId);
assert.equal(ingested.attachment.messageId, messageId);
assert.equal(ingested.attachment.sizeBytes, bytes.byteLength);
assert.match(ingested.attachment.sha256, /^[0-9a-f]{64}$/);
assert.equal(ingested.attachmentIngestion, true);
assert.equal(ingested.conversationContextShared, true);
assert.equal(ingested.voiceContextShared, true);
assert.equal(ingested.voiceTransport, false);
assert.equal(ingested.speechToText, false);
assert.equal(ingested.ocr, false);
assert.equal(ingested.contentInterpretation, false);
assert.equal(ingested.providerExecution, false);
assert.equal(ingested.mentionResolution, false);
assert.equal(ingested.jobCreation, false);
assert.equal(ingested.persistenceMutation, false);
assert.equal(Object.isFrozen(ingested), true);
assert.equal(Object.isFrozen(ingested.attachment), true);
await verifyAttachmentPayload({ attachment: ingested.attachment, bytes });
await assert.rejects(
  () => verifyAttachmentPayload({ attachment: ingested.attachment, bytes: new TextEncoder().encode('tampered') }),
  /size does not match|digest does not match/i,
);

const audioBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01, 0x02, 0x03, 0x04]);
const audio = await ingestAttachment({
  id: audioAttachmentId,
  conversationId,
  workspaceId,
  messageId: null,
  kind: 'audio',
  mediaType: 'audio/wav',
  name: 'voice.wav',
  bytes: audioBytes,
  createdAt: '2026-09-08T18:30:02.000Z',
});
assert.equal(audio.attachment.kind, 'audio');
assert.equal(audio.attachment.messageId, null);
assert.equal(audio.voiceContextShared, true);
assert.equal(audio.voiceTransport, false);
assert.equal(audio.speechToText, false);

await assert.rejects(() => ingestAttachment({
  id: 'gd_att_00000000-0000-4000-8000-000000000047',
  conversationId,
  workspaceId,
  messageId: null,
  kind: 'audio',
  mediaType: 'image/png',
  name: 'wrong.png',
  bytes: new Uint8Array([1]),
  createdAt,
}), /audio\/\*/i);
await assert.rejects(() => ingestAttachment({
  id: 'gd_att_00000000-0000-4000-8000-000000000048',
  conversationId,
  workspaceId,
  messageId: null,
  kind: 'document',
  mediaType: 'application/pdf',
  name: '../escape.pdf',
  bytes: new Uint8Array([1]),
  createdAt,
}), /name is invalid/i);
await assert.rejects(() => ingestAttachment({
  id: 'gd_att_00000000-0000-4000-8000-000000000049',
  conversationId,
  workspaceId,
  messageId: null,
  kind: 'document',
  mediaType: 'application/pdf',
  name: 'empty.pdf',
  bytes: new Uint8Array(),
  createdAt,
}), /between 1 and/i);
assert.equal(ATTACHMENT_MAX_BYTES, 33_554_432);

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build45-'));
const databasePath = join(tempRoot, 'runtime.sqlite3');
const attachmentRoot = join(tempRoot, 'attachments');
try {
  const database = new LocalDatabase({ path: databasePath });
  const opened = database.open();
  assert.equal(opened.schemaVersion, 12);
  database.transaction((sqlite) => {
    sqlite.prepare(`
      INSERT INTO gd_workspaces (id, root_path, display_name, registered_at, last_opened_at)
      VALUES (?, ?, ?, ?, NULL)
    `).run(workspaceId, join(tempRoot, 'workspace'), 'Build 45 Workspace', createdAt);
  });
  const conversations = new LocalConversationStore(database);
  conversations.create(createConversation({ id: conversationId, workspaceId, title: 'Build 45 attachments', createdAt }));
  conversations.append(conversationId, createConversationMessage({
    id: messageId,
    role: 'user',
    content: 'Use the attached context.',
    createdAt: nextAt,
  }));

  const store = new LocalAttachmentStore({ rootPath: attachmentRoot, conversations });
  await store.put(ingested.attachment, bytes);
  await store.put(audio.attachment, audioBytes);
  assert.deepEqual(store.get(ingested.attachment.id), ingested.attachment);
  assert.equal(store.list(conversationId).length, 2);
  assert.deepEqual([...await store.readBytes(ingested.attachment.id)], [...bytes]);
  assert.equal(database.read((sqlite) => Number((sqlite.prepare('SELECT COUNT(*) AS count FROM gd_jobs').get() as { count: number | bigint }).count)), 0);

  const wrongWorkspace = await ingestAttachment({
    id: 'gd_att_00000000-0000-4000-8000-000000000050',
    conversationId,
    workspaceId: otherWorkspaceId,
    messageId: null,
    kind: 'document',
    mediaType: 'application/pdf',
    name: 'wrong-workspace.pdf',
    bytes: new Uint8Array([1, 2]),
    createdAt: '2026-09-08T18:30:03.000Z',
  });
  await assert.rejects(() => store.put(wrongWorkspace.attachment, new Uint8Array([1, 2])), /workspace does not match/i);
  database.close();

  const reopened = new LocalDatabase({ path: databasePath });
  reopened.open();
  const reopenedConversations = new LocalConversationStore(reopened);
  const reopenedStore = new LocalAttachmentStore({ rootPath: attachmentRoot, conversations: reopenedConversations });
  assert.equal(reopenedStore.list(conversationId).length, 2);
  assert.deepEqual([...await reopenedStore.readBytes(audio.attachment.id)], [...audioBytes]);

  writeFileSync(join(attachmentRoot, ingested.attachment.id, 'content.bin'), new Uint8Array([9, 9, 9]));
  await assert.rejects(() => reopenedStore.readBytes(ingested.attachment.id), /size does not match|digest does not match/i);
  assert.equal(reopened.read((sqlite) => Number((sqlite.prepare('SELECT COUNT(*) AS count FROM gd_jobs').get() as { count: number | bigint }).count)), 0);
  reopened.close();
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build45-attachment-engine-runtime/1',
  sha256Integrity: true,
  durableFilesystemPersistence: true,
  persistenceAcrossReopen: true,
  conversationContextShared: true,
  workspaceBinding: true,
  messageBindingOptional: true,
  supportedAudioIngestion: true,
  voiceSecondStateAuthority: false,
  voiceTransport: false,
  speechToText: false,
  ocr: false,
  providerExecution: false,
  jobsCreated: 0,
}, null, 2));
