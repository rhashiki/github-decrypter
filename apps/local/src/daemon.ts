import { createEventBus, type EventBus } from '@github-decrypter/shared';
import type { AddressInfo } from 'node:net';
import { assertLoopbackHost, localRuntimeConfigFromEnv, type LocalRuntimeConfig } from './config.js';
import { createLocalDatabase, type LocalDatabase } from './database.js';
import { acquireLocalRuntimeInstanceLock, type LocalRuntimeInstanceLock } from './instance-lock.js';
import { createDurableJobEngine, type DurableJobEngine } from './job-engine.js';
import { createLocalRuntimePeer } from './identity.js';
import type { LocalRuntimeEventCatalog, LocalRuntimeState } from './lifecycle.js';
import { createCrashPowerRecovery, type CrashPowerRecovery } from './recovery-engine.js';
import { createLocalRuntimeHttpServer } from './server.js';

export interface LocalRuntimeDaemonOptions {
  readonly config?: LocalRuntimeConfig;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly database?: LocalDatabase;
  readonly jobs?: DurableJobEngine;
  readonly recovery?: CrashPowerRecovery;
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
  readonly #database: LocalDatabase;
  readonly #jobs: DurableJobEngine;
  readonly #recovery: CrashPowerRecovery;
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
    this.#database = options.database ?? createLocalDatabase({
      path: this.#config.databasePath,
      now: this.#now,
    });
    this.#jobs = options.jobs ?? createDurableJobEngine({
      database: this.#database,
      eventBus: this.#eventBus,
      now: this.#now,
    });
    this.#recovery = options.recovery ?? createCrashPowerRecovery({
      database: this.#database,
      eventBus: this.#eventBus,
      now: this.#now,
    });
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

  get database(): LocalDatabase {
    return this.#database;
  }

  get jobs(): DurableJobEngine {
    return this.#jobs;
  }

  get recovery(): CrashPowerRecovery {
    return this.#recovery;
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

      const databaseStatus = this.#database.open();
      await this.#eventBus.publish('gd.local.database.opened', {
        schemaVersion: databaseStatus.schemaVersion,
        journalMode: databaseStatus.journalMode,
        foreignKeys: databaseStatus.foreignKeys,
        integrity: databaseStatus.integrity,
      });

      const preRecoveryJobStatus = this.#jobs.status();
      if (!preRecoveryJobStatus.ready) throw new Error('Durable Job Engine is not ready after database startup.');

      const recoveryStatus = await this.#recovery.startSession();
      if (!recoveryStatus.ready) throw new Error('Crash & Power Recovery is not ready after database startup.');
      this.#recovery.startLeaseSweep();

      const jobStatus = this.#jobs.status();
      await this.#eventBus.publish('gd.local.jobs.ready', {
        schemaVersion: jobStatus.schemaVersion,
        total: jobStatus.summary.total,
        nonTerminal: jobStatus.summary.nonTerminal,
        expiredLeases: jobStatus.summary.expiredLeases,
      });

      const server = createLocalRuntimeHttpServer({
        peer: this.#peer,
        getState: () => this.#state,
        getStartedAt: () => this.#startedAt,
        getAddress: () => this.#addressInfo(),
        getDatabaseStatus: () => this.#database.status,
        getJobEngineStatus: () => this.#jobs.status(),
        getRecoveryStatus: () => this.#recovery.status,
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
      await this.#transition('running', 'loopback server listening with durable crash recovery ready');
      const address = this.address;
      if (!address) throw new Error('Local Runtime failed to resolve its bound address.');
      return address;
    } catch (error) {
      await this.#closeServerBestEffort();
      await this.#closeRecoveryBestEffort('startup failed');
      await this.#closeDatabaseBestEffort('startup failed');
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

    let recoveryError: unknown = null;
    try {
      await this.#recovery.stopSession(reason);
    } catch (error) {
      recoveryError = error;
    }

    await this.#closeDatabaseBestEffort(reason);
    this.#instanceLock?.release();
    this.#instanceLock = null;
    this.#startedAt = null;

    if (recoveryError) {
      const message = recoveryError instanceof Error ? recoveryError.message : 'recovery shutdown failed';
      await this.#transition('failed', message);
      throw recoveryError;
    }
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

  async #closeRecoveryBestEffort(reason: string): Promise<void> {
    if (!this.#recovery.sessionId || !this.#database.isOpen) return;
    try {
      await this.#recovery.stopSession(reason);
    } catch {
      this.#recovery.stopLeaseSweep();
    }
  }

  async #closeDatabaseBestEffort(reason: string): Promise<void> {
    const status = this.#database.status;
    if (!status) return;
    try {
      this.#database.close();
    } finally {
      await this.#eventBus.publish('gd.local.database.closed', {
        schemaVersion: status.schemaVersion,
        reason: reason || null,
      });
    }
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
