import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));

const policy = json('architecture.guardian.json');
const contract = read('packages/protocol/src/environment-doctor.ts');
const runtime = read('apps/local/src/environment-doctor.ts');
const server = read('apps/local/src/server.ts');
const client = read('apps/studio/src/environment-doctor-client.ts');
const surface = read('apps/studio/src/EnvironmentDoctor.tsx');
const app = read('apps/studio/src/App.tsx');

assert.equal(policy.currentBuild, 32);
assert.equal(policy.phaseGates.environmentDoctorBuild, 32);
assert.equal(policy.environmentDoctorAuthority.minimumBuild, 32);
assert.equal(policy.environmentDoctorAuthority.schema, 'gd-environment-doctor/1');
assert.equal(policy.environmentDoctorAuthority.userInitiated, true);
assert.equal(policy.environmentDoctorAuthority.readOnly, true);
assert.equal(policy.environmentDoctorAuthority.metadataOnly, true);
assert.equal(policy.environmentDoctorAuthority.responsePersistence, false);
assert.equal(policy.environmentDoctorAuthority.autoRepair, false);
assert.equal(policy.environmentDoctorAuthority.genericLocalRuntimeTransport, false);
assert.equal(policy.environmentDoctorAuthority.externalNetworkAuthority, false);

assert.match(contract, /ENVIRONMENT_DOCTOR_BUILD = 32/);
assert.match(contract, /gd-environment-doctor\/1/);
assert.match(contract, /assertEnvironmentDoctorReport/);
assert.doesNotMatch(contract, /node:|\bfetch\s*\(|https?:\/\//);

assert.match(runtime, /buildEnvironmentDoctorReport/);
assert.match(runtime, /database\.integrity/);
assert.match(runtime, /security\.boundary/);
assert.match(runtime, /workspace\.availability/);
assert.match(runtime, /git\.runtime/);
assert.match(server, /\/v1\/environment-doctor/);
assert.match(server, /GET.*OPTIONS|OPTIONS.*GET/s);
assert.match(server, /access-control-allow-origin/);
assert.doesNotMatch(server, /access-control-allow-credentials/i);

assert.match(client, /http:\/\/127\.0\.0\.1:43110\/v1\/environment-doctor/);
assert.match(client, /credentials: 'omit'/);
assert.match(client, /targetAddressSpace: 'loopback'/);
assert.match(client, /ENVIRONMENT_DOCTOR_TIMEOUT_MS = 3000/);
assert.match(surface, /Check Local Runtime/);
assert.match(surface, /Continue without checking/);
assert.doesNotMatch(surface, /\buseEffect\b|setInterval\s*\(/);
assert.match(app, /<EnvironmentDoctor/);
assert.match(app, /environmentDoctorComplete/);
assert.match(app, /environmentDoctorOutcome/);

assert.deepEqual(
  policy.appRules['@github-decrypter/studio'].sourcePatternExceptions['\\bfetch\\s*\\('],
  ['apps/studio/src/environment-doctor-client.ts'],
);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build32-environment-doctor-static/1',
  build: 32,
  doctorSchema: 'gd-environment-doctor/1',
  endpoint: policy.environmentDoctorAuthority.endpoint,
  userInitiated: true,
  readOnly: true,
  metadataOnly: true,
  genericLocalRuntimeTransport: false,
  externalNetworkAuthority: false,
}, null, 2));
