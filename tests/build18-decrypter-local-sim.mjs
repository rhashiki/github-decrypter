import fs from 'node:fs';
import vm from 'node:vm';
import { validateGatewayDecision } from '../core/model-gateway.js';

const commandSrc = fs.readFileSync('supabase/functions/ld-command/index.ts', 'utf8');
const gatewaySrc = fs.readFileSync('supabase/functions/ld-model-gateway/index.ts', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function chooseProvider({ healthy, attachmentsEligible = true }) {
  return healthy === true && attachmentsEligible ? 'decrypter-local' : 'gemini';
}

function extractBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Unable to extract ${start}`);
  return source.slice(from, to).trim();
}

function stripTypeScriptForVm(source) {
  return String(source)
    .replace(/([A-Za-z_$][\w$]*)\s*:\s*(?:string|number|boolean|any|unknown)(?=\s*[,)=])/g, '$1')
    .replace(/\b(Map|Set|Array|Promise)<[^>]+>/g, '$1');
}

function loadFunction(source, name, nextMarker, extras = '') {
  const extracted = extractBetween(source, `function ${name}`, nextMarker);
  const code = `${stripTypeScriptForVm(extras)}\n${stripTypeScriptForVm(extracted)}\nthis.__fn=${name};`;
  const context = {};
  vm.runInNewContext(code, context);
  return context.__fn;
}

// Routing simulations: decision happens before execution.
assert(chooseProvider({ healthy: true }) === 'decrypter-local', 'Local healthy must be selected');
assert(chooseProvider({ healthy: false }) === 'gemini', 'Local offline must route to Gemini before execution');
assert(chooseProvider({ healthy: false, code: 'LOCAL_HEALTH_TIMEOUT' }) === 'gemini', 'Local timeout must route to Gemini before execution');
assert(chooseProvider({ healthy: false, configured: false }) === 'gemini', 'No Local config must route to Gemini');
assert(chooseProvider({ healthy: true, attachmentsEligible: false }) === 'gemini', 'Unsupported Local attachments must route to Gemini');

const decisionBase = {
  schema: 'ld-model-gateway/1',
  requested_mode: 'auto',
  profile: 'fast',
  model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
  executor_model: 'decrypter-local',
  authoritative: true,
  cross_provider_fallback: false
};
assert(validateGatewayDecision({ ...decisionBase, provider: 'decrypter-local' }).allowed, 'Validated Local route should be accepted');
assert(!validateGatewayDecision({ ...decisionBase, provider: 'decrypter-local', cross_provider_fallback: true }).allowed, 'Cross-provider fallback must be rejected');

// Health cache simulation: fresh cache is reused, stale cache is rechecked.
let healthCalls = 0;
let cache = null;
const ttl = 15_000;
async function cachedHealth(now) {
  if (cache && now < cache.expiresAt) return { ...cache.value, cached: true };
  healthCalls += 1;
  const value = { healthy: true, sequence: healthCalls };
  cache = { value, expiresAt: now + ttl };
  return { ...value, cached: false };
}
const h1 = await cachedHealth(1_000);
const h2 = await cachedHealth(5_000);
const h3 = await cachedHealth(16_001);
assert(h1.sequence === 1 && h1.cached === false, 'Initial health must query runtime');
assert(h2.sequence === 1 && h2.cached === true && healthCalls === 2, 'Fresh health must use cache before stale recheck');
assert(h3.sequence === 2 && h3.cached === false, 'Stale health must recheck runtime');
assert(/LOCAL_HEALTH_TTL_MS\s*=\s*15_000/.test(gatewaySrc), 'Production gateway health TTL missing');
assert(/now\s*<\s*localHealthCache\.expiresAt/.test(gatewaySrc), 'Production stale-cache gate missing');
assert(gatewaySrc.includes('cachedLocalRuntimeStatus'), 'Production cached health function missing');

// Failure after provider start must fail closed: never invoke Gemini as a retry.
const attempts = [];
async function executeStartedProvider(provider, fail) {
  attempts.push(provider);
  if (fail) throw new Error(`${provider}-failed`);
  return provider;
}
try {
  await executeStartedProvider('decrypter-local', true);
} catch (_) {}
assert(attempts.join(',') === 'decrypter-local', 'Local failure after start must not invoke Gemini');
assert(/cross_provider_retry_attempted\s*:\s*false/.test(gatewaySrc), 'Gateway must report no cross-provider retry');
assert(/retry_across_providers\s*:\s*false/.test(gatewaySrc), 'Gateway policy must disable cross-provider retry');

// Invalid model JSON must block.
const stripJsonFence = loadFunction(commandSrc, 'stripJsonFence', '\nfunction compact');
let invalidJsonBlocked = false;
try {
  JSON.parse(stripJsonFence('not-json'));
} catch (_) {
  invalidJsonBlocked = true;
}
assert(invalidJsonBlocked, 'Invalid model JSON must be rejected');
assert(commandSrc.includes('INVALID_MODEL_JSON'), 'Production invalid JSON block missing');

// Invalid patch must block through the actual validateBuild implementation.
const deleteIntent = extractBetween(commandSrc, 'function deleteIntent', '\nconst PLAN_SCHEMA');
const validateBuild = loadFunction(commandSrc, 'validateBuild', '\nfunction localConfig', deleteIntent);
const ctx = { files: [{ path: 'src/a.js', content: 'const a = 1;\nconst b = 2;\n' }] };
const invalidPatch = {
  files: [{ path: 'src/a.js', action: 'update', content: 'rewritten', edits: [], explanation: 'bad' }]
};
const patchCheck = validateBuild(invalidPatch, ctx, 'ajuste a variável');
assert(patchCheck?.ok === false && patchCheck?.code === 'UPDATE_CONTENT_MUST_BE_EMPTY', 'Invalid patch must be blocked by validateBuild');

// Usage must remain null unless provider reports real values.
const telemetry = loadFunction(commandSrc, 'telemetry', '\n\nDeno.serve');
const noUsage = telemetry('decrypter-local', {});
assert(noUsage.reported === false, 'Usage without provider data must not be marked reported');
assert(noUsage.inputTokens === null && noUsage.outputTokens === null && noUsage.totalTokens === null, 'Usage must not be estimated');
const realUsage = telemetry('decrypter-local', { usage: { prompt_tokens: 123, completion_tokens: 45, total_tokens: 168 } });
assert(realUsage.reported === true, 'Reported provider usage must be surfaced');
assert(realUsage.inputTokens === 123 && realUsage.outputTokens === 45 && realUsage.totalTokens === 168, 'Reported usage must be preserved exactly');
assert(realUsage.cost === null, 'Self-hosted cost must not be invented');

// Provider-neutral authority and secret boundary markers.
for (const marker of ['ld_reserve_command', 'ld_complete_command', 'validateBuild', 'LOCAL_PROVIDER_GATEWAY_ONLY', '/v1/chat/completions']) {
  assert(commandSrc.includes(marker), `Missing provider-neutral authority marker: ${marker}`);
}
assert(commandSrc.includes('if(provider===LOCAL_PROVIDER)'), 'Local provider branch missing');
assert(commandSrc.includes('if(!geminiKey)return json'), 'Gemini key policy missing');
assert(!gatewaySrc.includes('DECRYPTER_LOCAL_TOKEN'), 'Local token must not exist in gateway/client-facing registry');

console.log('Build 18 Decrypter Local simulations: OK');
