import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { assertSafeRepoPath } from '../core/utils.js';

const read = path => fs.readFileSync(path,'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const roadmap = read('docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md');
const benchSource = read('benchmark/decrypterbench-v2.mjs');
const workflow = read('.github/workflows/v2.6-build69-decrypterbench-v2-hardening.yml');
const buildNumber = Number(String(manifest.version).split('.').at(-1));

assert.ok(buildNumber >= 69,`expected Build >=69, received ${manifest.version}`);
assert.equal(pkg.candidate,manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));
assert.ok(settings.includes("DECRYPTER_BENCH_SCHEMA = 'ld-decrypterbench/2'"));
assert.ok(pkg.forbidden_roots.includes('benchmark'));
assert.ok(pkg.forbidden_roots.includes('tests'));
assert.ok(pkg.forbidden_roots.includes('runtime'));
assert.ok(pkg.forbidden_roots.includes('supabase'));
assert.ok(!JSON.stringify(manifest).includes('benchmark/'));
assert.ok(!JSON.stringify(manifest).includes('tests/'));

for (const token of [
  'repo-path-traversal-blocklist',
  'patch-stale-blob',
  'patch-ambiguous-match',
  'scope-strong-human-intent-block',
  'scope-extra-file-block',
  'scope-broad-rewrite-block',
  'undo-preserves-later-manual-outside-hunk',
  'undo-conflict-inside-hunk',
  'local-agent-proposal-digest-tamper',
  'mcp-malicious-endpoints-blocked',
  'mcp-write-ticket-binding-one-shot',
  'continuity-inference-crash-resume',
  'continuity-ambiguous-write-fail-closed',
  'continuity-expired-write-lease-needs-verification',
  'model-router-no-paid-fallback',
  'no-paid-fallback-static-regression',
  'lovable-github-supabase-integration-contract'
]) assert.ok(benchSource.includes(token), token);

for (const attack of ['/etc/passwd','../secret','src/../secret','.GIT/config','C:\\Windows\\system.ini','%2e%2e/secret']) {
  assert.throws(() => assertSafeRepoPath(attack), undefined, attack);
}
assert.equal(assertSafeRepoPath('src/App.tsx'),'src/App.tsx');

const output = execFileSync(process.execPath,['benchmark/decrypterbench-v2.mjs'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const report = JSON.parse(output);
assert.equal(report.schema,'ld-decrypterbench/2');
assert.equal(report.build,69);
assert.equal(report.failed,0,JSON.stringify(report.cases.filter(item=>!item.ok),null,2));
assert.equal(report.passed,report.total);
assert.ok(report.total >= 20,`expected >=20 adversarial cases, received ${report.total}`);
for (const category of ['path-traversal','patch-engine','local-model-outage','scope-creep','undo-redo','approval-tamper','mcp-trust','continuity','zero-cost','e2e-contract']) {
  assert.ok(report.categories[category],`missing DecrypterBench category ${category}`);
  assert.equal(report.categories[category].failed,0,category);
}

assert.match(pkg.notes,/Build69|Build70/);
assert.match(pkg.notes,/DecrypterBench v2 \/ Hardening|Build69 DecrypterBench/i);
assert.match(pkg.notes,/No OTA metadata, GitHub Release or store publication is authorized/);
assert.match(roadmap,/Build 69 — DecrypterBench v2 \/ Hardening ✅/);
assert.match(roadmap,/does not authorize merge to `main`/);

assert.ok(workflow.includes('node benchmark/decrypterbench-v2.mjs'));
assert.ok(workflow.includes('node tests/build69-decrypterbench-v2.test.mjs'));
assert.ok(workflow.includes('node scripts/release-preflight.mjs --candidate'));
for (let build=48; build<=69; build++) assert.ok(workflow.includes(`build${build}`),`workflow missing cumulative Build ${build}`);

console.log(`Build69 DecrypterBench v2 contract OK under successor Build ${buildNumber} · ${report.passed}/${report.total} adversarial cases passed`);
