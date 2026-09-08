import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.contextMentionsAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 46 || rule.minimumBuild !== 46 || policy.phaseGates?.contextMentionsBuild !== 46
  || rule.ownerPackage !== '@github-decrypter/chat' || rule.ownerSource !== 'packages/chat/src/mentions.ts'
  || rule.schema !== 'gd-context-mention/1' || rule.targetSchema !== 'gd-context-mention-target/1'
  || rule.resolutionSchema !== 'gd-context-mention-resolution/1'
) {
  violations.push({ code: 'AG440', message: 'Build 46 Context Mentions authority is missing or inactive.' });
} else {
  const source = read('packages/chat/src/mentions.ts');
  const chatPackage = json('packages/chat/package.json');
  const chatRule = policy.packageRules?.['@github-decrypter/chat'];
  const packageBuild = versionBuild(chatPackage.version);

  if (
    packageBuild === null || packageBuild < 46 || packageBuild > policy.currentBuild
    || chatPackage.exports?.['./mentions'] !== './src/mentions.ts'
    || !chatRule?.environmentNeutral
    || JSON.stringify(chatRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/ai','@github-decrypter/context','@github-decrypter/workspace'])
  ) violations.push({ code: 'AG441', message: 'Context Mentions package identity, export or dependency boundary is inconsistent.' });

  for (const marker of [
    'CONTEXT_MENTIONS_BUILD = 46',
    "CONTEXT_MENTION_SCHEMA = 'gd-context-mention/1'",
    "CONTEXT_MENTION_TARGET_SCHEMA = 'gd-context-mention-target/1'",
    "CONTEXT_MENTION_RESOLUTION_SCHEMA = 'gd-context-mention-resolution/1'",
    'CONTEXT_MENTION_MAX_ITEMS = 64',
    'CONTEXT_MENTION_MAX_CATALOG_ITEMS = 4096',
    'CONTEXT_MENTION_MAX_REFERENCE_CHARACTERS = 2048',
    'CONTEXT_MENTION_MAX_LABEL_CHARACTERS = 256',
    'resolveContextMentions(',
    'assertConversationRecord(input.conversation)',
    "message.role !== 'user'",
    'explicitCatalogOnly: true',
    'exactReferenceMatch: true',
    'structuredReferencesOnly: true',
    'textualMentionParsing: false',
    'contentMaterialization: false',
    'sourceReads: false',
    'jobCreation: false',
    'persistenceMutation: false',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG442', message: 'Context Mentions core contract is incomplete.', detail: marker });

  if (
    JSON.stringify(rule.kinds) !== JSON.stringify(['file','folder','repository','commit','branch','pull-request','issue','database','preview','terminal'])
    || rule.maxItems !== 64 || rule.maxCatalogItems !== 4096 || rule.maxReferenceCharacters !== 2048 || rule.maxLabelCharacters !== 256
    || rule.environmentNeutral !== true || rule.workspaceScoped !== true || rule.conversationScoped !== true
    || rule.committedUserMessageBinding !== true
  ) violations.push({ code: 'AG443', message: 'Context Mentions kinds, limits or conversation-binding policy drifted.' });

  if (/\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/.test(source)
      || /(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\()/.test(source)
      || /@github-decrypter\/(?:tools|git|github-provider|github-app|studio|extension|local)/.test(source)
      || /\b(?:readFile|readdir|glob|grep|runSql|queryDatabase|readTerminal|readPreview|executeJob|createJob|generateText)\s*\(/i.test(source)) {
    violations.push({ code: 'AG444', message: 'Context Mentions core gained source-read, environment, transport or execution authority.' });
  }

  if (
    rule.explicitCatalogOnly !== true || rule.exactReferenceMatch !== true || rule.structuredReferencesOnly !== true
    || rule.textualMentionParsing !== false || !source.includes('targets.get(key)')
    || !source.includes('target.workspaceId !== input.conversation.workspaceId')
    || !source.includes('Context mention target was not supplied by the authoritative catalog')
  ) violations.push({ code: 'AG445', message: 'Context Mentions explicit-catalog resolution semantics drifted.' });

  if (
    rule.contentMaterialization !== false || rule.sourceReads !== false || rule.filesystemRead !== false
    || rule.gitRead !== false || rule.githubRead !== false || rule.databaseRead !== false
    || rule.previewRead !== false || rule.terminalRead !== false || rule.attachmentIngestion !== false
    || rule.providerExecution !== false || rule.jobCreation !== false || rule.persistenceMutation !== false
    || rule.networkAuthority !== false || rule.studioTransport !== false || rule.localRuntimeTransport !== false
  ) violations.push({ code: 'AG446', message: 'Context Mentions gained materialization, source-read, Job, persistence, provider or transport authority.' });

  if (
    rule.conversationEngineBuild !== 44 || rule.attachmentEngineBuild !== 45 || rule.jobsCenterBuild !== 47
    || rule.projectMemoryBuild !== 66 || rule.finalContextEngineBuild !== 67
  ) violations.push({ code: 'AG447', message: 'Context Mentions downstream ownership boundaries drifted.' });

  for (const required of [
    'packages/chat/src/mentions.ts',
    'docs/architecture/CONTEXT_MENTIONS.md',
    'docs/builds/BUILD_46_CONTEXT_MENTIONS.md',
    'scripts/architecture-guardian-context-mentions.mjs',
    'scripts/test-build46-context-mentions.mjs',
    'scripts/test-build46-context-mentions-runtime.ts',
    'scripts/test-build46-context-mentions-guardian-negative.mjs',
    'scripts/tsconfig.build46-tests.json',
    '.github/workflows/build46-context-mentions.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG448', message: 'Required Build 46 artifact is missing.', detail: required });

  const architectureDoc = read('docs/architecture/CONTEXT_MENTIONS.md');
  const buildDoc = read('docs/builds/BUILD_46_CONTEXT_MENTIONS.md');
  const scope = read('docs/product/V1_SCOPE.md');
  if (!architectureDoc.includes('Build 47 — Jobs Center')
      || !architectureDoc.includes('does not read')
      || !architectureDoc.includes('explicit catalog')
      || !buildDoc.includes('Build 47 — Jobs Center')
      || !scope.includes('project-aware mentions such as file, folder, repository, commit, branch, PR, issue, database, preview, and terminal context')) {
    violations.push({ code: 'AG449', message: 'Build 46 documentation does not preserve frozen V1 scope or downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-context-mentions-report/1',
  currentBuild: policy.currentBuild,
  mentionSchema: rule?.schema ?? null,
  kinds: rule?.kinds?.length ?? null,
  explicitCatalogOnly: rule?.explicitCatalogOnly ?? null,
  contentMaterialization: rule?.contentMaterialization ?? null,
  sourceReads: rule?.sourceReads ?? null,
  jobCreation: rule?.jobCreation ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
