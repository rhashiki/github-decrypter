import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const entry = read('background/service-worker-entry.js');
const client = read('background/tool-runtime-client.js');
const edge = read('supabase/functions/ld-tool-runtime/index.ts');
const migration = read('supabase/migrations/20260830095614_build61_tool_runtime_audit.sql');
const worker = read('runtime/decrypter-tools/tool-worker.cjs');
const dockerfile = read('runtime/decrypter-tools/Dockerfile');
const compose = read('runtime/decrypter-tools/compose.yaml');

assert.equal(manifest.version, '2.6.61');
assert.match(manifest.version_name, /Build 61 · Tool Runtime \+ LSP/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes("VERSION = '2.6.61'"));
assert.ok(pkg.forbidden_roots.includes('runtime'));
assert.ok(!JSON.stringify(manifest).includes('runtime/decrypter-tools'));

assert.ok(entry.includes("import { installToolRuntimeClient } from './tool-runtime-client.js'"));
assert.ok(entry.includes('installToolRuntimeClient();'));
assert.ok(client.includes("PORT_NAME = 'ld2-tool-runtime'"));
assert.ok(client.includes("const ACTIONS = new Set(['status', 'invoke'])"));
for (const tool of ['workspace.list','workspace.read','workspace.grep','lsp.diagnostics','lsp.definition','lsp.references']) assert.ok(client.includes(tool), tool);
for (const token of ['explicitInvocationOnly: true','readOnly: true','writeTools: false','arbitraryShell: false','ensureTrustSession(settings)']) assert.ok(client.includes(token), token);

assert.ok(edge.includes("const SCHEMA='ld-tool-runtime/1'"));
assert.ok(edge.includes('const BUILD=61'));
for (const tool of ['workspace.list','workspace.read','workspace.grep','lsp.diagnostics','lsp.definition','lsp.references']) assert.ok(edge.includes(tool), tool);
for (const token of [
  'explicit_invocation_only:true',
  'read_only:true',
  'write_tools:false',
  'arbitrary_shell:false',
  'arbitrary_command:false',
  'network_tool:false',
  'raw_input_persistence:false',
  'raw_output_persistence:false',
  'trust_required:true',
  'scope_lock_required_for_future_writes:true',
  "DECRYPTER_TOOL_WORKER_URL",
  "DECRYPTER_TOOL_WORKER_TOKEN",
  "sb.from('ld_tool_invocations')",
  'TOOL_NOT_ALLOWLISTED',
  'TOOL_RESULT_TOO_LARGE'
]) assert.ok(edge.includes(token), token);
assert.ok(!/Deno\.Command|eval\s*\(|new Function/.test(edge), 'Edge tool authority must not execute OS commands');

for (const token of [
  'create table public.ld_tool_invocations',
  'input_hash text not null',
  'output_hash text',
  'alter table public.ld_tool_invocations enable row level security',
  'revoke all on table public.ld_tool_invocations from public, anon, authenticated',
  'grant select, insert on table public.ld_tool_invocations to service_role'
]) assert.ok(migration.includes(token), token);
assert.ok(!/\b(input|output|content|prompt|response)\s+(text|jsonb)\b/i.test(migration.replace(/input_hash|output_hash/g, 'hash')), 'audit table must not persist raw tool content');

for (const token of [
  "'workspace.list'",
  "'workspace.read'",
  "'workspace.grep'",
  "'lsp.diagnostics'",
  "'lsp.definition'",
  "'lsp.references'",
  "spawn('typescript-language-server', ['--stdio'",
  'SYMLINK_ESCAPE_BLOCKED',
  'PATH_ESCAPE_BLOCKED',
  'arbitrary_shell: false',
  'raw_output_persistence: false'
]) assert.ok(worker.includes(token), token);
assert.ok(!/exec\s*\(|execSync\s*\(|shell:\s*true/.test(worker), 'worker must not expose shell execution');
assert.ok(dockerfile.includes('typescript@6.0.3'));
assert.ok(dockerfile.includes('typescript-language-server@6.0.0'));
assert.ok(compose.includes('read_only: true'));
assert.ok(compose.includes('cap_drop: ["ALL"]'));
assert.ok(compose.includes('no-new-privileges:true'));
assert.ok(compose.includes(':/workspace:ro'));

console.log('Build61 Tool Runtime + Coding Tools + LSP contract OK');
