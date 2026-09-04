import { createEventBus, type EventBus } from '@github-decrypter/shared';
import type { AddressInfo } from 'node:net';
import { createApprovalTransactions, type ApprovalTransactions } from './approval-transactions.js';
import { createAuditLedger, type AuditLedger } from './audit-ledger.js';
import { createCapabilitySecurityAuthority, type CapabilitySecurityAuthority } from './capability-security.js';
import { assertLoopbackHost, localRuntimeConfigFromEnv, type LocalRuntimeConfig } from './config.js';
import { createLocalDatabase, type LocalDatabase } from './database.js';
import { createGitRuntime, type GitRuntime } from './git-runtime.js';
import { acquireLocalRuntimeInstanceLock, type LocalRuntimeInstanceLock } from './instance-lock.js';
import { createDurableJobEngine, type DurableJobEngine } from './job-engine.js';
import { createLocalRuntimePeer } from './identity.js';
import type { LocalRuntimeEventCatalog, LocalRuntimeState } from './lifecycle.js';
import { createOfflineExecutionCoordinator, type OfflineExecutionCoordinator } from './offline-execution.js';
import { createProjectDetector, type ProjectDetector } from './project-detector.js';
import { createCrashPowerRecovery, type CrashPowerRecovery } from './recovery-engine.js';
import { createSecretsVault, type SecretsVault } from './secrets-vault.js';
import { createLocalRuntimeHttpServer } from './server.js';
import { createWorkspaceManager, type WorkspaceManager } from './workspace-manager.js';

export interface LocalRuntimeDaemonOptions {
  readonly config?: LocalRuntimeConfig;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly database?: LocalDatabase;
  readonly jobs?: DurableJobEngine;
  readonly recovery?: CrashPowerRecovery;
  readonly offline?: OfflineExecutionCoordinator;
  readonly capabilities?: CapabilitySecurityAuthority;
  readonly vault?: SecretsVault;
  readonly approvals?: ApprovalTransactions;
  readonly audit?: AuditLedger;
  readonly workspaces?: WorkspaceManager;
  readonly projectDetection?: ProjectDetector;
  readonly git?: GitRuntime;
  readonly now?: () => string;
}

export interface LocalRuntimeBoundAddress { readonly host: string; readonly port: number; readonly origin: string; }

export class LocalRuntimeDaemon {
  readonly #config: LocalRuntimeConfig;
  readonly #eventBus: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  readonly #peer = createLocalRuntimePeer();
  readonly #database: LocalDatabase;
  readonly #jobs: DurableJobEngine;
  readonly #recovery: CrashPowerRecovery;
  readonly #offline: OfflineExecutionCoordinator;
  readonly #capabilities: CapabilitySecurityAuthority;
  readonly #vault: SecretsVault;
  readonly #approvals: ApprovalTransactions;
  readonly #audit: AuditLedger;
  readonly #workspaces: WorkspaceManager;
  readonly #projectDetection: ProjectDetector;
  readonly #git: GitRuntime;
  #state: LocalRuntimeState = 'idle';
  #startedAt: string | null = null;
  #server: ReturnType<typeof createLocalRuntimeHttpServer> | null = null;
  #instanceLock: LocalRuntimeInstanceLock | null = null;

  constructor(options: LocalRuntimeDaemonOptions = {}) {
    this.#config = options.config ?? localRuntimeConfigFromEnv();
    assertLoopbackHost(this.#config.host);
    this.#eventBus = options.eventBus ?? createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'local-runtime' });
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#database = options.database ?? createLocalDatabase({ path: this.#config.databasePath, now: this.#now });
    this.#jobs = options.jobs ?? createDurableJobEngine({ database: this.#database, eventBus: this.#eventBus, now: this.#now });
    this.#recovery = options.recovery ?? createCrashPowerRecovery({ database: this.#database, eventBus: this.#eventBus, now: this.#now });
    this.#offline = options.offline ?? createOfflineExecutionCoordinator({ database: this.#database, jobs: this.#jobs, eventBus: this.#eventBus, now: this.#now });
    this.#capabilities = options.capabilities ?? createCapabilitySecurityAuthority({ database: this.#database, eventBus: this.#eventBus, now: this.#now });
    this.#vault = options.vault ?? createSecretsVault({ database: this.#database, capabilities: this.#capabilities, eventBus: this.#eventBus, keyPath: this.#config.vaultKeyPath, now: this.#now });
    this.#approvals = options.approvals ?? createApprovalTransactions({ database: this.#database, eventBus: this.#eventBus, now: this.#now });
    this.#audit = options.audit ?? createAuditLedger({ database: this.#database, eventBus: this.#eventBus, now: this.#now });
    this.#workspaces = options.workspaces ?? createWorkspaceManager({ database: this.#database, eventBus: this.#eventBus, now: this.#now });
    this.#projectDetection = options.projectDetection ?? createProjectDetector({ workspaces: this.#workspaces, eventBus: this.#eventBus, now: this.#now });
    this.#git = options.git ?? createGitRuntime({
      workspaces: this.#workspaces,
      capabilities: this.#capabilities,
      offline: this.#offline,
      eventBus: this.#eventBus,
      now: this.#now,
    });
  }

  get state(): LocalRuntimeState { return this.#state; }
  get startedAt(): string | null { return this.#startedAt; }
  get events(): EventBus<LocalRuntimeEventCatalog> { return this.#eventBus; }
  get database(): LocalDatabase { return this.#database; }
  get jobs(): DurableJobEngine { return this.#jobs; }
  get recovery(): CrashPowerRecovery { return this.#recovery; }
  get offline(): OfflineExecutionCoordinator { return this.#offline; }
  get capabilities(): CapabilitySecurityAuthority { return this.#capabilities; }
  get vault(): SecretsVault { return this.#vault; }
  get approvals(): ApprovalTransactions { return this.#approvals; }
  get audit(): AuditLedger { return this.#audit; }
  get workspaces(): WorkspaceManager { return this.#workspaces; }
  get projectDetection(): ProjectDetector { return this.#projectDetection; }
  get git(): GitRuntime { return this.#git; }

  get address(): LocalRuntimeBoundAddress | null {
    const address = this.#addressInfo();
    if (!address) return null;
    const hostForUrl = address.family === 'IPv6' ? `[${address.address}]` : address.address;
    return { host: address.address, port: address.port, origin: `http://${hostForUrl}:${address.port}` };
  }

  async start(): Promise<LocalRuntimeBoundAddress> {
    if (this.#state === 'running') {
      const address = this.address;
      if (!address) throw new Error('Local Runtime is running without a bound address.');
      return address;
    }
    if (this.#state === 'starting' || this.#state === 'stopping') throw new Error(`Cannot start Local Runtime while state is ${this.#state}.`);
    await this.#transition('starting', 'start requested');

    try {
      this.#instanceLock = acquireLocalRuntimeInstanceLock(this.#config.lockPath, this.#now);
      const databaseStatus = this.#database.open();
      await this.#eventBus.publish('gd.local.database.opened', { schemaVersion: databaseStatus.schemaVersion, journalMode: databaseStatus.journalMode, foreignKeys: databaseStatus.foreignKeys, integrity: databaseStatus.integrity });

      const auditStatus = await this.#audit.initialize();
      if (!auditStatus.ready || auditStatus.integrity !== 'ok') throw new Error('Audit Ledger is not ready after database startup.');
      const workspaceStatus = await this.#workspaces.initialize();
      if (!workspaceStatus.ready) throw new Error('Workspace Manager is not ready after database startup.');
      const projectDetectionStatus = await this.#projectDetection.initialize();
      if (!projectDetectionStatus.ready) throw new Error('Project Detection is not ready after Workspace Manager startup.');
      if (!this.#jobs.status().ready) throw new Error('Durable Job Engine is not ready after database startup.');
      const recoveryStatus = await this.#recovery.startSession();
      if (!recoveryStatus.ready) throw new Error('Crash & Power Recovery is not ready after database startup.');
      this.#recovery.startLeaseSweep();
      const offlineStatus = await this.#offline.initialize();
      if (!offlineStatus.ready) throw new Error('Offline Execution is not ready after recovery startup.');
      const capabilityStatus = await this.#capabilities.initialize();
      if (!capabilityStatus.ready) throw new Error('Capability Security is not ready after offline execution startup.');
      const gitStatus = await this.#git.initialize();
      if (!gitStatus.ready || !gitStatus.available) throw new Error('Git Runtime requires an available Git executable.');
      const vaultStatus = await this.#vault.initialize();
      if (!vaultStatus.ready) throw new Error('Secrets Vault is not ready after capability security startup.');
      const approvalStatus = await this.#approvals.initialize();
      if (!approvalStatus.ready) throw new Error('Approval Transactions are not ready after Secrets Vault startup.');

      const jobStatus = this.#jobs.status();
      await this.#eventBus.publish('gd.local.jobs.ready', { schemaVersion: jobStatus.schemaVersion, total: jobStatus.summary.total, nonTerminal: jobStatus.summary.nonTerminal, expiredLeases: jobStatus.summary.expiredLeases });

      const server = createLocalRuntimeHttpServer({
        peer: this.#peer,
        getState: () => this.#state,
        getStartedAt: () => this.#startedAt,
        getAddress: () => this.#addressInfo(),
        getDatabaseStatus: () => this.#database.status,
        getJobEngineStatus: () => this.#jobs.status(),
        getRecoveryStatus: () => this.#recovery.status,
        getOfflineExecutionStatus: () => this.#offline.status(),
        getCapabilitySecurityStatus: () => this.#capabilities.status(),
        getSecretsVaultStatus: () => this.#vault.status(),
        getAuditLedgerStatus: () => this.#audit.status(),
        getWorkspaceManagerStatus: () => this.#workspaces.status(),
        getProjectDetectionStatus: () => this.#projectDetection.status(),
        getGitRuntimeStatus: () => this.#git.status(),
        now: this.#now,
      });
      this.#server = server;
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => { server.off('listening', onListening); reject(error); };
        const onListening = () => { server.off('error', onError); resolve(); };
        server.once('error', onError); server.once('listening', onListening);
        server.listen({ host: this.#config.host, port: this.#config.port, exclusive: true });
      });
      this.#startedAt = this.#now();
      await this.#transition('running', 'loopback server listening with Git Runtime, Project Detection, Workspace Manager, Audit Ledger, recovery, offline execution, capability security, Secrets Vault and Approval Transactions ready');
      const address = this.address;
      if (!address) throw new Error('Local Runtime failed to resolve its bound address.');
      return address;
    } catch (error) {
      await this.#closeServerBestEffort();
      this.#closeApprovalsBestEffort();
      this.#closeVaultBestEffort();
      this.#closeGitBestEffort();
      await this.#closeCapabilitiesBestEffort('startup failed');
      await this.#closeRecoveryBestEffort('startup failed');
      this.#closeProjectDetectionBestEffort();
      this.#closeWorkspacesBestEffort();
      this.#closeAuditBestEffort();
      await this.#closeDatabaseBestEffort('startup failed');
      this.#instanceLock?.release(); this.#instanceLock = null; this.#startedAt = null;
      await this.#transition('failed', error instanceof Error ? error.message : 'start failed');
      throw error;
    }
  }

  async stop(reason = 'stop requested'): Promise<void> {
    if (this.#state === 'idle' || this.#state === 'stopped' || this.#state === 'stopping') return;
    await this.#transition('stopping', reason);
    await this.#closeServerBestEffort();
    this.#approvals.shutdown();
    let vaultError: unknown = null;
    try { this.#vault.shutdown(); } catch (error) { vaultError = error; }
    this.#git.shutdown();
    let capabilityError: unknown = null;
    try { await this.#capabilities.shutdown(`runtime stopped: ${reason}`); } catch (error) { capabilityError = error; }
    let recoveryError: unknown = null;
    try { await this.#recovery.stopSession(reason); } catch (error) { recoveryError = error; }
    this.#projectDetection.shutdown();
    this.#workspaces.shutdown();
    this.#audit.shutdown();
    await this.#closeDatabaseBestEffort(reason);
    this.#instanceLock?.release(); this.#instanceLock = null; this.#startedAt = null;
    const shutdownError = vaultError ?? capabilityError ?? recoveryError;
    if (shutdownError) {
      const message = shutdownError instanceof Error ? shutdownError.message : 'runtime shutdown failed';
      await this.#transition('failed', message); throw shutdownError;
    }
    await this.#transition('stopped', reason);
  }

  #addressInfo(): AddressInfo | null {
    const address = this.#server?.address();
    return address && typeof address !== 'string' ? address : null;
  }
  async #closeServerBestEffort(): Promise<void> {
    const server = this.#server; this.#server = null;
    if (!server?.listening) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  #closeApprovalsBestEffort(): void { try { this.#approvals.shutdown(); } catch {} }
  #closeVaultBestEffort(): void { try { this.#vault.shutdown(); } catch {} }
  #closeGitBestEffort(): void { try { this.#git.shutdown(); } catch {} }
  #closeProjectDetectionBestEffort(): void { try { this.#projectDetection.shutdown(); } catch {} }
  #closeWorkspacesBestEffort(): void { try { this.#workspaces.shutdown(); } catch {} }
  #closeAuditBestEffort(): void { try { this.#audit.shutdown(); } catch {} }
  async #closeCapabilitiesBestEffort(reason: string): Promise<void> {
    if (!this.#database.isOpen || !this.#capabilities.status().ready) return;
    try { await this.#capabilities.shutdown(`runtime stopped: ${reason}`); } catch {}
  }
  async #closeRecoveryBestEffort(reason: string): Promise<void> {
    if (!this.#recovery.sessionId || !this.#database.isOpen) return;
    try { await this.#recovery.stopSession(reason); } catch { this.#recovery.stopLeaseSweep(); }
  }
  async #closeDatabaseBestEffort(reason: string): Promise<void> {
    const status = this.#database.status;
    if (!status) return;
    try { this.#database.close(); } finally {
      await this.#eventBus.publish('gd.local.database.closed', { schemaVersion: status.schemaVersion, reason: reason || null });
    }
  }
  async #transition(current: LocalRuntimeState, reason: string): Promise<void> {
    const previous = this.#state; this.#state = current;
    await this.#eventBus.publish('gd.local.lifecycle', { previous, current, reason: reason || null });
  }
}

export function createLocalRuntimeDaemon(options?: LocalRuntimeDaemonOptions): LocalRuntimeDaemon { return new LocalRuntimeDaemon(options); }
