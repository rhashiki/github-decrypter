import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.jobsCenterAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 47 || rule.minimumBuild !== 47 || policy.phaseGates?.jobsCenterBuild !== 47
  || rule.ownerRoot !== 'apps/local' || rule.studioOwnerRoot !== 'apps/studio'
  || rule.contractPackage !== '@github-decrypter/protocol'
  || rule.protocolSource !== 'packages/protocol/src/jobs-center.ts'
  || rule.runtimeSource !== 'apps/local/src/jobs-center.ts'
  || rule.studioClient !== 'apps/studio/src/jobs-center-client.ts'
  || rule.studioSurface !== 'apps/studio/src/JobsCenter.tsx'
) {
  violations.push({ code: 'AG450', message: 'Build 47 Jobs Center authority is missing or inactive.' });
} else {
  const contract = read('packages/protocol/src/jobs-center.ts');
  const protocolIndex = read('packages/protocol/src/index.ts');
  for (const marker of [
    'JOBS_CENTER_BUILD = 47',
    "JOBS_CENTER_JOB_SCHEMA = 'gd-jobs-center-job/1'",
    "JOBS_CENTER_LIST_SCHEMA = 'gd-jobs-center-list/1'",
    "JOBS_CENTER_DETAIL_SCHEMA = 'gd-jobs-center-detail/1'",
    "JOBS_CENTER_CONTROL_RESULT_SCHEMA = 'gd-jobs-center-control-result/1'",
    "JOBS_CENTER_ACTIONS = ['pause', 'resume', 'cancel', 'retry']",
    'assertJobsCenterListView',
    'assertJobsCenterDetailView',
    'assertJobsCenterControlResult',
  ]) if (!contract.includes(marker)) violations.push({ code: 'AG451', message: 'Jobs Center protocol contract is incomplete.', detail: marker });
  if (!protocolIndex.includes("export * from './jobs-center.js'")) violations.push({ code: 'AG451', message: 'Jobs Center contract is not exported by @github-decrypter/protocol.' });
  if (/\bnode:|\bwindow\b|\bdocument\b|\bfetch\s*\(|https?:\/\//.test(contract)) {
    violations.push({ code: 'AG451', message: 'Jobs Center protocol contract is not environment-neutral.' });
  }

  const runtime = read('apps/local/src/jobs-center.ts');
  for (const marker of [
    'JOBS_CENTER_RUNTIME_BUILD = 47',
    'class JobsCenter',
    'this.#jobs.summary()',
    'this.#jobs.listJobs()',
    'this.#jobs.listDependencies(id)',
    'this.#jobs.listTransitions(id)',
    "case 'pause'",
    'this.#jobs.requestPause',
    "case 'resume'",
    'this.#jobs.resume',
    "case 'cancel'",
    'this.#jobs.requestCancel',
    "case 'retry'",
    'this.#jobs.retry',
  ]) if (!runtime.includes(marker)) violations.push({ code: 'AG452', message: 'Jobs Center runtime projection/control contract is incomplete.', detail: marker });
  if (/\.enqueue\s*\(|\.skip\s*\(|\.setPriority\s*\(|\.claimNext\s*\(|\.complete\s*\(|\.fail\s*\(|\.checkpoint\s*\(|\.wait\s*\(/.test(runtime)) {
    violations.push({ code: 'AG452', message: 'Jobs Center gained a non-authorized Durable Job mutation.' });
  }

  const daemon = read('apps/local/src/daemon.ts');
  const engine = read('apps/local/src/job-engine.ts');
  if (!daemon.includes('createJobsCenter({ jobs: this.#jobs })') || !daemon.includes('get jobsCenter(): JobsCenter')) {
    violations.push({ code: 'AG453', message: 'Jobs Center is not composed over the sovereign Durable Job Engine instance.' });
  }
  if (rule.durableJobEngineBuild !== 12 || rule.durableJobEngineSovereign !== true || rule.schedulerAuthority !== false
      || rule.enqueue !== false || rule.skip !== false || rule.priorityMutation !== false
      || !engine.includes('export class DurableJobEngine')) {
    violations.push({ code: 'AG453', message: 'Build 47 duplicated or weakened Durable Job Engine scheduling authority.' });
  }

  const server = read('apps/local/src/server.ts');
  const client = read('apps/studio/src/jobs-center-client.ts');
  for (const marker of [
    "url.pathname === '/v1/jobs'",
    'handleJobsCenter(',
    'jobsCenterJobId(',
    'applyJobsCenterCors',
    "request.headers['x-github-decrypter-client'] === JOBS_CENTER_CLIENT_HEADER",
    "response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')",
    "response.setHeader('access-control-allow-headers', 'Accept, Content-Type, X-GitHub-Decrypter-Client')",
  ]) if (!server.includes(marker)) violations.push({ code: 'AG454', message: 'Jobs Center loopback HTTP boundary is incomplete.', detail: marker });
  if (/\/v1\/jobs\/enqueue|\/v1\/jobs\/[^'"`]+\/skip|set-priority|priority\/control/i.test(server)) {
    violations.push({ code: 'AG454', message: 'Jobs Center HTTP surface exposes a forbidden scheduling/mutation route.' });
  }
  for (const marker of [
    "JOBS_CENTER_ENDPOINT = 'http://127.0.0.1:43110/v1/jobs'",
    "'x-github-decrypter-client': JOBS_CENTER_CLIENT_ID",
    "credentials: 'omit'",
    "cache: 'no-store'",
    "redirect: 'error'",
    "targetAddressSpace: 'loopback'",
  ]) if (!client.includes(marker)) violations.push({ code: 'AG454', message: 'Studio Jobs Center client is not tightly loopback-scoped.', detail: marker });
  if (/access-control-allow-origin['"\s,)]*,?\s*['"]\*['"]/i.test(server) || /access-control-allow-credentials/i.test(server)) {
    violations.push({ code: 'AG454', message: 'Jobs Center CORS must not use wildcard origins or credentials.' });
  }

  const surface = read('apps/studio/src/JobsCenter.tsx');
  const app = read('apps/studio/src/App.tsx');
  for (const marker of [
    '<h1 id="jobs-center-title">Jobs Center</h1>',
    'requestJobsCenterList()',
    'requestJobsCenterDetail',
    'requestJobsCenterControl',
    "loading ? 'Refreshing…' : 'Refresh'",
    'detail.job.allowedActions.map',
    'No lifecycle controls available.',
  ]) if (!surface.includes(marker)) violations.push({ code: 'AG455', message: 'Jobs Center Studio surface is incomplete.', detail: marker });
  if (!app.includes("onClick={() => setWorkspaceSurface('jobs')}") || !app.includes("workspaceSurface === 'jobs'") || !app.includes('<JobsCenter />')) {
    violations.push({ code: 'AG455', message: 'Jobs Center is not behind explicit Studio navigation.' });
  }
  if (/setInterval\s*\(|WebSocket\s*\(|EventSource\s*\(/.test([surface, client].join('\n')) || rule.backgroundPolling !== false) {
    violations.push({ code: 'AG455', message: 'Jobs Center introduced background polling or streaming authority.' });
  }

  for (const [key, expected] of Object.entries({
    safeProjectionOnly: true,
    payloadExposed: false,
    checkpointContentExposed: false,
    resultContentExposed: false,
    errorContentExposed: false,
    workerIdentityExposed: false,
    leaseTokenExposed: false,
    loopbackOnly: true,
    corsLoopbackOnly: true,
    credentials: false,
    genericLocalRuntimeTransport: false,
    externalTransport: false,
    externalNetworkAuthority: false,
  })) if (rule[key] !== expected) violations.push({ code: 'AG456', message: 'Jobs Center safety projection/transport policy drifted.', detail: key });
  if (/payload\s*:\s*job\.payload|checkpoint\s*:\s*job\.checkpoint|result\s*:\s*job\.result|error\s*:\s*job\.error|workerId\s*:\s*job\.workerId|leaseToken\s*:\s*/.test(runtime)) {
    violations.push({ code: 'AG456', message: 'Jobs Center projection exposes sensitive Durable Job internals.' });
  }

  const rootPackage = json('package.json');
  const studioPackage = json('apps/studio/package.json');
  const localPackage = json('apps/local/package.json');
  const studioContext = read('apps/studio/src/studio-context.ts');
  const localIdentity = read('apps/local/src/identity.ts');
  const vite = read('apps/studio/vite.config.ts');
  const exceptions = policy.appRules?.['@github-decrypter/studio']?.sourcePatternExceptions?.['\\bfetch\\s*\\('];
  if (
    versionBuild(rootPackage.version) !== 47 || versionBuild(studioPackage.version) !== 47 || versionBuild(localPackage.version) !== 47
    || !studioContext.includes('STUDIO_BUILD = 47') || !studioContext.includes("STUDIO_VERSION = '0.0.47'")
    || !localIdentity.includes('LOCAL_RUNTIME_BUILD = 47') || !localIdentity.includes("LOCAL_RUNTIME_VERSION = '0.0.47'")
    || !vite.includes('PWA_CACHE_NAME = `${PWA_CACHE_PREFIX}v47`')
    || JSON.stringify(exceptions) !== JSON.stringify(['apps/studio/src/environment-doctor-client.ts','apps/studio/src/jobs-center-client.ts'])
  ) violations.push({ code: 'AG457', message: 'Build 47 root/Studio/Local/PWA identity or fetch allowlist is inconsistent.' });

  for (const required of [
    'packages/protocol/src/jobs-center.ts',
    'apps/local/src/jobs-center.ts',
    'apps/studio/src/jobs-center-client.ts',
    'apps/studio/src/JobsCenter.tsx',
    'docs/architecture/JOBS_CENTER.md',
    'docs/builds/BUILD_47_JOBS_CENTER.md',
    'scripts/architecture-guardian-jobs-center.mjs',
    'scripts/test-build47-jobs-center.mjs',
    'scripts/test-build47-jobs-center-runtime.ts',
    'scripts/test-build47-jobs-center-guardian-negative.mjs',
    'scripts/tsconfig.build47-tests.json',
    '.github/workflows/build47-jobs-center.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG458', message: 'Required Build 47 artifact is missing.', detail: required });

  const architectureDoc = read('docs/architecture/JOBS_CENTER.md');
  const buildDoc = read('docs/builds/BUILD_47_JOBS_CENTER.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!architectureDoc.includes('Build 12') || !architectureDoc.includes('Build 48 — Plan Authority')
      || !architectureDoc.includes('pause, resume, cancel and retry')
      || !buildDoc.includes('Build 48 — Plan Authority')
      || !roadmap.includes('48. **Plan Authority**')) {
    violations.push({ code: 'AG459', message: 'Build 47 documentation does not preserve Durable Job sovereignty or downstream Plan Authority ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-jobs-center-report/1',
  currentBuild: policy.currentBuild,
  listSchema: rule?.listSchema ?? null,
  detailSchema: rule?.detailSchema ?? null,
  controlResultSchema: rule?.controlResultSchema ?? null,
  allowedActions: rule?.allowedActions ?? null,
  schedulerAuthority: rule?.schedulerAuthority ?? null,
  safeProjectionOnly: rule?.safeProjectionOnly ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
