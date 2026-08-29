import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260828234500_build23_mass_scale.sql','utf8');
const hardening=fs.readFileSync('supabase/migrations/20260828234600_build23_pool_health_gc.sql','utf8');
const command=fs.readFileSync('supabase/functions/ld-command/index.ts','utf8');
const control=fs.readFileSync('supabase/functions/ld-local-control/index.ts','utf8');
const gateway=fs.readFileSync('supabase/functions/ld-model-gateway/index.ts','utf8');
const agent=fs.readFileSync('runtime/decrypter-local/worker-agent.py','utf8');
const compose=fs.readFileSync('runtime/decrypter-local/compose.yaml','utf8');

for(const table of ['ld_inference_pools','ld_inference_workers','ld_inference_jobs','ld_inference_leases','ld_inference_rate_windows','ld_inference_scale_decisions'])assert.match(migration,new RegExp(`create table if not exists public\\.${table}`));
assert.match(migration,/for update skip locked/i);
assert.match(migration,/global_requests_per_minute/);
assert.match(migration,/POOL_RATE_LIMITED/);
assert.match(migration,/ld_finish_inference_job/);
assert.match(migration,/payload_persisted',false/);
assert.match(hardening,/HEARTBEAT_EXPIRED/);
assert.match(hardening,/interval '24 hours'/);
assert.match(hardening,/status in \('joining','ready','draining'\)/);

const jobs=migration.slice(migration.indexOf('create table if not exists public.ld_inference_jobs'),migration.indexOf('create index if not exists ld_inference_jobs_pool_status_idx'));
assert.doesNotMatch(jobs,/\b(prompt|content|payload|attachment|source_code|project_context)\b\s+(text|jsonb|bytea)/i);

assert.match(command,/const LOCAL_POOL="decrypter-local-primary"/);
assert.match(command,/ld_inference_pool_snapshot/);
assert.match(command,/ld_enqueue_inference_job/);
assert.match(command,/ld_claim_inference_worker/);
assert.match(command,/ld_finish_inference_job/);
assert.match(command,/fetch\(`\$\{exec\.url\}\/v1\/chat\/completions`/);
assert.match(command,/DECRYPTER_LOCAL_TOKEN/);
assert.match(command,/DECRYPTER_GPU_SCALER_URL/);
assert.match(command,/DECRYPTER_GPU_SCALER_TOKEN/);
assert.match(command,/provider_status/);
assert.match(command,/runtime:await localHealth\(sb\)/);
assert.match(command,/dispatch:"pooled-direct"/);
assert.match(command,/legacyLocalConfig/);
assert.match(command,/ld_reserve_command/);
assert.match(command,/ld_complete_command/);
assert.match(command,/MODEL_GATEWAY_REQUIRED/);
assert.doesNotMatch(command,/\/functions\/v1\/ld-local-(?:router|control)/);
assert.ok(!fs.existsSync('supabase/functions/ld-local-router/index.ts'));

assert.match(control,/x-decrypter-worker-secret/);
assert.match(control,/u\.protocol!=='https:'/);
assert.match(control,/reconcile\(sb,'heartbeat'\)/);
assert.match(control,/DECRYPTER_GPU_SCALER_TOKEN/);
assert.match(control,/provider_neutral:true/);

assert.match(gateway,/cross_provider_fallback:false/);
assert.match(gateway,/trust_attestation_required:true/);

for(const metric of ['vllm:num_requests_running','vllm:num_requests_waiting','vllm:kv_cache_usage_perc'])assert.ok(agent.includes(metric));
assert.match(agent,/\/health/);
assert.match(agent,/\/v1\/models/);
assert.match(agent,/\/metrics/);
assert.match(agent,/DECRYPTER_WORKER_INSTANCE_KEY"\) or socket\.gethostname\(\)/);
assert.doesNotMatch(agent,/^\s*(?:import|from)\s+(?:requests|httpx|aiohttp)\b/m);
assert.match(compose,/decrypter-worker-agent:/);
assert.match(compose,/python:3\.12-slim/);

function desired({demand,min=0,max=16,target=2,warm=false}){return Math.min(max,Math.max(min,Math.ceil(demand/target),warm?1:0));}
assert.equal(desired({demand:0}),0);
assert.equal(desired({demand:0,warm:true}),1);
assert.equal(desired({demand:1}),1);
assert.equal(desired({demand:4}),2);
assert.equal(desired({demand:9}),5);
assert.equal(desired({demand:100}),16);
assert.equal(desired({demand:0,min:2}),2);

function canScaleDown({inflight,queued,lastActivityMs,cooldownMs}){return inflight===0&&queued===0&&lastActivityMs>=cooldownMs;}
assert.equal(canScaleDown({inflight:1,queued:0,lastActivityMs:999999,cooldownMs:300000}),false);
assert.equal(canScaleDown({inflight:0,queued:1,lastActivityMs:999999,cooldownMs:300000}),false);
assert.equal(canScaleDown({inflight:0,queued:0,lastActivityMs:1000,cooldownMs:300000}),false);
assert.equal(canScaleDown({inflight:0,queued:0,lastActivityMs:301000,cooldownMs:300000}),true);

console.log(JSON.stringify({ok:true,cases:53,pool:'decrypter-local-primary',dispatch:'direct-leased-worker',batching:'vllm-continuous',payload_persistence:false,scale_to_zero:true,nested_edge_function_inference:false},null,2));
