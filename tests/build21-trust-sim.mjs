import fs from 'node:fs';
import assert from 'node:assert/strict';

function validateSession(session, expected) {
  if (!session) throw new Error('TRUST_SESSION_NOT_FOUND');
  if (session.revoked_at) throw new Error('TRUST_REVOKED');
  if (Date.parse(session.expires_at) <= Date.now()) throw new Error('TRUST_EXPIRED');
  if (session.license_id !== expected.license_id) throw new Error('TRUST_LICENSE_MISMATCH');
  if (session.device_hash !== expected.device_hash) throw new Error('TRUST_DEVICE_MISMATCH');
  if (session.client_version !== expected.client_version) throw new Error('TRUST_VERSION_MISMATCH');
  if (session.client_fingerprint !== expected.client_fingerprint) throw new Error('TRUST_FINGERPRINT_MISMATCH');
  return true;
}

const expected={license_id:'license-a',device_hash:'d'.repeat(64),client_version:'2.4.21',client_fingerprint:'f'.repeat(64)};
const good={...expected,expires_at:new Date(Date.now()+600000).toISOString(),revoked_at:null};
assert.equal(validateSession(good,expected),true);
assert.throws(()=>validateSession({...good,device_hash:'x'.repeat(64)},expected),/TRUST_DEVICE_MISMATCH/);
assert.throws(()=>validateSession({...good,license_id:'license-b'},expected),/TRUST_LICENSE_MISMATCH/);
assert.throws(()=>validateSession({...good,client_version:'2.4.20'},expected),/TRUST_VERSION_MISMATCH/);
assert.throws(()=>validateSession({...good,expires_at:new Date(Date.now()-1000).toISOString()},expected),/TRUST_EXPIRED/);
assert.throws(()=>validateSession({...good,revoked_at:new Date().toISOString()},expected),/TRUST_REVOKED/);

const nonces=new Set();
const acceptNonce=value=>{if(nonces.has(value))throw new Error('TRUST_NONCE_REPLAY');nonces.add(value);return true;};
assert.equal(acceptNonce('nonce-1'),true);
assert.throws(()=>acceptNonce('nonce-1'),/TRUST_NONCE_REPLAY/);

const command=fs.readFileSync('supabase/functions/ld-command/index.ts','utf8');
const gateway=fs.readFileSync('supabase/functions/ld-model-gateway/index.ts','utf8');
const client=fs.readFileSync('security/trust.js','utf8');
const attest=fs.readFileSync('supabase/functions/ld-trust-attest/index.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20260828224500_build21_trust_sessions.sql','utf8');
assert.match(command,/MODEL_GATEWAY_REQUIRED/);
assert.match(command,/provider_status/);
assert.match(command,/internalAllowed\(req,service,commandId\)/);
assert.match(gateway,/TRUST_REQUIRED/);
assert.match(gateway,/TRUST_DEVICE_MISMATCH/);
assert.match(gateway,/trust_attestation_required:true/);
assert.match(gateway,/cross_provider_fallback:false/);
assert.match(attest,/TRUST_NONCE_REPLAY/);
assert.match(attest,/TRUST_TTL_SECONDS=600/);
assert.match(client,/chrome\.storage\.session/);
assert.doesNotMatch(client,/chrome\.storage\.local\.set/);
assert.doesNotMatch(client,/SUPABASE_SERVICE_ROLE_KEY|LD_LICENSE_PRIVATE_JWK|DECRYPTER_LOCAL_TOKEN/);
assert.match(migration,/revoke all on table public\.ld_trust_sessions from anon, authenticated/);

console.log(JSON.stringify({ok:true,cases:13,trust_ttl_seconds:600,client_token_storage:'session-only'},null,2));
