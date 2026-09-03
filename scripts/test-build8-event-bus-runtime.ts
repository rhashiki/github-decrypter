import assert from 'node:assert/strict';
import {
  asEventId,
  createEventBus,
  type EventCatalog,
} from '../packages/shared/src/index.ts';

type TestEvents = {
  'gd.test.alpha': { value: number };
  'gd.test.failure': { value: number };
  'gd.test.mutation': { step: number };
};

const satisfiesCatalog: TestEvents extends EventCatalog ? true : false = true;
assert.equal(satisfiesCatalog, true);

let eventId = 0;
const bus = createEventBus<TestEvents>({
  defaultSource: 'build8-runtime-test',
  now: () => '2026-09-03T10:30:00.000Z',
  createEventId: () => asEventId(`gd_evt_test_${++eventId}`),
  maxListenersPerEvent: 20,
});

const order: string[] = [];
bus.subscribe('gd.test.alpha', async (event) => {
  order.push(`exact:${event.payload.value}`);
});
bus.subscribeAll(async (event) => {
  order.push(`all:${event.name}`);
});
bus.once('gd.test.alpha', async () => {
  order.push('once');
});

const first = await bus.publish('gd.test.alpha', { value: 1 });
assert.equal(first.matched, 3);
assert.equal(first.succeeded, 3);
assert.equal(first.failures.length, 0);
assert.deepEqual(order, ['exact:1', 'all:gd.test.alpha', 'once']);
assert.equal(bus.listenerCount('gd.test.alpha'), 1);
assert.equal(bus.listenerCount(), 2);

order.length = 0;
const second = await bus.publish('gd.test.alpha', { value: 2 });
assert.equal(second.matched, 2);
assert.deepEqual(order, ['exact:2', 'all:gd.test.alpha']);

let failureContinuation = false;
bus.subscribe('gd.test.failure', async () => {
  throw new Error('expected handler failure');
});
bus.subscribe('gd.test.failure', async () => {
  failureContinuation = true;
});
const failureReport = await bus.publish('gd.test.failure', { value: 3 });
assert.equal(failureReport.failures.length, 1);
assert.equal(failureReport.succeeded, 2); // successful exact handler + subscribeAll
assert.equal(failureContinuation, true);

const mutationOrder: string[] = [];
let unsubscribeSecond = () => {};
bus.subscribe('gd.test.mutation', async () => {
  mutationOrder.push('first');
  unsubscribeSecond();
});
unsubscribeSecond = bus.subscribe('gd.test.mutation', async () => {
  mutationOrder.push('second');
});
const mutationReport = await bus.publish('gd.test.mutation', { step: 1 });
assert.equal(mutationReport.matched, 3); // first, second and subscribeAll matched at snapshot time
assert.deepEqual(mutationOrder, ['first']);

let lateSubscriberCalls = 0;
let installedLateSubscriber = false;
bus.subscribe('gd.test.mutation', async () => {
  if (!installedLateSubscriber) {
    installedLateSubscriber = true;
    bus.subscribe('gd.test.mutation', async () => {
      lateSubscriberCalls += 1;
    });
  }
});
await bus.publish('gd.test.mutation', { step: 2 });
assert.equal(lateSubscriberCalls, 0, 'subscriptions created during dispatch must wait for the next publish');
await bus.publish('gd.test.mutation', { step: 3 });
assert.equal(lateSubscriberCalls, 1);

await assert.rejects(
  () => (bus as any).publish('invalid.event', { value: 1 }),
  TypeError,
);
await assert.rejects(
  () => (bus as any).publish('gd.test.alpha', { bad: 1n }),
  TypeError,
);

const limited = createEventBus<TestEvents>({ maxListenersPerEvent: 1 });
limited.subscribe('gd.test.alpha', async () => {});
assert.throws(
  () => limited.subscribe('gd.test.alpha', async () => {}),
  RangeError,
);
limited.clear('gd.test.alpha');
assert.equal(limited.listenerCount('gd.test.alpha'), 0);

if (false) {
  // @ts-expect-error event payload type must be enforced by the catalog
  void bus.publish('gd.test.alpha', { value: 'wrong' });
  // @ts-expect-error non-gd event names are not part of the typed catalog
  void bus.publish('test.alpha', { value: 1 });
}

const openCatalogBus = createEventBus();
const openReport = await openCatalogBus.publish('gd.test.open', { ok: true });
assert.equal(openReport.event.name, 'gd.test.open');

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-central-event-bus-runtime/1',
  deterministicOrder: true,
  onceSemantics: true,
  handlerFailureIsolation: true,
  mutationSafeDispatch: true,
  jsonBoundaryValidation: true,
  openCatalogSupport: true,
}, null, 2));
