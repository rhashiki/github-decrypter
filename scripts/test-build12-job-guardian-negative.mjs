import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-jobs.mjs');

function runExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Job Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code} was not reported.\n${result.stdout}\n${result.stderr}`);
}

const studioProbe = path.join(root, 'apps/studio/src/__job_guardian_probe.ts');
try {
  fs.writeFileSync(studioProbe, "export const leakedJobTable = 'gd_jobs';\n");
  runExpecting('AG101');
} finally {
  fs.rmSync(studioProbe, { force: true });
}

const enginePath = path.join(root, 'apps/local/src/job-engine.ts');
const engineOriginal = fs.readFileSync(enginePath, 'utf8');
try {
  fs.writeFileSync(enginePath, `${engineOriginal}\nexport const recoverExpiredLeases = () => undefined;\n`);
  runExpecting('AG102');
} finally {
  fs.writeFileSync(enginePath, engineOriginal);
}

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const prematureJobsRoute = '/v1/jobs';\n`);
  runExpecting('AG103');
} finally {
  fs.writeFileSync(serverPath, serverOriginal);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Job Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build12-job-guardian-negative/1',
  rejected: ['AG101', 'AG102', 'AG103'],
  restoredTreePasses: true,
}, null, 2));
