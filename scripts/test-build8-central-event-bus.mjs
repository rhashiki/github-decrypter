import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));

const rootPackage = json('package.json');
assert.equal(rootPackage.version, '0.0.8');
assert.equal(rootPackage.scripts?.['check:build8'], 'node scripts/test-build8-central-event-bus.mjs && tsx scripts/test-build8-event-bus-runtime.ts');

const sharedPackage = json('packages/shared/package.json');
assert.equal(sharedPackage.name, '@github-decrypter/shared');
assert.equal(sharedPackage.version, '0.0.8');
assert.equal(sharedPackage.dependencies?.['@github-decrypter/protocol'], 'workspace:*');
assert.equal(sharedPackage.sideEffects, false);

for (const path of [
  'packages/shared/src/event-types.ts',
  'packages/shared/src/event-bus.ts',
  'packages/shared/src/index.ts',
]) {
  assert.ok(fs.existsSync(path), `missing Build 8 source: ${path}`);
}

const eventTypes = read('packages/shared/src/event-types.ts');
const eventBus = read('packages/shared/src/event-bus.ts');
const index = read('packages/shared/src/index.ts');

assert.match(eventTypes, /`gd\.\$\{string\}`/);
assert.match(eventTypes, /EventDeliveryFailure/);
assert.match(eventTypes, /correlationId/);
assert.match(eventTypes, /causationId/);
assert.match(eventTypes, /traceId/);
assert.match(eventBus, /class EventBus/);
assert.match(eventBus, /subscribeAll/);
assert.match(eventBus, /async publish/);
assert.match(eventBus, /publishEvent/);
assert.match(eventBus, /subscription\.once/);
assert.match(eventBus, /failures\.push/);
assert.match(index, /event-types\.js/);
assert.match(index, /event-bus\.js/);

const forbiddenAuthority = [
  /chrome\./,
  /window\./,
  /document\./,
  /WebSocket/,
  /fetch\(/,
  /node:/,
  /supabase/i,
  /ollama/i,
  /vllm/i,
];

for (const source of [eventTypes, eventBus]) {
  for (const pattern of forbiddenAuthority) {
    assert.ok(!pattern.test(source), `Build 8 Event Bus must remain environment-neutral: ${pattern}`);
  }
}

assert.ok(!/localStorage|chrome\.storage/.test(eventBus), 'Build 8 must not introduce persistence; durable events belong to later Builds.');
assert.ok(!/setTimeout|setInterval/.test(eventBus), 'Build 8 must not become a scheduler or retry engine.');

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-central-event-bus/1',
  package: '@github-decrypter/shared',
  eventNamespace: 'gd.*',
  transportAuthority: false,
  durableQueueAuthority: false,
  securityAuthority: false,
}, null, 2));
