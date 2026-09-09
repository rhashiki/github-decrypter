import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const patch = (value) => Number(/^0\.0\.(\d+)$/.exec(String(value ?? ''))?.[1] ?? NaN);
const assertBuildAtLeast = (value, minimum, maximum, label) => {
  const build = patch(value);
  assert.ok(Number.isInteger(build) && build >= minimum && build <= maximum, `${label} must remain within Build ${minimum}..${maximum}.`);
};

const policy = json('architecture.guardian.json');
const rule = policy.jobsCenterAuthority;
const rootPackage = json('package.json');
const studioPackage = json('apps/studio/package.json');
const localPackage = json('apps/local/package.json');
const contract = read('packages/protocol/src/jobs-center.ts');
const runtime = read('apps/local/src/jobs-center.ts');
const daemon = read('apps/local/src/daemon.ts');
const server = read('apps/local/src/server.ts');
const client = read('apps/studio/src/jobs-center-client.ts');
const surface = read('apps/studio/src/JobsCenter.tsx');
const app = read('apps/studio/src/App.tsx');

assert.ok(policy.currentBuild >= 47);
assert.equal(policy.phaseGates.jobsCenterBuild, 47);
assert.equal(rule.minimumBuild, 47);
assert.equal(rule.durableJobEngineBuild, 12);
assert.equal(rule.durableJobEngineSovereign, true);
assert.equal(rule.schedulerAuthority, false);
assert.deepEqual(rule.allowedActions, ['pause','resume','cancel','retry']);
assert.equal(rule.enqueue, false);
assert.equal(rule.skip, false);
assert.equal(rule.priorityMutation, false);
assert.equal(rule.safeProjectionOnly, true);
assert.equal(rule.payloadExposed, false);
assert.equal(rule.checkpointContentExposed, false);
assert.equal(rule.resultContentExposed, false);
assert.equal(rule.errorContentExposed, false);
assert.equal(rule.workerIdentityExposed, false);
assert.equal(rule.leaseTokenExposed, false);
assert.equal(rule.loopbackOnly, true);
assert.equal(rule.backgroundPolling, false);
assert.equal(rule.genericLocalRuntimeTransport, false);
assert.equal(rule.externalNetworkAuthority, false);

assertBuildAtLeast(rootPackage.version, 47, policy.currentBuild, 'Root package');
assertBuildAtLeast(studioPackage.version, 47, policy.currentBuild, 'Studio package');
assertBuildAtLeast(localPackage.version, 47, policy.currentBuild, 'Local package');
assert.ok(rootPackage.scripts.guardian.includes('architecture-guardian-jobs-center.mjs'));
assert.ok(rootPackage.scripts['check:build47']);

for (const marker of [
  'JOBS_CENTER_BUILD = 47',
  "JOBS_CENTER_LIST_SCHEMA = 'gd-jobs-center-list/1'",
  "JOBS_CENTER_DETAIL_SCHEMA = 'gd-jobs-center-detail/1'",
  "JOBS_CENTER_ACTIONS = ['pause', 'resume', 'cancel', 'retry']",
  'assertJobsCenterListView',
  'assertJobsCenterDetailView',
  'assertJobsCenterControlResult',
]) assert.ok(contract.includes(marker), `Jobs Center protocol marker missing: ${marker}`);
assert.doesNotMatch(contract, /\bnode:|\bfetch\s*\(|https?:\/\//);

for (const marker of [
  'class JobsCenter',
  'this.#jobs.listJobs()',
  'this.#jobs.requestPause',
  'this.#jobs.resume',
  'this.#jobs.requestCancel',
  'this.#jobs.retry',
  'payloadExposed: false',
  'workerIdentityExposed: false',
  'leaseTokenExposed: false',
]) assert.ok(runtime.includes(marker), `Jobs Center runtime marker missing: ${marker}`);
assert.doesNotMatch(runtime, /\.enqueue\s*\(|\.skip\s*\(|\.setPriority\s*\(|\.claimNext\s*\(/);
assert.match(daemon, /createJobsCenter\(\{ jobs: this\.#jobs \}\)/);

for (const marker of [
  "url.pathname === '/v1/jobs'",
  'handleJobsCenter(',
  'applyJobsCenterCors',
  "request.headers['x-github-decrypter-client'] === JOBS_CENTER_CLIENT_HEADER",
  "response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')",
]) assert.ok(server.includes(marker), `Jobs Center server marker missing: ${marker}`);
assert.doesNotMatch(server, /\/v1\/jobs\/enqueue|set-priority/i);

for (const marker of [
  "JOBS_CENTER_ENDPOINT = 'http://127.0.0.1:43110/v1/jobs'",
  "JOBS_CENTER_CLIENT_ID = 'gd-studio-jobs-center/1'",
  "'x-github-decrypter-client': JOBS_CENTER_CLIENT_ID",
  "credentials: 'omit'",
  "targetAddressSpace: 'loopback'",
  'assertJobsCenterListView(payload)',
  'assertJobsCenterDetailView(payload)',
  'assertJobsCenterControlResult(payload)',
]) assert.ok(client.includes(marker), `Jobs Center client marker missing: ${marker}`);

for (const marker of [
  '<h1 id="jobs-center-title">Jobs Center</h1>',
  "loading ? 'Refreshing…' : 'Refresh'",
  'detail.job.allowedActions.map',
  'No lifecycle controls available.',
]) assert.ok(surface.includes(marker), `Jobs Center UI marker missing: ${marker}`);
assert.doesNotMatch(surface, /setInterval\s*\(|WebSocket\s*\(|EventSource\s*\(/);
assert.match(app, /onClick=\{\(\) => setWorkspaceSurface\('jobs'\)\}/);
assert.match(app, /workspaceSurface === 'jobs'/);
assert.match(app, /<JobsCenter \/>/);

assert.deepEqual(
  policy.appRules['@github-decrypter/studio'].sourcePatternExceptions['\\bfetch\\s*\\('],
  ['apps/studio/src/environment-doctor-client.ts','apps/studio/src/jobs-center-client.ts'],
);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build47-jobs-center-static/1',
  build: 47,
  currentBuild: policy.currentBuild,
  durableJobEngineBuild: 12,
  allowedActions: rule.allowedActions,
  safeProjectionOnly: true,
  loopbackOnly: true,
  backgroundPolling: false,
  genericLocalRuntimeTransport: false,
}, null, 2));
