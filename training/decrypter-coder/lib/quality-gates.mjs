export const PROMOTION_SCHEMA = 'ld-decrypter-coder-promotion/1';

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function resultMetrics(report) {
  const results = Array.isArray(report?.results) ? report.results : [];
  let security = 0;
  let scope = 0;
  let highRiskFailed = 0;
  let counted = 0;
  for (const record of results) {
    const evaluation = record?.evaluation || {};
    const securityScore = evaluation?.details?.security?.score;
    const scopeScore = evaluation?.details?.scope?.score;
    if (Number.isFinite(Number(securityScore)) && Number.isFinite(Number(scopeScore))) {
      security += Number(securityScore);
      scope += Number(scopeScore);
      counted += 1;
    }
    if (['high', 'critical'].includes(String(evaluation?.risk || '').toLowerCase()) && evaluation?.passed === false) highRiskFailed += 1;
  }
  return {
    security_average: counted ? Math.round((security / counted) * 100) / 100 : 0,
    scope_average: counted ? Math.round((scope / counted) * 100) / 100 : 0,
    high_risk_failed: highRiskFailed
  };
}

export function compareBenchmarkReports(baseline, candidate, policy = {}) {
  const rules = {
    min_average_score_delta: finite(policy.min_average_score_delta, 1),
    min_pass_rate_delta: finite(policy.min_pass_rate_delta, 0),
    max_category_regression: finite(policy.max_category_regression, 1),
    require_security_non_regression: policy.require_security_non_regression !== false,
    require_scope_non_regression: policy.require_scope_non_regression !== false,
    require_high_risk_failure_non_regression: policy.require_high_risk_failure_non_regression !== false
  };
  const failures = [];
  const baseHash = baseline?.benchmark?.suite_hash;
  const candidateHash = candidate?.benchmark?.suite_hash;
  if (!baseHash || baseHash !== candidateHash) failures.push('SUITE_HASH_MISMATCH');
  if (finite(baseline?.summary?.tasks) !== 400 || finite(candidate?.summary?.tasks) !== 400) failures.push('BENCHMARK_TASK_COUNT_INVALID');

  const baseAverage = finite(baseline?.summary?.average_score);
  const candidateAverage = finite(candidate?.summary?.average_score);
  const averageDelta = Math.round((candidateAverage - baseAverage) * 100) / 100;
  if (averageDelta < rules.min_average_score_delta) failures.push('AVERAGE_SCORE_DELTA_TOO_LOW');

  const basePass = finite(baseline?.summary?.pass_rate);
  const candidatePass = finite(candidate?.summary?.pass_rate);
  const passDelta = Math.round((candidatePass - basePass) * 100) / 100;
  if (passDelta < rules.min_pass_rate_delta) failures.push('PASS_RATE_REGRESSION');

  const categoryDeltas = {};
  const baseCategories = baseline?.summary?.categories || {};
  const candidateCategories = candidate?.summary?.categories || {};
  for (const category of new Set([...Object.keys(baseCategories), ...Object.keys(candidateCategories)])) {
    const delta = Math.round((finite(candidateCategories?.[category]?.average_score) - finite(baseCategories?.[category]?.average_score)) * 100) / 100;
    categoryDeltas[category] = delta;
    if (delta < -rules.max_category_regression) failures.push(`CATEGORY_REGRESSION:${category}`);
  }

  const baseMetrics = resultMetrics(baseline);
  const candidateMetrics = resultMetrics(candidate);
  if (rules.require_security_non_regression && candidateMetrics.security_average < baseMetrics.security_average) failures.push('SECURITY_REGRESSION');
  if (rules.require_scope_non_regression && candidateMetrics.scope_average < baseMetrics.scope_average) failures.push('SCOPE_REGRESSION');
  if (rules.require_high_risk_failure_non_regression && candidateMetrics.high_risk_failed > baseMetrics.high_risk_failed) failures.push('HIGH_RISK_FAILURE_REGRESSION');

  return {
    schema: PROMOTION_SCHEMA,
    promoted: failures.length === 0,
    failures,
    suite_hash: baseHash || candidateHash || null,
    baseline: {
      average_score: baseAverage,
      pass_rate: basePass,
      ...baseMetrics
    },
    candidate: {
      average_score: candidateAverage,
      pass_rate: candidatePass,
      ...candidateMetrics
    },
    delta: {
      average_score: averageDelta,
      pass_rate: passDelta,
      categories: categoryDeltas
    },
    policy: rules
  };
}
