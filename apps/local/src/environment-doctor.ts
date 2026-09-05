import {
  ENVIRONMENT_DOCTOR_BUILD,
  ENVIRONMENT_DOCTOR_SCHEMA,
  type EnvironmentDoctorCheck,
  type EnvironmentDoctorReport,
  type EnvironmentDoctorStatus,
} from '@github-decrypter/protocol';

export interface EnvironmentDoctorSnapshot {
  readonly build: number;
  readonly version: string;
  readonly state: string;
  readonly protocol: 'gd-protocol/1';
  readonly database: null | { readonly open: boolean; readonly integrity: 'ok' };
  readonly jobs: { readonly ready: boolean; readonly expiredLeases: number };
  readonly recovery: { readonly ready: boolean; readonly healthy: boolean };
  readonly offline: { readonly ready: boolean; readonly connectivity: string; readonly localExecutionAvailable: true };
  readonly capabilities: { readonly ready: boolean; readonly denyByDefault: true; readonly secretsVaultReady: boolean };
  readonly audit: { readonly ready: boolean; readonly integrity: 'ok' | 'unchecked' };
  readonly workspaces: { readonly ready: boolean; readonly registered: number; readonly available: number };
  readonly projectDetection: { readonly ready: boolean };
  readonly git: { readonly ready: boolean; readonly available: boolean; readonly version: string | null };
  readonly changeTracking: { readonly ready: boolean };
}

function check(
  id: EnvironmentDoctorCheck['id'],
  status: EnvironmentDoctorStatus,
  title: string,
  detail: string,
  remediation: string | null = null,
): EnvironmentDoctorCheck {
  return Object.freeze({ id, status, title, detail, remediation });
}

function summarize(checks: readonly EnvironmentDoctorCheck[]): EnvironmentDoctorReport['summary'] {
  const counts = { pass: 0, warning: 0, fail: 0, unknown: 0 };
  for (const item of checks) counts[item.status] += 1;
  return Object.freeze({ ...counts, ready: counts.fail === 0 && counts.unknown === 0 });
}

export function buildEnvironmentDoctorReport(snapshot: EnvironmentDoctorSnapshot, generatedAt: string): EnvironmentDoctorReport {
  const securityReady = snapshot.capabilities.ready
    && snapshot.capabilities.denyByDefault
    && snapshot.capabilities.secretsVaultReady
    && snapshot.audit.ready
    && snapshot.audit.integrity === 'ok';
  const workspaceStatus: EnvironmentDoctorStatus = !snapshot.workspaces.ready || !snapshot.projectDetection.ready
    ? 'fail'
    : snapshot.workspaces.registered === 0
      ? 'warning'
      : snapshot.workspaces.available === 0
        ? 'warning'
        : 'pass';
  const offlineStatus: EnvironmentDoctorStatus = !snapshot.offline.ready
    ? 'fail'
    : snapshot.offline.connectivity === 'offline' || snapshot.offline.connectivity === 'unknown'
      ? 'warning'
      : 'pass';

  const checks = Object.freeze([
    check(
      'runtime.state',
      snapshot.state === 'running' ? 'pass' : 'fail',
      'Local Runtime',
      snapshot.state === 'running' ? 'The Local Runtime is running.' : `The Local Runtime state is ${snapshot.state}.`,
      snapshot.state === 'running' ? null : 'Restart the GitHub Decrypter Local Runtime and run the check again.',
    ),
    check(
      'protocol.compatibility',
      snapshot.protocol === 'gd-protocol/1' ? 'pass' : 'fail',
      'Shared protocol',
      snapshot.protocol === 'gd-protocol/1' ? 'Studio and Local Runtime use the supported protocol family.' : 'The Local Runtime protocol is not supported by this Studio.',
      snapshot.protocol === 'gd-protocol/1' ? null : 'Update the GitHub Decrypter components so Studio and Local Runtime use compatible versions.',
    ),
    check(
      'database.integrity',
      snapshot.database?.open === true && snapshot.database.integrity === 'ok' ? 'pass' : 'fail',
      'Local database',
      snapshot.database?.open === true && snapshot.database.integrity === 'ok' ? 'The local database is open and passed integrity checks.' : 'The local database is unavailable or failed integrity checks.',
      snapshot.database?.open === true && snapshot.database.integrity === 'ok' ? null : 'Restart the Local Runtime. If the problem remains, use the later recovery tooling rather than editing the database manually.',
    ),
    check(
      'jobs.engine',
      snapshot.jobs.ready && snapshot.jobs.expiredLeases === 0 ? 'pass' : snapshot.jobs.ready ? 'warning' : 'fail',
      'Durable jobs',
      snapshot.jobs.ready ? (snapshot.jobs.expiredLeases === 0 ? 'The durable job engine is ready.' : `${snapshot.jobs.expiredLeases} expired lease(s) are awaiting recovery.`) : 'The durable job engine is not ready.',
      snapshot.jobs.ready && snapshot.jobs.expiredLeases === 0 ? null : 'Allow Local Runtime recovery to reconcile interrupted jobs before starting new privileged work.',
    ),
    check(
      'recovery.health',
      snapshot.recovery.ready && snapshot.recovery.healthy ? 'pass' : 'fail',
      'Crash recovery',
      snapshot.recovery.ready && snapshot.recovery.healthy ? 'Recovery state is healthy.' : 'Recovery state is not healthy.',
      snapshot.recovery.ready && snapshot.recovery.healthy ? null : 'Restart the Local Runtime and review recovery diagnostics before continuing.',
    ),
    check(
      'offline.execution',
      offlineStatus,
      'Offline execution',
      !snapshot.offline.ready
        ? 'Offline execution state is not ready.'
        : snapshot.offline.connectivity === 'online'
          ? 'Local execution is ready and connectivity is marked online.'
          : `Local execution is ready; connectivity is ${snapshot.offline.connectivity}. Remote-dependent work may wait.`,
      offlineStatus === 'fail' ? 'Restart the Local Runtime so offline execution state can initialize.' : null,
    ),
    check(
      'security.boundary',
      securityReady ? 'pass' : 'fail',
      'Security boundary',
      securityReady ? 'Capabilities, Secrets Vault and Audit Ledger are ready with deny-by-default security.' : 'One or more required local security authorities are not ready.',
      securityReady ? null : 'Do not start privileged work until Capability Security, Secrets Vault and Audit Ledger are healthy.',
    ),
    check(
      'workspace.availability',
      workspaceStatus,
      'Workspace readiness',
      !snapshot.workspaces.ready || !snapshot.projectDetection.ready
        ? 'Workspace Manager or Project Detection is not ready.'
        : snapshot.workspaces.registered === 0
          ? 'No local workspace is registered yet.'
          : snapshot.workspaces.available === 0
            ? 'Registered workspaces are currently unavailable.'
            : `${snapshot.workspaces.available} local workspace(s) are available.`,
      workspaceStatus === 'fail'
        ? 'Restart the Local Runtime before opening a workspace.'
        : workspaceStatus === 'warning'
          ? 'Open or register a local project when you are ready to work.'
          : null,
    ),
    check(
      'git.runtime',
      snapshot.git.ready && snapshot.git.available ? 'pass' : 'fail',
      'Git runtime',
      snapshot.git.ready && snapshot.git.available ? `Git is available${snapshot.git.version ? ` (${snapshot.git.version})` : ''}.` : 'Git is not available to the Local Runtime.',
      snapshot.git.ready && snapshot.git.available ? null : 'Install Git or make it available on the Local Runtime PATH, then restart the runtime.',
    ),
  ] satisfies readonly EnvironmentDoctorCheck[]);

  return Object.freeze({
    schema: ENVIRONMENT_DOCTOR_SCHEMA,
    build: ENVIRONMENT_DOCTOR_BUILD,
    generatedAt,
    source: 'local-runtime',
    runtime: Object.freeze({
      product: 'github-decrypter',
      build: snapshot.build,
      version: snapshot.version,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      protocol: snapshot.protocol,
      state: snapshot.state,
    }),
    checks,
    summary: summarize(checks),
    readOnly: true,
    metadataOnly: true,
  });
}
