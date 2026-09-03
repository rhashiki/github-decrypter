import {
  SUPPORTED_PROTOCOL_VERSIONS,
  asMessageId,
  assertProtocolEnvelope,
  envelope,
  isPeerRole,
  protocolError,
  selectProtocolVersion,
  type ProtocolHandshakeHelloPayload,
  type ProtocolPeer,
} from '@github-decrypter/protocol';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { CapabilitySecurityStatus } from './capability-security.js';
import { MAX_REQUEST_BODY_BYTES } from './config.js';
import type { LocalDatabaseStatus } from './database.js';
import { LOCAL_RUNTIME_BUILD, LOCAL_RUNTIME_FEATURES, LOCAL_RUNTIME_VERSION } from './identity.js';
import type { DurableJobEngineStatus } from './job-types.js';
import type { LocalRuntimeState } from './lifecycle.js';
import type { OfflineExecutionStatus } from './offline-execution.js';
import type { CrashRecoveryStatus } from './recovery-engine.js';
import type { SecretsVaultStatus } from './secrets-vault.js';

export interface LocalRuntimeHealth {
  readonly schema: 'gd-local-health/1';
  readonly product: 'github-decrypter';
  readonly build: typeof LOCAL_RUNTIME_BUILD;
  readonly version: typeof LOCAL_RUNTIME_VERSION;
  readonly state: LocalRuntimeState;
  readonly pid: number;
  readonly host: string;
  readonly port: number | null;
  readonly startedAt: string | null;
  readonly uptimeMs: number;
  readonly protocol: 'gd-protocol/1';
  readonly database: null | {
    readonly open: boolean;
    readonly schemaVersion: number;
    readonly journalMode: string;
    readonly foreignKeys: boolean;
    readonly integrity: 'ok';
  };
  readonly jobs: {
    readonly ready: boolean;
    readonly total: number;
    readonly nonTerminal: number;
    readonly expiredLeases: number;
  };
  readonly recovery: {
    readonly ready: boolean;
    readonly sessionActive: boolean;
    readonly healthy: boolean;
    readonly priorUncleanSessions: number;
    readonly startupRecovered: number;
    readonly lastSweepRecovered: number;
    readonly lastSweepAt: string | null;
  };
  readonly offline: {
    readonly ready: boolean;
    readonly connectivity: OfflineExecutionStatus['connectivity'];
    readonly waitingForNetwork: number;
    readonly localQueued: number;
    readonly localExecutionAvailable: true;
    readonly automaticNetworkProbe: false;
  };
  readonly capabilities: {
    readonly ready: boolean;
    readonly activeGrants: number;
    readonly revokedGrants: number;
    readonly expiredGrants: number;
    readonly denyByDefault: true;
    readonly plaintextTokenPersistence: false;
    readonly secretsVaultReady: boolean;
    readonly approvalTransactionsReady: false;
    readonly externalGrantTransport: false;
  };
  readonly vault: {
    readonly ready: boolean;
    readonly secretCount: number;
    readonly cipher: 'AES-256-GCM';
    readonly kdf: 'HKDF-SHA256';
    readonly keyBackend: 'local-key-file-v1';
    readonly plaintextPersistence: false;
    readonly plaintextResourcePersistence: false;
    readonly externalTransport: false;
  };
}

export interface LocalRuntimeServerContext {
  readonly peer: ProtocolPeer;
  getState(): LocalRuntimeState;
  getStartedAt(): string | null;
  getAddress(): AddressInfo | null;
  getDatabaseStatus(): LocalDatabaseStatus | null;
  getJobEngineStatus(): DurableJobEngineStatus;
  getRecoveryStatus(): CrashRecoveryStatus;
  getOfflineExecutionStatus(): OfflineExecutionStatus;
  getCapabilitySecurityStatus(): CapabilitySecurityStatus;
  getSecretsVaultStatus(): SecretsVaultStatus;
  now(): string;
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  response.end(`${JSON.stringify(body)}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHandshakeHelloPayload(value: unknown): value is ProtocolHandshakeHelloPayload {
  if (!isRecord(value) || !isRecord(value.peer)) return false;
  const peer = value.peer;
  if (typeof peer.id !== 'string' || peer.id.length === 0) return false;
  if (!isPeerRole(peer.role)) return false;
  if (peer.product !== 'github-decrypter') return false;
  if (typeof peer.productVersion !== 'string' || peer.productVersion.length === 0) return false;
  if (!Array.isArray(value.supportedVersions) || !value.supportedVersions.every(Number.isSafeInteger)) return false;
  if (!Array.isArray(value.features) || !value.features.every((item) => typeof item === 'string')) return false;
  return true;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_REQUEST_BODY_BYTES) {
      const error = new Error(`Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes.`);
      (error as NodeJS.ErrnoException).code = 'ERR_BODY_TOO_LARGE';
      throw error;
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function buildHealth(context: LocalRuntimeServerContext): LocalRuntimeHealth {
  const startedAt = context.getStartedAt();
  const address = context.getAddress();
  const startedMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  const nowMs = Date.parse(context.now());
  const database = context.getDatabaseStatus();
  const jobs = context.getJobEngineStatus();
  const recovery = context.getRecoveryStatus();
  const offline = context.getOfflineExecutionStatus();
  const capabilities = context.getCapabilitySecurityStatus();
  const vault = context.getSecretsVaultStatus();
  return {
    schema: 'gd-local-health/1',
    product: 'github-decrypter',
    build: LOCAL_RUNTIME_BUILD,
    version: LOCAL_RUNTIME_VERSION,
    state: context.getState(),
    pid: process.pid,
    host: address?.address ?? '127.0.0.1',
    port: address?.port ?? null,
    startedAt,
    uptimeMs: Number.isFinite(startedMs) && Number.isFinite(nowMs) ? Math.max(0, nowMs - startedMs) : 0,
    protocol: 'gd-protocol/1',
    database: database ? {
      open: database.open,
      schemaVersion: database.schemaVersion,
      journalMode: database.journalMode,
      foreignKeys: database.foreignKeys,
      integrity: database.integrity,
    } : null,
    jobs: {
      ready: jobs.ready,
      total: jobs.summary.total,
      nonTerminal: jobs.summary.nonTerminal,
      expiredLeases: jobs.summary.expiredLeases,
    },
    recovery: {
      ready: recovery.ready,
      sessionActive: recovery.sessionActive,
      healthy: recovery.healthy,
      priorUncleanSessions: recovery.priorUncleanSessions,
      startupRecovered: recovery.startupRecovered,
      lastSweepRecovered: recovery.lastSweepRecovered,
      lastSweepAt: recovery.lastSweepAt,
    },
    offline: {
      ready: offline.ready,
      connectivity: offline.connectivity,
      waitingForNetwork: offline.waitingForNetwork,
      localQueued: offline.localQueued,
      localExecutionAvailable: true,
      automaticNetworkProbe: false,
    },
    capabilities: {
      ready: capabilities.ready,
      activeGrants: capabilities.activeGrants,
      revokedGrants: capabilities.revokedGrants,
      expiredGrants: capabilities.expiredGrants,
      denyByDefault: true,
      plaintextTokenPersistence: false,
      secretsVaultReady: vault.ready,
      approvalTransactionsReady: false,
      externalGrantTransport: false,
    },
    vault: {
      ready: vault.ready,
      secretCount: vault.secretCount,
      cipher: vault.cipher,
      kdf: vault.kdf,
      keyBackend: vault.keyBackend,
      plaintextPersistence: false,
      plaintextResourcePersistence: false,
      externalTransport: false,
    },
  };
}

async function handleHandshake(request: IncomingMessage, response: ServerResponse, context: LocalRuntimeServerContext): Promise<void> {
  let raw: unknown;
  try {
    raw = await readJsonBody(request);
    assertProtocolEnvelope(raw);
  } catch (error) {
    const tooLarge = (error as NodeJS.ErrnoException).code === 'ERR_BODY_TOO_LARGE';
    writeJson(response, tooLarge ? 413 : 400, {
      schema: 'gd-local-http-error/1',
      error: { code: tooLarge ? 'BODY_TOO_LARGE' : 'MALFORMED_MESSAGE', message: error instanceof Error ? error.message : 'Invalid request body.' },
    });
    return;
  }

  if (raw.kind !== 'handshake.hello' || !isHandshakeHelloPayload(raw.payload)) {
    writeJson(response, 400, { schema: 'gd-local-http-error/1', error: { code: 'INVALID_REQUEST', message: 'Expected a handshake.hello envelope.' } });
    return;
  }

  if (raw.payload.peer.id !== raw.meta.source.id || raw.payload.peer.role !== raw.meta.source.role || raw.payload.peer.product !== raw.meta.source.product) {
    writeJson(response, 400, { schema: 'gd-local-http-error/1', error: { code: 'PEER_MISMATCH', message: 'Handshake peer must match envelope source identity.' } });
    return;
  }

  const selectedVersion = selectProtocolVersion(SUPPORTED_PROTOCOL_VERSIONS, raw.payload.supportedVersions);
  const meta = {
    messageId: asMessageId(`gd_msg_${randomUUID()}`), timestamp: context.now(), source: context.peer,
    destination: { role: raw.meta.source.role, peerId: raw.meta.source.id },
  } as const;

  if (selectedVersion === null) {
    writeJson(response, 426, envelope({
      kind: 'handshake.reject', meta,
      payload: { error: protocolError('UNSUPPORTED_PROTOCOL', 'No mutually supported GitHub Decrypter protocol version.', { retryable: false, details: { supportedVersions: [...SUPPORTED_PROTOCOL_VERSIONS] } }) },
    }));
    return;
  }

  writeJson(response, 200, envelope({
    kind: 'handshake.accept', meta,
    payload: { peer: context.peer, selectedVersion, features: [...LOCAL_RUNTIME_FEATURES] },
  }));
}

export function createLocalRuntimeHttpServer(context: LocalRuntimeServerContext): Server {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'GET' && url.pathname === '/healthz') {
      writeJson(response, 200, buildHealth(context));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/readyz') {
      const health = buildHealth(context);
      const ready = health.state === 'running'
        && health.database?.open === true
        && health.database.integrity === 'ok'
        && health.jobs.ready
        && health.recovery.ready
        && health.recovery.healthy
        && health.offline.ready
        && health.capabilities.ready
        && health.vault.ready;
      writeJson(response, ready ? 200 : 503, {
        schema: 'gd-local-readiness/1',
        ready,
        state: health.state,
        databaseReady: health.database?.open === true,
        jobsReady: health.jobs.ready,
        recoveryReady: health.recovery.ready,
        offlineExecutionReady: health.offline.ready,
        capabilitySecurityReady: health.capabilities.ready,
        secretsVaultReady: health.vault.ready,
        connectivity: health.offline.connectivity,
        localExecutionAvailable: health.offline.localExecutionAvailable,
        denyByDefault: health.capabilities.denyByDefault,
      });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/v1/handshake') {
      await handleHandshake(request, response, context);
      return;
    }
    writeJson(response, 404, { schema: 'gd-local-http-error/1', error: { code: 'NOT_FOUND', message: 'This Build exposes only health, readiness and protocol handshake endpoints.' } });
  });
}
