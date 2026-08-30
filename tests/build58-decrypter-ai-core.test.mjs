import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const entry = read('background/service-worker-entry.js');
const client = read('background/agent-runtime-client.js');
const agent = read('supabase/functions/ld-agent-runtime/index.ts');
const gateway = read('supabase/functions/ld-model-gateway/index.ts');
const migration = read('supabase/migrations/20260830084751_build58_decrypter_ai_agent_runtime.sql');
const fixMigration = read('supabase/migrations/20260830085526_build58_agent_claim_step_fix.sql');
const serviceWorker = read('background/service-worker.js');
const gatewayBootstrap = read('background/model-gateway-bootstrap.js');

assert.equal(manifest.version, '2.6.58');
assert.match(manifest.version_name, /Build 58 · Decrypter AI Core/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));

assert.ok(entry.includes("import { installAgentRuntimeClient } from './agent-runtime-client.js'"));
assert.ok(entry.includes('installAgentRuntimeClient();'));
assert.ok(client.includes("PORT_NAME = 'ld2-agent-runtime'"));
for (const action of ['status','start','get','step','complete','cancel']) assert.ok(client.includes(`'${action}'`), action);
assert.ok(client.includes('ensureTrustSession(settings)'));
assert.ok(client.includes("'x-decrypter-trust': trust.token"));
assert.ok(client.includes("gemini_billing_mode: 'free'"));
assert.ok(client.includes('oneInferencePerStep: true'));
assert.ok(client.includes('rawContentPersistence: false'));

assert.ok(agent.includes("const SCHEMA='ld-agent-runtime/1'"));
assert.ok(agent.includes('const BUILD=58'));
for (const token of [
  'start_inference:false',
  'one_inference_per_step:true',
  'model_gateway_authority:true',
  'zero_cost:true',
  'paid_mode_allowed:false',
  'raw_content_persistence:false',
  'trajectory_capture:false',
  'tool_execution:false',
  'automatic_loop:false',
  'inference_started:false'
]) assert.ok(agent.includes(token), token);
assert.equal((agent.match(/\/ld-model-gateway/g) || []).length, 1, 'Agent Runtime must have one model gateway dispatch site');
assert.ok(agent.includes("gemini_billing_mode:'free'"));
assert.ok(agent.includes("sb.rpc('ld_agent_claim_step'"));
assert.ok(agent.includes("action==='start'"));
assert.ok(agent.indexOf("action==='start'") < agent.indexOf('/ld-model-gateway'), 'start must be handled before inference dispatch');
assert.ok(agent.includes('raw_content_persisted:false'));
assert.ok(!/child_process|Deno\.Command|eval\s*\(|new Function/.test(agent), 'Build58 must not introduce arbitrary tool execution');

const key = source => source.match(/PUBLIC_SPKI_B64=['\"]([^'\"]+)/)?.[1] || '';
assert.ok(key(agent));
assert.equal(key(agent), key(gateway), 'Agent Runtime must verify the same signing authority as Model Gateway');

for (const token of [
  'create table if not exists public.ld_agent_runs',
  'create table if not exists public.ld_agent_steps',
  'max_steps between 1 and 8',
  'step_count between 0 and 8',
  'alter table public.ld_agent_runs enable row level security',
  'alter table public.ld_agent_steps enable row level security',
  'revoke all on table public.ld_agent_runs from public, anon, authenticated',
  'revoke all on table public.ld_agent_steps from public, anon, authenticated',
  'security invoker',
  "set search_path = ''",
  'ld_agent_claim_step'
]) assert.ok(migration.includes(token), token);
assert.ok(!/\b(prompt|response|context|command)\s+(text|jsonb)\b/i.test(migration), 'raw prompts/responses/context must not be persisted');
assert.ok(migration.includes('command_hash text'));
assert.ok(migration.includes('input_hash text'));
assert.ok(migration.includes('output_hash text'));

assert.ok(fixMigration.includes('update public.ld_agent_runs as r'));
assert.ok(fixMigration.includes('r.step_count < r.max_steps'));
assert.ok(fixMigration.includes('returning r.step_count, r.mode, r.status, r.max_steps'));
assert.ok(fixMigration.includes('security invoker'));

const app = manifest.content_scripts.find(item => Array.isArray(item.js) && item.js.includes('ui/ui-kernel-v48.js'));
assert.ok(app);
assert.ok(!app.js.some(path => /agent-runtime/i.test(path)), 'Build58 agent runtime must remain background/server-only');
assert.ok(!serviceWorker.includes('ld-agent-runtime'), 'existing Plan/Build switch must not be silently redirected in Build58');
assert.ok(gatewayBootstrap.includes('GeminiAgent.prototype.backendCommand'));
assert.ok(gatewayBootstrap.includes('/ld-model-gateway'));

assert.ok(!/XMLHttpRequest\.prototype\s*\.|window\.fetch\s*=|globalThis\.fetch\s*=|navigator\.sendBeacon\s*=/.test(client + agent));
assert.ok(!agent.includes('user_paid'));
assert.ok(!client.includes('user_paid'));
assert.match(pkg.notes, /No OTA metadata, GitHub Release or store publication is authorized/);
assert.ok(!read('release/homologation-v2.5.57.json').includes('"release_authorized": true'));

console.log('Build58 Decrypter AI Core contract OK');
