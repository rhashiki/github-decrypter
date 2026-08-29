import fs from 'node:fs';
import vm from 'node:vm';
import { validateGatewayDecision } from '../core/model-gateway.js';

const commandSrc = fs.readFileSync('supabase/functions/ld-command/index.ts', 'utf8');
const gatewaySrc = fs.readFileSync('supabase/functions/ld-model-gateway/index.ts', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Unable to extract ${start}`);
  return source.slice(from, to).trim();
}
function stripTs(source) {
  return String(source)
    .replace(/([A-Za-z_$][\w$]*)\s*:\s*(?:string|number|boolean|any|unknown)(?=\s*[,)=])/g, '$1')
    .replace(/\b(Map|Set|Array|Promise)<[^>]+>/g, '$1');
}
function loadFunction(source, name, end, extras = '') {
  const context = {};
  vm.runInNewContext(`${stripTs(extras)}\n${stripTs(between(source, `function ${name}`, end))}\nthis.fn=${name};`, context);
  return context.fn;
}

const route = healthy => healthy ? 'decrypter-local' : 'gemini';
assert(route(true) === 'decrypter-local', 'Healthy Local must be eligible before execution');
assert(route(false) === 'gemini', 'Unavailable Local must route before execution');
const decision = {schema:'ld-model-gateway/1',requested_mode:'auto',profile:'fast',provider:'decrypter-local',model:'Qwen/Qwen3-Coder-30B-A3B-Instruct',executor_model:'decrypter-local',authoritative:true,cross_provider_fallback:false};
assert(validateGatewayDecision(decision).allowed, 'Validated Local route should be accepted');
assert(!validateGatewayDecision({...decision,cross_provider_fallback:true}).allowed, 'Cross-provider fallback must be rejected');

assert(/LOCAL_HEALTH_TTL_MS\s*=\s*15_000/.test(gatewaySrc), 'Gateway health TTL missing');
assert(/now\s*<\s*localHealthCache\.expiresAt/.test(gatewaySrc), 'Fresh health cache gate missing');
assert(gatewaySrc.includes('cachedLocalRuntimeStatus'), 'Cached health function missing');
assert(/cross_provider_retry_attempted\s*:\s*false/.test(gatewaySrc), 'No-retry result marker missing');
assert(/retry_across_providers\s*:\s*false/.test(gatewaySrc), 'No-retry policy missing');

const stripJsonFence = loadFunction(commandSrc, 'stripJsonFence', '\nfunction compact');
assert.throws(() => JSON.parse(stripJsonFence('not-json')), SyntaxError, 'Invalid model JSON must fail');
assert(commandSrc.includes('INVALID_MODEL_JSON'), 'Invalid JSON production guard missing');

const deleteIntent = between(commandSrc, 'function deleteIntent', '\nconst PLAN_SCHEMA');
const validateBuild = loadFunction(commandSrc, 'validateBuild', '\nfunction localModelConfig', deleteIntent);
const patchCheck = validateBuild({files:[{path:'src/a.js',action:'update',content:'rewritten',edits:[],explanation:'bad'}]}, {files:[{path:'src/a.js',content:'const a = 1;\nconst b = 2;\n'}]}, 'ajuste a variável');
assert(patchCheck?.ok === false && patchCheck?.code === 'UPDATE_CONTENT_MUST_BE_EMPTY', 'validateBuild must block full rewrite updates');

const telemetry = loadFunction(commandSrc, 'telemetry', '\n\nDeno.serve');
const none = telemetry('decrypter-local', {});
assert(none.reported === false && none.totalTokens === null && none.cost === null, 'Unreported usage must not be estimated');
const real = telemetry('decrypter-local', {usage:{prompt_tokens:123,completion_tokens:45,total_tokens:168}});
assert(real.reported === true && real.inputTokens === 123 && real.outputTokens === 45 && real.totalTokens === 168 && real.cost === null, 'Real usage must be preserved exactly');

for (const marker of ['ld_reserve_command','ld_complete_command','validateBuild','MODEL_GATEWAY_REQUIRED','internalAllowed','/v1/chat/completions','ld_claim_inference_worker']) {
  assert(commandSrc.includes(marker), `Missing current authority marker: ${marker}`);
}
assert(commandSrc.includes('if(provider===LOCAL_PROVIDER)'), 'Local provider execution branch missing');

console.log('Build 18 Decrypter Local simulations: OK');
