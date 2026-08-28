import assert from 'node:assert/strict';
import { benchmarkManifest } from '../benchmark/lib/catalog.mjs';
import { buildCurriculum, datasetManifest, validateCurriculum } from '../training/decrypter-coder/lib/curriculum.mjs';
import { compareBenchmarkReports } from '../training/decrypter-coder/lib/quality-gates.mjs';

const examples = buildCurriculum();
const validation = validateCurriculum(examples);
assert.equal(validation.ok, true, validation.errors.join('\n'));
assert.equal(examples.length, 2400);
assert.deepEqual(validation.splits, { train: 2160, validation: 240 });
assert.deepEqual(validation.counts, {
  lovable: 600,
  supabase: 600,
  github: 300,
  react_ts: 300,
  security: 300,
  full_stack: 300
});
assert.ok(validation.max_benchmark_prompt_similarity < 0.82);
assert.ok(examples.every(example => example.synthetic === true));
assert.ok(examples.every(example => example.private_customer_code === false));
assert.ok(examples.every(example => example.benchmark_holdout === true));
assert.ok(examples.every(example => example.id.startsWith('dc-train-')));

const manifest = datasetManifest(examples);
assert.equal(manifest.schema, 'ld-decrypter-coder-dataset/1');
assert.equal(manifest.synthetic_only, true);
assert.equal(manifest.private_customer_code_training, false);
assert.equal(manifest.decrypterbench_holdout, true);
assert.equal(manifest.benchmark_suite_hash, benchmarkManifest().suite_hash);
assert.equal(manifest.total_examples, 2400);

function makeResults({ security = 18, scope = 20, failHighRisk = 0 } = {}) {
  return Array.from({ length: 400 }, (_, index) => ({
    evaluation: {
      risk: index < 100 ? 'high' : 'medium',
      passed: index < failHighRisk ? false : true,
      details: {
        security: { score: security },
        scope: { score: scope }
      }
    }
  }));
}

function makeReport({ suite = 'suite-1', average = 80, passRate = 90, categoryAverage = 80, security = 18, scope = 20, failHighRisk = 0 } = {}) {
  const categories = Object.fromEntries(['lovable','supabase','github','react_ts','security','full_stack'].map(category => [category, {
    tasks: category === 'lovable' || category === 'supabase' ? 100 : 50,
    passed: category === 'lovable' || category === 'supabase' ? 90 : 45,
    pass_rate: passRate,
    average_score: categoryAverage
  }]));
  return {
    benchmark: { suite_hash: suite },
    summary: { tasks: 400, pass_rate: passRate, average_score: average, categories },
    results: makeResults({ security, scope, failHighRisk })
  };
}

const baseline = makeReport();
const improved = makeReport({ average: 82, passRate: 92, categoryAverage: 82, security: 19, scope: 21 });
const promoted = compareBenchmarkReports(baseline, improved, {
  min_average_score_delta: 1,
  min_pass_rate_delta: 0,
  max_category_regression: 1,
  require_security_non_regression: true,
  require_scope_non_regression: true,
  require_high_risk_failure_non_regression: true
});
assert.equal(promoted.promoted, true, promoted.failures.join(','));

const contaminatedSuite = compareBenchmarkReports(baseline, makeReport({ suite: 'other-suite', average: 82, passRate: 92, categoryAverage: 82, security: 19, scope: 21 }));
assert.equal(contaminatedSuite.promoted, false);
assert.ok(contaminatedSuite.failures.includes('SUITE_HASH_MISMATCH'));

const securityRegression = compareBenchmarkReports(baseline, makeReport({ average: 82, passRate: 92, categoryAverage: 82, security: 17, scope: 21 }));
assert.equal(securityRegression.promoted, false);
assert.ok(securityRegression.failures.includes('SECURITY_REGRESSION'));

const riskRegression = compareBenchmarkReports(baseline, makeReport({ average: 82, passRate: 92, categoryAverage: 82, security: 19, scope: 21, failHighRisk: 1 }));
assert.equal(riskRegression.promoted, false);
assert.ok(riskRegression.failures.includes('HIGH_RISK_FAILURE_REGRESSION'));

console.log(JSON.stringify({
  ok: true,
  examples: examples.length,
  dataset_hash: manifest.dataset_hash,
  benchmark_suite_hash: manifest.benchmark_suite_hash,
  max_benchmark_prompt_similarity: manifest.max_benchmark_prompt_similarity,
  promotion_gate: promoted.promoted
}, null, 2));
