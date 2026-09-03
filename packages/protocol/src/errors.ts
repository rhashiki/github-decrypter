import type { JsonValue } from './json.js';

export const PROTOCOL_ERROR_CODES = [
  'MALFORMED_MESSAGE',
  'UNSUPPORTED_PROTOCOL',
  'UNKNOWN_COMMAND',
  'INVALID_REQUEST',
  'TIMEOUT',
  'UNAVAILABLE',
  'CONFLICT',
  'INTERNAL_ERROR',
] as const;

export type ProtocolErrorCode = (typeof PROTOCOL_ERROR_CODES)[number];

export interface ProtocolError {
  readonly code: ProtocolErrorCode | (string & {});
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: JsonValue;
}

export function protocolError(
  code: ProtocolError['code'],
  message: string,
  options: { retryable?: boolean; details?: JsonValue } = {},
): ProtocolError {
  return {
    code,
    message,
    retryable: options.retryable ?? false,
    ...(options.details === undefined ? {} : { details: options.details }),
  };
}
