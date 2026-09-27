import {
  PREVIEW_BRIDGE_MAX_CONSOLE_ENTRIES,
  PREVIEW_BRIDGE_MAX_ERROR_ENTRIES,
  PREVIEW_BRIDGE_MAX_NETWORK_ENTRIES,
  PREVIEW_BRIDGE_MAX_TEXT_CHARACTERS,
  type PreviewBridgeConsoleEntry,
  type PreviewBridgeNetworkEntry,
  type PreviewBridgeRuntimeError,
} from '@github-decrypter/preview';

export class BoundedTelemetryRing<T> {
  readonly #capacity: number;
  #items: T[] = [];
  #head = 0;
  #dropped = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4096) {
      throw new RangeError('Telemetry ring capacity is invalid.');
    }
    this.#capacity = capacity;
  }

  push(value: T): T | undefined {
    let evicted: T | undefined;
    if (this.size >= this.#capacity) {
      evicted = this.#items[this.#head];
      this.#head += 1;
      this.#dropped += 1;
    }
    this.#items.push(value);
    if (this.#head > 64 && this.#head * 2 > this.#items.length) {
      this.#items = this.#items.slice(this.#head);
      this.#head = 0;
    }
    return evicted;
  }

  get size(): number {
    return this.#items.length - this.#head;
  }

  get dropped(): number {
    return this.#dropped;
  }

  values(): readonly T[] {
    return Object.freeze(this.#items.slice(this.#head));
  }

  replace(predicate: (value: T) => boolean, replacement: T): boolean {
    for (let index = this.#items.length - 1; index >= this.#head; index -= 1) {
      if (predicate(this.#items[index]!)) {
        this.#items[index] = replacement;
        return true;
      }
    }
    return false;
  }

  clear(): void {
    this.#items = [];
    this.#head = 0;
    this.#dropped = 0;
  }
}

function safeText(value: unknown): { text: string; truncated: boolean } {
  const raw = typeof value === 'string' ? value : value === undefined ? '' : String(value);
  const normalized = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '�');
  if (normalized.length <= PREVIEW_BRIDGE_MAX_TEXT_CHARACTERS) return { text: normalized, truncated: false };
  return { text: normalized.slice(0, PREVIEW_BRIDGE_MAX_TEXT_CHARACTERS), truncated: true };
}

export function sanitizeTelemetryUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const parsed = new URL(value);
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    const keys = [...new Set([...parsed.searchParams.keys()])];
    parsed.search = '';
    for (const key of keys.sort()) parsed.searchParams.append(key, '[redacted]');
    return parsed.toString();
  } catch {
    return safeText(value).text;
  }
}

export interface PreviewTelemetryCollector {
  readonly network: BoundedTelemetryRing<PreviewBridgeNetworkEntry>;
  readonly console: BoundedTelemetryRing<PreviewBridgeConsoleEntry>;
  readonly errors: BoundedTelemetryRing<PreviewBridgeRuntimeError>;
  requestStarted(input: {
    requestId: string;
    method?: string;
    url?: string;
    resourceType?: string;
    timestamp?: number;
    redirect?: boolean;
  }): void;
  responseReceived(input: {
    requestId: string;
    status?: number;
    mimeType?: string;
  }): void;
  requestFinished(requestId: string): void;
  requestFailed(requestId: string, message?: string): void;
  consoleEntry(input: { level?: string; text?: unknown; timestamp?: number }): void;
  runtimeError(input: { message?: unknown; timestamp?: number }): void;
}

export function createPreviewTelemetryCollector(): PreviewTelemetryCollector {
  const network = new BoundedTelemetryRing<PreviewBridgeNetworkEntry>(PREVIEW_BRIDGE_MAX_NETWORK_ENTRIES);
  const console = new BoundedTelemetryRing<PreviewBridgeConsoleEntry>(PREVIEW_BRIDGE_MAX_CONSOLE_ENTRIES);
  const errors = new BoundedTelemetryRing<PreviewBridgeRuntimeError>(PREVIEW_BRIDGE_MAX_ERROR_ENTRIES);
  const latestByRequest = new Map<string, PreviewBridgeNetworkEntry>();
  let sequence = 0;

  function requestStarted(input: {
    requestId: string;
    method?: string;
    url?: string;
    resourceType?: string;
    timestamp?: number;
    redirect?: boolean;
  }): void {
    const requestId = safeText(input.requestId).text || 'unknown';
    const entry: PreviewBridgeNetworkEntry = Object.freeze({
      sequence: ++sequence,
      requestId,
      method: safeText(input.method ?? 'GET').text || 'GET',
      url: sanitizeTelemetryUrl(input.url ?? ''),
      resourceType: input.resourceType ? safeText(input.resourceType).text : null,
      status: null,
      mimeType: null,
      startedAtMonotonic: Number.isFinite(input.timestamp) ? Number(input.timestamp) : null,
      finished: false,
      failed: null,
      redirect: input.redirect === true,
      metadataOnly: true,
      queryValuesRedacted: true,
    });
    const evicted = network.push(entry);
    if (evicted && latestByRequest.get(evicted.requestId) === evicted) {
      latestByRequest.delete(evicted.requestId);
    }
    latestByRequest.set(requestId, entry);
  }

  function replaceRequest(requestId: string, patch: Partial<PreviewBridgeNetworkEntry>): void {
    const previous = latestByRequest.get(requestId);
    if (!previous) return;
    const next = Object.freeze({ ...previous, ...patch });
    latestByRequest.set(requestId, next);
    network.replace(
      (item) => item.requestId === requestId && item.sequence === previous.sequence,
      next,
    );
  }

  return Object.freeze({
    network,
    console,
    errors,
    requestStarted,
    responseReceived(input: { requestId: string; status?: number; mimeType?: string }) {
      replaceRequest(input.requestId, {
        status: Number.isFinite(input.status) ? Number(input.status) : null,
        mimeType: input.mimeType ? safeText(input.mimeType).text : null,
      });
    },
    requestFinished(requestId: string) {
      replaceRequest(requestId, { finished: true });
    },
    requestFailed(requestId: string, message?: string) {
      replaceRequest(requestId, { finished: true, failed: safeText(message ?? 'request failed').text });
    },
    consoleEntry(input: { level?: string; text?: unknown; timestamp?: number }) {
      const value = safeText(input.text);
      console.push(Object.freeze({
        sequence: ++sequence,
        level: safeText(input.level ?? 'log').text || 'log',
        text: value.text,
        timestamp: Number.isFinite(input.timestamp) ? Number(input.timestamp) : null,
        truncated: value.truncated,
      }));
    },
    runtimeError(input: { message?: unknown; timestamp?: number }) {
      const value = safeText(input.message ?? 'Runtime error');
      errors.push(Object.freeze({
        sequence: ++sequence,
        message: value.text,
        timestamp: Number.isFinite(input.timestamp) ? Number(input.timestamp) : null,
        truncated: value.truncated,
      }));
    },
  });
}
