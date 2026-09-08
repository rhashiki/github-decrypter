import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const guardian = 'scripts/architecture-guardian-jobs-center.mjs';
const runGuardian = () => spawnSync(process.execPath, [guardian], { encoding: 'utf8' });

function probe(path, mutate, expectedCode) {
  const original = fs.readFileSync(path, 'utf8');
  try {
    const changed = mutate(original);
    assert.notEqual(changed, original, `negative probe did not mutate ${path}`);
    fs.writeFileSync(path, changed, 'utf8');
    const result = runGuardian();
    assert.notEqual(result.status, 0, `${expectedCode} negative probe unexpectedly passed`);
    assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(expectedCode));
  } finally {
    fs.writeFileSync(path, original, 'utf8');
  }
}

probe(
  'architecture.guardian.json',
  (source) => source.replace('"schedulerAuthority": false', '"schedulerAuthority": true'),
  'AG453',
);
probe(
  'apps/local/src/jobs-center.ts',
  (source) => `${source}\nvoid (null as any)?.enqueue();\n`,
  'AG452',
);
probe(
  'apps/studio/src/jobs-center-client.ts',
  (source) => source.replace('http://127.0.0.1:43110/v1/jobs', 'https://example.com/v1/jobs'),
  'AG454',
);
probe(
  'apps/local/src/jobs-center.ts',
  (source) => source.replace('payloadExposed: false,', 'payload: job.payload,'),
  'AG456',
);
probe(
  'apps/studio/src/App.tsx',
  (source) => source.replace("onClick={() => setWorkspaceSurface('jobs')}", "onClick={() => setWorkspaceSurface('overview')}"),
  'AG455',
);

const restored = runGuardian();
assert.equal(restored.status, 0, `${restored.stdout}\n${restored.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build47-jobs-center-guardian-negative/1',
  rejected: ['AG453','AG452','AG454','AG456','AG455'],
  restoredTreePasses: true,
}, null, 2));
