import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const compose = read('runtime/decrypter-local/compose.yaml');
const vllm = read('runtime/decrypter-local/compose.vllm.yaml');
const worker = read('runtime/decrypter-local/worker-agent.py');
const ollama = read('runtime/decrypter-local/ollama-gateway.py');
const control = read('supabase/functions/ld-local-control/index.ts');
const command = read('supabase/functions/ld-command/index.ts');
const gateway = read('supabase/functions/ld-model-gateway/index.ts');
const migration = read('supabase/migrations/20260830094418_build60_local_model_runtime.sql');

const versionParts = String(manifest.version || '').split('.').map(Number);
const currentBuild = versionParts.length === 3 && versionParts.every(Number.isInteger) ? versionParts[2] : 0;
assert.ok(currentBuild >= 60, `Build 60 contract requires authoritative build >= 60, received ${manifest.version}`);
assert.match(manifest.version_name, new RegExp(`Build ${currentBuild}\\b`));
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));
assert.ok(settings.includes("DECRYPTER_LOCAL_RECOMMENDED_MODEL = 'qwen3-coder:30b'"));
assert.ok(pkg.forbidden_roots.includes('runtime'), 'worker runtime must never ship inside the browser extension package');

for (const token of [
  'ollama/ollama:0.32.14',
  'qwen3-coder:30b',
  'ollama-model-init',
  'ollama-gateway.py',
  'DECRYPTER_RUNTIME_KIND: ollama',
  'DECRYPTER_WORKER_MAX_INFLIGHT: ${DECRYPTER_WORKER_MAX_INFLIGHT:-1}'
]) assert.ok(compose.includes(token), token);
assert.ok(vllm.includes('vllm/vllm-openai'));
assert.ok(vllm.includes('DECRYPTER_RUNTIME_KIND: vllm'));

for (const token of [
  'DecrypterOllamaGateway/2.6.60',
  'hmac.compare_digest',
  '/v1/models',
  '/v1/chat/completions',
  'rewrite_chat_payload',
  'response_format',
  'qwen3-coder:30b',
  'decrypter-local',
  'zero_cost_api'
]) assert.ok(ollama.includes(token), token);
assert.ok(!/sqlite3|psycopg|write_text\(|json\.dump\s*\(/.test(ollama), 'Ollama bridge must not persist prompts or responses');

for (const token of [
  'AGENT_VERSION = "2.6.60"',
  'DECRYPTER_RUNTIME_KIND',
  'DECRYPTER_RUNTIME_MODEL',
  'model_label',
  'runtime_model',
  'never reads or stores inference prompts'
]) assert.ok(worker.includes(token), token);

for (const token of [
  "const RUNTIMES=new Set(['ollama','vllm'])",
  "schema:'ld-local-control/2'",
  'WORKER_MODEL_CONTRACT_MISMATCH',
  "contract:'openai-compatible/v1'",
  'zero_cost_api:true',
  "metadata:{runtime,runtime_model:runtimeModel"
]) assert.ok(control.includes(token), token);

for (const token of [
  "model_label='Qwen3-Coder 30B A3B · Ollama'",
  "'primary_runtime','ollama'",
  "jsonb_build_array('ollama','vllm')",
  "'ollama_model','qwen3-coder:30b'",
  "'runtime_contract','openai-compatible/v1'",
  "'payload_persistence',false",
  "'zero_cost_api',true"
]) assert.ok(migration.includes(token), token);

assert.ok(command.includes('/v1/chat/completions'));
assert.ok(command.includes('response_format:{type:"json_schema"'));
assert.ok(command.includes('MODEL_GATEWAY_REQUIRED'));
assert.ok(gateway.includes("code:'ZERO_COST_PAID_MODE_FORBIDDEN'"));
assert.ok(gateway.includes('paid_mode_allowed:false'));
assert.ok(gateway.includes('cross_provider_fallback:false'));
assert.ok(!JSON.stringify(manifest).includes('runtime/decrypter-local'));

console.log(`Build60 Local Model Runtime contract OK on authoritative Build ${currentBuild}`);
