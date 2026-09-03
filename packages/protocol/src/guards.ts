import {
  PROTOCOL_MESSAGE_KINDS,
  type ProtocolEnvelope,
  type ProtocolMessageKind,
} from './envelope.js';
import { isPeerRole } from './peer.js';
import {
  PROTOCOL_SCHEMA,
  isSupportedProtocolVersion,
} from './version.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isProtocolMessageKind(value: unknown): value is ProtocolMessageKind {
  return typeof value === 'string' && PROTOCOL_MESSAGE_KINDS.includes(value as ProtocolMessageKind);
}

export function isProtocolEnvelope(value: unknown): value is ProtocolEnvelope {
  if (!isRecord(value)) return false;
  if (value.schema !== PROTOCOL_SCHEMA) return false;
  if (!isSupportedProtocolVersion(value.version)) return false;
  if (!isProtocolMessageKind(value.kind)) return false;
  if (!isRecord(value.meta)) return false;

  const meta = value.meta;
  if (typeof meta.messageId !== 'string' || meta.messageId.length === 0) return false;
  if (typeof meta.timestamp !== 'string' || meta.timestamp.length === 0) return false;
  if (!isRecord(meta.source)) return false;
  if (typeof meta.source.id !== 'string' || meta.source.id.length === 0) return false;
  if (!isPeerRole(meta.source.role)) return false;
  if (meta.source.product !== 'github-decrypter') return false;
  if (typeof meta.source.productVersion !== 'string' || meta.source.productVersion.length === 0) return false;

  if (meta.destination !== undefined) {
    if (!isRecord(meta.destination)) return false;
    const role = meta.destination.role;
    if (role !== 'broadcast' && !isPeerRole(role)) return false;
    if (meta.destination.peerId !== undefined && typeof meta.destination.peerId !== 'string') return false;
  }

  return 'payload' in value;
}

export function assertProtocolEnvelope(value: unknown): asserts value is ProtocolEnvelope {
  if (!isProtocolEnvelope(value)) {
    throw new TypeError('Invalid GitHub Decrypter protocol envelope.');
  }
}
