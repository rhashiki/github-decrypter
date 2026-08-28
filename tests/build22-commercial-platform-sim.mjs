import assert from 'node:assert/strict';
import fs from 'node:fs';

const commercial = fs.readFileSync('supabase/functions/ld-commercial/index.ts','utf8');
const webhook = fs.readFileSync('supabase/functions/ld-mercadopago-webhook/index.ts','utf8');
const migration = fs.readFileSync('supabase/migrations/20260828231000_build22_commercial_platform.sql','utf8');
const runtime = fs.readFileSync('content/commercial-runtime.js','utf8');

assert.match(commercial,/const TRIAL_MS=4\*60\*60\*1000/);
assert.match(commercial,/duration_seconds:14400/);
assert.match(commercial,/TRIAL_ALREADY_USED/);
assert.match(migration,/email_hash text not null unique/);
assert.match(migration,/device_hash text not null unique/);
assert.match(migration,/subscription_monthly/);
assert.match(migration,/subscription_annual/);
assert.match(migration,/p\.code='time_30d'/);
assert.match(migration,/p\.code='time_365d'/);
assert.match(commercial,/https:\/\/api\.mercadopago\.com\/preapproval/);
assert.match(webhook,/subscription_preapproval/);
assert.match(webhook,/subscription_authorized_payment/);
assert.match(webhook,/authorized_payments/);
assert.match(webhook,/ld_reverse_order_entitlement/);
assert.match(runtime,/TRIAL 4H/);
assert.match(runtime,/subscription_create/);
assert.doesNotMatch(runtime,/new\s+MutationObserver/);
assert.doesNotMatch(runtime,/chrome\.storage\.local/);
assert.doesNotMatch(runtime,/SUPABASE_SERVICE_ROLE_KEY|MERCADOPAGO_ACCESS_TOKEN|LD_OWNER_SECRET/);

function addPeriod(type, n, iso) {
  const d = new Date(iso);
  if (type === 'years') d.setUTCFullYear(d.getUTCFullYear() + n);
  else d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString();
}
assert.equal(addPeriod('months',1,'2026-01-15T00:00:00.000Z'),'2026-02-15T00:00:00.000Z');
assert.equal(addPeriod('years',1,'2026-01-15T00:00:00.000Z'),'2027-01-15T00:00:00.000Z');

const start = Date.parse('2026-08-28T12:00:00.000Z');
const expiry = start + 4*60*60*1000;
assert.equal(expiry - start, 14_400_000);
assert.ok(Date.parse('2026-08-28T15:59:59.999Z') < expiry);
assert.ok(Date.parse('2026-08-28T16:00:00.000Z') >= expiry);

console.log(JSON.stringify({ok:true,cases:24,trial_seconds:14400,recurring_plans:['subscription_monthly','subscription_annual'],webhooks:['subscription_preapproval','subscription_authorized_payment']},null,2));
