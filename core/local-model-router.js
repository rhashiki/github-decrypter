export const LOCAL_MODEL_ROUTER_SCHEMA = 'ld-local-model-router/1';

export const DEFAULT_LOCAL_MODEL_TIERS = Object.freeze({
  large: Object.freeze({ id: 'large', model: 'qwen3-coder:30b', rank: 3, role: 'coding-reasoning' }),
  medium: Object.freeze({ id: 'medium', model: 'qwen2.5-coder:14b', rank: 2, role: 'coding-general' }),
  small: Object.freeze({ id: 'small', model: 'qwen2.5-coder:7b', rank: 1, role: 'routing-summarization' })
});

const TIER_ORDER = ['large', 'medium', 'small'];
const text = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const uniq = values => [...new Set((Array.isArray(values) ? values : []).map(value => text(value, 300)).filter(Boolean))];

export function normalizeLocalModelTiers(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const tier of TIER_ORDER) {
    const fallback = DEFAULT_LOCAL_MODEL_TIERS[tier];
    const value = source[tier];
    out[tier] = {
      id: tier,
      model: text(typeof value === 'string' ? value : value?.model || fallback.model, 240) || fallback.model,
      rank: fallback.rank,
      role: fallback.role
    };
  }
  return out;
}

export function classifyLocalTask({ command = '', role = '', iteration = 0, failures = 0, contextFileCount = 0, diagnosticsFailures = 0 } = {}) {
  const prompt = text(command, 12000).toLowerCase();
  const requestedRole = text(role, 80).toLowerCase();
  if (['router','summary','summarize','classify','classification','context-select'].includes(requestedRole)) {
    return { tier: 'small', score: 1, reason: 'lightweight-role' };
  }

  let score = 2;
  if (/\b(arquitet(?:ura|ural)?|architecture|refactor|migrat|multi[- ]?file|security|auth|schema|database|concurrency|race|performance|debug complex|root cause)\b/i.test(prompt)) score += 3;
  if (/\b(vários|varios|múltiplos|multiplos)\s+arquivos\b/i.test(prompt)) score += 2;
  if (/\b(fix|corrig|implement|build|feature|patch|repair|diagnostic)\b/i.test(prompt)) score += 1;
  if (Number(contextFileCount || 0) >= 6) score += 2;
  if (Number(contextFileCount || 0) >= 12) score += 1;
  if (Number(failures || 0) >= 1) score += 1;
  if (Number(diagnosticsFailures || 0) >= 1) score += 2;
  if (Number(iteration || 0) >= 3) score += 1;

  if (score >= 7) return { tier: 'large', score, reason: 'high-complexity' };
  if (score >= 3) return { tier: 'medium', score, reason: 'general-coding' };
  return { tier: 'small', score, reason: 'lightweight-task' };
}

function degradationOrder(targetTier = 'medium') {
  const index = Math.max(0, TIER_ORDER.indexOf(targetTier));
  return TIER_ORDER.slice(index);
}

export function routeLocalModel({
  command = '',
  role = '',
  iteration = 0,
  failures = 0,
  diagnosticsFailures = 0,
  contextFileCount = 0,
  desiredTier = '',
  tiers = {},
  loadedModels = [],
  health = {},
  metrics = {}
} = {}) {
  const configured = normalizeLocalModelTiers(tiers);
  const loaded = new Set(uniq(loadedModels));
  const classified = desiredTier && TIER_ORDER.includes(desiredTier)
    ? { tier: desiredTier, score: 0, reason: 'explicit-local-tier' }
    : classifyLocalTask({ command, role, iteration, failures, diagnosticsFailures, contextFileCount });

  let targetTier = classified.tier;
  const inflight = Math.max(0, Number(metrics?.inflight || metrics?.running || 0) || 0);
  const latency = Math.max(0, Number(metrics?.last_latency_ms || metrics?.lastLatencyMs || health?.latency_ms || 0) || 0);
  const pressure = inflight >= 2 || latency >= 60_000 || health?.degraded === true;
  if (pressure && targetTier === 'large') targetTier = 'medium';
  else if (pressure && targetTier === 'medium') targetTier = 'small';

  for (const tier of degradationOrder(targetTier)) {
    const model = configured[tier]?.model;
    if (!model || !loaded.has(model)) continue;
    return {
      ok: true,
      schema: LOCAL_MODEL_ROUTER_SCHEMA,
      provider: 'decrypter-local',
      tier,
      model,
      requestedTier: classified.tier,
      degraded: tier !== classified.tier,
      pressureDegraded: pressure && tier !== classified.tier,
      reason: tier === classified.tier ? classified.reason : 'local-degradation',
      zeroCostApi: true,
      paidFallbackAllowed: false,
      remoteFallbackAllowed: false,
      fallbackOrder: degradationOrder(targetTier).map(name => configured[name].model)
    };
  }

  return {
    ok: false,
    schema: LOCAL_MODEL_ROUTER_SCHEMA,
    code: 'LOCAL_MODEL_UNAVAILABLE',
    provider: 'decrypter-local',
    requestedTier: classified.tier,
    loadedModels: [...loaded],
    configuredModels: TIER_ORDER.map(tier => configured[tier].model),
    zeroCostApi: true,
    paidFallbackAllowed: false,
    remoteFallbackAllowed: false
  };
}

export function localRouterPublicStatus(tiers = {}) {
  const configured = normalizeLocalModelTiers(tiers);
  return {
    schema: LOCAL_MODEL_ROUTER_SCHEMA,
    order: TIER_ORDER.map(tier => ({ tier, model: configured[tier].model })),
    degradation: 'large->medium->small',
    paidFallbackAllowed: false,
    remoteFallbackAllowed: false
  };
}
