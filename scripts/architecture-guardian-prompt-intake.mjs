import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.promptIntakeAuthority;
const violations = [];

const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 38 || rule.minimumBuild !== 38 || policy.phaseGates?.promptIntakeBuild !== 38
  || rule.ownerPackage !== '@github-decrypter/plan' || rule.schema !== 'gd-prompt-intake/1'
) {
  violations.push({ code: 'AG360', message: 'Build 38 Prompt Intake authority is missing or inactive.' });
} else {
  const source = read('packages/plan/src/index.ts');
  const planPackage = json('packages/plan/package.json');
  const packageRule = policy.packageRules?.['@github-decrypter/plan'];
  const studioPackage = json('apps/studio/package.json');
  const extensionPackage = json('apps/extension/package.json');
  const localPackage = json('apps/local/package.json');

  if (
    planPackage.name !== '@github-decrypter/plan' || versionBuild(planPackage.version) !== 38
    || Object.keys(planPackage.dependencies ?? {}).length !== 0
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify([])
  ) violations.push({ code: 'AG361', message: 'Prompt Intake package identity/dependency boundary is inconsistent.' });

  for (const marker of [
    "PROMPT_INTAKE_BUILD = 38",
    "PROMPT_INTAKE_SCHEMA = 'gd-prompt-intake/1'",
    "PROMPT_INTAKE_SOURCE = 'user'",
    "PROMPT_INTAKE_DIGEST_ALGORITHM = 'sha256'",
    'PROMPT_INTAKE_MAX_CHARACTERS = 262_144',
    'createPromptIntakeRecord(',
    'normalizePromptText(',
    "keys.length !== 1 || keys[0] !== 'text'",
    "text.normalize('NFC').replace(/\\r\\n?/g, '\\n').trim()",
    'Object.freeze({',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG362', message: 'Prompt Intake deterministic contract is incomplete.', detail: marker });

  if (
    rule.source !== 'user' || rule.maxCharacters !== 262144 || rule.digestAlgorithm !== 'sha256'
    || rule.deterministic !== true || rule.environmentNeutral !== true
    || JSON.stringify(rule.exactInputFields) !== JSON.stringify(['text'])
    || JSON.stringify(rule.normalization) !== JSON.stringify(['unicode-nfc','crlf-to-lf','outer-trim'])
  ) violations.push({ code: 'AG363', message: 'Prompt Intake normalization/fingerprint policy drifted.' });
  if (!source.includes('sha256Hex(normalizedText)') || !source.includes('normalizedText.length') || !source.includes("normalizedText.split('\\n').length")) {
    violations.push({ code: 'AG363', message: 'Prompt Intake fingerprint/structural metadata implementation is incomplete.' });
  }

  if (/^\s*import\s/m.test(source) || /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/.test(source)) {
    violations.push({ code: 'AG364', message: 'Prompt Intake gained environment/network/browser authority.' });
  }
  if (/\b(?:node:|process\.|child_process|spawn\s*\(|exec\s*\(|LocalDatabase|SecretsVault)\b/.test(source)) {
    violations.push({ code: 'AG364', message: 'Prompt Intake gained Node/filesystem/process/database/secret authority.' });
  }
  if (/@github-decrypter\/(?:ai|chat|context|tools|workspace|git)/.test(source)) {
    violations.push({ code: 'AG364', message: 'Prompt Intake gained a forbidden workspace dependency.' });
  }

  for (const [field, value] of Object.entries({
    semanticInterpretation: false,
    requirementCompilation: false,
    taskGraphCompilation: false,
    contextCompilation: false,
    attachmentIngestion: false,
    mentionResolution: false,
    conversationHistory: false,
    aiExecution: false,
    persistence: false,
  })) {
    if (rule[field] !== value || !source.includes(`${field}: false`)) {
      violations.push({ code: 'AG365', message: 'Prompt Intake gained deferred semantic/conversation authority.', detail: field });
    }
  }

  if (
    rule.networkAuthority !== false || rule.filesystemAuthority !== false || rule.databaseAuthority !== false
    || rule.storageAuthority !== false || rule.studioTransport !== false || rule.localRuntimeTransport !== false
  ) violations.push({ code: 'AG366', message: 'Prompt Intake policy granted transport or persistence authority.' });
  for (const [name, pkg] of [['studio', studioPackage], ['extension', extensionPackage], ['local', localPackage]]) {
    if (pkg.dependencies?.['@github-decrypter/plan']) violations.push({ code: 'AG366', message: `Build 38 activated Prompt Intake inside ${name} prematurely.` });
  }

  if (
    rule.requirementCompilerBuild !== 39 || rule.taskGraphCompilerBuild !== 40 || rule.hierarchicalContextBuild !== 41
    || rule.contextContinuationBuild !== 42 || rule.tokenAbstractionBuild !== 43 || rule.conversationEngineBuild !== 44
    || rule.attachmentEngineBuild !== 45 || rule.contextMentionsBuild !== 46
  ) violations.push({ code: 'AG367', message: 'Prompt Intake future ownership boundaries drifted.' });
  if (/\b(?:compileRequirements|compileTaskGraph|buildContext|continueContext|resolveMention|ingestAttachment|routeModel|generate)\b/.test(source)) {
    violations.push({ code: 'AG367', message: 'A later-roadmap engine leaked into Prompt Intake.' });
  }

  for (const required of [
    'packages/plan/src/index.ts',
    'docs/architecture/PROMPT_INTAKE_ENGINE.md',
    'docs/builds/BUILD_38_PROMPT_INTAKE_ENGINE.md',
    'scripts/architecture-guardian-prompt-intake.mjs',
    'scripts/test-build38-prompt-intake.mjs',
    'scripts/test-build38-prompt-intake-runtime.ts',
    'scripts/test-build38-prompt-intake-guardian-negative.mjs',
    'scripts/tsconfig.build38-tests.json',
    '.github/workflows/build38-prompt-intake-engine.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG368', message: 'Required Build 38 artifact is missing.', detail: required });

  if (!read('docs/architecture/PROMPT_INTAKE_ENGINE.md').includes('Build 39 — Requirement Compiler')
      || !read('docs/builds/BUILD_38_PROMPT_INTAKE_ENGINE.md').includes('Build 40 — Task Graph Compiler')) {
    violations.push({ code: 'AG369', message: 'Build 38 documentation does not preserve downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-prompt-intake-report/1',
  currentBuild: policy.currentBuild,
  promptIntakeSchema: rule?.schema ?? null,
  deterministic: rule?.deterministic ?? null,
  semanticInterpretation: rule?.semanticInterpretation ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
