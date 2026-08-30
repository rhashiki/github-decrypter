import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  MCP_PROTOCOL_VERSION,
  normalizeMcpEndpoint,
  mcpResourceUri,
  originPermissionPattern,
  mcpRequestHeaders,
  buildMcpRequest
} from '../core/mcp-protocol.js';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const entry = read('background/service-worker-entry.js');
const bg = read('background/mcp-runtime.js');
const client = read('content/mcp-runtime-client.js');
const protocol = read('core/mcp-protocol.js');
const trust = read('core/mcp-trust-gateway.js');
const mcpClient = read('core/mcp-client.js');
const oauth = read('security/mcp-oauth.js');

const currentBuild = Number(String(manifest.version || '').split('.').at(-1));
assert.ok(Number.isInteger(currentBuild) && currentBuild >= 62, `Build62 contract requires authoritative Build >=62, received ${manifest.version}`);
assert.match(manifest.version_name, new RegExp(`Build ${currentBuild}\\b`));
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));
assert.ok(settings.includes("MCP_RUNTIME_SCHEMA = 'ld-mcp-runtime/1'"));
assert.ok(settings.includes("MCP_PROTOCOL_VERSION = '2026-07-28'"));
assert.equal(MCP_PROTOCOL_VERSION, '2026-07-28');

assert.ok(manifest.permissions.includes('identity'));
assert.ok(manifest.optional_host_permissions.includes('https://*/*'));
assert.ok(manifest.optional_host_permissions.includes('http://localhost/*'));
assert.ok(manifest.optional_host_permissions.includes('http://127.0.0.1/*'));
assert.ok(manifest.content_scripts[1].js.includes('content/mcp-runtime-client.js'));
assert.ok(entry.includes("import { installMcpRuntime } from './mcp-runtime.js';"));
assert.ok(entry.includes('installMcpRuntime();'));

assert.equal(normalizeMcpEndpoint('https://mcp.example.com/mcp'), 'https://mcp.example.com/mcp');
assert.equal(normalizeMcpEndpoint('http://127.0.0.1:7777/mcp'), 'http://127.0.0.1:7777/mcp');
assert.equal(originPermissionPattern('https://mcp.example.com/mcp'), 'https://mcp.example.com/*');
assert.throws(() => normalizeMcpEndpoint('http://mcp.example.com/mcp'), /HTTPS/);
assert.throws(() => normalizeMcpEndpoint('https://user:pass@mcp.example.com/mcp'), /Credenciais/);
assert.throws(() => normalizeMcpEndpoint('https://mcp.example.com/mcp?token=secret'), /sensível/);
assert.throws(() => normalizeMcpEndpoint('https://mcp.example.com/mcp?scope=repo'), /não autorizados/);
assert.equal(
  normalizeMcpEndpoint('https://mcp.example.com/mcp?scope=repo', { allowedQueryKeys: ['scope'] }),
  'https://mcp.example.com/mcp?scope=repo'
);
assert.equal(mcpResourceUri('https://mcp.example.com/mcp?scope=repo'), 'https://mcp.example.com/mcp');

const headers = mcpRequestHeaders({ method: 'tools/call', name: 'search' });
assert.equal(headers['MCP-Protocol-Version'], '2026-07-28');
assert.equal(headers['Mcp-Method'], 'tools/call');
assert.equal(headers['Mcp-Name'], 'search');
assert.ok(!('Authorization' in headers));
const req = buildMcpRequest({ method: 'tools/list', client: { clientVersion: manifest.version } });
assert.equal(req.jsonrpc, '2.0');
assert.equal(req.method, 'tools/list');
assert.equal(req.params._meta['io.modelcontextprotocol/clientInfo'].version, manifest.version);

for (const token of [
  "'server/discover'",
  "'tools/list'",
  "'tools/call'",
  "'Mcp-Method'",
  "'Mcp-Name'",
  "'text/event-stream'",
  "redirect: 'error'"
]) assert.ok(`${protocol}\n${mcpClient}`.includes(token), token);
assert.ok(!protocol.includes('Mcp-Session-Id'));
assert.ok(!protocol.includes("method: 'initialize'"));

for (const token of [
  "trust: 'pending'",
  "MCP_TOOL_NOT_ALLOWLISTED",
  "MCP_METHOD_NOT_ALLOWLISTED",
  "MCP_SERVER_NOT_TRUSTED",
  "MCP_SCOPE_LOCK_ARGUMENT_REJECTED",
  "MCP_SCOPE_LOCK_VALUE_REJECTED",
  "MCP_SCOPE_LOCK_PREFIX_REJECTED",
  "MCP_WRITE_APPROVAL_REQUIRED",
  "MCP_APPROVAL_BINDING_MISMATCH",
  "humanDecision !== true",
  "chrome.storage.session",
  "APPROVAL_TTL_MS = 5 * 60 * 1000"
]) assert.ok(trust.includes(token), token);
assert.ok(!trust.includes('chrome.storage.local.set({ [AUTH_KEY]'), 'MCP auth secrets must not be persisted in local storage');

for (const token of [
  "code_challenge_method', 'S256'",
  "searchParams.set('resource'",
  "MCP_OAUTH_ISSUER_MISMATCH",
  "MCP_OAUTH_RESPONSE_ISSUER_MISMATCH",
  "MCP_OAUTH_PKCE_S256_REQUIRED",
  "resource: discovery.resource",
  "persistentTokenStorage: false"
]) assert.ok(oauth.includes(token), token);
assert.ok(!oauth.includes('client_secret'));
assert.ok(!oauth.includes('access_token='));

for (const token of [
  "writePolicy: 'explicit-tool-allowlist+scope-lock+one-time-human-approval'",
  'unknownToolsDefaultDeny: true',
  'serverAnnotationsTrustedForSecurity: false',
  'writesRequireHumanApproval: true',
  "chrome.permissions.contains",
  "chrome.permissions.request",
  "legacyHttpSse: false",
  "stdioBrowserProcessSpawn: false"
]) assert.ok(bg.includes(token), token);
assert.ok(client.includes('prepareWrite'));
assert.ok(client.includes('approveWrite'));
assert.ok(client.includes('requestHostPermission'));

assert.ok(mcpClient.includes('beginOperation'));
assert.ok(mcpClient.includes('finishOperation'));
assert.ok(mcpClient.includes("credentials: 'omit'"));
assert.ok(mcpClient.includes("securityAuthority: 'local-trust-gateway'"));
assert.ok(pkg.notes.includes('MCP'));
assert.ok(pkg.forbidden_roots.includes('runtime'));
assert.ok(!JSON.stringify(manifest).includes('runtime/decrypter-local'));

console.log(`Build62 MCP Core + Trust Gateway contract OK on authoritative Build ${currentBuild}`);
