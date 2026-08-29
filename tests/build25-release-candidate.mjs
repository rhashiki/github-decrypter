import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
const config=fs.readFileSync('settings/config.js','utf8');
const trust=fs.readFileSync('security/trust.js','utf8');
const gatewayClient=fs.readFileSync('background/model-gateway-client.js','utf8');
const gatewayBootstrap=fs.readFileSync('background/model-gateway-bootstrap.js','utf8');
const gateway=fs.readFileSync('supabase/functions/ld-model-gateway/index.ts','utf8');
const command=fs.readFileSync('supabase/functions/ld-command/index.ts','utf8');
const webhook=fs.readFileSync('supabase/functions/ld-mercadopago-webhook/index.ts','utf8');
const build23=fs.readFileSync('supabase/migrations/20260828234500_build23_mass_scale.sql','utf8');
const build24=fs.readFileSync('supabase/migrations/20260829003000_build24_security_chaos_hardening.sql','utf8');
const releaseWorkflow=fs.readFileSync('.github/workflows/release.yml','utf8');
const rc=JSON.parse(fs.readFileSync('release/RC25_MANIFEST.json','utf8'));

assert.equal(manifest.manifest_version,3);
const versionParts=String(manifest.version||'').split('.').map(Number);
assert.equal(versionParts[0],2);
assert.equal(versionParts[1],4);
assert.ok(versionParts[2]>=25,'Current v2.4 build must not regress below RC25');
assert.match(config,/export const VERSION = '2\.4\.\d+'/);
assert.match(config,/export const TRUST_PROTOCOL_VERSION = '2\.4\.21'/);
assert.doesNotMatch(config,/TRUST_PROTOCOL_VERSION = '2\.4\.25'/);

assert.match(trust,/TRUST_PROTOCOL_VERSION/);
assert.match(trust,/client_version:TRUST_PROTOCOL_VERSION/);
assert.match(trust,/chrome\.storage\.session/);
assert.doesNotMatch(trust,/chrome\.storage\.local\.set/);
assert.match(gatewayClient,/'x-decrypter-client-version': TRUST_PROTOCOL_VERSION/);
assert.match(gatewayBootstrap,/'x-decrypter-client-version': TRUST_PROTOCOL_VERSION/);

assert.match(gateway,/trust_attestation_required:true/);
assert.match(gateway,/cross_provider_fallback:false/);
assert.match(gateway,/retry_across_providers:false/);
assert.match(command,/MODEL_GATEWAY_REQUIRED/);
assert.match(command,/ld_reserve_command/);
assert.match(command,/ld_complete_command/);
assert.match(command,/ld_claim_inference_worker/);
assert.match(command,/dispatch:"pooled-direct"/);
assert.doesNotMatch(command,/\/functions\/v1\/ld-local-(?:router|control)/);

assert.match(webhook,/paymentStatus==='approved'/);
assert.match(webhook,/payment_authoritative_entitlement:true/);
assert.match(webhook,/access_changed:false/);
assert.match(build24,/if new\.signature_valid is not true then/);
assert.match(build24,/ld_worker_endpoint_is_public_https/);
assert.match(build24,/octet_length\(payload::text\) <= 524288/);

const jobs=build23.slice(build23.indexOf('create table if not exists public.ld_inference_jobs'),build23.indexOf('create index if not exists ld_inference_jobs_pool_status_idx'));
assert.doesNotMatch(jobs,/\b(prompt|content|payload|attachment|source_code|project_context)\b\s+(text|jsonb|bytea)/i);

assert.match(releaseWorkflow,/branches:\s*\n\s*- main[\s\S]*paths:\s*\n\s*- '\.github\/RELEASE_TRIGGER'/);
assert.match(releaseWorkflow,/tags:\s*\n\s*- 'v\*'/);
assert.match(releaseWorkflow,/workflow_dispatch:/);

assert.equal(rc.schema,'ld-release-candidate/1');
assert.equal(rc.candidate,'2.4.25');
assert.equal(rc.trust_protocol_version,'2.4.21');
assert.equal(rc.release_state,'candidate-only');
assert.equal(rc.official_release_published,false);
assert.equal(rc.ota_published,false);
assert.equal(rc.database_migration_head.version,'20260829002720');
for(const name of ['ld-model-gateway','ld-command','ld-trust-attest','ld-commercial','ld-license-validate','ld-mercadopago-webhook','ld-local-control']){
  assert.equal(rc.critical_edge_functions[name].status,'ACTIVE');
  assert.match(rc.critical_edge_functions[name].ezbr_sha256,/^[a-f0-9]{64}$/);
}
assert.equal(rc.critical_edge_functions['ld-model-gateway'].version,5);
assert.equal(rc.critical_edge_functions['ld-command'].version,8);
assert.equal(rc.critical_edge_functions['ld-trust-attest'].version,1);
assert.equal(rc.critical_edge_functions['ld-commercial'].version,1);
assert.equal(rc.critical_edge_functions['ld-local-control'].version,1);

assert.equal(rc.release_invariants.server_authoritative_execution,true);
assert.equal(rc.release_invariants.trust_attestation_required,true);
assert.equal(rc.release_invariants.cross_provider_retry_after_execution_start,false);
assert.equal(rc.release_invariants.customer_prompt_persisted_in_gpu_queue,false);
assert.equal(rc.release_invariants.invalid_webhook_payload_persisted,false);
assert.equal(rc.release_invariants.gpu_worker_private_endpoint_allowed,false);
assert.equal(rc.release_invariants.free_mode_has_no_paid_fallback,true);

for(const browserFile of ['manifest.json','settings/config.js','security/trust.js','background/model-gateway-client.js','background/model-gateway-bootstrap.js']){
  const text=fs.readFileSync(browserFile,'utf8');
  assert.doesNotMatch(text,/SUPABASE_SERVICE_ROLE_KEY|LD_LICENSE_PRIVATE_JWK|DECRYPTER_LOCAL_TOKEN|DECRYPTER_WORKER_SECRET|MERCADOPAGO_ACCESS_TOKEN/);
}

console.log(JSON.stringify({
  ok:true,
  candidate:'2.4.25',
  current_version:manifest.version,
  trust_protocol:'2.4.21',
  critical_backend_functions:7,
  official_release_published:false,
  ota_published:false,
  release_trigger_guarded:true
},null,2));
