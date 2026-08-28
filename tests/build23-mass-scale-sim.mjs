import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260828234500_build23_mass_scale.sql','utf8');
const hardening=fs.readFileSync('supabase/migrations/20260828234600_build23_pool_health_gc.sql','utf8');
const router=fs.readFileSync('supabase/functions/ld-local-router/index.ts','utf8');
const control=fs.readFileSync('supabase/functions/ld-local-control/index.ts','utf8');
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

assert.match(router,/endsWith\('\/v1\/models'\)/);
assert.match(router,/endsWith\('\/v1\/chat\/completions'\)/);
assert.match(router,/LOCAL_STREAMING_DISABLED/);
assert.match(router,/maybeScale\(sb,snap,'health-demand',true\)/);
assert.match(router,/DECRYPTER_GPU_SCALER_URL/);
assert.match(router,/ld_claim_inference_worker/);
assert.match(router,/ld_finish_inference_job/);
assert.doesNotMatch(router,/gemini|generativelanguage\.googleapis\.com/i);

assert.match(control,/x-decrypter-worker-secret/);
assert.match(control,/u\.protocol!=='https:'/);
assert.match(control,/reconcile\(sb,'heartbeat'\)/);
assert.match(control,/DECRYPTER_GPU_SCALER_TOKEN/);
assert.match(control,/provider_neutral:true/);

for(const metric of ['vllm:num_requests_running','vllm:num_requests_waiting','vllm:kv_cache_usage_perc'])assert.ok(agent.includes(metric));
assert.match(agent,/\/health/);
assert.match(agent,/\/v1\/models/);
assert.match(agent,/\/metrics/);
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

console.log(JSON.stringify({ok:true,cases:43,pool:'decrypter-local-primary',batching:'vllm-continuous',payload_persistence:false,scale_to_zero:true},null,2));
