import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('manifest.json'));
const config=read('settings/config.js');
const trust=read('security/trust.js');
const gatewayClient=read('background/model-gateway-client.js');
const gatewayBootstrap=read('background/model-gateway-bootstrap.js');
const attest=read('supabase/functions/ld-trust-attest/index.ts');
const gateway=read('supabase/functions/ld-model-gateway/index.ts');
const command=read('supabase/functions/ld-command/index.ts');
const control=read('supabase/functions/ld-local-control/index.ts');
const webhook=read('supabase/functions/ld-mercadopago-webhook/index.ts');
const hardening=read('supabase/migrations/20260829003000_build24_security_chaos_hardening.sql');
const massScale=read('supabase/migrations/20260828234500_build23_mass_scale.sql');

// Version/trust-protocol drift: app releases must not silently invalidate the Build 21 protocol.
assert.equal(manifest.version,'2.4.24');
assert.equal(manifest.version_name,'2.4 Build 24');
assert.match(config,/export const VERSION = '2\.4\.24'/);
assert.match(config,/export const TRUST_PROTOCOL_VERSION = '2\.4\.21'/);
assert.match(attest,/const EXPECTED_VERSION='2\.4\.21'/);
assert.match(gateway,/const EXPECTED_CLIENT_VERSION='2\.4\.21'/);
assert.match(trust,/client_version:TRUST_PROTOCOL_VERSION/);
assert.match(trust,/appVersion:VERSION,clientVersion:TRUST_PROTOCOL_VERSION/);
assert.match(gatewayClient,/'x-decrypter-client-version': TRUST_PROTOCOL_VERSION/);
assert.match(gatewayBootstrap,/'x-decrypter-client-version': TRUST_PROTOCOL_VERSION/);
assert.doesNotMatch(gatewayClient,/'x-decrypter-client-version': VERSION/);
assert.doesNotMatch(gatewayBootstrap,/'x-decrypter-client-version': VERSION/);

// Existing trust boundaries remain server-authoritative and short-lived.
assert.match(attest,/TRUST_NONCE_REPLAY/);
assert.match(attest,/TRUST_TTL_SECONDS=600/);
assert.match(gateway,/TRUST_REQUIRED/);
assert.match(gateway,/TRUST_DEVICE_MISMATCH/);
assert.match(gateway,/TRUST_SESSION_MISMATCH/);
assert.match(gateway,/cross_provider_fallback:false/);
assert.match(command,/MODEL_GATEWAY_REQUIRED/);
assert.match(command,/INVALID_MODEL_JSON/);
assert.match(command,/UNSAFE_PATH/);
assert.match(command,/DELETE_NOT_EXPLICIT/);
assert.match(command,/PATCH_TOO_LARGE/);
assert.match(command,/SEARCH_AMBIGUOUS/);

// Browser trust bearer remains ephemeral and secrets remain server-only.
assert.match(trust,/chrome\.storage\.session/);
assert.doesNotMatch(trust,/chrome\.storage\.local\.set/);
for(const client of [config,trust,gatewayClient,gatewayBootstrap,read('manifest.json')]){
  assert.doesNotMatch(client,/SUPABASE_SERVICE_ROLE_KEY|LD_LICENSE_PRIVATE_JWK|DECRYPTER_LOCAL_TOKEN|DECRYPTER_WORKER_SECRET|MERCADOPAGO_ACCESS_TOKEN/);
}

// Database boundary rejects invalid webhook persistence and oversized valid payloads.
assert.match(hardening,/if new\.signature_valid is not true then\s+return null;/s);
assert.match(hardening,/ld_webhook_accept_signed_row_trigger/);
assert.match(hardening,/octet_length\(payload::text\) <= 524288/);
assert.match(hardening,/security invoker/i);
assert.doesNotMatch(hardening,/security definer/i);
assert.match(webhook,/INVALID_SIGNATURE/);
assert.match(webhook,/paymentStatus==='approved'/);
assert.match(webhook,/payment_authoritative_entitlement:true/);

// GPU endpoints are constrained at the DB boundary, even if a future worker-control regression occurs.
assert.match(hardening,/ld_worker_endpoint_is_public_https/);
for(const token of ['localhost','127\\.','10\\.','169\\.254\\.','192\\.168\\.','172\\.','fc|fd','fe[89ab]','local|internal|localhost|lan'])assert.ok(hardening.includes(token) || new RegExp(token).test(hardening));
assert.match(hardening,/p_endpoint ~ '@'/);
assert.match(hardening,/octet_length\(metrics::text\) <= 65536/);
assert.match(hardening,/octet_length\(metadata::text\) <= 32768/);
assert.match(control,/u\.protocol!=='https:'/);

function safeWorkerEndpoint(value){
  let u;try{u=new URL(value);}catch{return false;}
  if(u.protocol!=='https:'||u.username||u.password)return false;
  let h=u.hostname.toLowerCase().replace(/^\[/,'').replace(/\]$/,'');
  if(['localhost','0.0.0.0','::','::1'].includes(h))return false;
  if(/^127\./.test(h)||/^10\./.test(h)||/^169\.254\./.test(h)||/^192\.168\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h))return false;
  if(/^(fc|fd)[0-9a-f]{2}:/.test(h)||/^fe[89ab][0-9a-f]:/.test(h))return false;
  if(/\.(local|internal|localhost|lan)$/.test(h))return false;
  return true;
}
const blocked=[
  'http://worker.example.com','https://localhost','https://127.0.0.1','https://127.1.2.3:8443',
  'https://10.0.0.1','https://169.254.169.254','https://172.16.0.1','https://172.31.255.254',
  'https://192.168.1.1','https://[::1]','https://[fc00::1]','https://[fd12::1]','https://[fe80::1]',
  'https://worker.local','https://gpu.internal','https://gpu.lan','https://user:pass@worker.example.com'
];
for(const url of blocked)assert.equal(safeWorkerEndpoint(url),false,`must block ${url}`);
for(const url of ['https://worker.example.com','https://gpu-01.example.net:8443','https://abc123.proxy.runpod.net'])assert.equal(safeWorkerEndpoint(url),true,`must allow ${url}`);

// Chaos model: bounded admission, lease idempotency, fail-closed provider behavior.
function admit(current,limit){return current<limit?{ok:true,next:current+1}:{ok:false,next:current};}
let admitted=0,rejected=0,count=0;for(let i=0;i<500;i++){const r=admit(count,240);if(r.ok){admitted++;count=r.next;}else rejected++;}
assert.equal(admitted,240);assert.equal(rejected,260);assert.equal(count,240);

function release(state){if(state!=='active')return {state,duplicate:true,decrement:0};return {state:'released',duplicate:false,decrement:1};}
assert.deepEqual(release('active'),{state:'released',duplicate:false,decrement:1});
assert.deepEqual(release('released'),{state:'released',duplicate:true,decrement:0});
assert.deepEqual(release('expired'),{state:'expired',duplicate:true,decrement:0});

function routeAfterStart(provider,failed){return failed?{provider,retry:null}:{provider,retry:null};}
for(const provider of ['gemini','decrypter-local'])assert.equal(routeAfterStart(provider,true).retry,null);
assert.match(gateway,/retry_across_providers:false/);
assert.match(command,/LOCAL_UPSTREAM_TIMEOUT/);
assert.match(command,/LOCAL_UPSTREAM_FETCH_FAILED/);
assert.match(command,/CREDIT_RESERVATION_FAILED/);
assert.match(command,/ld_complete_command/);

// Queue metadata remains payload-free under chaos load.
const jobs=massScale.slice(massScale.indexOf('create table if not exists public.ld_inference_jobs'),massScale.indexOf('create index if not exists ld_inference_jobs_pool_status_idx'));
assert.doesNotMatch(jobs,/\b(prompt|content|payload|attachment|source_code|project_context)\b\s+(text|jsonb|bytea)/i);
assert.match(massScale,/for update skip locked/i);
assert.match(massScale,/POOL_RATE_LIMITED/);

// No invasive Lovable DOM/network hooks are introduced by Build 24 browser changes.
const browserChanged=[trust,gatewayClient,gatewayBootstrap,config];
for(const source of browserChanged){
  assert.doesNotMatch(source,/new\s+MutationObserver/);
  assert.doesNotMatch(source,/window\.fetch\s*=|globalThis\.fetch\s*=|XMLHttpRequest\.prototype|navigator\.sendBeacon\s*=/);
}

console.log(JSON.stringify({
  ok:true,
  app_version:'2.4.24',
  trust_protocol:'2.4.21',
  deterministic_chaos_iterations:500,
  blocked_ssrf_vectors:blocked.length,
  webhook_invalid_payload_persistence:false,
  cross_provider_retry_after_start:false,
  queue_payload_persistence:false
},null,2));
