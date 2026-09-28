export const PROBLEMS_DIAGNOSTICS_BUILD = 72 as const;
export const PROBLEMS_DIAGNOSTICS_SCHEMA = 'gd-problems-diagnostics/1' as const;
export const PROBLEMS_DIAGNOSTIC_SCHEMA = 'gd-problem-diagnostic/1' as const;
export const PROBLEMS_DIAGNOSTIC_GROUP_SCHEMA = 'gd-problem-diagnostic-group/1' as const;
export const PROBLEMS_DIAGNOSTIC_CORRELATION_SCHEMA = 'gd-problem-diagnostic-correlation/1' as const;
export const PROBLEMS_DIAGNOSTIC_TEXT_SCHEMA = 'gd-problem-diagnostic-text/1' as const;

export const PROBLEMS_DIAGNOSTIC_SOURCES = Object.freeze([
  'runtime',
  'browser',
  'test',
  'preview',
  'validation',
] as const);
export const PROBLEMS_DIAGNOSTIC_SEVERITIES = Object.freeze(['info', 'warning', 'error'] as const);
export const PROBLEMS_DIAGNOSTIC_MAX_INPUTS = 4096 as const;
export const PROBLEMS_DIAGNOSTIC_DEFAULT_MAX_ENTRIES = 256 as const;
export const PROBLEMS_DIAGNOSTIC_MAX_ENTRIES = 512 as const;
export const PROBLEMS_DIAGNOSTIC_MAX_MESSAGE = 4096 as const;
export const PROBLEMS_DIAGNOSTIC_MAX_SOURCE_REF = 2048 as const;
export const PROBLEMS_DIAGNOSTIC_TEXT_MAX_CHARACTERS = 24_000 as const;
export const PROBLEMS_DIAGNOSTIC_TEXT_MAX_RESULTS = 256 as const;

export type ProblemsDiagnosticSource = (typeof PROBLEMS_DIAGNOSTIC_SOURCES)[number];
export type ProblemsDiagnosticSeverity = (typeof PROBLEMS_DIAGNOSTIC_SEVERITIES)[number];

export interface ProblemsDiagnosticLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

export interface ProblemsDiagnosticInput {
  readonly source: ProblemsDiagnosticSource;
  readonly severity: ProblemsDiagnosticSeverity;
  readonly message: string;
  readonly sourceRef: string;
  readonly code?: string;
  readonly location?: ProblemsDiagnosticLocation;
  readonly evidenceRefs?: readonly string[];
}

export interface ProblemsDiagnosticTextInput {
  readonly schema?: typeof PROBLEMS_DIAGNOSTIC_TEXT_SCHEMA;
  readonly source: 'runtime' | 'test';
  readonly sourceRef: string;
  readonly text: string;
}

export interface ProblemsDiagnostic {
  readonly schema: typeof PROBLEMS_DIAGNOSTIC_SCHEMA;
  readonly build: typeof PROBLEMS_DIAGNOSTICS_BUILD;
  readonly id: string;
  readonly source: ProblemsDiagnosticSource;
  readonly severity: ProblemsDiagnosticSeverity;
  readonly message: string;
  readonly sourceRef: string;
  readonly code: string | null;
  readonly location: ProblemsDiagnosticLocation | null;
  readonly evidenceRefs: readonly string[];
  readonly occurrences: number;
  readonly sourceCorrelated: boolean;
  readonly rootCauseClaimed: false;
  readonly autoFixAuthority: false;
}

export interface ProblemsDiagnosticGroup {
  readonly schema: typeof PROBLEMS_DIAGNOSTIC_GROUP_SCHEMA;
  readonly build: typeof PROBLEMS_DIAGNOSTICS_BUILD;
  readonly id: string;
  readonly kind: 'source' | 'file';
  readonly label: string;
  readonly severity: ProblemsDiagnosticSeverity;
  readonly count: number;
  readonly diagnosticIds: readonly string[];
  readonly worstSeverityPropagation: true;
}

export interface ProblemsDiagnosticCorrelation {
  readonly schema: typeof PROBLEMS_DIAGNOSTIC_CORRELATION_SCHEMA;
  readonly build: typeof PROBLEMS_DIAGNOSTICS_BUILD;
  readonly id: string;
  readonly file: string;
  readonly line: number;
  readonly diagnosticIds: readonly string[];
  readonly sources: readonly ProblemsDiagnosticSource[];
  readonly evidenceRefs: readonly string[];
  readonly correlatedBy: 'source-location';
  readonly causationClaimed: false;
}

export interface ProblemsDiagnosticsInput {
  readonly workspaceId: string;
  readonly observations: readonly ProblemsDiagnosticInput[];
  readonly maxEntries?: number;
}

export interface ProblemsDiagnosticsSnapshot {
  readonly schema: typeof PROBLEMS_DIAGNOSTICS_SCHEMA;
  readonly build: typeof PROBLEMS_DIAGNOSTICS_BUILD;
  readonly workspaceId: string;
  readonly diagnostics: readonly ProblemsDiagnostic[];
  readonly groups: readonly ProblemsDiagnosticGroup[];
  readonly correlations: readonly ProblemsDiagnosticCorrelation[];
  readonly topLevelSeverity: ProblemsDiagnosticSeverity | null;
  readonly counts: Readonly<Record<ProblemsDiagnosticSeverity, number>>;
  readonly sourceCounts: Readonly<Record<ProblemsDiagnosticSource, number>>;
  readonly inputCount: number;
  readonly deduplicatedCount: number;
  readonly returnedCount: number;
  readonly droppedCount: number;
  readonly unlocatedCount: number;
  readonly truncated: boolean;
  readonly bounded: true;
  readonly deterministic: true;
  readonly sourceGrounded: true;
  readonly unmatchedDiagnosticsPreserved: true;
  readonly worstSeverityPropagation: true;
  readonly correlationIsNotCausation: true;
  readonly rootCauseAuthority: false;
  readonly autoFixAuthority: false;
  readonly mutationAuthority: false;
  readonly validationAuthority: false;
  readonly releaseAuthority: false;
  readonly persistence: false;
}

const SOURCE_SET: ReadonlySet<ProblemsDiagnosticSource> = new Set(PROBLEMS_DIAGNOSTIC_SOURCES);
const SEVERITY_SET: ReadonlySet<ProblemsDiagnosticSeverity> = new Set(PROBLEMS_DIAGNOSTIC_SEVERITIES);
const SOURCE_EXTENSIONS = Object.freeze([
  'ts','tsx','js','jsx','mjs','cjs','rs','py','go','vue','svelte','css','scss','html','java','kt','kts','cs','cpp','cc','c','h','hpp',
] as const);
const SEVERITY_RANK: Readonly<Record<ProblemsDiagnosticSeverity, number>> = Object.freeze({
  info: 1,
  warning: 2,
  error: 3,
});

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a string.');
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (!normalized || normalized.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    throw new TypeError(label + ' is invalid.');
  }
  return normalized;
}

function boundedInteger(value: unknown, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new TypeError(label + ' is invalid.');
  return Number(value);
}

function normalizeFile(value: unknown): string {
  let file = boundedText(value, 'Diagnostic file', 2048).replace(/\\/g, '/');
  if (file.startsWith('file://')) {
    const raw = file.slice('file://'.length);
    let decoded = raw;
    try { decoded = decodeURIComponent(raw); } catch {}
    if (/^\/[A-Za-z]:\//.test(decoded)) decoded = decoded.slice(1);
    file = decoded.replace(/\/+/g, '/');
  }
  file = file.replace(/\/+/g, '/');
  if (!file || file.length > 2048) throw new TypeError('Diagnostic file is invalid.');
  return file;
}

function normalizeLocation(value: unknown): ProblemsDiagnosticLocation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Diagnostic location must be an object.');
  const row = value as Record<string, unknown>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['column','file','line'])) {
    throw new TypeError('Diagnostic location fields are invalid.');
  }
  return Object.freeze({
    file: normalizeFile(row.file),
    line: boundedInteger(row.line, 'Diagnostic line', 1, 10_000_000),
    column: boundedInteger(row.column, 'Diagnostic column', 1, 1_000_000),
  });
}

function uniqueRefs(value: unknown, primary: string): readonly string[] {
  if (value === undefined) return Object.freeze([primary]);
  if (!Array.isArray(value) || value.length > 128) throw new TypeError('Diagnostic evidenceRefs must be a bounded array.');
  const refs = value.map((entry, index) => boundedText(entry, 'Diagnostic evidenceRef '+(index+1), PROBLEMS_DIAGNOSTIC_MAX_SOURCE_REF));
  refs.push(primary);
  return Object.freeze([...new Set(refs)].sort());
}

function normalizeInput(value: ProblemsDiagnosticInput): ProblemsDiagnosticInput & { readonly evidenceRefs: readonly string[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Diagnostic observation must be an object.');
  if (!SOURCE_SET.has(value.source)) throw new TypeError('Diagnostic source is invalid.');
  if (!SEVERITY_SET.has(value.severity)) throw new TypeError('Diagnostic severity is invalid.');
  const sourceRef = boundedText(value.sourceRef, 'Diagnostic sourceRef', PROBLEMS_DIAGNOSTIC_MAX_SOURCE_REF);
  const message = boundedText(value.message, 'Diagnostic message', PROBLEMS_DIAGNOSTIC_MAX_MESSAGE);
  const code = value.code === undefined ? undefined : boundedText(value.code, 'Diagnostic code', 256);
  const location = value.location === undefined ? undefined : normalizeLocation(value.location);
  return Object.freeze({
    source: value.source,
    severity: value.severity,
    message,
    sourceRef,
    ...(code ? { code } : {}),
    ...(location ? { location } : {}),
    evidenceRefs: uniqueRefs(value.evidenceRefs, sourceRef),
  });
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  const bytes = new TextEncoder().encode(value);
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function diagnosticKey(value: ProblemsDiagnosticInput): string {
  const location = value.location ? value.location.file+'\u0000'+value.location.line+'\u0000'+value.location.column : '';
  return [value.source,value.severity,value.code??'',value.message.toLowerCase(),location].join('\u0001');
}

function worstSeverity(values: readonly ProblemsDiagnosticSeverity[]): ProblemsDiagnosticSeverity | null {
  let best: ProblemsDiagnosticSeverity | null = null;
  for (const severity of values) {
    if (best === null || SEVERITY_RANK[severity] > SEVERITY_RANK[best]) best = severity;
  }
  return best;
}

function diagnosticSort(left: ProblemsDiagnostic, right: ProblemsDiagnostic): number {
  return SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity]
    || (left.location?.file ?? '').localeCompare(right.location?.file ?? '')
    || (left.location?.line ?? 0) - (right.location?.line ?? 0)
    || (left.location?.column ?? 0) - (right.location?.column ?? 0)
    || left.source.localeCompare(right.source)
    || left.message.localeCompare(right.message);
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}

function looksLikeSourceFile(value: string): boolean {
  const lower = value.toLowerCase().replace(/\\/g, '/');
  return SOURCE_EXTENSIONS.some((extension) => lower.endsWith('.'+extension));
}

function inferSeverity(value: string): ProblemsDiagnosticSeverity {
  const lower = value.toLowerCase();
  if (/\bwarn(?:ing)?\b/.test(lower)) return 'warning';
  if (/\binfo\b/.test(lower)) return 'info';
  return 'error';
}

function cleanDiagnosticMessage(value: string): string {
  let message = value.trim().replace(/^[-:>\s]+/, '');
  message = message.replace(/^(?:error|warning|warn|info)\s*:\s*/i, '');
  message = message.replace(/^error\s+TS\d+\s*:\s*/i, '');
  return message.trim() || 'Diagnostic reported a problem';
}

function locationFromLine(line: string): { file: string; line: number; column: number; tail: string } | null {
  const paren = /(.+\.[A-Za-z0-9]+)\((\d+),(\d+)\)\s*:\s*(.*)$/.exec(line);
  if (paren && looksLikeSourceFile(paren[1]!)) {
    return { file: normalizeFile(paren[1]!), line: Number(paren[2]), column: Number(paren[3]), tail: paren[4] ?? '' };
  }
  const colon = /(?:^|\bat\s+|\()((?:file:\/\/)?[^\n()]+\.[A-Za-z0-9]+):(\d+):(\d+)(?:\)?\s*[:\-]?\s*(.*))?$/.exec(line.trim());
  if (colon && looksLikeSourceFile(colon[1]!.replace(/^file:\/\//,''))) {
    return { file: normalizeFile(colon[1]!), line: Number(colon[2]), column: Number(colon[3]), tail: colon[4] ?? '' };
  }
  return null;
}

export function parseDiagnosticText(input: ProblemsDiagnosticTextInput): readonly ProblemsDiagnosticInput[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Diagnostic text input must be an object.');
  if (input.schema !== undefined && input.schema !== PROBLEMS_DIAGNOSTIC_TEXT_SCHEMA) throw new TypeError('Diagnostic text schema is invalid.');
  if (input.source !== 'runtime' && input.source !== 'test') throw new TypeError('Diagnostic text source must be runtime or test.');
  const sourceRef = boundedText(input.sourceRef, 'Diagnostic text sourceRef', PROBLEMS_DIAGNOSTIC_MAX_SOURCE_REF);
  if (typeof input.text !== 'string') throw new TypeError('Diagnostic text must be a string.');
  const normalized = stripAnsi(input.text.normalize('NFC').replace(/\r\n?/g, '\n'));
  const bounded = normalized.length <= PROBLEMS_DIAGNOSTIC_TEXT_MAX_CHARACTERS
    ? normalized
    : normalized.slice(normalized.length - PROBLEMS_DIAGNOSTIC_TEXT_MAX_CHARACTERS);

  const results: ProblemsDiagnosticInput[] = [];
  const seen = new Set<string>();
  const lines = bounded.split('\n');
  for (let index = 0; index < lines.length && results.length < PROBLEMS_DIAGNOSTIC_TEXT_MAX_RESULTS; index += 1) {
    const raw = lines[index]!.trim();
    if (!raw) continue;
    const location = locationFromLine(raw);
    if (!location) continue;
    const nearby = [location.tail, lines[index - 1] ?? '', lines[index + 1] ?? '']
      .map((value) => value.trim())
      .find((value) => value && !locationFromLine(value)) ?? '';
    const message = cleanDiagnosticMessage(location.tail || nearby);
    const observation: ProblemsDiagnosticInput = Object.freeze({
      source: input.source,
      severity: inferSeverity(location.tail+' '+nearby),
      message,
      sourceRef,
      location: Object.freeze({ file: location.file, line: location.line, column: location.column }),
      evidenceRefs: Object.freeze([sourceRef]),
    });
    const key = diagnosticKey(observation);
    if (!seen.has(key)) {
      seen.add(key);
      results.push(observation);
    }
  }
  return Object.freeze(results);
}

export function createProblemsDiagnostics(input: ProblemsDiagnosticsInput): ProblemsDiagnosticsSnapshot {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Problems & Diagnostics input must be an object.');
  const workspaceId = boundedText(input.workspaceId, 'Problems & Diagnostics workspaceId', 256);
  if (!Array.isArray(input.observations) || input.observations.length > PROBLEMS_DIAGNOSTIC_MAX_INPUTS) {
    throw new RangeError('Problems & Diagnostics observations exceed the input limit.');
  }
  const maxEntries = input.maxEntries === undefined
    ? PROBLEMS_DIAGNOSTIC_DEFAULT_MAX_ENTRIES
    : boundedInteger(input.maxEntries, 'Problems & Diagnostics maxEntries', 1, PROBLEMS_DIAGNOSTIC_MAX_ENTRIES);

  const merged = new Map<string, {
    normalized: ReturnType<typeof normalizeInput>;
    occurrences: number;
    evidenceRefs: Set<string>;
  }>();
  for (const raw of input.observations) {
    const normalized = normalizeInput(raw);
    const key = diagnosticKey(normalized);
    const current = merged.get(key);
    if (current) {
      current.occurrences += 1;
      for (const ref of normalized.evidenceRefs) current.evidenceRefs.add(ref);
    } else {
      merged.set(key, { normalized, occurrences: 1, evidenceRefs: new Set(normalized.evidenceRefs) });
    }
  }

  const allDiagnostics: ProblemsDiagnostic[] = [...merged.entries()].map(([key, value]) => Object.freeze({
    schema: PROBLEMS_DIAGNOSTIC_SCHEMA,
    build: PROBLEMS_DIAGNOSTICS_BUILD,
    id: 'problem-'+stableHash(key),
    source: value.normalized.source,
    severity: value.normalized.severity,
    message: value.normalized.message,
    sourceRef: value.normalized.sourceRef,
    code: value.normalized.code ?? null,
    location: value.normalized.location ?? null,
    evidenceRefs: Object.freeze([...value.evidenceRefs].sort()),
    occurrences: value.occurrences,
    sourceCorrelated: false,
    rootCauseClaimed: false,
    autoFixAuthority: false,
  })).sort(diagnosticSort);

  const selectedBase = allDiagnostics.slice(0, maxEntries);
  const correlationBuckets = new Map<string, ProblemsDiagnostic[]>();
  for (const item of selectedBase) {
    if (!item.location) continue;
    const key = item.location.file.toLowerCase()+'\u0000'+item.location.line;
    const list = correlationBuckets.get(key) ?? [];
    list.push(item);
    correlationBuckets.set(key, list);
  }

  const correlatedIds = new Set<string>();
  const correlations: ProblemsDiagnosticCorrelation[] = [];
  for (const [key, values] of correlationBuckets) {
    const sources = [...new Set(values.map((value) => value.source))].sort() as ProblemsDiagnosticSource[];
    if (values.length < 2 || sources.length < 2) continue;
    for (const value of values) correlatedIds.add(value.id);
    const location = values[0]!.location!;
    correlations.push(Object.freeze({
      schema: PROBLEMS_DIAGNOSTIC_CORRELATION_SCHEMA,
      build: PROBLEMS_DIAGNOSTICS_BUILD,
      id: 'correlation-'+stableHash(key),
      file: location.file,
      line: location.line,
      diagnosticIds: Object.freeze(values.map((value) => value.id).sort()),
      sources: Object.freeze(sources),
      evidenceRefs: Object.freeze([...new Set(values.flatMap((value) => value.evidenceRefs))].sort()),
      correlatedBy: 'source-location',
      causationClaimed: false,
    }));
  }
  correlations.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);

  const diagnostics = Object.freeze(selectedBase.map((value) => (
    correlatedIds.has(value.id)
      ? Object.freeze({ ...value, sourceCorrelated: true as const })
      : value
  )));

  const groups: ProblemsDiagnosticGroup[] = [];
  const group = (kind: 'source' | 'file', label: string, values: readonly ProblemsDiagnostic[]) => {
    if (values.length === 0) return;
    groups.push(Object.freeze({
      schema: PROBLEMS_DIAGNOSTIC_GROUP_SCHEMA,
      build: PROBLEMS_DIAGNOSTICS_BUILD,
      id: 'group-'+stableHash(kind+'\u0000'+label.toLowerCase()),
      kind,
      label,
      severity: worstSeverity(values.map((value) => value.severity))!,
      count: values.length,
      diagnosticIds: Object.freeze(values.map((value) => value.id).sort()),
      worstSeverityPropagation: true,
    }));
  };

  for (const source of PROBLEMS_DIAGNOSTIC_SOURCES) group('source', source, diagnostics.filter((value) => value.source === source));
  const files = [...new Set(diagnostics.flatMap((value) => value.location ? [value.location.file] : []))].sort();
  for (const file of files) group('file', file, diagnostics.filter((value) => value.location?.file === file));
  groups.sort((left, right) => SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] || left.label.localeCompare(right.label));

  const counts = Object.freeze({
    info: diagnostics.filter((value) => value.severity === 'info').length,
    warning: diagnostics.filter((value) => value.severity === 'warning').length,
    error: diagnostics.filter((value) => value.severity === 'error').length,
  });
  const sourceCounts = Object.freeze({
    runtime: diagnostics.filter((value) => value.source === 'runtime').length,
    browser: diagnostics.filter((value) => value.source === 'browser').length,
    test: diagnostics.filter((value) => value.source === 'test').length,
    preview: diagnostics.filter((value) => value.source === 'preview').length,
    validation: diagnostics.filter((value) => value.source === 'validation').length,
  });
  const droppedCount = Math.max(0, allDiagnostics.length - diagnostics.length);

  return Object.freeze({
    schema: PROBLEMS_DIAGNOSTICS_SCHEMA,
    build: PROBLEMS_DIAGNOSTICS_BUILD,
    workspaceId,
    diagnostics,
    groups: Object.freeze(groups),
    correlations: Object.freeze(correlations),
    topLevelSeverity: worstSeverity(diagnostics.map((value) => value.severity)),
    counts,
    sourceCounts,
    inputCount: input.observations.length,
    deduplicatedCount: allDiagnostics.length,
    returnedCount: diagnostics.length,
    droppedCount,
    unlocatedCount: diagnostics.filter((value) => value.location === null).length,
    truncated: droppedCount > 0,
    bounded: true,
    deterministic: true,
    sourceGrounded: true,
    unmatchedDiagnosticsPreserved: true,
    worstSeverityPropagation: true,
    correlationIsNotCausation: true,
    rootCauseAuthority: false,
    autoFixAuthority: false,
    mutationAuthority: false,
    validationAuthority: false,
    releaseAuthority: false,
    persistence: false,
  });
}
