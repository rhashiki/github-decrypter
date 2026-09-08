import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const source = read('packages/plan/src/index.ts');
const pkg = JSON.parse(read('packages/plan/package.json'));
const packageBuild = Number(String(pkg.version).split('.')[2]);

assert.equal(pkg.name, '@github-decrypter/plan');
assert.ok(Number.isInteger(packageBuild) && packageBuild >= 38, 'plan package must preserve Build 38 or newer identity');
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);

for (const marker of [
  "PROMPT_INTAKE_BUILD = 38",
  "PROMPT_INTAKE_SCHEMA = 'gd-prompt-intake/1'",
  "PROMPT_INTAKE_SOURCE = 'user'",
  "PROMPT_INTAKE_DIGEST_ALGORITHM = 'sha256'",
  'PROMPT_INTAKE_MAX_CHARACTERS = 262_144',
  'createPromptIntakeRecord(',
  'normalizePromptText(',
  'semanticInterpretation: false',
  'requirementCompilation: false',
  'taskGraphCompilation: false',
  'contextCompilation: false',
  'attachmentIngestion: false',
  'mentionResolution: false',
  'conversationHistory: false',
  'aiExecution: false',
  'persistence: false',
]) assert.ok(source.includes(marker), `missing Build 38 marker: ${marker}`);

assert.doesNotMatch(source, /^\s*import\s/m);
assert.doesNotMatch(source, /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/);
assert.doesNotMatch(source, /\b(?:node:|process\.|require\s*\(|child_process|spawn\s*\(|exec\s*\()\b/);
assert.doesNotMatch(source, /@github-decrypter\/(?:ai|chat|context|tools|workspace|git)/);
assert.doesNotMatch(source, /\b(?:compileTaskGraph|buildHierarchicalContext|continueContext|abstractTokens|resolveMention|ingestAttachment|routeModel|generate)\b/);

if (packageBuild < 39) {
  assert.doesNotMatch(source, /\bcompileRequirements\b/);
} else {
  assert.match(source, /REQUIREMENT_COMPILER_BUILD = 39/);
  assert.match(source, /REQUIREMENT_SPEC_SCHEMA = 'gd-requirement-spec\/1'/);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build38-prompt-intake-static/1',
  build: 38,
  packageBuild,
  package: '@github-decrypter/plan',
  deterministic: true,
  environmentNeutral: true,
  semanticInterpretation: false,
  aiExecution: false,
  forwardCompatibleRequirementCompiler: packageBuild >= 39,
}, null, 2));
