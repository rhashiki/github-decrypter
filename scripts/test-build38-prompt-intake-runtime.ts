import assert from 'node:assert/strict';
import {
  PROMPT_INTAKE_DIGEST_ALGORITHM,
  PROMPT_INTAKE_MAX_CHARACTERS,
  PROMPT_INTAKE_SCHEMA,
  createPromptIntakeRecord,
  normalizePromptText,
} from '../packages/plan/src/index.js';

const abc = createPromptIntakeRecord({ text: '  abc  ' });
assert.equal(abc.schema, PROMPT_INTAKE_SCHEMA);
assert.equal(abc.normalizedText, 'abc');
assert.equal(abc.digest.algorithm, PROMPT_INTAKE_DIGEST_ALGORITHM);
assert.equal(abc.digest.hex, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.equal(abc.characterCount, 3);
assert.equal(abc.lineCount, 1);
assert.equal(abc.shape, 'single-line');
assert.equal(abc.hasFencedCode, false);
assert.equal(Object.isFrozen(abc), true);
assert.equal(Object.isFrozen(abc.digest), true);

const multi = createPromptIntakeRecord({ text: 'first\r\nsecond\rthird' });
assert.equal(multi.normalizedText, 'first\nsecond\nthird');
assert.equal(multi.lineCount, 3);
assert.equal(multi.shape, 'multi-line');

const fenced = createPromptIntakeRecord({ text: 'Use this:\n```ts\nconst x = 1;\n```' });
assert.equal(fenced.hasFencedCode, true);
assert.equal(fenced.semanticInterpretation, false);
assert.equal(fenced.requirementCompilation, false);
assert.equal(fenced.taskGraphCompilation, false);
assert.equal(fenced.contextCompilation, false);
assert.equal(fenced.attachmentIngestion, false);
assert.equal(fenced.mentionResolution, false);
assert.equal(fenced.conversationHistory, false);
assert.equal(fenced.aiExecution, false);
assert.equal(fenced.persistence, false);

const decomposed = 'Cafe\u0301';
assert.equal(normalizePromptText(decomposed), 'Café');
assert.equal(
  createPromptIntakeRecord({ text: decomposed }).digest.hex,
  createPromptIntakeRecord({ text: 'Café' }).digest.hex,
);

assert.throws(() => createPromptIntakeRecord({ text: '   \r\n  ' }), /must not be empty/i);
assert.throws(() => createPromptIntakeRecord({ text: 'x'.repeat(PROMPT_INTAKE_MAX_CHARACTERS + 1) }), /exceeds/i);
assert.throws(() => createPromptIntakeRecord({ text: 123 } as unknown as { text: string }), /must be a string/i);
assert.throws(() => createPromptIntakeRecord({ text: 'ok', extra: true } as unknown as { text: string }), /only the text field/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build38-prompt-intake-runtime/1',
  sha256Vector: true,
  crlfNormalization: true,
  unicodeNormalization: true,
  fencedCodeSignal: true,
  exactInput: true,
  maxLength: PROMPT_INTAKE_MAX_CHARACTERS,
  deferredSemanticAuthority: true,
}, null, 2));
