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
import { MAX_REQUEST_BODY_BYTES } from './config.js';
import { LOCAL_RUNTIME_BUILD, LOCAL_RUNTIME_FEATURES, LOCAL_RUNTIME_VERSION } from './identity.js';
import type { LocalRuntimeState } from './lifecycle.js';

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
}

export interface LocalRuntimeServerContext {
  readonly peer: ProtocolPeer;
  getState(): LocalRuntimeState;
  getStartedAt(): string | null;
  getAddress(): AddressInfo | null;
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
  };
}

async function handleHandshake(
  request: IncomingMessage,
  response: ServerResponse,
  context: LocalRuntimeServerContext,
): Promise<void> {
  let raw: unknown;
  try {
    raw = await readJsonBody(request);
    assertProtocolEnvelope(raw);
  } catch (error) {
    const tooLarge = (error as NodeJS.ErrnoException).code === 'ERR_BODY_TOO_LARGE';
    writeJson(response, tooLarge ? 413 : 400, {
      schema: 'gd-local-http-error/1',
      error: {
        code: tooLarge ? 'BODY_TOO_LARGE' : 'MALFORMED_MESSAGE',
        message: error instanceof Error ? error.message : 'Invalid request body.',
      },
    });
    return;
  }

  if (raw.kind !== 'handshake.hello' || !isHandshakeHelloPayload(raw.payload)) {
    writeJson(response, 400, {
      schema: 'gd-local-http-error/1',
      error: { code: 'INVALID_REQUEST', message: 'Expected a handshake.hello envelope.' },
    });
    return;
  }

  if (
    raw.payload.peer.id !== raw.meta.source.id
    || raw.payload.peer.role !== raw.meta.source.role
    || raw.payload.peer.product !== raw.meta.source.product
  ) {
    writeJson(response, 400, {
      schema: 'gd-local-http-error/1',
      error: { code: 'PEER_MISMATCH', message: 'Handshake peer must match envelope source identity.' },
    });
    return;
  }

  const selectedVersion = selectProtocolVersion(
    SUPPORTED_PROTOCOL_VERSIONS,
    raw.payload.supportedVersions,
  );

  const meta = {
    messageId: asMessageId(`gd_msg_${randomUUID()}`),
    timestamp: context.now(),
    source: context.peer,
    destination: {
      role: raw.meta.source.role,
      peerId: raw.meta.source.id,
    },
  } as const;

  if (selectedVersion === null) {
    const reject = envelope({
      kind: 'handshake.reject',
      meta,
      payload: {
        error: protocolError(
          'UNSUPPORTED_PROTOCOL',
          'No mutually supported GitHub Decrypter protocol version.',
          { retryable: false, details: { supportedVersions: [...SUPPORTED_PROTOCOL_VERSIONS] } },
        ),
      },
    });
    writeJson(response, 426, reject);
    return;
  }

  const accept = envelope({
    kind: 'handshake.accept',
    meta,
    payload: {
      peer: context.peer,
      selectedVersion,
      features: [...LOCAL_RUNTIME_FEATURES],
    },
  });
  writeJson(response, 200, accept);
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
      writeJson(response, health.state === 'running' ? 200 : 503, {
        schema: 'gd-local-readiness/1',
        ready: health.state === 'running',
        state: health.state,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/v1/handshake') {
      await handleHandshake(request, response, context);
      return;
    }

    writeJson(response, 404, {
      schema: 'gd-local-http-error/1',
      error: {
        code: 'NOT_FOUND',
        message: 'This Build exposes only health, readiness and protocol handshake endpoints.',
      },
    });
  });
}
