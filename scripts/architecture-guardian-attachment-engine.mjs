import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.attachmentEngineAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 45 || rule.minimumBuild !== 45 || policy.phaseGates?.attachmentEngineBuild !== 45
  || rule.ownerPackage !== '@github-decrypter/chat' || rule.ownerSource !== 'packages/chat/src/attachments.ts'
  || rule.runtimeOwnerRoot !== 'apps/local' || rule.runtimeStoreSource !== 'apps/local/src/attachment-store.ts'
  || rule.schema !== 'gd-attachment/1' || rule.ingestionSchema !== 'gd-attachment-ingestion/1'
) {
  violations.push({ code: 'AG430', message: 'Build 45 Attachment Engine authority is missing or inactive.' });
} else {
  const source = read('packages/chat/src/attachments.ts');
  const store = read('apps/local/src/attachment-store.ts');
  const chatPackage = json('packages/chat/package.json');
  const localPackage = json('apps/local/package.json');
  const chatRule = policy.packageRules?.['@github-decrypter/chat'];
  const localRule = policy.appRules?.['@github-decrypter/local'];

  if (
    versionBuild(chatPackage.version) !== 45 || versionBuild(localPackage.version) !== 45
    || chatPackage.exports?.['./attachments'] !== './src/attachments.ts'
    || !chatRule?.environmentNeutral
    || JSON.stringify(chatRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/ai','@github-decrypter/context','@github-decrypter/workspace'])
    || !localRule?.allowedWorkspaceDependencies?.includes('@github-decrypter/chat')
  ) violations.push({ code: 'AG431', message: 'Attachment package/runtime identity or dependency boundary is inconsistent.' });

  for (const marker of [
    'ATTACHMENT_BUILD = 45',
    "ATTACHMENT_SCHEMA = 'gd-attachment/1'",
    "ATTACHMENT_INGESTION_SCHEMA = 'gd-attachment-ingestion/1'",
    'ATTACHMENT_MAX_BYTES = 33_554_432',
    'ATTACHMENT_MAX_NAME_CHARACTERS = 255',
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
  ]) if (!source.includes(marker)) violations.push({ code: 'AG432', message: 'Attachment Engine core contract is incomplete.', detail: marker });

  if (
    JSON.stringify(rule.kinds) !== JSON.stringify(['image','document','code','log','screenshot','structured-data','audio','media'])
    || rule.maxBytes !== 33554432 || rule.maxNameCharacters !== 255 || rule.digestAlgorithm !== 'sha256'
    || rule.environmentNeutralCore !== true || rule.workspaceScoped !== true || rule.conversationScoped !== true
    || rule.messageBindingOptional !== true || !source.includes("subtle.digest('SHA-256'")
    || !source.includes('audio/* media type') || !source.includes('image/* media type')
  ) violations.push({ code: 'AG433', message: 'Attachment validation, integrity or size policy drifted.' });

  if (/\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/.test(source)
      || /(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\()/.test(source)
      || /@github-decrypter\/(?:tools|git|github-provider|studio|extension|local)/.test(source)
      || /\b(?:transcribe|recognizeSpeech|runOcr|extractText|resolveMention|runTool|executeJob)\s*\(/i.test(source)) {
    violations.push({ code: 'AG434', message: 'Attachment core gained environment, transport, interpretation or execution authority.' });
  }

  for (const marker of [
    'LOCAL_ATTACHMENT_STORE_BUILD = 45',
    "LOCAL_ATTACHMENT_STORE_SCHEMA = 'gd-local-attachment-store/1'",
    'LOCAL_ATTACHMENT_STORE_MAX_ITEMS_PER_CONVERSATION = 256',
    'class LocalAttachmentStore',
    'verifyAttachmentPayload({ attachment, bytes })',
    'this.#conversations.get(attachment.conversationId)',
    'conversation.workspaceId !== attachment.workspaceId',
    'renameSync(temporaryDirectory, finalDirectory)',
    "'content.bin'",
    "'metadata.json'",
  ]) if (!store.includes(marker)) violations.push({ code: 'AG435', message: 'Durable Local Attachment Store contract is incomplete.', detail: marker });
  if (
    rule.localPersistence !== true || rule.persistenceMedium !== 'filesystem' || rule.atomicDirectoryCommit !== true
    || rule.storeSchema !== 'gd-local-attachment-store/1' || rule.maxPersistedPerConversation !== 256
    || rule.payloadIntegrityVerification !== true
  ) violations.push({ code: 'AG435', message: 'Attachment persistence policy drifted.' });

  if (/\bgd_jobs\b|DurableJobEngine|CapabilitySecurityAuthority|\/v1\//.test(store)
      || rule.jobCreation !== false || rule.localRuntimeTransport !== false || rule.studioTransport !== false
      || rule.networkAuthority !== false) {
    violations.push({ code: 'AG436', message: 'Attachment persistence gained Job, transport, capability or network authority.' });
  }

  if (
    rule.conversationEngineBuild !== 44 || rule.contextMentionsBuild !== 46 || rule.jobsCenterBuild !== 47
    || rule.voiceContextShared !== true || rule.voiceSecondStateAuthority !== false || rule.voiceTransport !== false
    || rule.speechToText !== false || rule.ocr !== false || rule.contentInterpretation !== false
    || rule.providerExecution !== false || rule.mentionResolution !== false
  ) violations.push({ code: 'AG437', message: 'Attachment/voice downstream ownership boundaries drifted.' });

  for (const required of [
    'packages/chat/src/attachments.ts',
    'apps/local/src/attachment-store.ts',
    'docs/architecture/ATTACHMENT_ENGINE.md',
    'docs/builds/BUILD_45_ATTACHMENT_ENGINE.md',
    'scripts/architecture-guardian-attachment-engine.mjs',
    'scripts/test-build45-attachment-engine.mjs',
    'scripts/test-build45-attachment-engine-runtime.ts',
    'scripts/test-build45-attachment-engine-guardian-negative.mjs',
    'scripts/tsconfig.build45-tests.json',
    '.github/workflows/build45-attachment-engine.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG438', message: 'Required Build 45 artifact is missing.', detail: required });

  const architectureDoc = read('docs/architecture/ATTACHMENT_ENGINE.md');
  const buildDoc = read('docs/builds/BUILD_45_ATTACHMENT_ENGINE.md');
  const mapping = read('docs/product/NORTH_STAR_ROADMAP_MAPPING.md');
  const scope = read('docs/product/V1_SCOPE.md');
  if (!architectureDoc.includes('Build 46 — Context Mentions')
      || !architectureDoc.includes('same conversation')
      || !architectureDoc.includes('No OCR or speech-to-text')
      || !buildDoc.includes('Build 47 — Jobs Center')
      || !mapping.includes('Voice is another interaction channel, not another execution authority')
      || !scope.includes('attachments including images, documents, code, logs, screenshots, structured data, and supported media')) {
    violations.push({ code: 'AG439', message: 'Build 45 documentation does not preserve scope or North Star voice boundaries.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-attachment-engine-report/1',
  currentBuild: policy.currentBuild,
  attachmentSchema: rule?.schema ?? null,
  localPersistence: rule?.localPersistence ?? null,
  voiceContextShared: rule?.voiceContextShared ?? null,
  voiceTransport: rule?.voiceTransport ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
