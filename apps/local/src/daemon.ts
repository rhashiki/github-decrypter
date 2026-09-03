import { createEventBus, type EventBus } from '@github-decrypter/shared';
import type { AddressInfo } from 'node:net';
import { assertLoopbackHost, localRuntimeConfigFromEnv, type LocalRuntimeConfig } from './config.js';
import { acquireLocalRuntimeInstanceLock, type LocalRuntimeInstanceLock } from './instance-lock.js';
import { createLocalRuntimePeer } from './identity.js';
import type { LocalRuntimeEventCatalog, LocalRuntimeState } from './lifecycle.js';
import { createLocalRuntimeHttpServer } from './server.js';

export interface LocalRuntimeDaemonOptions {
  readonly config?: LocalRuntimeConfig;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
}

export interface LocalRuntimeBoundAddress {
  readonly host: string;
  readonly port: number;
  readonly origin: string;
}

export class LocalRuntimeDaemon {
  readonly #config: LocalRuntimeConfig;
  readonly #eventBus: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  readonly #peer = createLocalRuntimePeer();
  #state: LocalRuntimeState = 'idle';
  #startedAt: string | null = null;
  #server: ReturnType<typeof createLocalRuntimeHttpServer> | null = null;
  #instanceLock: LocalRuntimeInstanceLock | null = null;

  constructor(options: LocalRuntimeDaemonOptions = {}) {
    this.#config = options.config ?? localRuntimeConfigFromEnv();
    assertLoopbackHost(this.#config.host);
    this.#eventBus = options.eventBus ?? createEventBus<LocalRuntimeEventCatalog>({
      defaultSource: 'local-runtime',
    });
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  get state(): LocalRuntimeState {
    return this.#state;
  }

  get startedAt(): string | null {
    return this.#startedAt;
  }

  get events(): EventBus<LocalRuntimeEventCatalog> {
    return this.#eventBus;
  }

  get address(): LocalRuntimeBoundAddress | null {
    const address = this.#addressInfo();
    if (!address) return null;
    const hostForUrl = address.family === 'IPv6' ? `[${address.address}]` : address.address;
    return {
      host: address.address,
      port: address.port,
      origin: `http://${hostForUrl}:${address.port}`,
    };
  }

  async start(): Promise<LocalRuntimeBoundAddress> {
    if (this.#state === 'running') {
      const address = this.address;
      if (!address) throw new Error('Local Runtime is running without a bound address.');
      return address;
    }
    if (this.#state === 'starting' || this.#state === 'stopping') {
      throw new Error(`Cannot start Local Runtime while state is ${this.#state}.`);
    }

    await this.#transition('starting', 'start requested');

    try {
      this.#instanceLock = acquireLocalRuntimeInstanceLock(this.#config.lockPath, this.#now);
      const server = createLocalRuntimeHttpServer({
        peer: this.#peer,
        getState: () => this.#state,
        getStartedAt: () => this.#startedAt,
        getAddress: () => this.#addressInfo(),
        now: this.#now,
      });
      this.#server = server;

      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen({
          host: this.#config.host,
          port: this.#config.port,
          exclusive: true,
        });
      });

      this.#startedAt = this.#now();
      await this.#transition('running', 'loopback server listening');
      const address = this.address;
      if (!address) throw new Error('Local Runtime failed to resolve its bound address.');
      return address;
    } catch (error) {
      await this.#closeServerBestEffort();
      this.#instanceLock?.release();
      this.#instanceLock = null;
      this.#startedAt = null;
      await this.#transition('failed', error instanceof Error ? error.message : 'start failed');
      throw error;
    }
  }

  async stop(reason = 'stop requested'): Promise<void> {
    if (this.#state === 'idle' || this.#state === 'stopped') return;
    if (this.#state === 'stopping') return;

    await this.#transition('stopping', reason);
    await this.#closeServerBestEffort();
    this.#instanceLock?.release();
    this.#instanceLock = null;
    this.#startedAt = null;
    await this.#transition('stopped', reason);
  }

  #addressInfo(): AddressInfo | null {
    const address = this.#server?.address();
    return address && typeof address !== 'string' ? address : null;
  }

  async #closeServerBestEffort(): Promise<void> {
    const server = this.#server;
    this.#server = null;
    if (!server?.listening) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  async #transition(current: LocalRuntimeState, reason: string): Promise<void> {
    const previous = this.#state;
    this.#state = current;
    await this.#eventBus.publish('gd.local.lifecycle', {
      previous,
      current,
      reason: reason || null,
    });
  }
}

export function createLocalRuntimeDaemon(options?: LocalRuntimeDaemonOptions): LocalRuntimeDaemon {
  return new LocalRuntimeDaemon(options);
}
