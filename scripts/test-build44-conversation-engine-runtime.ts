import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { buildHierarchicalContext } from '../packages/context/src/index.js';
import { compileContextContinuation } from '../packages/context/src/continuation.js';
import { abstractTokenWindow } from '../packages/context/src/token-abstraction.js';
import {
  CONVERSATION_DISPATCH_SCHEMA,
  CONVERSATION_MAX_MESSAGES,
  appendConversationMessage,
  compileConversationDispatch,
  createConversation,
  createConversationMessage,
  type ConversationRecord,
} from '../packages/chat/src/index.js';
import { LocalDatabase } from '../apps/local/src/database.js';
import { LocalConversationStore } from '../apps/local/src/conversation-store.js';

const workspaceId = 'gd_ws_00000000-0000-4000-8000-000000000001';
const conversationId = 'gd_conv_00000000-0000-4000-8000-000000000001';
const baseTime = Date.parse('2026-09-08T12:00:00.000Z');
const iso = (offset: number) => new Date(baseTime + offset).toISOString();
const messageId = (ordinal: number) => `gd_msg_00000000-0000-4000-8000-${ordinal.toString(16).padStart(12, '0')}`;

const intake = createPromptIntakeRecord({
  text: [
    '# Goal',
    'Preserve conversation context honestly.',
    '',
    '## Requirements',
    '- Prepare the response.',
    '- Validate the response [depends: req-0002].',
  ].join('\n'),
});
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const hierarchical = buildHierarchicalContext({ spec, graph });
const continuation = compileContextContinuation({ context: hierarchical });
const abstraction = abstractTokenWindow({
  continuation,
  window: { contextWindowTokens: 8192, reservedOutputTokens: 1024 },
});

let conversation = createConversation({
  id: conversationId,
  workspaceId,
  title: 'Build 44 runtime',
  createdAt: iso(0),
});
assert.equal(conversation.revision, 0);
assert.equal(conversation.messages.length, 0);
assert.equal(Object.isFrozen(conversation), true);
assert.equal(Object.isFrozen(conversation.messages), true);

const user1 = createConversationMessage({ id: messageId(1), role: 'user', content: 'First request', createdAt: iso(1) });
conversation = appendConversationMessage({ conversation, message: user1 });
const assistant1 = createConversationMessage({ id: messageId(2), role: 'assistant', content: 'First response', createdAt: iso(2) });
conversation = appendConversationMessage({ conversation, message: assistant1 });
const user2 = createConversationMessage({ id: messageId(3), role: 'user', content: 'Second request', createdAt: iso(3) });
conversation = appendConversationMessage({ conversation, message: user2 });

const dispatch = compileConversationDispatch({
  conversation,
  abstraction,
  envelopeId: abstraction.envelopeOrder[0]!,
  providerId: 'local',
  modelId: 'qwen2.5-coder:7b',
  temperature: 0.2,
});
assert.equal(dispatch.schema, CONVERSATION_DISPATCH_SCHEMA);
assert.equal(dispatch.conversationId, conversation.id);
assert.equal(dispatch.workspaceId, workspaceId);
assert.equal(dispatch.conversationRevision, 3);
assert.equal(dispatch.contextEnvelopeId, abstraction.envelopeOrder[0]);
assert.equal(dispatch.providerRequest.messages.length, 3);
assert.deepEqual(dispatch.providerRequest.messages.map((message) => message.content), ['First request', 'First response', 'Second request']);
assert.equal(dispatch.providerRequest.maxOutputTokens, 1024);
assert.equal(dispatch.conversationHistory, true);
assert.equal(dispatch.persistentConversation, true);
assert.equal(dispatch.jobLifecycleIndependent, true);
assert.equal(dispatch.fullHistoryOrReject, true);
assert.equal(dispatch.silentTruncation, false);
assert.equal(dispatch.attachmentIngestion, false);
assert.equal(dispatch.mentionResolution, false);
assert.equal(dispatch.providerExecution, false);
assert.equal(dispatch.persistenceMutation, false);
assert.equal(Object.isFrozen(dispatch), true);
assert.equal(Object.isFrozen(dispatch.carriedContextIds), true);

const assistantLast = appendConversationMessage({
  conversation,
  message: createConversationMessage({ id: messageId(4), role: 'assistant', content: 'No pending user turn', createdAt: iso(4) }),
});
assert.throws(() => compileConversationDispatch({
  conversation: assistantLast,
  abstraction,
  envelopeId: abstraction.envelopeOrder[0]!,
  providerId: 'local',
  modelId: 'qwen2.5-coder:7b',
  temperature: null,
}), /latest committed message to be from the user/i);
assert.throws(() => compileConversationDispatch({
  conversation,
  abstraction,
  envelopeId: 'ctxwin-9999',
  providerId: 'local',
  modelId: 'qwen2.5-coder:7b',
  temperature: null,
}), /does not exist/i);

let maxConversation: ConversationRecord = createConversation({
  id: 'gd_conv_00000000-0000-4000-8000-000000000002',
  workspaceId,
  title: 'Full history boundary',
  createdAt: iso(1000),
});
for (let ordinal = 1; ordinal <= CONVERSATION_MAX_MESSAGES; ordinal += 1) {
  maxConversation = appendConversationMessage({
    conversation: maxConversation,
    message: createConversationMessage({
      id: messageId(1000 + ordinal),
      role: 'user',
      content: `Message ${ordinal}`,
      createdAt: iso(1000 + ordinal),
    }),
  });
}
const maxDispatch = compileConversationDispatch({
  conversation: maxConversation,
  abstraction,
  envelopeId: abstraction.envelopeOrder[0]!,
  providerId: 'local',
  modelId: 'qwen2.5-coder:7b',
  temperature: null,
});
assert.equal(maxDispatch.providerRequest.messages.length, CONVERSATION_MAX_MESSAGES);
assert.equal(maxDispatch.providerRequest.messages[0]!.content, 'Message 1');
assert.equal(maxDispatch.providerRequest.messages.at(-1)!.content, `Message ${CONVERSATION_MAX_MESSAGES}`);
assert.throws(() => appendConversationMessage({
  conversation: maxConversation,
  message: createConversationMessage({
    id: messageId(2000),
    role: 'user',
    content: 'Overflow',
    createdAt: iso(2000),
  }),
}), /at most 256 messages/i);

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build44-'));
const databasePath = join(tempRoot, 'runtime.sqlite3');
try {
  const database = new LocalDatabase({ path: databasePath });
  const opened = database.open();
  assert.equal(opened.schemaVersion, 12);
  database.transaction((sqlite) => {
    sqlite.prepare(`
      INSERT INTO gd_workspaces (id, root_path, display_name, registered_at, last_opened_at)
      VALUES (?, ?, ?, ?, NULL)
    `).run(workspaceId, join(tempRoot, 'workspace'), 'Build 44 Workspace', iso(0));
  });
  const store = new LocalConversationStore(database);
  const pristine = createConversation({ id: conversationId, workspaceId, title: 'Persistent conversation', createdAt: iso(10) });
  store.create(pristine);
  const stored1 = store.append(conversationId, createConversationMessage({
    id: messageId(10), role: 'user', content: 'Persist me', createdAt: iso(11),
  }));
  const stored2 = store.append(conversationId, createConversationMessage({
    id: messageId(11), role: 'assistant', content: 'Persisted', createdAt: iso(12),
  }));
  assert.equal(stored1.revision, 1);
  assert.equal(stored2.revision, 2);
  assert.deepEqual(store.get(conversationId), stored2);
  assert.equal(store.list(workspaceId).length, 1);
  assert.equal(database.read((sqlite) => Number((sqlite.prepare('SELECT COUNT(*) AS count FROM gd_jobs').get() as { count: number | bigint }).count)), 0);
  database.close();

  const reopened = new LocalDatabase({ path: databasePath });
  reopened.open();
  const reopenedStore = new LocalConversationStore(reopened);
  const persisted = reopenedStore.get(conversationId);
  assert.ok(persisted);
  assert.equal(persisted.revision, 2);
  assert.deepEqual(persisted.messages.map((message) => message.content), ['Persist me', 'Persisted']);
  assert.equal(reopened.read((sqlite) => Number((sqlite.prepare('SELECT COUNT(*) AS count FROM gd_jobs').get() as { count: number | bigint }).count)), 0);
  reopened.close();
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build44-conversation-engine-runtime/1',
  conversationMessages: dispatch.providerRequest.messages.length,
  maxHistoryMessages: maxDispatch.providerRequest.messages.length,
  fullHistoryOrReject: true,
  silentTruncation: false,
  persistentAcrossReopen: true,
  jobLifecycleIndependent: true,
  jobsCreated: 0,
  attachmentIngestion: false,
  mentionResolution: false,
}, null, 2));
