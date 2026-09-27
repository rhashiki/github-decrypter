import {
  LIVE_PREVIEW_BUILD,
  LIVE_PREVIEW_CAPTURE_SCHEMA,
  LIVE_PREVIEW_MAX_RECOVERY_ATTEMPTS,
  LIVE_PREVIEW_PROBE_SCHEMA,
  LIVE_PREVIEW_SCHEMA,
  LIVE_PREVIEW_SETTLING_SCHEMA,
  LIVE_PREVIEW_TOOL_IDS,
  livePreviewSessionScopeResource,
  livePreviewTargetScopeResource,
  livePreviewViewport,
  normalizeLivePreviewColorScheme,
  normalizeLivePreviewFormFactor,
  normalizeLivePreviewId,
  normalizeLivePreviewSettlingPolicy,
  normalizePreviewUrl,
  normalizeVisualEvidenceRequest,
  type LivePreviewCapture,
  type LivePreviewColorScheme,
  type LivePreviewDescriptor,
  type LivePreviewFormFactor,
  type LivePreviewProbe,
  type LivePreviewSettlingPolicy,
  type LivePreviewSettlingResult,
  type PreviewPageState,
  type PreviewViewport,
  type VisualEvidence,
  type VisualEvidenceRequest,
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

export interface LivePreviewHost {
  createBrowserSession(viewport: PreviewViewport): Promise<BrowserAdapterSession>;
  getBrowserSession(sessionId: string): BrowserAdapterSession;
  closeBrowserSession(sessionId: string): Promise<void>;
}

export interface LivePreviewRuntimeOptions {
  readonly host: LivePreviewHost;
  readonly now?: () => string;
  readonly monotonicNow?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly settlingPolicy?: LivePreviewSettlingPolicy;
}

export interface LivePreviewRuntimeStatus {
  readonly build: typeof LIVE_PREVIEW_BUILD;
  readonly activeCount: number;
  readonly activeIds: readonly string[];
  readonly maxRecoveryAttempts: typeof LIVE_PREVIEW_MAX_RECOVERY_ATTEMPTS;
  readonly nativeHmrPreferred: true;
  readonly hmrOwner: 'target-dev-server';
  readonly boundedVisualSettling: true;
  readonly deterministicFormFactors: true;
  readonly persistentBrowserState: true;
  readonly toolRuntimeRequired: true;
  readonly scopeLockRequiredForMutation: true;
  readonly directBrowserAuthority: false;
}

export interface LivePreviewRuntime {
  readonly build: typeof LIVE_PREVIEW_BUILD;
  status(): LivePreviewRuntimeStatus;
  createToolRegistrations(scopeLock: ScopeLockRecord): readonly ToolRegistration[];
  shutdown(): Promise<void>;
}

interface LivePreviewRecord {
  id: string;
  status: 'ready' | 'degraded' | 'recovering';
  browserSessionId: string;
  tabId: string;
  targetUrl: string;
  formFactor: LivePreviewFormFactor;
  viewport: PreviewViewport;
  colorScheme: LivePreviewColorScheme;
  startedAt: string;
  lastHealthyAt: string | null;
  lastSettledAt: string | null;
  generation: number;
  refreshCount: number;
  recoveryCount: number;
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

function requiredString(value: ToolValue | undefined, label: string, max = 4096): string {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a string.');
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new TypeError(label + ' is invalid.');
  }
  return normalized;
}

function ensureToolContext(context: ToolExecutionContext, descriptor: ToolDescriptor): void {
  if (context.schema !== TOOL_RUNTIME_SCHEMA || context.tool.id !== descriptor.id) {
    throw new Error('Live Preview requires a Tool Runtime execution context.');
  }
  for (const capability of descriptor.requiredCapabilities) {
    if (!context.verifiedCapabilities.includes(capability)) {
      throw new Error('Live Preview received an unverified capability context.');
    }
  }
  if (descriptor.mutating && context.mutationAuthorized !== true) {
    throw new Error('Live Preview mutation was not authorized by Tool Runtime.');
  }
}

function assertScopedResource(context: ToolExecutionContext, lock: ScopeLockRecord, expectedResource: string): void {
  if (!context.sourceScopeLockId || context.sourceScopeLockId !== lock.id
      || context.sourceScopeLockDigest !== lock.lockDigest.hex
      || !context.scopeCandidateId) {
    throw new Error('Live Preview requires the active Scope Lock for mutations.');
  }
  const candidate = lock.sourceScope.candidates.find((item) => item.id === context.scopeCandidateId);
  if (!candidate || !lock.lockedCandidateIds.includes(candidate.id)) {
    throw new Error('Live Preview scope candidate is not locked.');
  }
  if (candidate.resource !== expectedResource) {
    throw new Error('Live Preview scope resource does not match the requested operation.');
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

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1024) || 'Unknown Live Preview failure.';
}

function recordDescriptor(record: LivePreviewRecord): LivePreviewDescriptor {
  return Object.freeze({
    schema: LIVE_PREVIEW_SCHEMA,
    build: LIVE_PREVIEW_BUILD,
    id: record.id,
    status: record.status,
    browserSessionId: record.browserSessionId,
    tabId: record.tabId,
    targetUrl: record.targetUrl,
    formFactor: record.formFactor,
    viewport: record.viewport,
    colorScheme: record.colorScheme,
    startedAt: record.startedAt,
    lastHealthyAt: record.lastHealthyAt,
    lastSettledAt: record.lastSettledAt,
    generation: record.generation,
    refreshCount: record.refreshCount,
    recoveryCount: record.recoveryCount,
    maxRecoveryAttempts: LIVE_PREVIEW_MAX_RECOVERY_ATTEMPTS,
    nativeHmrPreferred: true,
    hmrOwner: 'target-dev-server',
    hostReloadRequiredForSourceChange: false,
    longRunningSession: true,
    toolRuntimeRequired: true,
    scopeLockRequiredForMutation: true,
  });
}

function stateSignature(state: PreviewPageState): string {
  return JSON.stringify([
    state.url,
    state.title,
    state.readyState,
    state.viewport.width,
    state.viewport.height,
    state.viewport.deviceScaleFactor,
    state['document'].width,
    state['document'].height,
    state['document'].scrollX,
    state['document'].scrollY,
    state.accessibilityNodeCount,
  ]);
}

export function createLivePreviewRuntime(options: LivePreviewRuntimeOptions): LivePreviewRuntime {
  if (!options?.host) throw new TypeError('Live Preview requires a browser host.');
  const now = options.now ?? (() => new Date().toISOString());
  const monotonicNow = options.monotonicNow ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const settlingPolicy = normalizeLivePreviewSettlingPolicy(options.settlingPolicy);
  const records = new Map<string, LivePreviewRecord>();
  let shuttingDown = false;

  function requireRecord(idValue: unknown): LivePreviewRecord {
    const id = normalizeLivePreviewId(idValue);
    const record = records.get(id);
    if (!record) throw new Error('Unknown Live Preview session.');
    return record;
  }

  async function settle(record: LivePreviewRecord): Promise<LivePreviewSettlingResult> {
    const started = monotonicNow();
    let samples = 0;
    let stableSamples = 0;
    let previousSignature: string | null = null;
    let lastState: PreviewPageState | null = null;
    let lastFailure: string | null = null;

    while (monotonicNow() - started <= settlingPolicy.maxWaitMs) {
      samples += 1;
      try {
        const session = options.host.getBrowserSession(record.browserSessionId);
        const state = await session.pageState(record.tabId);
        lastState = state;
        lastFailure = null;
        const signature = stateSignature(state);
        if (state.readyState === 'complete') {
          stableSamples = previousSignature === signature ? stableSamples + 1 : 1;
          previousSignature = signature;
          if (stableSamples >= settlingPolicy.requiredStableSamples) {
            const settledAt = now();
            record.lastHealthyAt = settledAt;
            record.lastSettledAt = settledAt;
            record.status = 'ready';
            return Object.freeze({
              schema: LIVE_PREVIEW_SETTLING_SCHEMA,
              build: LIVE_PREVIEW_BUILD,
              settled: true,
              samples,
              stableSamples,
              elapsedMs: Math.max(0, monotonicNow() - started),
              policy: settlingPolicy,
              state,
              failure: null,
              bounded: true,
            });
          }
        } else {
          stableSamples = 0;
          previousSignature = null;
        }
      } catch (error) {
        stableSamples = 0;
        previousSignature = null;
        lastFailure = safeError(error);
      }

      if (monotonicNow() - started >= settlingPolicy.maxWaitMs) break;
      await sleep(settlingPolicy.sampleIntervalMs);
    }

    record.status = 'degraded';
    return Object.freeze({
      schema: LIVE_PREVIEW_SETTLING_SCHEMA,
      build: LIVE_PREVIEW_BUILD,
      settled: false,
      samples,
      stableSamples,
      elapsedMs: Math.max(0, monotonicNow() - started),
      policy: settlingPolicy,
      state: lastState,
      failure: lastFailure ?? 'Live Preview did not reach bounded visual stability.',
      bounded: true,
    });
  }

  async function setSessionColor(record: LivePreviewRecord): Promise<void> {
    const session = options.host.getBrowserSession(record.browserSessionId);
    if (!session.setColorScheme) throw new Error('Preview browser adapter does not support Live Preview color emulation.');
    await session.setColorScheme(record.tabId, record.colorScheme);
  }

  async function startRecord(id: string, targetUrl: string, formFactor: LivePreviewFormFactor, colorScheme: LivePreviewColorScheme): Promise<LivePreviewDescriptor> {
    if (records.has(id)) throw new Error('Live Preview id is already active.');
    const viewport = livePreviewViewport(formFactor);
    const browser = await options.host.createBrowserSession(viewport);
    let tabId: string | null = null;
    try {
      const tab = await browser.openTab(targetUrl);
      tabId = tab.id;
      const record: LivePreviewRecord = {
        id,
        status: 'degraded',
        browserSessionId: browser.descriptor.id,
        tabId,
        targetUrl,
        formFactor,
        viewport,
        colorScheme,
        startedAt: now(),
        lastHealthyAt: null,
        lastSettledAt: null,
        generation: 1,
        refreshCount: 0,
        recoveryCount: 0,
      };
      records.set(id, record);
      await setSessionColor(record);
      await settle(record);
      return recordDescriptor(record);
    } catch (error) {
      records.delete(id);
      try { await options.host.closeBrowserSession(browser.descriptor.id); } catch {}
      throw error;
    }
  }

  async function recover(record: LivePreviewRecord): Promise<LivePreviewDescriptor> {
    if (record.recoveryCount >= LIVE_PREVIEW_MAX_RECOVERY_ATTEMPTS) {
      record.status = 'degraded';
      throw new RangeError('Live Preview recovery attempt limit reached.');
    }

    record.status = 'recovering';
    let nextBrowser: BrowserAdapterSession;
    try {
      nextBrowser = await options.host.createBrowserSession(record.viewport);
    } catch (error) {
      record.status = 'degraded';
      throw error;
    }
    try {
      const nextTab = await nextBrowser.openTab(record.targetUrl);
      const candidate: LivePreviewRecord = {
        ...record,
        status: 'recovering',
        browserSessionId: nextBrowser.descriptor.id,
        tabId: nextTab.id,
        generation: record.generation + 1,
        recoveryCount: record.recoveryCount + 1,
      };
      await setSessionColor(candidate);
      await settle(candidate);
      const previousSessionId = record.browserSessionId;
      Object.assign(record, candidate);
      try { await options.host.closeBrowserSession(previousSessionId); } catch {}
      return recordDescriptor(record);
    } catch (error) {
      try { await options.host.closeBrowserSession(nextBrowser.descriptor.id); } catch {}
      record.status = 'degraded';
      throw error;
    }
  }

  function status(): LivePreviewRuntimeStatus {
    return Object.freeze({
      build: LIVE_PREVIEW_BUILD,
      activeCount: records.size,
      activeIds: Object.freeze([...records.keys()].sort()),
      maxRecoveryAttempts: LIVE_PREVIEW_MAX_RECOVERY_ATTEMPTS,
      nativeHmrPreferred: true,
      hmrOwner: 'target-dev-server',
      boundedVisualSettling: true,
      deterministicFormFactors: true,
      persistentBrowserState: true,
      toolRuntimeRequired: true,
      scopeLockRequiredForMutation: true,
      directBrowserAuthority: false,
    });
  }

  function createToolRegistrations(scopeLock: ScopeLockRecord): readonly ToolRegistration[] {
    if (!scopeLock || scopeLock.schema !== 'gd-scope-lock/1' || scopeLock.status !== 'locked') {
      throw new TypeError('Live Preview requires a locked Scope Lock record.');
    }

    const startDescriptor = descriptor(LIVE_PREVIEW_TOOL_IDS.start, 'Start Live Preview', ['EXECUTE','NETWORK'], true);
    const stopDescriptor = descriptor(LIVE_PREVIEW_TOOL_IDS.stop, 'Stop Live Preview', ['EXECUTE'], true);
    const probeDescriptor = descriptor(LIVE_PREVIEW_TOOL_IDS.probe, 'Probe Live Preview health', ['READ'], false);
    const refreshDescriptor = descriptor(LIVE_PREVIEW_TOOL_IDS.refresh, 'Refresh Live Preview', ['EXECUTE','NETWORK'], true);
    const recoverDescriptor = descriptor(LIVE_PREVIEW_TOOL_IDS.recover, 'Recover Live Preview', ['EXECUTE','NETWORK'], true);
    const formFactorDescriptor = descriptor(LIVE_PREVIEW_TOOL_IDS.setFormFactor, 'Set Live Preview form factor', ['EXECUTE'], true);
    const colorDescriptor = descriptor(LIVE_PREVIEW_TOOL_IDS.setColorScheme, 'Set Live Preview color scheme', ['EXECUTE'], true);
    const captureDescriptor = descriptor(LIVE_PREVIEW_TOOL_IDS.capture, 'Capture settled Live Preview evidence', ['READ'], false);

    return Object.freeze([
      Object.freeze({
        descriptor: startDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureToolContext(context, startDescriptor);
          const value = row(input, 'Live Preview start');
          exactKeys(value, ['id','url'], ['formFactor','colorScheme'], 'Live Preview start');
          const id = normalizeLivePreviewId(value.id);
          const url = normalizePreviewUrl(value.url);
          const formFactor = normalizeLivePreviewFormFactor(value.formFactor ?? 'desktop');
          const colorScheme = normalizeLivePreviewColorScheme(value.colorScheme ?? 'light');
          assertScopedResource(context, scopeLock, livePreviewTargetScopeResource(id, url));
          if (shuttingDown) throw new Error('Live Preview Runtime is shutting down.');
          return asToolValue(await startRecord(id, url, formFactor, colorScheme));
        },
      }),
      Object.freeze({
        descriptor: stopDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureToolContext(context, stopDescriptor);
          const value = row(input, 'Live Preview stop');
          exactKeys(value, ['id'], [], 'Live Preview stop');
          const record = requireRecord(value.id);
          assertScopedResource(context, scopeLock, livePreviewSessionScopeResource(record.id));
          records.delete(record.id);
          await options.host.closeBrowserSession(record.browserSessionId);
          return { stopped: true, id: record.id };
        },
      }),
      Object.freeze({
        descriptor: probeDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureToolContext(context, probeDescriptor);
          const value = row(input, 'Live Preview probe');
          exactKeys(value, ['id'], [], 'Live Preview probe');
          const record = requireRecord(value.id);
          const probedAt = now();
          try {
            const state = await options.host.getBrowserSession(record.browserSessionId).pageState(record.tabId);
            const healthy = state.readyState === 'complete';
            record.status = healthy ? 'ready' : 'degraded';
            if (healthy) record.lastHealthyAt = probedAt;
            const result: LivePreviewProbe = Object.freeze({
              schema: LIVE_PREVIEW_PROBE_SCHEMA,
              build: LIVE_PREVIEW_BUILD,
              id: record.id,
              healthy,
              status: record.status,
              generation: record.generation,
              recoveryCount: record.recoveryCount,
              probedAt,
              state,
              error: healthy ? null : 'Live Preview page is not complete.',
              mutationPerformed: false,
            });
            return asToolValue(result);
          } catch (error) {
            record.status = 'degraded';
            const result: LivePreviewProbe = Object.freeze({
              schema: LIVE_PREVIEW_PROBE_SCHEMA,
              build: LIVE_PREVIEW_BUILD,
              id: record.id,
              healthy: false,
              status: 'degraded',
              generation: record.generation,
              recoveryCount: record.recoveryCount,
              probedAt,
              state: null,
              error: safeError(error),
              mutationPerformed: false,
            });
            return asToolValue(result);
          }
        },
      }),
      Object.freeze({
        descriptor: refreshDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureToolContext(context, refreshDescriptor);
          const value = row(input, 'Live Preview refresh');
          exactKeys(value, ['id','url'], [], 'Live Preview refresh');
          const record = requireRecord(value.id);
          const url = normalizePreviewUrl(value.url);
          if (url !== record.targetUrl) throw new Error('Live Preview refresh target does not match active target.');
          assertScopedResource(context, scopeLock, livePreviewTargetScopeResource(record.id, url));
          const session = options.host.getBrowserSession(record.browserSessionId);
          try {
            if (session.reload) await session.reload(record.tabId);
            else await session.navigate(record.tabId, record.targetUrl);
            record.refreshCount += 1;
            await settle(record);
            return asToolValue(recordDescriptor(record));
          } catch (error) {
            record.status = 'degraded';
            throw error;
          }
        },
      }),
      Object.freeze({
        descriptor: recoverDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureToolContext(context, recoverDescriptor);
          const value = row(input, 'Live Preview recovery');
          exactKeys(value, ['id','url'], [], 'Live Preview recovery');
          const record = requireRecord(value.id);
          const url = normalizePreviewUrl(value.url);
          if (url !== record.targetUrl) throw new Error('Live Preview recovery target does not match active target.');
          assertScopedResource(context, scopeLock, livePreviewTargetScopeResource(record.id, url));
          return asToolValue(await recover(record));
        },
      }),
      Object.freeze({
        descriptor: formFactorDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureToolContext(context, formFactorDescriptor);
          const value = row(input, 'Live Preview form factor');
          exactKeys(value, ['formFactor','id'], [], 'Live Preview form factor');
          const record = requireRecord(value.id);
          assertScopedResource(context, scopeLock, livePreviewSessionScopeResource(record.id));
          const formFactor = normalizeLivePreviewFormFactor(value.formFactor);
          const viewport = livePreviewViewport(formFactor);
          const session = options.host.getBrowserSession(record.browserSessionId);
          if (!session.setViewport) throw new Error('Preview browser adapter does not support Live Preview viewport changes.');
          await session.setViewport(record.tabId, viewport);
          record.formFactor = formFactor;
          record.viewport = viewport;
          await settle(record);
          return asToolValue(recordDescriptor(record));
        },
      }),
      Object.freeze({
        descriptor: colorDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureToolContext(context, colorDescriptor);
          const value = row(input, 'Live Preview color scheme');
          exactKeys(value, ['colorScheme','id'], [], 'Live Preview color scheme');
          const record = requireRecord(value.id);
          assertScopedResource(context, scopeLock, livePreviewSessionScopeResource(record.id));
          const nextColorScheme = normalizeLivePreviewColorScheme(value.colorScheme);
          const session = options.host.getBrowserSession(record.browserSessionId);
          if (!session.setColorScheme) throw new Error('Preview browser adapter does not support Live Preview color emulation.');
          await session.setColorScheme(record.tabId, nextColorScheme);
          record.colorScheme = nextColorScheme;
          await settle(record);
          return asToolValue(recordDescriptor(record));
        },
      }),
      Object.freeze({
        descriptor: captureDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureToolContext(context, captureDescriptor);
          const value = row(input, 'Live Preview capture');
          exactKeys(value, ['id','request'], [], 'Live Preview capture');
          const record = requireRecord(value.id);
          const request = normalizeVisualEvidenceRequest(value.request);
          const expectedDark = record.colorScheme === 'dark';
          if (request.darkMode !== undefined && request.darkMode !== expectedDark) {
            throw new TypeError('Live Preview capture darkMode must match the active Live Preview color scheme.');
          }
          const settling = await settle(record);
          let evidence: VisualEvidence | null = null;
          if (settling.settled) {
            const session = options.host.getBrowserSession(record.browserSessionId);
            const captureRequest: VisualEvidenceRequest = Object.freeze({ ...request, darkMode: expectedDark });
            evidence = await session.capture(record.tabId, captureRequest);
          }
          const result: LivePreviewCapture = Object.freeze({
            schema: LIVE_PREVIEW_CAPTURE_SCHEMA,
            build: LIVE_PREVIEW_BUILD,
            id: record.id,
            generation: record.generation,
            formFactor: record.formFactor,
            colorScheme: record.colorScheme,
            settling,
            evidence,
            captured: evidence !== null,
            validationAuthority: false,
            releaseAuthority: false,
          });
          return asToolValue(result);
        },
      }),
    ]);
  }

  return Object.freeze({
    build: LIVE_PREVIEW_BUILD,
    status,
    createToolRegistrations,
    async shutdown() {
      if (shuttingDown) return;
      shuttingDown = true;
      const active = [...records.values()];
      records.clear();
      await Promise.allSettled(active.map((record) => options.host.closeBrowserSession(record.browserSessionId)));
      shuttingDown = false;
    },
  });
}
