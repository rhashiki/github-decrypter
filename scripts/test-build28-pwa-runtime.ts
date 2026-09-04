import assert from 'node:assert/strict';
import {
  registerStudioPwa,
  STUDIO_PWA_SCOPE,
  STUDIO_PWA_SERVICE_WORKER,
} from '../apps/studio/src/pwa.js';

assert.equal(STUDIO_PWA_SERVICE_WORKER, './service-worker.js');
assert.equal(STUDIO_PWA_SCOPE, './');

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

try {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {},
  });
  assert.deepEqual(await registerStudioPwa(), { supported: false, registered: false });

  const calls: Array<{ script: string; options: RegistrationOptions }> = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        register: async (script: string, options: RegistrationOptions) => {
          calls.push({ script, options });
          return {} as ServiceWorkerRegistration;
        },
      },
    },
  });
  assert.deepEqual(await registerStudioPwa(), { supported: true, registered: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.script, './service-worker.js');
  assert.equal(calls[0]?.options.scope, './');
  assert.equal(calls[0]?.options.updateViaCache, 'none');

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        register: async () => { throw new Error('registration failed'); },
      },
    },
  });
  assert.deepEqual(await registerStudioPwa(), { supported: true, registered: false });
} finally {
  if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
  else Reflect.deleteProperty(globalThis, 'navigator');
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build28-pwa-runtime/1',
  unsupportedBrowserFailsClosed: true,
  registrationScope: STUDIO_PWA_SCOPE,
  serviceWorker: STUDIO_PWA_SERVICE_WORKER,
  updateViaCache: 'none',
  registrationFailureContained: true,
}, null, 2));
