import {
  PREVIEW_BRIDGE_BUILD,
  PREVIEW_BRIDGE_CAPABILITIES,
  PREVIEW_BRIDGE_CAPTURE_REPORT_SCHEMA,
  PREVIEW_BRIDGE_SNAPSHOT_SCHEMA,
  PREVIEW_BRIDGE_TOOL_IDS,
  normalizeLivePreviewId,
  normalizeVisualEvidenceRequest,
  type LivePreviewCapture,
  type PreviewBridgeCaptureMetadata,
  type PreviewBridgeCaptureReport,
  type PreviewBridgeProvenance,
  type PreviewBridgeSnapshot,
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

export interface PreviewBridgeHost {
  getBrowserSession(sessionId: string): BrowserAdapterSession;
  captureLivePreview(id: string, request: VisualEvidenceRequest): Promise<LivePreviewCapture>;
}

export interface PreviewBridgeRuntimeOptions {
  readonly host: PreviewBridgeHost;
  readonly now?: () => string;
}

export interface PreviewBridgeRuntimeStatus {
  readonly build: typeof PREVIEW_BRIDGE_BUILD;
  readonly ready: true;
  readonly readOnly: true;
  readonly bounded: true;
  readonly telemetryPersistentPerTab: true;
  readonly requestHeadersCaptured: false;
  readonly responseHeadersCaptured: false;
  readonly bodiesCaptured: false;
  readonly cookiesCaptured: false;
  readonly storageCaptured: false;
  readonly unsafeEvaluate: false;
  readonly interactionAuthority: false;
  readonly validationAuthority: false;
  readonly releaseAuthority: false;
}

export interface PreviewBridgeRuntime {
  readonly build: typeof PREVIEW_BRIDGE_BUILD;
  status(): PreviewBridgeRuntimeStatus;
  createToolRegistrations(scopeLock: ScopeLockRecord): readonly ToolRegistration[];
}

interface InputRow { readonly [key: string]: ToolValue }

function row(value: ToolValue, label: string): InputRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(label + ' input must be an object.');
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
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) throw new TypeError(label + ' is invalid.');
  return normalized;
}

function descriptor(id: string, label: string): ToolDescriptor {
  return Object.freeze({ id, label, requiredCapabilities: Object.freeze(['READ'] as const), mutating: false });
}

function ensureContext(context: ToolExecutionContext, tool: ToolDescriptor): void {
  if (context.schema !== TOOL_RUNTIME_SCHEMA || context.tool.id !== tool.id) {
    throw new Error('Preview Bridge requires a Tool Runtime execution context.');
  }
  if (!context.verifiedCapabilities.includes('READ')) throw new Error('Preview Bridge requires verified READ capability.');
  if (context.mutationAuthorized) throw new Error('Preview Bridge must not receive mutation authority.');
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

function safeFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 1024) || 'Preview Bridge capture failed.';
}

function captureMetadata(
  id: string,
  request: VisualEvidenceRequest,
  capture: LivePreviewCapture | null,
  failure: string | null,
): PreviewBridgeCaptureMetadata {
  if (!capture) {
    return Object.freeze({
      status: 'failed',
      livePreviewId: id,
      generation: null,
      formFactor: null,
      colorScheme: null,
      viewport: null,
      deviceScaleFactor: null,
      mode: request.mode,
      selector: request.selector ?? null,
      width: null,
      height: null,
      format: request.format,
      bytes: null,
      settlingSucceeded: false,
      failureCode: 'capture_failed',
      failureMessage: failure,
      evidenceInlineAvailable: false,
      evidenceDataOmitted: true,
    });
  }

  const evidence = capture.evidence;
  if (!capture.captured || !capture.settling.settled || !evidence) {
    return Object.freeze({
      status: 'inconclusive',
      livePreviewId: capture.id,
      generation: capture.generation,
      formFactor: capture.formFactor,
      colorScheme: capture.colorScheme,
      viewport: capture.settling.state?.viewport ?? null,
      deviceScaleFactor: capture.settling.state?.viewport.deviceScaleFactor ?? null,
      mode: request.mode,
      selector: request.selector ?? null,
      width: null,
      height: null,
      format: request.format,
      bytes: null,
      settlingSucceeded: capture.settling.settled,
      failureCode: 'visual_not_settled',
      failureMessage: capture.settling.failure ?? 'Visual state was not stable enough to capture.',
      evidenceInlineAvailable: false,
      evidenceDataOmitted: true,
    });
  }

  return Object.freeze({
    status: 'success',
    livePreviewId: capture.id,
    generation: capture.generation,
    formFactor: capture.formFactor,
    colorScheme: capture.colorScheme,
    viewport: evidence.viewport,
    deviceScaleFactor: evidence.viewport.deviceScaleFactor,
    mode: evidence.mode,
    selector: evidence.selector,
    width: evidence.width,
    height: evidence.height,
    format: evidence.format,
    bytes: evidence.bytes,
    settlingSucceeded: true,
    failureCode: null,
    failureMessage: null,
    evidenceInlineAvailable: true,
    evidenceDataOmitted: true,
  });
}

export function createPreviewBridgeRuntime(options: PreviewBridgeRuntimeOptions): PreviewBridgeRuntime {
  if (!options?.host) throw new TypeError('Preview Bridge requires a host.');
  const now = options.now ?? (() => new Date().toISOString());

  function status(): PreviewBridgeRuntimeStatus {
    return Object.freeze({
      build: PREVIEW_BRIDGE_BUILD,
      ready: true,
      readOnly: true,
      bounded: true,
      telemetryPersistentPerTab: true,
      requestHeadersCaptured: false,
      responseHeadersCaptured: false,
      bodiesCaptured: false,
      cookiesCaptured: false,
      storageCaptured: false,
      unsafeEvaluate: false,
      interactionAuthority: false,
      validationAuthority: false,
      releaseAuthority: false,
    });
  }

  function createToolRegistrations(scopeLock: ScopeLockRecord): readonly ToolRegistration[] {
    if (!scopeLock || scopeLock.schema !== 'gd-scope-lock/1' || scopeLock.status !== 'locked') {
      throw new TypeError('Preview Bridge requires the active locked Scope Lock record as provenance context.');
    }

    const snapshotDescriptor = descriptor(PREVIEW_BRIDGE_TOOL_IDS.snapshot, 'Read structured Preview Bridge telemetry');
    const captureDescriptor = descriptor(PREVIEW_BRIDGE_TOOL_IDS.captureReport, 'Capture Preview evidence metadata with provenance');

    return Object.freeze([
      Object.freeze({
        descriptor: snapshotDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureContext(context, snapshotDescriptor);
          const value = row(input, 'Preview Bridge snapshot');
          exactKeys(value, ['sessionId','tabId'], [], 'Preview Bridge snapshot');
          const sessionId = requiredString(value.sessionId, 'Preview session id', 256);
          const tabId = requiredString(value.tabId, 'Preview tab id', 256);
          const session = options.host.getBrowserSession(sessionId);
          if (!session.telemetrySnapshot) throw new Error('Preview browser adapter does not support structured telemetry.');
          const snapshot = await session.telemetrySnapshot(tabId);
          const result: PreviewBridgeSnapshot = Object.freeze({
            schema: PREVIEW_BRIDGE_SNAPSHOT_SCHEMA,
            build: PREVIEW_BRIDGE_BUILD,
            sessionId,
            tabId,
            capabilities: PREVIEW_BRIDGE_CAPABILITIES,
            provenance: provenance(context),
            page: snapshot.page,
            dom: snapshot.dom,
            network: snapshot.network,
            console: snapshot.console,
            errors: snapshot.errors,
            dropped: Object.freeze({
              network: snapshot.networkDropped,
              console: snapshot.consoleDropped,
              errors: snapshot.errorsDropped,
            }),
            capturedAt: snapshot.capturedAt,
            readOnly: true,
            bounded: true,
            credentialsIncluded: false,
            bodiesIncluded: false,
            validationAuthority: false,
            releaseAuthority: false,
          });
          return asToolValue(result);
        },
      }),
      Object.freeze({
        descriptor: captureDescriptor,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureContext(context, captureDescriptor);
          const value = row(input, 'Preview Bridge capture report');
          exactKeys(value, ['id','request'], [], 'Preview Bridge capture report');
          const id = normalizeLivePreviewId(requiredString(value.id, 'Live Preview id', 128));
          const request = normalizeVisualEvidenceRequest(value.request);
          let capture: LivePreviewCapture | null = null;
          let failure: string | null = null;
          try {
            capture = await options.host.captureLivePreview(id, request);
          } catch (error) {
            failure = safeFailure(error);
          }
          const result: PreviewBridgeCaptureReport = Object.freeze({
            schema: PREVIEW_BRIDGE_CAPTURE_REPORT_SCHEMA,
            build: PREVIEW_BRIDGE_BUILD,
            provenance: provenance(context),
            capture: captureMetadata(id, request, capture, failure),
            reportedAt: now(),
            readOnly: true,
            bounded: true,
            validationAuthority: false,
            releaseAuthority: false,
          });
          return asToolValue(result);
        },
      }),
    ]);
  }

  return Object.freeze({
    build: PREVIEW_BRIDGE_BUILD,
    status,
    createToolRegistrations,
  });
}
