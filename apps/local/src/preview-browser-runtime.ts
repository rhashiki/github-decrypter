import {
  PREVIEW_MAX_SESSIONS,
  decodePreviewInlineData,
  normalizePreviewSelector,
  normalizePreviewTimeout,
  normalizePreviewUrl,
  normalizePreviewViewport,
  normalizeVisualEvidenceRequest,
  previewBrowserScopeResource,
  previewDownloadScopeResource,
  previewTabScopeResource,
  previewUploadScopeResource,
  previewUrlScopeResource,
  type PreviewViewport,
} from '@github-decrypter/preview';
import type { ScopeLockRecord } from '@github-decrypter/scope/lock';
import {
  TOOL_RUNTIME_SCHEMA,
  type ToolDescriptor,
  type ToolExecutionContext,
  type ToolRegistration,
  type ToolValue,
} from '@github-decrypter/tools';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createChromiumCdpAdapter,
  detectLocalChromiumExecutable,
  type BrowserAdapterSession,
  type PreviewBrowserAdapter,
} from './preview-browser-adapter.js';

export const PREVIEW_BROWSER_RUNTIME_BUILD = 68 as const;
export const PREVIEW_BROWSER_RUNTIME_SCHEMA = 'gd-preview-browser-runtime/1' as const;

export const PREVIEW_TOOL_IDS = Object.freeze({
  startSession: 'tool:preview.session.start',
  stopSession: 'tool:preview.session.stop',
  openTab: 'tool:preview.tab.open',
  closeTab: 'tool:preview.tab.close',
  navigate: 'tool:preview.navigate',
  pageState: 'tool:preview.page-state',
  capture: 'tool:preview.capture',
  upload: 'tool:preview.upload',
  download: 'tool:preview.download',
} as const);

export interface PreviewBrowserRuntimeStatus {
  readonly schema: typeof PREVIEW_BROWSER_RUNTIME_SCHEMA;
  readonly build: typeof PREVIEW_BROWSER_RUNTIME_BUILD;
  readonly ready: true;
  readonly browserDetected: boolean;
  readonly activeSessionCount: number;
  readonly activeSessionIds: readonly string[];
  readonly maxSessions: typeof PREVIEW_MAX_SESSIONS;
  readonly isolatedProfiles: true;
  readonly deterministicCleanup: true;
  readonly toolRuntimeRequired: true;
  readonly scopeLockRequiredForMutation: true;
  readonly directBrowserAuthorityExposed: false;
  readonly visualEvidenceReadOnly: true;
  readonly persistentFileWrites: false;
}

export interface PreviewBrowserRuntimeOptions {
  readonly adapter?: PreviewBrowserAdapter;
  readonly now?: () => string;
  readonly executablePath?: string;
}

export interface PreviewBrowserRuntime {
  readonly build: typeof PREVIEW_BROWSER_RUNTIME_BUILD;
  status(): PreviewBrowserRuntimeStatus;
  createToolRegistrations(scopeLock: ScopeLockRecord): readonly ToolRegistration[];
  shutdown(): Promise<void>;
}

interface InputRow { readonly [key: string]: ToolValue }

function row(value: ToolValue, label: string): InputRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(label + ' input must be an object.');
  return value as InputRow;
}

function exactKeys(value: InputRow, keys: readonly string[], label: string): void {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    throw new TypeError(label + ' input fields are invalid.');
  }
}

function requiredString(value: ToolValue | undefined, label: string, max = 4096): string {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a string.');
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) throw new TypeError(label + ' is invalid.');
  return normalized;
}

function optionalInteger(value: ToolValue | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value)) throw new TypeError(label + ' must be an integer.');
  return Number(value);
}

function ensureToolContext(context: ToolExecutionContext, descriptor: ToolDescriptor): void {
  if (context.schema !== TOOL_RUNTIME_SCHEMA || context.tool.id !== descriptor.id) {
    throw new Error('Preview Browser Runtime requires a Tool Runtime execution context.');
  }
  for (const capability of descriptor.requiredCapabilities) {
    if (!context.verifiedCapabilities.includes(capability)) {
      throw new Error('Preview Browser Runtime received an unverified capability context.');
    }
  }
  if (descriptor.mutating && context.mutationAuthorized !== true) {
    throw new Error('Preview Browser Runtime mutation was not authorized by Tool Runtime.');
  }
}

function assertScopedResource(context: ToolExecutionContext, lock: ScopeLockRecord, expectedResource: string): void {
  if (!context.sourceScopeLockId || context.sourceScopeLockId !== lock.id
      || context.sourceScopeLockDigest !== lock.lockDigest.hex
      || !context.scopeCandidateId) {
    throw new Error('Preview Browser Runtime requires the active Scope Lock for mutations.');
  }
  const candidate = lock.sourceScope.candidates.find((item) => item.id === context.scopeCandidateId);
  if (!candidate || !lock.lockedCandidateIds.includes(candidate.id)) throw new Error('Preview Browser Runtime scope candidate is not locked.');
  if (candidate.resource !== expectedResource) {
    throw new Error('Preview Browser Runtime scope resource does not match the requested browser operation.');
  }
}

function descriptor(
  id: string,
  label: string,
  requiredCapabilities: ToolDescriptor['requiredCapabilities'],
  mutating: boolean,
): ToolDescriptor {
  return Object.freeze({ id, label, requiredCapabilities: Object.freeze([...requiredCapabilities]), mutating });
}

function asToolValue(value: unknown): ToolValue {
  return JSON.parse(JSON.stringify(value)) as ToolValue;
}

export function createPreviewBrowserRuntime(options: PreviewBrowserRuntimeOptions = {}): PreviewBrowserRuntime {
  const adapter = options.adapter ?? createChromiumCdpAdapter();
  const now = options.now ?? (() => new Date().toISOString());
  const sessions = new Map<string, BrowserAdapterSession>();
  let shuttingDown = false;

  function requireSession(sessionId: string): BrowserAdapterSession {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Unknown Preview browser session.');
    return session;
  }

  async function stopSession(sessionId: string): Promise<void> {
    const session = requireSession(sessionId);
    sessions.delete(sessionId);
    await session.close();
  }

  function status(): PreviewBrowserRuntimeStatus {
    let browserDetected = false;
    try {
      detectLocalChromiumExecutable(options.executablePath);
      browserDetected = true;
    } catch {}
    return Object.freeze({
      schema: PREVIEW_BROWSER_RUNTIME_SCHEMA,
      build: PREVIEW_BROWSER_RUNTIME_BUILD,
      ready: true,
      browserDetected,
      activeSessionCount: sessions.size,
      activeSessionIds: Object.freeze([...sessions.keys()].sort()),
      maxSessions: PREVIEW_MAX_SESSIONS,
      isolatedProfiles: true,
      deterministicCleanup: true,
      toolRuntimeRequired: true,
      scopeLockRequiredForMutation: true,
      directBrowserAuthorityExposed: false,
      visualEvidenceReadOnly: true,
      persistentFileWrites: false,
    });
  }

  function createToolRegistrations(scopeLock: ScopeLockRecord): readonly ToolRegistration[] {
    if (!scopeLock || scopeLock.schema !== 'gd-scope-lock/1' || scopeLock.status !== 'locked') {
      throw new TypeError('Preview Browser Runtime requires a locked Scope Lock record.');
    }

    const startDescriptor = descriptor(PREVIEW_TOOL_IDS.startSession, 'Start isolated Preview browser session', ['EXECUTE'], true);
    const stopDescriptor = descriptor(PREVIEW_TOOL_IDS.stopSession, 'Stop Preview browser session', ['EXECUTE'], true);
    const openDescriptor = descriptor(PREVIEW_TOOL_IDS.openTab, 'Open Preview browser tab', ['EXECUTE','NETWORK'], true);
    const closeDescriptor = descriptor(PREVIEW_TOOL_IDS.closeTab, 'Close Preview browser tab', ['EXECUTE'], true);
    const navigateDescriptor = descriptor(PREVIEW_TOOL_IDS.navigate, 'Navigate Preview browser tab', ['EXECUTE','NETWORK'], true);
    const stateDescriptor = descriptor(PREVIEW_TOOL_IDS.pageState, 'Read structured Preview page state', ['READ'], false);
    const captureDescriptor = descriptor(PREVIEW_TOOL_IDS.capture, 'Capture read-only Preview visual evidence', ['READ'], false);
    const uploadDescriptor = descriptor(PREVIEW_TOOL_IDS.upload, 'Upload ephemeral inline data into Preview', ['READ','EXECUTE'], true);
    const downloadDescriptor = descriptor(PREVIEW_TOOL_IDS.download, 'Download ephemeral Preview data inline', ['READ','EXECUTE','NETWORK'], true);

    return Object.freeze([
      Object.freeze({
        descriptor: startDescriptor,
        handler: async (context, input) => {
          ensureToolContext(context, startDescriptor);
          assertScopedResource(context, scopeLock, previewBrowserScopeResource());
          if (shuttingDown) throw new Error('Preview Browser Runtime is shutting down.');
          if (sessions.size >= PREVIEW_MAX_SESSIONS) throw new RangeError('Preview Browser Runtime session limit reached.');
          const value = row(input, 'Preview session start');
          const keys = Object.keys(value);
          if (keys.length > 1 || (keys.length === 1 && keys[0] !== 'viewport')) throw new TypeError('Preview session start accepts only optional viewport.');
          const viewport = normalizePreviewViewport(value.viewport ?? 'desktop');
          const profileDir = mkdtempSync(join(tmpdir(), 'vortex-preview-'));
          const session = await adapter.launch({ profileDir, viewport, executablePath: options.executablePath, now });
          if (sessions.has(session.descriptor.id)) {
            await session.close();
            throw new Error('Preview Browser Runtime adapter returned a duplicate session id.');
          }
          sessions.set(session.descriptor.id, session);
          return asToolValue(session.descriptor);
        },
      }),
      Object.freeze({
        descriptor: stopDescriptor,
        handler: async (context, input) => {
          ensureToolContext(context, stopDescriptor);
          assertScopedResource(context, scopeLock, previewBrowserScopeResource());
          const value = row(input, 'Preview session stop');
          exactKeys(value, ['sessionId'], 'Preview session stop');
          const sessionId = requiredString(value.sessionId, 'Preview session id', 256);
          await stopSession(sessionId);
          return { stopped: true, sessionId };
        },
      }),
      Object.freeze({
        descriptor: openDescriptor,
        handler: async (context, input) => {
          ensureToolContext(context, openDescriptor);
          const value = row(input, 'Preview tab open');
          exactKeys(value, ['sessionId','url'], 'Preview tab open');
          const sessionId = requiredString(value.sessionId, 'Preview session id', 256);
          const url = normalizePreviewUrl(value.url);
          assertScopedResource(context, scopeLock, previewUrlScopeResource(url));
          return asToolValue(await requireSession(sessionId).openTab(url));
        },
      }),
      Object.freeze({
        descriptor: closeDescriptor,
        handler: async (context, input) => {
          ensureToolContext(context, closeDescriptor);
          assertScopedResource(context, scopeLock, previewTabScopeResource());
          const value = row(input, 'Preview tab close');
          exactKeys(value, ['sessionId','tabId'], 'Preview tab close');
          const sessionId = requiredString(value.sessionId, 'Preview session id', 256);
          const tabId = requiredString(value.tabId, 'Preview tab id', 256);
          await requireSession(sessionId).closeTab(tabId);
          return { closed: true, sessionId, tabId };
        },
      }),
      Object.freeze({
        descriptor: navigateDescriptor,
        handler: async (context, input) => {
          ensureToolContext(context, navigateDescriptor);
          const value = row(input, 'Preview navigation');
          const keys = Object.keys(value).sort();
          if (JSON.stringify(keys) !== JSON.stringify(['sessionId','tabId','timeoutMs','url'])
              && JSON.stringify(keys) !== JSON.stringify(['sessionId','tabId','url'])) {
            throw new TypeError('Preview navigation input fields are invalid.');
          }
          const sessionId = requiredString(value.sessionId, 'Preview session id', 256);
          const tabId = requiredString(value.tabId, 'Preview tab id', 256);
          const url = normalizePreviewUrl(value.url);
          const timeoutMs = optionalInteger(value.timeoutMs, 'Preview navigation timeout');
          assertScopedResource(context, scopeLock, previewUrlScopeResource(url));
          return asToolValue(await requireSession(sessionId).navigate(tabId, url, timeoutMs));
        },
      }),
      Object.freeze({
        descriptor: stateDescriptor,
        handler: async (context, input) => {
          ensureToolContext(context, stateDescriptor);
          const value = row(input, 'Preview page state');
          exactKeys(value, ['sessionId','tabId'], 'Preview page state');
          return asToolValue(await requireSession(
            requiredString(value.sessionId, 'Preview session id', 256),
          ).pageState(requiredString(value.tabId, 'Preview tab id', 256)));
        },
      }),
      Object.freeze({
        descriptor: captureDescriptor,
        handler: async (context, input) => {
          ensureToolContext(context, captureDescriptor);
          const value = row(input, 'Preview capture');
          exactKeys(value, ['request','sessionId','tabId'], 'Preview capture');
          const request = normalizeVisualEvidenceRequest(value.request);
          return asToolValue(await requireSession(
            requiredString(value.sessionId, 'Preview session id', 256),
          ).capture(requiredString(value.tabId, 'Preview tab id', 256), request));
        },
      }),
      Object.freeze({
        descriptor: uploadDescriptor,
        handler: async (context, input) => {
          ensureToolContext(context, uploadDescriptor);
          const value = row(input, 'Preview upload');
          exactKeys(value, ['dataBase64','fileName','mediaType','selector','sessionId','tabId'], 'Preview upload');
          const selector = normalizePreviewSelector(value.selector);
          assertScopedResource(context, scopeLock, previewUploadScopeResource(selector));
          const mediaType = requiredString(value.mediaType, 'Preview upload media type', 128);
          if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(mediaType)) throw new TypeError('Preview upload media type is invalid.');
          const bytes = decodePreviewInlineData(value.dataBase64);
          return asToolValue(await requireSession(
            requiredString(value.sessionId, 'Preview session id', 256),
          ).upload(
            requiredString(value.tabId, 'Preview tab id', 256),
            selector,
            requiredString(value.fileName, 'Preview upload file name', 180),
            bytes,
          ));
        },
      }),
      Object.freeze({
        descriptor: downloadDescriptor,
        handler: async (context, input) => {
          ensureToolContext(context, downloadDescriptor);
          const value = row(input, 'Preview download');
          const keys = Object.keys(value).sort();
          if (JSON.stringify(keys) !== JSON.stringify(['selector','sessionId','tabId','timeoutMs'])
              && JSON.stringify(keys) !== JSON.stringify(['selector','sessionId','tabId'])) {
            throw new TypeError('Preview download input fields are invalid.');
          }
          const selector = normalizePreviewSelector(value.selector);
          assertScopedResource(context, scopeLock, previewDownloadScopeResource(selector));
          return asToolValue(await requireSession(
            requiredString(value.sessionId, 'Preview session id', 256),
          ).download(
            requiredString(value.tabId, 'Preview tab id', 256),
            selector,
            optionalInteger(value.timeoutMs, 'Preview download timeout'),
          ));
        },
      }),
    ]);
  }

  return Object.freeze({
    build: PREVIEW_BROWSER_RUNTIME_BUILD,
    status,
    createToolRegistrations,
    async shutdown() {
      if (shuttingDown) return;
      shuttingDown = true;
      const active = [...sessions.entries()];
      sessions.clear();
      await Promise.allSettled(active.map(([, session]) => session.close()));
      shuttingDown = false;
    },
  });
}
