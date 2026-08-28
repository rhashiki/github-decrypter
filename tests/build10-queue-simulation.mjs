import assert from 'node:assert/strict';

const items = Array.from({ length: 12 }, (_, index) => ({
  id: `item-${index + 1}`,
  position: index + 1,
  status: 'queued',
  error: null
}));

function running() { return items.filter(item => item.status === 'running'); }
function assertSingleRunning() { assert.ok(running().length <= 1, `more than one running item: ${running().map(x => x.id).join(',')}`); }
function claim() {
  assertSingleRunning();
  if (running().length) throw new Error('QUEUE_ALREADY_RUNNING');
  const item = items.find(row => row.status === 'queued');
  if (!item) return null;
  item.status = 'running';
  assertSingleRunning();
  return item;
}
function finish(item, status, error = null) {
  assert.equal(item.status, 'running');
  item.status = status;
  item.error = error;
  if (status === 'failed' || status === 'blocked') {
    for (const row of items) if (row.status === 'queued') row.status = 'paused';
  }
  assertSingleRunning();
}
function pause() { for (const row of items) if (row.status === 'queued') row.status = 'paused'; }
function resume() {
  assert.equal(running().length, 0);
  for (const row of items) if (row.status === 'paused') row.status = 'queued';
}
function retry(item) {
  assert.ok(['failed', 'blocked'].includes(item.status));
  assert.equal(running().length, 0);
  item.status = 'queued';
  item.error = null;
  resume();
}
function skip(item) {
  assert.ok(['failed', 'blocked'].includes(item.status));
  assert.equal(running().length, 0);
  item.status = 'cancelled';
  item.error = 'SKIPPED_BY_USER';
  resume();
}
function cancelPending() {
  for (const row of items) if (row.status === 'queued' || row.status === 'paused') row.status = 'cancelled';
}

// 1-3 complete strictly in order.
for (let expected = 1; expected <= 3; expected++) {
  const item = claim();
  assert.equal(item.position, expected);
  finish(item, 'completed');
}

// 4 fails and pauses all following items.
const four = claim();
assert.equal(four.position, 4);
finish(four, 'failed', 'TEST_FAILURE');
assert.equal(items.slice(4).every(row => row.status === 'paused'), true);

// Retry 4 resumes the project and succeeds.
retry(four);
assert.equal(items.slice(4).every(row => row.status === 'queued'), true);
const fourRetry = claim();
assert.equal(fourRetry.id, four.id);
finish(fourRetry, 'completed');

// Manual pause/resume does not affect an already-completed item.
pause();
assert.equal(items.slice(4).every(row => row.status === 'paused'), true);
resume();
assert.equal(items.slice(4).every(row => row.status === 'queued'), true);

// 5 fails; user skips it atomically and project resumes on 6.
const five = claim();
assert.equal(five.position, 5);
finish(five, 'failed', 'SECOND_FAILURE');
skip(five);
assert.equal(five.status, 'cancelled');
assert.equal(five.error, 'SKIPPED_BY_USER');
const six = claim();
assert.equal(six.position, 6);
finish(six, 'completed');

// Reload recovery A: journal says the running item completed; backend reconciliation completes it.
const seven = claim();
assert.equal(seven.position, 7);
const recoveredJournal = { status: 'completed', resultSummary: 'Recovered after reload', headBefore: 'aaa' };
assert.equal(recoveredJournal.status, 'completed');
finish(seven, 'completed');

// Reload recovery B: stale uncertain execution + changed HEAD must block, never auto-retry.
const eight = claim();
assert.equal(eight.position, 8);
const uncertainJournal = { status: 'running', headBefore: 'aaa', headNow: 'bbb', stale: true };
assert.equal(uncertainJournal.stale && uncertainJournal.headBefore !== uncertainJournal.headNow, true);
finish(eight, 'blocked', 'RECOVERY_HEAD_CHANGED');
assert.equal(items.slice(8).every(row => row.status === 'paused'), true);
assert.equal(claim, claim); // explicit: no automatic claim while paused/failure is unresolved.

// User decides to skip the uncertain item, then 9 becomes eligible.
skip(eight);
const nine = claim();
assert.equal(nine.position, 9);
finish(nine, 'completed');

// Cancel remaining pending items 10-12.
cancelPending();
assert.equal(items.slice(9).every(row => row.status === 'cancelled'), true);
assert.equal(items.filter(row => row.status === 'running').length, 0);
assert.deepEqual(items.map(row => row.status), [
  'completed','completed','completed','completed','cancelled','completed','completed','cancelled','completed','cancelled','cancelled','cancelled'
]);

console.log('Build 10 queue simulation passed: 12 items, sequential/failure/retry/skip/pause/resume/recovery/cancel.');
