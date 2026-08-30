import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  MCP_MARKETPLACE_SCHEMA,
  MCP_MARKETPLACE_CATALOG_VERSION,
  listCuratedMcpCatalog,
  getCuratedMcpItem,
  buildCuratedMcpEndpoint,
  marketplaceStatus
} from '../core/mcp-marketplace.js';
import { normalizeMcpEndpoint } from '../core/mcp-protocol.js';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const entry = read('background/service-worker-entry.js');
const marketplace = read('core/mcp-marketplace.js');
const trust = read('core/mcp-trust-gateway.js');
const protocol = read('core/mcp-protocol.js');
const oauth = read('security/mcp-oauth.js');
const bg = read('background/mcp-marketplace-runtime.js');
const client = read('content/mcp-marketplace-client.js');
const ui = read('ui/mcp-marketplace-v63.js');
const css = read('ui/mcp-marketplace-v63.css');

assert.equal(manifest.version, '2.6.63');
assert.match(manifest.version_name, /Build 63 · Curated MCP Marketplace/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes("VERSION = '2.6.63'"));
assert.ok(settings.includes("MCP_MARKETPLACE_SCHEMA = 'ld-mcp-marketplace/1'"));
assert.ok(settings.includes('MCP_MARKETPLACE_CATALOG_VERSION = 1'));
assert.equal(MCP_MARKETPLACE_SCHEMA, 'ld-mcp-marketplace/1');
assert.equal(MCP_MARKETPLACE_CATALOG_VERSION, 1);

const status = marketplaceStatus();
assert.equal(status.build, 63);
assert.equal(status.remoteCodeExecution, false);
assert.equal(status.arbitraryCatalogInstall, false);
assert.equal(status.writesAutoEnabled, false);

const catalog = listCuratedMcpCatalog();
assert.equal(catalog.length, 6);
assert.deepEqual(new Set(catalog.map(item => item.category)), new Set(['github','supabase','code','memory','security','observability']));
for (const item of catalog) {
  assert.ok(item.id);
  assert.ok(item.publisher);
  assert.ok(item.provenance?.sourceUrl);
  assert.ok(item.provenance?.verifiedDomain);
  assert.equal(item.provenance?.reviewedAt, '2026-08-30');
  assert.ok(['verified-publisher','official-reference'].includes(item.trustLevel));
}

const github = getCuratedMcpItem('github-official-remote');
assert.equal(github.publisher, 'GitHub');
assert.equal(github.endpoint.value, 'https://api.githubcopilot.com/mcp/');
assert.equal(github.availability, 'direct');
assert.equal(github.toolPolicy, 'manual-after-discovery');

const supabase = getCuratedMcpItem('supabase-official-remote');
assert.deepEqual(supabase.endpoint.allowedQueryKeys, ['project_ref','read_only','features']);
const supabaseEndpoint = buildCuratedMcpEndpoint('supabase-official-remote', {
  project_ref: 'abcdefghij1234567890',
  read_only: true,
  features: ['docs','database','debugging']
});
assert.ok(supabaseEndpoint.startsWith('https://mcp.supabase.com/mcp?'));
assert.ok(supabaseEndpoint.includes('project_ref=abcdefghij1234567890'));
assert.ok(supabaseEndpoint.includes('read_only=true'));
assert.ok(supabaseEndpoint.includes('features=docs%2Cdatabase%2Cdebugging'));
assert.throws(() => buildCuratedMcpEndpoint('supabase-official-remote', { project_ref: 'bad ref!' }), /project_ref/);

assert.throws(() => buildCuratedMcpEndpoint('mcp-git-reference'), error => error?.code === 'MCP_MARKETPLACE_BRIDGE_REQUIRED');
assert.throws(() => buildCuratedMcpEndpoint('mcp-memory-reference'), error => error?.code === 'MCP_MARKETPLACE_BRIDGE_REQUIRED');
assert.throws(() => buildCuratedMcpEndpoint('semgrep-official-security'), error => error?.code === 'MCP_MARKETPLACE_BRIDGE_REQUIRED');
assert.throws(() => buildCuratedMcpEndpoint('datadog-official-observability', { endpoint:'https://evil.example/mcp' }), error => error?.code === 'MCP_MARKETPLACE_ENDPOINT_HOST_REJECTED');
const dd = buildCuratedMcpEndpoint('datadog-official-observability', { endpoint:'https://mcp.us5.datadoghq.com/mcp', toolsets:'apm,llmobs' });
assert.equal(new URL(dd).hostname, 'mcp.us5.datadoghq.com');
assert.equal(new URL(dd).searchParams.get('toolsets'), 'apm,llmobs');

assert.throws(() => normalizeMcpEndpoint('https://mcp.example.com/mcp?api_key=abc', { allowSafeQuery:true }), error => error?.code === 'MCP_ENDPOINT_SECRET_QUERY_FORBIDDEN');
assert.throws(() => normalizeMcpEndpoint('https://mcp.example.com/mcp?scope=all'), error => error?.code === 'MCP_ENDPOINT_QUERY_FORBIDDEN');
assert.equal(normalizeMcpEndpoint('https://mcp.example.com/mcp?scope=all', { allowedQueryKeys:['scope'] }), 'https://mcp.example.com/mcp?scope=all');

for (const token of [
  'MCP_MARKETPLACE_INSTALLS_KEY',
  'installCuratedMcp',
  'revokeCuratedMcp',
  'reconcileMcpMarketplaceInstalls',
  "writesAutoEnabled: false",
  "remoteCodeExecution: false",
  "arbitraryCatalogInstall: false",
  "setMcpToolPolicy(server.id, 'search_docs'",
  "mode: 'read'"
]) assert.ok(marketplace.includes(token), token);
assert.ok(!marketplace.includes("mode: 'write',\n      reason: 'Curated safe seed"));
assert.ok(marketplace.includes("availability: 'bridge-required'"));
assert.ok(marketplace.includes('https://api.githubcopilot.com/mcp/'));
assert.ok(marketplace.includes('https://mcp.supabase.com/mcp'));
assert.ok(marketplace.includes('https://docs.datadoghq.com/mcp_server/'));
assert.ok(marketplace.includes('semgrep.dev'));

for (const token of [
  'allowedQueryKeys',
  'removeMcpServer',
  'approvalsRevoked',
  'chrome.storage.session.get(null)',
  'marketplace:'
]) assert.ok(trust.includes(token), token);
assert.ok(protocol.includes('SENSITIVE_QUERY_KEY'));
assert.ok(protocol.includes('MCP_ENDPOINT_SECRET_QUERY_FORBIDDEN'));
assert.ok(protocol.includes('mcpResourceUri'));
assert.ok(oauth.includes('requestEndpoint: normalizeMcpEndpoint'));
assert.ok(oauth.includes('resource: mcpResourceUri(server.endpoint)'));

assert.ok(entry.includes("import { installMcpMarketplaceRuntime } from './mcp-marketplace-runtime.js';"));
assert.ok(entry.includes('installMcpMarketplaceRuntime();'));
assert.ok(manifest.content_scripts[1].js.includes('content/mcp-marketplace-client.js'));
assert.ok(manifest.content_scripts[1].js.includes('ui/mcp-marketplace-v63.js'));
assert.ok(manifest.content_scripts[1].css.includes('ui/mcp-marketplace-v63.css'));

for (const token of [
  "PORT_NAME = 'ld2-mcp-marketplace'",
  "arbitraryRemoteCatalog: false",
  "remoteCodeExecution: false",
  "writeToolsAutoEnabled: false",
  'request_host_permission'
]) assert.ok(bg.includes(token), token);
for (const token of ['catalog:', 'install:', 'revoke:', 'requestHostPermission:', 'setToolPolicy:']) assert.ok(client.includes(token), token);
for (const token of ['Curated MCP Marketplace', 'Bridge local necessário', 'Writes', 'Nunca habilitados automaticamente', 'data-ld63-mcp-marketplace']) assert.ok(ui.includes(token), token);
assert.ok(css.includes('@media(max-width:760px)'));
assert.ok(css.includes('font-family:Arial'));
assert.ok(css.includes('prefers-reduced-motion'));

assert.ok(pkg.notes.includes('Build63'));
assert.ok(pkg.notes.includes('No remote catalog'));
assert.ok(pkg.forbidden_roots.includes('runtime'));
assert.ok(!JSON.stringify(manifest).includes('runtime/decrypter-local'));

console.log('Build63 Curated MCP Marketplace contract OK');
