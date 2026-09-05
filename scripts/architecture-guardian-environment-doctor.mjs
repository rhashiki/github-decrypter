import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const policy = JSON.parse(read('architecture.guardian.json'));
const rule = policy.environmentDoctorAuthority;
const violations = [];

if (!rule || policy.currentBuild < 32 || rule.minimumBuild !== 32 || policy.phaseGates?.environmentDoctorBuild !== 32) {
  violations.push({ code: 'AG300', message: 'Build 32 Environment Doctor authority is missing or inactive.' });
} else {
  const contract = read('packages/protocol/src/environment-doctor.ts');
  const protocolIndex = read('packages/protocol/src/index.ts');
  for (const marker of [
    'ENVIRONMENT_DOCTOR_BUILD = 32',
    "ENVIRONMENT_DOCTOR_SCHEMA = 'gd-environment-doctor/1'",
    'EnvironmentDoctorReport',
    'EnvironmentDoctorCheck',
    'isEnvironmentDoctorReport',
    'assertEnvironmentDoctorReport',
    "readOnly: true",
    "metadataOnly: true",
  ]) if (!contract.includes(marker)) violations.push({ code: 'AG301', message: 'Environment Doctor protocol contract is incomplete.', detail: marker });
  if (!protocolIndex.includes("export * from './environment-doctor.js'")) violations.push({ code: 'AG301', message: 'Environment Doctor contract is not exported by @github-decrypter/protocol.' });
  if (/\bnode:|\bwindow\b|\bdocument\b|\bfetch\s*\(|https?:\/\//.test(contract)) {
    violations.push({ code: 'AG301', message: 'Environment Doctor protocol contract is not environment-neutral.' });
  }

  const runtime = read('apps/local/src/environment-doctor.ts');
  const server = read('apps/local/src/server.ts');
  for (const marker of [
    'buildEnvironmentDoctorReport',
    "'runtime.state'",
    "'protocol.compatibility'",
    "'database.integrity'",
    "'jobs.engine'",
    "'recovery.health'",
    "'offline.execution'",
    "'security.boundary'",
    "'workspace.availability'",
    "'git.runtime'",
    'metadataOnly: true',
    'readOnly: true',
  ]) if (!runtime.includes(marker)) violations.push({ code: 'AG302', message: 'Local Runtime diagnostic report is incomplete.', detail: marker });
  if (!server.includes("url.pathname === '/v1/environment-doctor'")) violations.push({ code: 'AG302', message: 'Environment Doctor endpoint is missing.' });
  if (!server.includes('buildEnvironmentDoctorReport(health, context.now())')) violations.push({ code: 'AG302', message: 'Environment Doctor endpoint does not derive its response from runtime health metadata.' });
  if (/readonly\s+(?:path|token|secret|credential|workspaceRoot|databasePath)\b/i.test(contract)) {
    violations.push({ code: 'AG302', message: 'Environment Doctor response contract exposes sensitive or project-local metadata.' });
  }

  const client = read('apps/studio/src/environment-doctor-client.ts');
  const surface = read('apps/studio/src/EnvironmentDoctor.tsx');
  const app = read('apps/studio/src/App.tsx');
  for (const marker of [
    "ENVIRONMENT_DOCTOR_ENDPOINT = 'http://127.0.0.1:43110/v1/environment-doctor'",
    "credentials: 'omit'",
    "cache: 'no-store'",
    "redirect: 'error'",
    "targetAddressSpace: 'loopback'",
    'ENVIRONMENT_DOCTOR_TIMEOUT_MS = 3000',
  ]) if (!client.includes(marker)) violations.push({ code: 'AG303', message: 'Studio Environment Doctor client is not tightly loopback-scoped.', detail: marker });
  for (const marker of [
    "checking ? 'Checking Local Runtime…' : 'Check Local Runtime'",
    'onClick={() => void runCheck()}',
    'Continue without checking',
    'requestEnvironmentDoctorReport()',
  ]) if (!surface.includes(marker)) violations.push({ code: 'AG303', message: 'Environment Doctor must remain explicitly user initiated.', detail: marker });
  if (/\buseEffect\b|setInterval\s*\(|setTimeout\s*\([^,]+,\s*0\)/.test(surface)) violations.push({ code: 'AG303', message: 'Environment Doctor introduced an automatic/background diagnostic probe.' });

  for (const marker of [
    '<EnvironmentDoctor\n              onOutcome={setEnvironmentDoctorOutcome}',
    'Environment Doctor',
    'environmentDoctorComplete',
    'environmentDoctorOutcome',
    "Local Runtime: {runtimeStatusLabel(environmentDoctorOutcome)}",
  ]) if (!app.includes(marker)) violations.push({ code: 'AG304', message: 'Studio Environment Doctor flow is incomplete.', detail: marker });
  const css = read('apps/studio/src/styles.css');
  for (const marker of ['.studio-doctor', '.studio-doctor-grid', '.studio-doctor-actions', '.studio-doctor-checks']) {
    if (!css.includes(marker)) violations.push({ code: 'AG304', message: 'Environment Doctor UI styling is incomplete.', detail: marker });
  }

  const doctorSurface = [runtime, client, surface].join('\n');
  if (/\b(?:spawn|exec|execFile|writeFile|appendFile|unlink|rm|rename|mkdir|chmod|chown)\s*\(/.test(doctorSurface)) {
    violations.push({ code: 'AG305', message: 'Environment Doctor gained repair, shell or filesystem mutation authority.' });
  }
  if (/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/.test([client, surface, app].join('\n'))) {
    violations.push({ code: 'AG305', message: 'Environment Doctor state must remain memory-only.' });
  }
  if (rule.readOnly !== true || rule.metadataOnly !== true || rule.responsePersistence !== false || rule.autoRepair !== false || rule.shellExecution !== false || rule.filesystemMutation !== false) {
    violations.push({ code: 'AG305', message: 'Machine policy allowed Environment Doctor to mutate or persist state.' });
  }

  for (const marker of [
    'isAllowedEnvironmentDoctorOrigin',
    "parsed.hostname === '127.0.0.1'",
    "parsed.hostname === 'localhost'",
    "response.setHeader('access-control-allow-origin', origin)",
    "response.setHeader('access-control-allow-methods', 'GET, OPTIONS')",
  ]) if (!server.includes(marker)) violations.push({ code: 'AG306', message: 'Environment Doctor CORS boundary is incomplete.', detail: marker });
  if (/access-control-allow-origin['"\s,)]*,?\s*['"]\*['"]/i.test(server) || /access-control-allow-credentials/i.test(server)) {
    violations.push({ code: 'AG306', message: 'Environment Doctor CORS must not use wildcard origins or credentials.' });
  }
  const exception = policy.appRules?.['@github-decrypter/studio']?.sourcePatternExceptions?.['\\bfetch\\s*\\('];
  if (JSON.stringify(exception) !== JSON.stringify(['apps/studio/src/environment-doctor-client.ts'])) {
    violations.push({ code: 'AG306', message: 'Studio fetch exception is broader than the Environment Doctor client.' });
  }

  if (
    rule.aiProviderBuild !== 33 || rule.runtimeInstallerBuild !== 119 || rule.pwaProductionPackagingBuild !== 122
    || rule.aiExecution !== false || rule.externalNetworkAuthority !== false || rule.genericLocalRuntimeTransport !== false
    || /@github-decrypter\/ai|\bollama\b|\bvllm\b|\bmodel manager\b/i.test(doctorSurface)
  ) violations.push({ code: 'AG307', message: 'Build 32 crossed into AI, installer or generic runtime transport authority.' });

  let rootPackage = null;
  let studioPackage = null;
  let localPackage = null;
  try { rootPackage = JSON.parse(read('package.json')); } catch {}
  try { studioPackage = JSON.parse(read('apps/studio/package.json')); } catch {}
  try { localPackage = JSON.parse(read('apps/local/package.json')); } catch {}
  const identity = read('apps/studio/src/index.ts');
  const studioContext = read('apps/studio/src/studio-context.ts');
  const localIdentity = read('apps/local/src/identity.ts');
  const vite = read('apps/studio/vite.config.ts');
  if (
    rootPackage?.version !== '0.0.32' || studioPackage?.version !== '0.0.32' || localPackage?.version !== '0.0.32'
    || !studioContext.includes('STUDIO_BUILD = 32') || !studioContext.includes("STUDIO_VERSION = '0.0.32'")
    || !localIdentity.includes('LOCAL_RUNTIME_BUILD = 32') || !localIdentity.includes("LOCAL_RUNTIME_VERSION = '0.0.32'")
    || !identity.includes('environmentDoctorBuild: ENVIRONMENT_DOCTOR_BUILD')
    || !identity.includes('diagnosticLocalRuntimeTransport: true')
    || !identity.includes('genericLocalRuntimeTransport: false')
    || !vite.includes("PWA_CACHE_NAME = `${PWA_CACHE_PREFIX}v32`")
    || policy.studioAuthority?.environmentDoctor !== true
    || policy.studioAuthority?.diagnosticLocalRuntimeTransport !== true
    || policy.studioAuthority?.genericLocalRuntimeTransport !== false
  ) violations.push({ code: 'AG308', message: 'Build 32 identity/version/PWA/Studio integration is inconsistent.' });

  for (const required of [
    'packages/protocol/src/environment-doctor.ts',
    'apps/local/src/environment-doctor.ts',
    'apps/studio/src/environment-doctor-client.ts',
    'apps/studio/src/EnvironmentDoctor.tsx',
    'docs/architecture/ENVIRONMENT_DOCTOR.md',
    'docs/builds/BUILD_32_ENVIRONMENT_DOCTOR.md',
    'scripts/architecture-guardian-environment-doctor.mjs',
    'scripts/test-build32-environment-doctor.mjs',
    'scripts/test-build32-environment-doctor-runtime.ts',
    'scripts/test-build32-environment-doctor-dist.mjs',
    'scripts/test-build32-environment-doctor-guardian-negative.mjs',
    'scripts/tsconfig.build32-tests.json',
    '.github/workflows/build32-environment-doctor.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG309', message: 'Required Build 32 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-environment-doctor-report/2',
  currentBuild: policy.currentBuild,
  doctorSchema: rule?.schema ?? null,
  endpoint: rule?.endpoint ?? null,
  userInitiated: rule?.userInitiated ?? null,
  readOnly: rule?.readOnly ?? null,
  metadataOnly: rule?.metadataOnly ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
