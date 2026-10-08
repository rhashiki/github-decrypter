import assert from 'node:assert/strict';
import {
  DIFF_VIEWER_BUILD,
  DIFF_VIEWER_SCHEMA,
  compareExplicitTexts,
  unifiedDiffPreview,
} from '../apps/studio/src/diff-viewer-model.js';

const equal = compareExplicitTexts('a\nb\n', 'a\nb\n');
assert.equal(equal.build, DIFF_VIEWER_BUILD);
assert.equal(equal.schema, DIFF_VIEWER_SCHEMA);
assert.equal(equal.unchanged, true);
assert.equal(equal.hunks.length, 0);
assert.equal(equal.added, 0);
assert.equal(equal.removed, 0);
assert.equal(equal.mutationAuthority, false);
assert.equal(equal.repositoryAccess, false);
assert.equal(equal.authority, 'explicit-user-text-only');

const replaced = compareExplicitTexts('first\nold\nlast\n', 'first\nnew\nlast\n');
assert.equal(replaced.added, 1);
assert.equal(replaced.removed, 1);
assert.equal(replaced.hunks.length, 1);
assert.equal(replaced.hunks[0]?.oldStart, 1);
assert.equal(replaced.hunks[0]?.newStart, 1);
assert.ok(unifiedDiffPreview(replaced).includes('-old\n+new'));

const added = compareExplicitTexts('', 'hello\n');
assert.equal(added.added, 1);
assert.equal(added.removed, 0);
assert.equal(added.originalLines, 0);
assert.equal(added.hunks[0]?.oldStart, 0);
assert.equal(added.hunks[0]?.oldCount, 0);
assert.equal(added.hunks[0]?.newCount, 1);
assert.ok(unifiedDiffPreview(added).includes('@@ -0,0 +1,1 @@'));

const deleted = compareExplicitTexts('goodbye\n', '');
assert.equal(deleted.added, 0);
assert.equal(deleted.removed, 1);
assert.equal(deleted.hunks[0]?.newStart, 0);
assert.equal(deleted.hunks[0]?.newCount, 0);

const normalizedEol = compareExplicitTexts('first\r\nsecond\r\n', 'first\nsecond\n');
assert.equal(normalizedEol.unchanged, true);
const newlineChanged = compareExplicitTexts('a', 'a\n');
assert.equal(newlineChanged.unchanged, false);
assert.ok(unifiedDiffPreview(newlineChanged).includes('\\ No newline at end of file'));

const stable = compareExplicitTexts('a\nx\na\nx\n', 'a\ny\na\ny\n', { context: 0 });
assert.equal(stable.added, 2);
assert.equal(stable.removed, 2);
assert.equal(stable.hunks.length, 2);
assert.deepEqual(stable, compareExplicitTexts('a\nx\na\nx\n', 'a\ny\na\ny\n', { context: 0 }));

const separated = compareExplicitTexts(
  'first\nkeep1\nkeep2\nkeep3\nlast\n',
  'changed\nkeep1\nkeep2\nkeep3\nnew-last\n',
  { context: 0, maxHunks: 1 },
);
assert.equal(separated.totalHunks, 2);
assert.equal(separated.hunks.length, 1);
assert.equal(separated.truncated, true);
assert.ok(unifiedDiffPreview(separated).includes('Preview truncated'));

assert.throws(() => compareExplicitTexts('x'.repeat(100001), ''), RangeError);
assert.throws(() => compareExplicitTexts('', 'x'.repeat(100001)), RangeError);
assert.throws(() => compareExplicitTexts(Array(802).fill('a').join('\n'), ''), RangeError);
assert.throws(() => compareExplicitTexts('a', 'b', { context: 13 }), RangeError);
assert.throws(() => compareExplicitTexts('a', 'b', { context: -1 }), RangeError);
assert.throws(() => compareExplicitTexts('a', 'b', { maxHunks: 0 }), RangeError);
assert.throws(() => compareExplicitTexts('a', 'b', { maxHunks: 65 }), RangeError);
assert.throws(() => compareExplicitTexts(null as unknown as string, 'a'), RangeError);
const safeLabels = unifiedDiffPreview(replaced, 'old\nforged', 'new\thdr');
assert.ok(safeLabels.startsWith('--- old forged\n+++ new hdr'));
assert.equal(Object.isFrozen(replaced), true);
assert.equal(Object.isFrozen(replaced.hunks), true);
assert.equal(Object.isFrozen(replaced.hunks[0]), true);
console.log(JSON.stringify({ ok: true, build: 74, suite: 'bounded-read-only-text-diff' }));
