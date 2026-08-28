export const MODEL_GATEWAY_SCHEMA = 'ld-model-gateway/1';
export const MODEL_GATEWAY_NAME = 'Decrypter Model Gateway';
export const MODEL_GATEWAY_MODES = Object.freeze(['auto', 'fast', 'deep']);
export const MODEL_GATEWAY_PROVIDERS = Object.freeze(['gemini', 'decrypter-local']);

export function normalizeGatewayMode(value = 'auto') {
  const mode = String(value || 'auto').trim().toLowerCase();
  return MODEL_GATEWAY_MODES.includes(mode) ? mode : 'auto';
}

export function validateGatewayDecision(value = {}) {
  const violations = [];
  if (!value || typeof value !== 'object') violations.push('gateway-result-invalid');
  if (String(value?.schema || '') !== MODEL_GATEWAY_SCHEMA) violations.push('gateway-schema-invalid');
  if (!MODEL_GATEWAY_MODES.includes(String(value?.requested_mode || ''))) violations.push('gateway-mode-invalid');
  if (!['fast', 'deep'].includes(String(value?.profile || ''))) violations.push('gateway-profile-invalid');
  if (!MODEL_GATEWAY_PROVIDERS.includes(String(value?.provider || ''))) violations.push('gateway-provider-not-active');
  if (!String(value?.model || '').trim()) violations.push('gateway-model-missing');
  if (String(value?.provider || '') === 'decrypter-local' && !String(value?.executor_model || '').trim()) violations.push('gateway-local-executor-model-missing');
  if (value?.authoritative !== true) violations.push('gateway-not-authoritative');
  if (value?.cross_provider_fallback === true) violations.push('gateway-cross-provider-fallback-forbidden');
  return Object.freeze({ allowed: violations.length === 0, violations });
}

export function assertGatewayDecision(value = {}) {
  const check = validateGatewayDecision(value);
  if (!check.allowed) {
    const error = new Error(`MODEL_GATEWAY_INVALID: ${check.violations.join(' | ')}`);
    error.code = 'MODEL_GATEWAY_INVALID';
    error.gatewayValidation = check;
    throw error;
  }
  return check;
}

export function publicGatewaySummary(value = {}) {
  const route = value && typeof value === 'object' ? value : {};
  const localRuntime = route?.local_runtime && typeof route.local_runtime === 'object' ? {
    served_model: String(route.local_runtime.served_model || ''),
    health: String(route.local_runtime.health || ''),
    latency_ms: Number.isFinite(Number(route.local_runtime.latency_ms)) ? Number(route.local_runtime.latency_ms) : null
  } : null;
  return Object.freeze({
    schema: MODEL_GATEWAY_SCHEMA,
    active: route?.authoritative === true,
    requested_mode: normalizeGatewayMode(route?.requested_mode || 'auto'),
    profile: String(route?.profile || ''),
    provider: String(route?.provider || ''),
    model: String(route?.model || ''),
    executor_model: String(route?.executor_model || route?.model || ''),
    reason: String(route?.reason || '').slice(0, 600),
    fallback: route?.fallback ? {
      applied: route.fallback.applied === true,
      from: String(route.fallback.from || ''),
      to: String(route.fallback.to || ''),
      reason: String(route.fallback.reason || '').slice(0, 300)
    } : { applied: false, from: '', to: '', reason: '' },
    local_runtime: localRuntime,
    authoritative: route?.authoritative === true,
    cross_provider_fallback: false,
    resolved_at: String(route?.resolved_at || new Date().toISOString())
  });
}

export const DecrypterModelGateway = Object.freeze({
  schema: MODEL_GATEWAY_SCHEMA,
  name: MODEL_GATEWAY_NAME,
  modes: MODEL_GATEWAY_MODES,
  providers: MODEL_GATEWAY_PROVIDERS,
  normalizeGatewayMode,
  validateGatewayDecision,
  assertGatewayDecision,
  publicGatewaySummary
});
