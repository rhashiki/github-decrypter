import { createLocalRuntimeDaemon } from './daemon.js';
import { localRuntimeConfigFromEnv } from './config.js';
import { localRuntimeIdentity } from './identity.js';

const daemon = createLocalRuntimeDaemon({
  config: localRuntimeConfigFromEnv(),
});

let shutdownPromise: Promise<void> | null = null;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = daemon.stop(`received ${signal}`);
  await shutdownPromise;
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal).catch((error) => {
      console.error('[github-decrypter-local] graceful shutdown failed', error);
      process.exitCode = 1;
    });
  });
}

try {
  const address = await daemon.start();
  console.log(JSON.stringify({
    schema: 'gd-local-runtime-started/1',
    product: localRuntimeIdentity.product,
    build: localRuntimeIdentity.build,
    version: localRuntimeIdentity.version,
    pid: process.pid,
    origin: address.origin,
  }));
} catch (error) {
  console.error('[github-decrypter-local] failed to start', error);
  process.exitCode = 1;
}
