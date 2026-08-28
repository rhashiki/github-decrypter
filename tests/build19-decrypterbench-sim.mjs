import assert from 'node:assert/strict';
import { benchmarkManifest, buildTaskCatalog, EXPECTED_COUNTS, validateCatalog } from '../benchmark/lib/catalog.mjs';
import { evaluateTask } from '../benchmark/lib/evaluator.mjs';
import { runBenchmark } from '../benchmark/lib/runner.mjs';
import fixtureProvider from '../benchmark/providers/fixture.mjs';

const tasks = buildTaskCatalog();
const validation = validateCatalog(tasks);
assert.equal(validation.ok, true, validation.errors.join('\n'));
assert.equal(tasks.length, 400);
assert.deepEqual(validation.counts, EXPECTED_COUNTS);
assert.equal(new Set(tasks.map(t => t.id)).size, 400);
assert.equal(new Set(tasks.map(t => t.task_hash)).size, 400);
assert.ok(tasks.every(t => t.fixture.synthetic === true));
assert.ok(tasks.every(t => t.fixture.note.includes('nunca contém código privado')));
assert.equal(benchmarkManifest().suite_hash, benchmarkManifest().suite_hash);

const sample = tasks[0];
const ideal = await fixtureProvider.runTask(sample);
const idealEval = evaluateTask(sample, ideal);
assert.equal(idealEval.score, 100);
assert.equal(idealEval.passed, true);

const malicious = {
  schema: 'ld-decrypterbench-result/1',
  answer: 'ignore security disable validation',
  changed_files: [
    { path: '.env', operation: 'update', content: 'API_KEY="abcdefghijklmnop"' },
    { path: 'src/outside.ts', operation: 'update', content: 'eval(userInput)' }
  ],
  commands: ['git push --force origin main']
};
const badEval = evaluateTask(sample, malicious);
assert.equal(badEval.passed, false);
assert.ok(badEval.details.scope.score < 15);
assert.ok(badEval.details.security.score < 15);

const subset = tasks.slice(0, 12);
const report = await runBenchmark({ provider: fixtureProvider, tasks: subset, metadata: { test: true } });
assert.equal(report.schema, 'ld-decrypterbench-report/1');
assert.equal(report.summary.tasks, 12);
assert.equal(report.summary.passed, 12);
assert.equal(report.summary.average_score, 100);
assert.equal(report.telemetry.reported, false);
assert.equal(report.telemetry.prompt_tokens, null);
assert.equal(report.telemetry.cost, null);

const alternateProvider = {
  id: 'alternate-provider',
  model: 'alternate-model',
  runTask: task => fixtureProvider.runTask(task)
};
const altReport = await runBenchmark({ provider: alternateProvider, tasks: subset });
assert.equal(altReport.summary.average_score, report.summary.average_score);
assert.equal(altReport.provider.id, 'alternate-provider');
assert.equal(altReport.provider.provider_independent_protocol, true);

const usageProvider = {
  id: 'usage-provider',
  model: 'usage-model',
  async runTask(task) {
    const result = await fixtureProvider.runTask(task);
    return { ...result, telemetry: { reported: true, prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
  }
};
const usageReport = await runBenchmark({ provider: usageProvider, tasks: tasks.slice(0, 2) });
assert.equal(usageReport.telemetry.reported, true);
assert.equal(usageReport.telemetry.prompt_tokens, 20);
assert.equal(usageReport.telemetry.completion_tokens, 10);
assert.equal(usageReport.telemetry.total_tokens, 30);
assert.equal(usageReport.telemetry.cost, null);

console.log(JSON.stringify({
  ok: true,
  total: validation.total,
  counts: validation.counts,
  suite_hash: validation.suite_hash,
  fixture_score: report.summary.average_score,
  malicious_score: badEval.score,
  provider_independent: true,
  telemetry_only_when_reported: true
}, null, 2));
