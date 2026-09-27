import {
  DEVELOPER_CONSOLE_BUILD,
  DEVELOPER_CONSOLE_RESULT_SCHEMA,
  DEVELOPER_CONSOLE_SCHEMA,
  DEVELOPER_CONSOLE_TOOL_IDS,
  normalizeDeveloperConsoleQuery,
  type DeveloperConsoleEntry,
  type DeveloperConsoleQuery,
  type DeveloperConsoleResult,
  type DeveloperConsoleSummary,
  type PreviewBridgeAdapterSnapshot,
  type PreviewBridgeProvenance,
} from '@github-decrypter/preview';
import type { ScopeLockRecord } from '@github-decrypter/scope/lock';
import {
  TOOL_RUNTIME_SCHEMA,
  type ToolDescriptor,
  type ToolExecutionContext,
  type ToolRegistration,
  type ToolValue,
} from '@github-decrypter/tools';
import type { BrowserAdapterSession } from './preview-browser-adapter.js';

export const DEVELOPER_CONSOLE_RUNTIME_SCHEMA = 'gd-developer-console-runtime/1' as const;

export interface DeveloperConsoleHost {
  getBrowserSession(sessionId: string): BrowserAdapterSession;
}

export interface DeveloperConsoleRuntimeOptions {
  readonly host: DeveloperConsoleHost;
}

export interface DeveloperConsoleRuntimeStatus {
  readonly schema: typeof DEVELOPER_CONSOLE_RUNTIME_SCHEMA;
  readonly build: typeof DEVELOPER_CONSOLE_BUILD;
  readonly ready: true;
  readonly readOnly: true;
  readonly bounded: true;
  readonly streamingByCursor: true;
  readonly telemetryOwner: 'preview-bridge';
  readonly secondCollector: false;
  readonly hostExecutionSeparated: true;
  readonly persistentStorage: false;
  readonly mutationAuthority: false;
  readonly browserAuthority: false;
  readonly diagnosticsAuthority: false;
  readonly validationAuthority: false;
  readonly releaseAuthority: false;
}

export interface DeveloperConsoleRuntime {
  readonly build: typeof DEVELOPER_CONSOLE_BUILD;
  status(): DeveloperConsoleRuntimeStatus;
  createToolRegistrations(scopeLock: ScopeLockRecord): readonly ToolRegistration[];
}

interface InputRow { readonly [key: string]: ToolValue }

function row(value: ToolValue, label: string): InputRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(label + ' input must be an object.');
  }
  return value as InputRow;
}

function exactKeys(value: InputRow, required: readonly string[], optional: readonly string[], label: string): void {
  const keys = Object.keys(value);
  for (const key of required) if (!keys.includes(key)) throw new TypeError(label + ' requires ' + key + '.');
  const allowed = new Set([...required, ...optional]);
  if (keys.some((key) => !allowed.has(key))) throw new TypeError(label + ' input fields are invalid.');
}

function requiredString(value: ToolValue | undefined, label: string, max = 256): string {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a string.');
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new TypeError(label + ' is invalid.');
  }
  return normalized;
}

function descriptor(id: string, label: string): ToolDescriptor {
  return Object.freeze({
    id,
    label,
    requiredCapabilities: Object.freeze(['READ'] as const),
    mutating: false,
  });
}

function ensureContext(context: ToolExecutionContext, tool: ToolDescriptor): void {
  if (context.schema !== TOOL_RUNTIME_SCHEMA || context.tool.id !== tool.id) {
    throw new Error('Developer Console requires a Tool Runtime execution context.');
  }
  if (!context.verifiedCapabilities.includes('READ')) {
    throw new Error('Developer Console requires verified READ capability.');
  }
  if (context.mutationAuthorized) {
    throw new Error('Developer Console must not receive mutation authority.');
  }
}

function provenance(context: ToolExecutionContext): PreviewBridgeProvenance {
  return Object.freeze({
    workspaceId: context.workspaceId,
    orchestrationId: context.sourceOrchestrationId,
    orchestrationDigest: context.sourceOrchestrationDigest,
    buildStepId: context.step.id,
    taskId: context.step.sourceTaskId,
    requirementId: context.step.requirementId,
    runId: context.invocationId,
    scopeLockId: context.sourceScopeLockId,
    scopeLockDigest: context.sourceScopeLockDigest,
  });
}

function asToolValue(value: unknown): ToolValue {
  return JSON.parse(JSON.stringify(value)) as ToolValue;
}

function networkLevel(status: number | null, failed: string | null): string {
  if (failed) return 'error';
  if (status !== null && status >= 400) return 'error';
  if (status !== null && status >= 300) return 'warn';
  return 'info';
}

function entrySearchText(entry: DeveloperConsoleEntry): string {
  return [
    entry.source,
    entry.level,
    entry.message,
    entry.requestId,
    entry.method,
    entry.url,
    entry.resourceType,
    entry.status === null ? null : String(entry.status),
    entry.mimeType,
    entry.failed,
  ].filter((value): value is string => typeof value === 'string').join(' ').toLowerCase();
}

function normalizeEntries(snapshot: PreviewBridgeAdapterSnapshot): readonly DeveloperConsoleEntry[] {
  const entries: DeveloperConsoleEntry[] = [];

  for (const item of snapshot.console) {
    entries.push(Object.freeze({
      sequence: item.sequence,
      source: 'console',
      level: item.level.trim().toLowerCase() || 'log',
      message: item.text,
      timestamp: item.timestamp,
      requestId: null,
      method: null,
      url: null,
      resourceType: null,
      status: null,
      mimeType: null,
      finished: null,
      failed: null,
      redirect: null,
      truncated: item.truncated,
      metadataOnly: false,
      queryValuesRedacted: false,
    }));
  }

  for (const item of snapshot.errors) {
    entries.push(Object.freeze({
      sequence: item.sequence,
      source: 'runtime-error',
      level: 'error',
      message: item.message,
      timestamp: item.timestamp,
      requestId: null,
      method: null,
      url: null,
      resourceType: null,
      status: null,
      mimeType: null,
      finished: null,
      failed: item.message,
      redirect: null,
      truncated: item.truncated,
      metadataOnly: false,
      queryValuesRedacted: false,
    }));
  }

  for (const item of snapshot.network) {
    const statusText = item.status === null ? '' : ' ' + item.status;
    const failureText = item.failed ? ' ' + item.failed : '';
    entries.push(Object.freeze({
      sequence: item.sequence,
      source: 'network',
      level: networkLevel(item.status, item.failed),
      message: (item.method + ' ' + item.url + statusText + failureText).trim(),
      timestamp: item.startedAtMonotonic,
      requestId: item.requestId,
      method: item.method,
      url: item.url,
      resourceType: item.resourceType,
      status: item.status,
      mimeType: item.mimeType,
      finished: item.finished,
      failed: item.failed,
      redirect: item.redirect,
      truncated: false,
      metadataOnly: item.metadataOnly,
      queryValuesRedacted: item.queryValuesRedacted,
    }));
  }

  return Object.freeze(entries.sort((left, right) => left.sequence - right.sequence));
}

function matches(entry: DeveloperConsoleEntry, query: DeveloperConsoleQuery): boolean {
  if (!query.sources.includes(entry.source)) return false;
  if (entry.sequence <= query.afterSequence) return false;
  if (query.levels.length > 0 && (!entry.level || !query.levels.includes(entry.level.toLowerCase()))) return false;

  if (query.methods.length > 0) {
    if (entry.source !== 'network' || !entry.method || !query.methods.includes(entry.method.toLowerCase())) return false;
  }

  if (query.minStatus !== null || query.maxStatus !== null) {
    if (entry.source !== 'network' || entry.status === null) return false;
    if (query.minStatus !== null && entry.status < query.minStatus) return false;
    if (query.maxStatus !== null && entry.status > query.maxStatus) return false;
  }

  if (query.text && !entrySearchText(entry).includes(query.text)) return false;
  return true;
}

function buildResult(
  sessionId: string,
  tabId: string,
  snapshot: PreviewBridgeAdapterSnapshot,
  query: DeveloperConsoleQuery,
  sourceProvenance: PreviewBridgeProvenance,
): DeveloperConsoleResult {
  const all = normalizeEntries(snapshot);
  const matched = all.filter((entry) => matches(entry, query));
  const ordered = query.order === 'asc' ? matched : [...matched].reverse();
  const selected = Object.freeze(ordered.slice(0, query.limit));
  const latestSequence = all.reduce((latest, entry) => Math.max(latest, entry.sequence), 0);
  const nextAfterSequence = selected.reduce(
    (latest, entry) => Math.max(latest, entry.sequence),
    query.afterSequence,
  );

  return Object.freeze({
    schema: DEVELOPER_CONSOLE_RESULT_SCHEMA,
    build: DEVELOPER_CONSOLE_BUILD,
    sessionId,
    tabId,
    query,
    entries: selected,
    totals: Object.freeze({
      network: snapshot.network.length,
      console: snapshot.console.length,
      errors: snapshot.errors.length,
      available: all.length,
      matched: matched.length,
      returned: selected.length,
    }),
    dropped: Object.freeze({
      network: snapshot.networkDropped,
      console: snapshot.consoleDropped,
      errors: snapshot.errorsDropped,
    }),
    latestSequence,
    nextAfterSequence,
    truncated: matched.length > selected.length,
    page: snapshot.page,
    capturedAt: snapshot.capturedAt,
    provenance: sourceProvenance,
    readOnly: true,
    bounded: true,
    streamingByCursor: true,
    hostExecutionSeparated: true,
    credentialsIncluded: false,
    requestHeadersIncluded: false,
    responseHeadersIncluded: false,
    bodiesIncluded: false,
    validationAuthority: false,
    releaseAuthority: false,
  });
}

export function createDeveloperConsoleRuntime(options: DeveloperConsoleRuntimeOptions): DeveloperConsoleRuntime {
  if (!options?.host) throw new TypeError('Developer Console requires a host.');

  function status(): DeveloperConsoleRuntimeStatus {
    return Object.freeze({
      schema: DEVELOPER_CONSOLE_RUNTIME_SCHEMA,
      build: DEVELOPER_CONSOLE_BUILD,
      ready: true,
      readOnly: true,
      bounded: true,
      streamingByCursor: true,
      telemetryOwner: 'preview-bridge',
      secondCollector: false,
      hostExecutionSeparated: true,
      persistentStorage: false,
      mutationAuthority: false,
      browserAuthority: false,
      diagnosticsAuthority: false,
      validationAuthority: false,
      releaseAuthority: false,
    });
  }

  async function snapshot(sessionId: string, tabId: string): Promise<PreviewBridgeAdapterSnapshot> {
    const session = options.host.getBrowserSession(sessionId);
    if (!session.telemetrySnapshot) {
      throw new Error('Developer Console requires Build 70 structured telemetry support.');
    }
    return session.telemetrySnapshot(tabId);
  }

  function createToolRegistrations(scopeLock: ScopeLockRecord): readonly ToolRegistration[] {
    if (!scopeLock || scopeLock.schema !== 'gd-scope-lock/1' || scopeLock.status !== 'locked') {
      throw new TypeError('Developer Console requires the active locked Scope Lock record as provenance context.');
    }

    const queryDescriptor = descriptor(DEVELOPER_CONSOLE_TOOL_IDS.query, 'Query bounded Developer Console telemetry');
    const summaryDescriptor = descriptor(DEVELOPER_CONSOLE_TOOL_IDS.summary, 'Read Developer Console telemetry summary');

    return Object.freeze([
      Object.freeze({
        descriptor: queryDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureContext(context, queryDescriptor);
          const value = row(input, 'Developer Console query');
          exactKeys(value, ['sessionId','tabId'], ['query'], 'Developer Console query');
          const sessionId = requiredString(value.sessionId, 'Developer Console session id');
          const tabId = requiredString(value.tabId, 'Developer Console tab id');
          const query = normalizeDeveloperConsoleQuery(value.query);
          const current = await snapshot(sessionId, tabId);
          return asToolValue(buildResult(sessionId, tabId, current, query, provenance(context)));
        },
      }),
      Object.freeze({
        descriptor: summaryDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureContext(context, summaryDescriptor);
          const value = row(input, 'Developer Console summary');
          exactKeys(value, ['sessionId','tabId'], [], 'Developer Console summary');
          const sessionId = requiredString(value.sessionId, 'Developer Console session id');
          const tabId = requiredString(value.tabId, 'Developer Console tab id');
          const current = await snapshot(sessionId, tabId);
          const all = normalizeEntries(current);
          const result: DeveloperConsoleSummary = Object.freeze({
            schema: DEVELOPER_CONSOLE_SCHEMA,
            build: DEVELOPER_CONSOLE_BUILD,
            sessionId,
            tabId,
            page: current.page,
            totals: Object.freeze({
              network: current.network.length,
              console: current.console.length,
              errors: current.errors.length,
            }),
            dropped: Object.freeze({
              network: current.networkDropped,
              console: current.consoleDropped,
              errors: current.errorsDropped,
            }),
            latestSequence: all.reduce((latest, entry) => Math.max(latest, entry.sequence), 0),
            capturedAt: current.capturedAt,
            provenance: provenance(context),
            readOnly: true,
            bounded: true,
            hostExecutionSeparated: true,
            mutationAuthority: false,
            browserAuthority: false,
            diagnosticsAuthority: false,
            validationAuthority: false,
            releaseAuthority: false,
          });
          return asToolValue(result);
        },
      }),
    ]);
  }

  return Object.freeze({
    build: DEVELOPER_CONSOLE_BUILD,
    status,
    createToolRegistrations,
  });
}
