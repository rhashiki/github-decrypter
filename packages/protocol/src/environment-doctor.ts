export const ENVIRONMENT_DOCTOR_BUILD = 32 as const;
export const ENVIRONMENT_DOCTOR_SCHEMA = 'gd-environment-doctor/1' as const;

export type EnvironmentDoctorStatus = 'pass' | 'warning' | 'fail' | 'unknown';

export type EnvironmentDoctorCheckId =
  | 'runtime.state'
  | 'protocol.compatibility'
  | 'database.integrity'
  | 'jobs.engine'
  | 'recovery.health'
  | 'offline.execution'
  | 'security.boundary'
  | 'workspace.availability'
  | 'git.runtime';

export interface EnvironmentDoctorCheck {
  readonly id: EnvironmentDoctorCheckId;
  readonly status: EnvironmentDoctorStatus;
  readonly title: string;
  readonly detail: string;
  readonly remediation: string | null;
}

export interface EnvironmentDoctorRuntimeInfo {
  readonly product: 'github-decrypter';
  readonly build: number;
  readonly version: string;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly protocol: 'gd-protocol/1';
  readonly state: string;
}

export interface EnvironmentDoctorSummary {
  readonly pass: number;
  readonly warning: number;
  readonly fail: number;
  readonly unknown: number;
  readonly ready: boolean;
}

export interface EnvironmentDoctorReport {
  readonly schema: typeof ENVIRONMENT_DOCTOR_SCHEMA;
  readonly build: typeof ENVIRONMENT_DOCTOR_BUILD;
  readonly generatedAt: string;
  readonly source: 'local-runtime';
  readonly runtime: EnvironmentDoctorRuntimeInfo;
  readonly checks: readonly EnvironmentDoctorCheck[];
  readonly summary: EnvironmentDoctorSummary;
  readonly readOnly: true;
  readonly metadataOnly: true;
}

const CHECK_IDS = new Set<EnvironmentDoctorCheckId>([
  'runtime.state',
  'protocol.compatibility',
  'database.integrity',
  'jobs.engine',
  'recovery.health',
  'offline.execution',
  'security.boundary',
  'workspace.availability',
  'git.runtime',
]);
const CHECK_STATUSES = new Set<EnvironmentDoctorStatus>(['pass', 'warning', 'fail', 'unknown']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isEnvironmentDoctorReport(value: unknown): value is EnvironmentDoctorReport {
  if (!isRecord(value) || value.schema !== ENVIRONMENT_DOCTOR_SCHEMA || value.build !== ENVIRONMENT_DOCTOR_BUILD) return false;
  if (typeof value.generatedAt !== 'string' || value.source !== 'local-runtime') return false;
  if (value.readOnly !== true || value.metadataOnly !== true) return false;
  if (!isRecord(value.runtime)) return false;
  const runtime = value.runtime;
  if (runtime.product !== 'github-decrypter' || typeof runtime.build !== 'number' || !Number.isSafeInteger(runtime.build)) return false;
  if (typeof runtime.version !== 'string' || typeof runtime.nodeVersion !== 'string') return false;
  if (typeof runtime.platform !== 'string' || typeof runtime.arch !== 'string') return false;
  if (runtime.protocol !== 'gd-protocol/1' || typeof runtime.state !== 'string') return false;
  if (!Array.isArray(value.checks) || !value.checks.every((check) => {
    if (!isRecord(check)) return false;
    return typeof check.id === 'string' && CHECK_IDS.has(check.id as EnvironmentDoctorCheckId)
      && typeof check.status === 'string' && CHECK_STATUSES.has(check.status as EnvironmentDoctorStatus)
      && typeof check.title === 'string'
      && typeof check.detail === 'string'
      && (check.remediation === null || typeof check.remediation === 'string');
  })) return false;
  if (!isRecord(value.summary)) return false;
  const summary = value.summary;
  return ['pass', 'warning', 'fail', 'unknown'].every((key) => typeof summary[key] === 'number' && Number.isSafeInteger(summary[key]) && summary[key] >= 0)
    && typeof summary.ready === 'boolean';
}

export function assertEnvironmentDoctorReport(value: unknown): asserts value is EnvironmentDoctorReport {
  if (!isEnvironmentDoctorReport(value)) throw new TypeError('Environment Doctor report is invalid.');
}
