import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.conversationEngineAuthority;
const violations = [];

const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 44 || rule.minimumBuild !== 44 || policy.phaseGates?.conversationEngineBuild !== 44
  || rule.ownerPackage !== '@github-decrypter/chat' || rule.ownerSource !== 'packages/chat/src/index.ts'
  || rule.runtimeOwnerRoot !== 'apps/local' || rule.schema !== 'gd-conversation/1'
) {
  violations.push({ code: 'AG420', message: 'Build 44 Conversation Engine authority is missing or inactive.' });
} else {
  const source = read('packages/chat/src/index.ts');
  const store = read('apps/local/src/conversation-store.ts');
  const migrations = read('apps/local/src/database-migrations.ts');
  const localIndex = read('apps/local/src/index.ts');
  const server = read('apps/local/src/server.ts');
  const chatPackage = json('packages/chat/package.json');
  const localPackage = json('apps/local/package.json');
  const chatRule = policy.packageRules?.['@github-decrypter/chat'];
  const localRule = policy.appRules?.['@github-decrypter/local'];
  const packageBuild = versionBuild(chatPackage.version);

  const expectedDependencies = {
    '@github-decrypter/ai': 'workspace:*',
    '@github-decrypter/context': 'workspace:*',
    '@github-decrypter/workspace': 'workspace:*',
  };
  if (
    chatPackage.name !== '@github-decrypter/chat' || packageBuild !== 44
    || JSON.stringify(chatPackage.dependencies ?? {}) !== JSON.stringify(expectedDependencies)
    || !chatRule || chatRule.environmentNeutral !== true
    || JSON.stringify(chatRule.allowedWorkspaceDependencies) !== JSON.stringify(Object.keys(expectedDependencies))
  ) violations.push({ code: 'AG421', message: 'Conversation package identity/dependency boundary is inconsistent.' });

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
    'tokenAbstraction: true',
    'finiteModelWindow: true',
    'fullHistoryOrReject: true',
    'silentTruncation: false',
    'attachmentIngestion: false',
    'mentionResolution: false',
    'voiceContextShared: true',
    'voiceTransport: false',
    'providerExecution: false',
    'persistenceMutation: false',
    'projectMemory: false',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG422', message: 'Conversation Engine core contract is incomplete.', detail: marker });

  if (
    rule.tokenAbstractionBuild !== 43 || rule.inputSchema !== 'gd-token-abstraction/1'
    || rule.messageSchema !== 'gd-conversation-message/1' || rule.dispatchSchema !== 'gd-conversation-dispatch/1'
    || rule.maxMessages !== 256 || rule.maxTitleCharacters !== 160 || rule.maxMessageCharacters !== 262144
    || JSON.stringify(rule.roles) !== JSON.stringify(['user','assistant'])
    || rule.environmentNeutral !== true || rule.workspaceScoped !== true
    || rule.fullHistoryOrReject !== true || rule.silentTruncation !== false
  ) violations.push({ code: 'AG423', message: 'Conversation Engine structural policy drifted.' });

  if (/\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/.test(source)
      || /(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\(|\bLocalDatabase\b|\bDatabaseSync\b)/.test(source)) {
    violations.push({ code: 'AG424', message: 'Conversation core gained environment, transport or database authority.' });
  }
  if (/@github-decrypter\/(?:tools|git|github-provider|studio|extension|local)/.test(source)) {
    violations.push({ code: 'AG424', message: 'Conversation core gained a forbidden workspace dependency.' });
  }
  if (/\b(?:generate|execute|runTool|ingestAttachment|resolveMention|rememberProject)\s*\(/.test(source)) {
    violations.push({ code: 'AG424', message: 'Conversation core gained deferred execution authority.' });
  }

  for (const marker of [
    'LOCAL_CONVERSATION_STORE_BUILD = 44',
    "LOCAL_CONVERSATION_STORE_SCHEMA = 'gd-local-conversation-store/1'",
    'class LocalConversationStore',
    'createLocalConversationStore(',
    'this.#database.transaction(',
    'appendConversationMessage({ conversation: current, message })',
  ]) if (!store.includes(marker)) violations.push({ code: 'AG425', message: 'Local Conversation Store contract is incomplete.', detail: marker });
  for (const marker of [
    'MIGRATION_012_SQL',
    'CREATE TABLE gd_conversations',
    'CREATE TABLE gd_conversation_messages',
    "name: 'conversation-engine'",
    'version: 12',
  ]) if (!migrations.includes(marker)) violations.push({ code: 'AG425', message: 'Conversation persistence migration is incomplete.', detail: marker });
  const migration12 = migrations.match(/const MIGRATION_012_SQL = `([\s\S]*?)`;/)?.[1] ?? '';
  if (!migration12 || /\bjob_id\b/.test(migration12) || /REFERENCES\s+gd_jobs/i.test(migration12)) {
    violations.push({ code: 'AG425', message: 'Conversation persistence must remain independent from job lifecycle.' });
  }
  if (!localIndex.includes("export * from './conversation-store.js';")) {
    violations.push({ code: 'AG425', message: 'Local Conversation Store is not exported by Local Runtime.' });
  }

  if (
    rule.persistentConversation !== true || rule.jobLifecycleIndependent !== true || rule.localPersistence !== true
    || rule.persistenceMigration !== 12 || rule.jobForeignKey !== false || rule.providerExecution !== false
    || rule.voiceContextShared !== true || rule.voiceTransport !== false
    || rule.attachmentIngestion !== false || rule.mentionResolution !== false || rule.projectMemory !== false
  ) violations.push({ code: 'AG426', message: 'Conversation persistence/deferred authority policy drifted.' });
  if (!localPackage.dependencies?.['@github-decrypter/chat'] || !localRule?.allowedWorkspaceDependencies?.includes('@github-decrypter/chat')) {
    violations.push({ code: 'AG426', message: 'Local Runtime is not explicitly authorized to consume Conversation Engine.' });
  }
  if (/\/v1\/(?:conversation|conversations|chat)\b/i.test(server)) {
    violations.push({ code: 'AG426', message: 'Build 44 must not expose Conversation Engine transport/RPC prematurely.' });
  }

  if (
    rule.attachmentEngineBuild !== 45 || rule.contextMentionsBuild !== 46
    || rule.projectMemoryBuild !== 66 || rule.finalContextEngineBuild !== 67
  ) violations.push({ code: 'AG427', message: 'Conversation Engine downstream ownership boundaries drifted.' });
  if (/\b(?:ingestAttachment|resolveMention|persistContextPack|rememberProject|voiceTransport)\s*\(/.test(source + '\n' + store)) {
    violations.push({ code: 'AG427', message: 'A later-roadmap engine leaked into Build 44.' });
  }

  for (const required of [
    'packages/chat/src/index.ts',
    'apps/local/src/conversation-store.ts',
    'docs/architecture/CONVERSATION_ENGINE.md',
    'docs/builds/BUILD_44_CONVERSATION_ENGINE.md',
    'scripts/architecture-guardian-conversation-engine.mjs',
    'scripts/test-build44-conversation-engine.mjs',
    'scripts/test-build44-conversation-engine-runtime.ts',
    'scripts/test-build44-conversation-engine-guardian-negative.mjs',
    'scripts/tsconfig.build44-tests.json',
    '.github/workflows/build44-conversation-engine.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG428', message: 'Required Build 44 artifact is missing.', detail: required });

  const architectureDoc = read('docs/architecture/CONVERSATION_ENGINE.md');
  const buildDoc = read('docs/builds/BUILD_44_CONVERSATION_ENGINE.md');
  const scopeDoc = read('docs/product/V1_SCOPE.md');
  if (!architectureDoc.includes('Build 45 — Attachment Engine')
      || !architectureDoc.includes('Build 46 — Context Mentions')
      || !architectureDoc.includes('independent from job lifecycle')
      || !buildDoc.includes('Build 66 — Project Memory')
      || !scopeDoc.includes('persistent conversations independent from job lifecycle')) {
    violations.push({ code: 'AG429', message: 'Build 44 documentation does not preserve persistence or downstream ownership policy.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-conversation-engine-report/1',
  currentBuild: policy.currentBuild,
  conversationSchema: rule?.schema ?? null,
  persistentConversation: rule?.persistentConversation ?? null,
  jobLifecycleIndependent: rule?.jobLifecycleIndependent ?? null,
  fullHistoryOrReject: rule?.fullHistoryOrReject ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
