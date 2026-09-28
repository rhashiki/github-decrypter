import {
  PROBLEMS_DIAGNOSTICS_BUILD,
  PROBLEMS_DIAGNOSTICS_REPORT_SCHEMA,
  PROBLEMS_DIAGNOSTICS_TOOL_IDS,
  createProblemsDiagnostics,
  parseDiagnosticText,
  type ProblemsDiagnosticInput,
  type ProblemsDiagnosticSeverity,
  type ProblemsDiagnosticSource,
  type ProblemsDiagnosticsProvenance,
  type ProblemsDiagnosticsReport,
  type ProblemsDiagnosticTextInput,
} from '@github-decrypter/diagnostics';
import type {
  PreviewBridgeAdapterSnapshot,
  PreviewBridgeCaptureReport,
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

export const PROBLEMS_DIAGNOSTICS_RUNTIME_SCHEMA = 'gd-problems-diagnostics-runtime/1' as const;

export interface ProblemsDiagnosticsHost {
  getBrowserSession(sessionId: string): BrowserAdapterSession;
}

export interface ProblemsDiagnosticsRuntimeOptions {
  readonly host: ProblemsDiagnosticsHost;
  readonly now?: () => string;
}

export interface ProblemsDiagnosticsRuntimeStatus {
  readonly schema: typeof PROBLEMS_DIAGNOSTICS_RUNTIME_SCHEMA;
  readonly build: typeof PROBLEMS_DIAGNOSTICS_BUILD;
  readonly ready: true;
  readonly readOnly: true;
  readonly aggregationAuthority: true;
  readonly correlationAuthority: true;
  readonly telemetryOwner: 'preview-bridge';
  readonly validationOwner: 'validation-pipeline';
  readonly secondCollector: false;
  readonly persistentStorage: false;
  readonly rootCauseAuthority: false;
  readonly autoFixAuthority: false;
  readonly mutationAuthority: false;
  readonly validationAuthority: false;
  readonly releaseAuthority: false;
}

export interface ProblemsDiagnosticsRuntime {
  readonly build: typeof PROBLEMS_DIAGNOSTICS_BUILD;
  status(): ProblemsDiagnosticsRuntimeStatus;
  createToolRegistrations(scopeLock: ScopeLockRecord): readonly ToolRegistration[];
}

interface InputRow { readonly [key: string]: ToolValue }

function row(value: ToolValue, label: string): InputRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(label + ' input must be an object.');
  return value as InputRow;
}

function requiredString(value: ToolValue | undefined, label: string, max = 2048): string {
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

function toolArray(value: ToolValue | undefined, label: string, max: number): readonly ToolValue[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > max) throw new TypeError(label + ' must be a bounded array.');
  return Object.freeze([...value]);
}

function descriptor(): ToolDescriptor {
  return Object.freeze({
    id: PROBLEMS_DIAGNOSTICS_TOOL_IDS.aggregate,
    label: 'Aggregate bounded Problems & Diagnostics evidence',
    requiredCapabilities: Object.freeze(['READ'] as const),
    mutating: false,
  });
}

function ensureContext(context: ToolExecutionContext, tool: ToolDescriptor): void {
  if (context.schema !== TOOL_RUNTIME_SCHEMA || context.tool.id !== tool.id) {
    throw new Error('Problems & Diagnostics requires a Tool Runtime execution context.');
  }
  if (!context.verifiedCapabilities.includes('READ')) {
    throw new Error('Problems & Diagnostics requires verified READ capability.');
  }
  if (context.mutationAuthorized) {
    throw new Error('Problems & Diagnostics must not receive mutation authority.');
  }
}

function provenance(context: ToolExecutionContext): ProblemsDiagnosticsProvenance {
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

function previewRef(sessionId: string, tabId: string, kind: string, suffix: string): string {
  return 'preview:'+sessionId+':'+tabId+':'+kind+':'+suffix;
}

function consoleSeverity(level: string): ProblemsDiagnosticSeverity | null {
  const normalized = level.trim().toLowerCase();
  if (['error','assert'].includes(normalized)) return 'error';
  if (['warn','warning'].includes(normalized)) return 'warning';
  return null;
}

function previewObservations(
  sessionId: string,
  tabId: string,
  snapshot: PreviewBridgeAdapterSnapshot,
): readonly ProblemsDiagnosticInput[] {
  const observations: ProblemsDiagnosticInput[] = [];

  for (const error of snapshot.errors) {
    observations.push(Object.freeze({
      source: 'runtime',
      severity: 'error',
      message: error.message,
      sourceRef: previewRef(sessionId,tabId,'runtime-error',String(error.sequence)),
      code: 'runtime-error',
    }));
  }

  for (const entry of snapshot.console) {
    const severity = consoleSeverity(entry.level);
    if (!severity) continue;
    observations.push(Object.freeze({
      source: 'runtime',
      severity,
      message: entry.text,
      sourceRef: previewRef(sessionId,tabId,'console',String(entry.sequence)),
      code: 'console-'+entry.level.toLowerCase(),
    }));
  }

  for (const entry of snapshot.network) {
    if (!entry.failed && (entry.status === null || entry.status < 400)) continue;
    const severity: ProblemsDiagnosticSeverity = entry.failed || (entry.status !== null && entry.status >= 500) ? 'error' : 'warning';
    const status = entry.status === null ? '' : ' HTTP '+entry.status;
    const failed = entry.failed ? ' — '+entry.failed : '';
    observations.push(Object.freeze({
      source: 'browser',
      severity,
      message: (entry.method+' '+entry.url+status+failed).trim(),
      sourceRef: previewRef(sessionId,tabId,'network',entry.requestId),
      code: entry.failed ? 'network-failed' : 'http-'+entry.status,
    }));
  }

  const dropped = snapshot.networkDropped + snapshot.consoleDropped + snapshot.errorsDropped;
  if (dropped > 0) {
    observations.push(Object.freeze({
      source: 'browser',
      severity: 'warning',
      message: 'Preview Bridge dropped '+dropped+' telemetry entries because bounded buffers were full.',
      sourceRef: previewRef(sessionId,tabId,'telemetry','dropped'),
      code: 'telemetry-dropped',
    }));
  }

  return Object.freeze(observations);
}

function validationObservations(
  values: readonly ToolValue[],
  workspaceId: string,
): readonly ProblemsDiagnosticInput[] {
  const observations: ProblemsDiagnosticInput[] = [];
  for (const value of values) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Validation diagnostic source must be an object.');
    const record = value as Record<string, ToolValue>;
    if (record.schema !== 'gd-validation-pipeline/1' || record.status !== 'validated') {
      throw new TypeError('Problems & Diagnostics accepts only canonical Validation Pipeline records.');
    }
    if (record.workspaceId !== workspaceId) throw new Error('Validation diagnostic source belongs to a different workspace.');
    if (!Array.isArray(record.criteria)) throw new TypeError('Validation diagnostic criteria are invalid.');
    const validationId = requiredString(record.id, 'Validation id', 256);
    for (const criterionValue of record.criteria) {
      if (!criterionValue || typeof criterionValue !== 'object' || Array.isArray(criterionValue)) {
        throw new TypeError('Validation criterion diagnostic source is invalid.');
      }
      const criterion = criterionValue as Record<string, ToolValue>;
      if (criterion.passed === true) continue;
      if (criterion.passed !== false) throw new TypeError('Validation criterion passed state is invalid.');
      const evidenceKind = requiredString(criterion.evidenceKind, 'Validation evidence kind', 64);
      const source: ProblemsDiagnosticSource =
        evidenceKind === 'test' ? 'test'
          : evidenceKind === 'preview' ? 'preview'
            : evidenceKind === 'diagnostic' ? 'runtime'
              : 'validation';
      observations.push(Object.freeze({
        source,
        severity: 'error',
        message: requiredString(criterion.statement, 'Validation criterion statement', 4096),
        sourceRef: requiredString(criterion.sourceRef, 'Validation criterion sourceRef', 2048),
        code: requiredString(criterion.criterionId, 'Validation criterion id', 256),
        evidenceRefs: Object.freeze(['validation:'+validationId, requiredString(criterion.sourceRef, 'Validation criterion sourceRef', 2048)]),
      }));
    }
  }
  return Object.freeze(observations);
}

function captureObservations(
  values: readonly ToolValue[],
  workspaceId: string,
): readonly ProblemsDiagnosticInput[] {
  const observations: ProblemsDiagnosticInput[] = [];
  for (const value of values) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Preview capture diagnostic source must be an object.');
    const report = value as unknown as PreviewBridgeCaptureReport;
    if (report.schema !== 'gd-preview-bridge-capture-report/1' || report.build !== 70 || report.readOnly !== true) {
      throw new TypeError('Problems & Diagnostics accepts only canonical Preview Bridge capture reports.');
    }
    if (report.provenance?.workspaceId !== workspaceId) throw new Error('Preview capture diagnostic source belongs to a different workspace.');
    if (report.capture.status === 'success') continue;
    const code = report.capture.failureCode ?? (report.capture.status === 'inconclusive' ? 'capture-inconclusive' : 'capture-failed');
    const message = report.capture.failureMessage
      ?? (report.capture.status === 'inconclusive'
        ? 'Preview capture was inconclusive.'
        : 'Preview capture failed.');
    observations.push(Object.freeze({
      source: 'preview',
      severity: report.capture.status === 'failed' ? 'error' : 'warning',
      message,
      sourceRef: 'preview-capture:'+report.capture.livePreviewId+':'+String(report.capture.generation ?? 'unknown'),
      code,
      evidenceRefs: Object.freeze([report.provenance.runId]),
    }));
  }
  return Object.freeze(observations);
}

function textObservations(values: readonly ToolValue[]): readonly ProblemsDiagnosticInput[] {
  const observations: ProblemsDiagnosticInput[] = [];
  for (const value of values) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Diagnostic text source must be an object.');
    const record = value as Record<string, ToolValue>;
    const input: ProblemsDiagnosticTextInput = {
      source: record.source === 'runtime' ? 'runtime' : record.source === 'test' ? 'test' : (()=>{throw new TypeError('Diagnostic text source is invalid.');})(),
      sourceRef: requiredString(record.sourceRef, 'Diagnostic text sourceRef', 2048),
      text: requiredString(record.text, 'Diagnostic text', 100_000),
    };
    observations.push(...parseDiagnosticText(input));
  }
  return Object.freeze(observations);
}

export function createProblemsDiagnosticsRuntime(options: ProblemsDiagnosticsRuntimeOptions): ProblemsDiagnosticsRuntime {
  if (!options?.host) throw new TypeError('Problems & Diagnostics requires a host.');
  const now = options.now ?? (() => new Date().toISOString());

  function status(): ProblemsDiagnosticsRuntimeStatus {
    return Object.freeze({
      schema: PROBLEMS_DIAGNOSTICS_RUNTIME_SCHEMA,
      build: PROBLEMS_DIAGNOSTICS_BUILD,
      ready: true,
      readOnly: true,
      aggregationAuthority: true,
      correlationAuthority: true,
      telemetryOwner: 'preview-bridge',
      validationOwner: 'validation-pipeline',
      secondCollector: false,
      persistentStorage: false,
      rootCauseAuthority: false,
      autoFixAuthority: false,
      mutationAuthority: false,
      validationAuthority: false,
      releaseAuthority: false,
    });
  }

  function createToolRegistrations(scopeLock: ScopeLockRecord): readonly ToolRegistration[] {
    if (!scopeLock || scopeLock.schema !== 'gd-scope-lock/1' || scopeLock.status !== 'locked') {
      throw new TypeError('Problems & Diagnostics requires the active locked Scope Lock record as provenance context.');
    }
    const tool = descriptor();

    return Object.freeze([
      Object.freeze({
        descriptor: tool,
        handler: async (context: ToolExecutionContext, input: ToolValue) => {
          ensureContext(context, tool);
          const value = row(input, 'Problems & Diagnostics');
          const allowed = new Set(['preview','validations','textDiagnostics','previewCaptureReports','maxEntries']);
          if (Object.keys(value).some((key) => !allowed.has(key))) throw new TypeError('Problems & Diagnostics input fields are invalid.');

          const validations = toolArray(value.validations, 'Problems & Diagnostics validations', 64);
          const textInputs = toolArray(value.textDiagnostics, 'Problems & Diagnostics textDiagnostics', 64);
          const captureReports = toolArray(value.previewCaptureReports, 'Problems & Diagnostics previewCaptureReports', 64);
          const observations: ProblemsDiagnosticInput[] = [];
          let previewBridge = false;
          let telemetryDropped = 0;

          if (value.preview !== undefined) {
            const preview = row(value.preview, 'Problems & Diagnostics preview');
            if (JSON.stringify(Object.keys(preview).sort()) !== JSON.stringify(['sessionId','tabId'])) {
              throw new TypeError('Problems & Diagnostics preview fields are invalid.');
            }
            const sessionId = requiredString(preview.sessionId, 'Problems & Diagnostics session id', 256);
            const tabId = requiredString(preview.tabId, 'Problems & Diagnostics tab id', 256);
            const session = options.host.getBrowserSession(sessionId);
            if (!session.telemetrySnapshot) throw new Error('Problems & Diagnostics requires Build 70 structured telemetry support.');
            const snapshot = await session.telemetrySnapshot(tabId);
            observations.push(...previewObservations(sessionId,tabId,snapshot));
            telemetryDropped = snapshot.networkDropped + snapshot.consoleDropped + snapshot.errorsDropped;
            previewBridge = true;
          }

          observations.push(...validationObservations(validations,context.workspaceId));
          observations.push(...textObservations(textInputs));
          observations.push(...captureObservations(captureReports,context.workspaceId));

          if (!previewBridge && validations.length === 0 && textInputs.length === 0 && captureReports.length === 0) {
            throw new TypeError('Problems & Diagnostics requires at least one diagnostic source.');
          }

          const snapshot = createProblemsDiagnostics({
            workspaceId: context.workspaceId,
            observations,
            maxEntries: optionalInteger(value.maxEntries, 'Problems & Diagnostics maxEntries'),
          });

          const report: ProblemsDiagnosticsReport = Object.freeze({
            schema: PROBLEMS_DIAGNOSTICS_REPORT_SCHEMA,
            build: PROBLEMS_DIAGNOSTICS_BUILD,
            snapshot,
            provenance: provenance(context),
            sourceStats: Object.freeze({
              previewBridge,
              validationRecords: validations.length,
              diagnosticTextInputs: textInputs.length,
              previewCaptureReports: captureReports.length,
              previewTelemetryDropped: telemetryDropped,
            }),
            capturedAt: now(),
            readOnly: true,
            aggregationAuthority: true,
            correlationAuthority: true,
            rootCauseAuthority: false,
            autoFixAuthority: false,
            mutationAuthority: false,
            validationAuthority: false,
            releaseAuthority: false,
            persistence: false,
          });
          return asToolValue(report);
        },
      }),
    ]);
  }

  return Object.freeze({
    build: PROBLEMS_DIAGNOSTICS_BUILD,
    status,
    createToolRegistrations,
  });
}
