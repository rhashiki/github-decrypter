import assert from 'node:assert/strict';
import {
  appendConversationMessage,
  createConversation,
  createConversationMessage,
} from '../packages/chat/src/index.js';
import {
  CONTEXT_MENTION_KINDS,
  CONTEXT_MENTION_RESOLUTION_SCHEMA,
  createContextMention,
  createContextMentionTarget,
  resolveContextMentions,
} from '../packages/chat/src/mentions.js';

const workspaceId = 'gd_ws_00000000-0000-4000-8000-000000000001';
const conversationId = 'gd_conv_00000000-0000-4000-8000-000000000001';
const messageId = 'gd_msg_00000000-0000-4000-8000-000000000001';

let conversation = createConversation({
  id: conversationId,
  workspaceId,
  title: 'Build 46 runtime',
  createdAt: '2026-09-08T12:00:00.000Z',
});
conversation = appendConversationMessage({
  conversation,
  message: createConversationMessage({
    id: messageId,
    role: 'user',
    content: 'Inspect the referenced project context.',
    createdAt: '2026-09-08T12:00:01.000Z',
  }),
});

const references = [
  ['file', 'src/index.ts'],
  ['folder', 'src'],
  ['repository', 'rhashiki/github-decrypter'],
  ['commit', '0123456789abcdef0123456789abcdef01234567'],
  ['branch', 'main'],
  ['pull-request', '48'],
  ['issue', '123'],
  ['database', 'local-primary'],
  ['preview', 'preview-main'],
  ['terminal', 'terminal-main'],
] as const;

assert.deepEqual(CONTEXT_MENTION_KINDS, references.map(([kind]) => kind));

const catalog = references.map(([kind, reference], index) => createContextMentionTarget({
  workspaceId,
  kind,
  reference,
  label: `Target ${index + 1}`,
}));
const mentions = references.map(([kind, reference], index) => createContextMention({
  id: `gd_mention_00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`,
  kind,
  reference,
  label: index === 0 ? 'Entry file' : null,
}));

const resolution = resolveContextMentions({ conversation, messageId, mentions, catalog });
assert.equal(resolution.schema, CONTEXT_MENTION_RESOLUTION_SCHEMA);
assert.equal(resolution.workspaceId, workspaceId);
assert.equal(resolution.conversationId, conversationId);
assert.equal(resolution.conversationRevision, 1);
assert.equal(resolution.messageId, messageId);
assert.equal(resolution.resolved.length, 10);
assert.equal(resolution.mentionResolution, true);
assert.equal(resolution.explicitCatalogOnly, true);
assert.equal(resolution.exactReferenceMatch, true);
assert.equal(resolution.structuredReferencesOnly, true);
assert.equal(resolution.textualMentionParsing, false);
assert.equal(resolution.contentMaterialization, false);
assert.equal(resolution.sourceReads, false);
assert.equal(resolution.filesystemRead, false);
assert.equal(resolution.gitRead, false);
assert.equal(resolution.githubRead, false);
assert.equal(resolution.databaseRead, false);
assert.equal(resolution.previewRead, false);
assert.equal(resolution.terminalRead, false);
assert.equal(resolution.attachmentIngestion, false);
assert.equal(resolution.providerExecution, false);
assert.equal(resolution.jobCreation, false);
assert.equal(resolution.persistenceMutation, false);
assert.equal(resolution.networkAuthority, false);
assert.equal(resolution.projectMemory, false);
assert.equal(Object.isFrozen(resolution), true);
assert.equal(Object.isFrozen(resolution.resolved), true);
assert.equal(Object.isFrozen(resolution.resolved[0]!), true);
assert.equal(resolution.resolved[0]!.mentionLabel, 'Entry file');
assert.equal(resolution.resolved[0]!.targetLabel, 'Target 1');

const second = resolveContextMentions({ conversation, messageId, mentions, catalog });
assert.deepEqual(second, resolution);

assert.throws(() => resolveContextMentions({
  conversation,
  messageId,
  mentions: [createContextMention({
    id: 'gd_mention_00000000-0000-4000-8000-000000000099',
    kind: 'file',
    reference: 'missing.ts',
    label: null,
  })],
  catalog,
}), /authoritative catalog/i);

assert.throws(() => resolveContextMentions({
  conversation,
  messageId,
  mentions: [mentions[0]!, { ...mentions[0]! }],
  catalog,
}), /duplicated/i);

assert.throws(() => resolveContextMentions({
  conversation,
  messageId,
  mentions: [mentions[0]!],
  catalog: [catalog[0]!, { ...catalog[0]! }],
}), /duplicated/i);

assert.throws(() => resolveContextMentions({
  conversation,
  messageId,
  mentions: [mentions[0]!],
  catalog: [createContextMentionTarget({
    workspaceId: 'gd_ws_00000000-0000-4000-8000-000000000002',
    kind: 'file',
    reference: 'src/index.ts',
    label: 'Wrong workspace',
  })],
}), /workspace does not match/i);

const assistantConversation = appendConversationMessage({
  conversation,
  message: createConversationMessage({
    id: 'gd_msg_00000000-0000-4000-8000-000000000002',
    role: 'assistant',
    content: 'Assistant message',
    createdAt: '2026-09-08T12:00:02.000Z',
  }),
});
assert.throws(() => resolveContextMentions({
  conversation: assistantConversation,
  messageId: 'gd_msg_00000000-0000-4000-8000-000000000002',
  mentions: [mentions[0]!],
  catalog: [catalog[0]!],
}), /committed user message/i);

assert.throws(() => createContextMention({
  id: 'gd_mention_00000000-0000-4000-8000-000000000100',
  kind: 'file',
  reference: ' src/index.ts ',
  label: null,
}), /canonical|invalid/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build46-context-mentions-runtime/1',
  build: 46,
  kinds: CONTEXT_MENTION_KINDS.length,
  resolved: resolution.resolved.length,
  explicitCatalogOnly: resolution.explicitCatalogOnly,
  exactReferenceMatch: resolution.exactReferenceMatch,
  contentMaterialization: resolution.contentMaterialization,
  sourceReads: resolution.sourceReads,
  jobCreation: resolution.jobCreation,
}, null, 2));
