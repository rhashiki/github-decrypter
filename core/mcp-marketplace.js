import { mcpError, normalizeMcpEndpoint } from './mcp-protocol.js';
import {
  registerMcpServer,
  removeMcpServer,
  listMcpServers,
  setMcpServerTrust,
  setMcpMethodPermission,
  setMcpToolPolicy
} from './mcp-trust-gateway.js';

export const MCP_MARKETPLACE_SCHEMA = 'ld-mcp-marketplace/1';
export const MCP_MARKETPLACE_CATALOG_VERSION = 1;
export const MCP_MARKETPLACE_INSTALLS_KEY = 'ld2_mcp_marketplace_installs_v1';
export const MCP_MARKETPLACE_REVIEWED_AT = '2026-08-30';

const SUPABASE_FEATURES = Object.freeze([
  'docs', 'account', 'database', 'debugging', 'development', 'functions', 'branching', 'storage'
]);

const CATALOG = Object.freeze([
  Object.freeze({
    id: 'github-official-remote',
    version: 1,
    category: 'github',
    title: 'GitHub MCP Server',
    publisher: 'GitHub',
    badge: 'GH',
    risk: 'medium',
    trustLevel: 'verified-publisher',
    availability: 'direct',
    transport: 'streamable-http',
    description: 'Servidor MCP remoto oficial do GitHub para contexto de repositórios, issues, PRs, Actions e automações.',
    endpoint: Object.freeze({ mode: 'fixed', value: 'https://api.githubcopilot.com/mcp/', allowedQueryKeys: [] }),
    auth: Object.freeze({ defaultMode: 'bearer', supported: ['bearer', 'oauth'], requiresInteractiveSetup: true }),
    allowedMethods: Object.freeze(['server/discover', 'tools/list']),
    toolPolicy: 'manual-after-discovery',
    capabilities: Object.freeze(['repositories', 'code', 'issues', 'pull-requests', 'actions']),
    provenance: Object.freeze({
      sourceKind: 'official-repository',
      sourceUrl: 'https://github.com/github/github-mcp-server',
      docsUrl: 'https://docs.github.com/en/copilot/concepts/context/mcp',
      verifiedDomain: 'github.com',
      reviewedAt: MCP_MARKETPLACE_REVIEWED_AT
    })
  }),
  Object.freeze({
    id: 'supabase-official-remote',
    version: 1,
    category: 'supabase',
    title: 'Supabase MCP Server',
    publisher: 'Supabase',
    badge: 'SB',
    risk: 'medium',
    trustLevel: 'verified-publisher',
    availability: 'direct',
    transport: 'streamable-http',
    description: 'Servidor MCP remoto oficial do Supabase, com escopo por projeto, modo read-only e grupos de features.',
    endpoint: Object.freeze({
      mode: 'template',
      value: 'https://mcp.supabase.com/mcp',
      allowedQueryKeys: ['project_ref', 'read_only', 'features'],
      defaults: Object.freeze({ read_only: true, features: ['docs', 'database', 'debugging'] })
    }),
    auth: Object.freeze({ defaultMode: 'oauth', supported: ['oauth'], requiresInteractiveSetup: true }),
    allowedMethods: Object.freeze(['server/discover', 'tools/list']),
    toolPolicy: 'manual-after-discovery',
    capabilities: Object.freeze(['database', 'docs', 'debugging', 'development', 'functions']),
    provenance: Object.freeze({
      sourceKind: 'official-docs',
      sourceUrl: 'https://supabase.com/docs/guides/ai-tools/mcp',
      verifiedDomain: 'supabase.com',
      reviewedAt: MCP_MARKETPLACE_REVIEWED_AT
    })
  }),
  Object.freeze({
    id: 'mcp-git-reference',
    version: 1,
    category: 'code',
    title: 'Git Reference MCP',
    publisher: 'Model Context Protocol',
    badge: 'GIT',
    risk: 'low',
    trustLevel: 'official-reference',
    availability: 'bridge-required',
    transport: 'stdio',
    description: 'Servidor de referência oficial para leitura, busca e manipulação controlada de repositórios Git locais.',
    endpoint: null,
    auth: Object.freeze({ defaultMode: 'none', supported: ['none'], requiresInteractiveSetup: false }),
    allowedMethods: Object.freeze([]),
    toolPolicy: 'bridge-owned',
    capabilities: Object.freeze(['git', 'workspace', 'history']),
    provenance: Object.freeze({
      sourceKind: 'official-reference-server',
      sourceUrl: 'https://github.com/modelcontextprotocol/servers',
      verifiedDomain: 'modelcontextprotocol.io',
      reviewedAt: MCP_MARKETPLACE_REVIEWED_AT
    })
  }),
  Object.freeze({
    id: 'mcp-memory-reference',
    version: 1,
    category: 'memory',
    title: 'Memory Reference MCP',
    publisher: 'Model Context Protocol',
    badge: 'MEM',
    risk: 'low',
    trustLevel: 'official-reference',
    availability: 'bridge-required',
    transport: 'stdio',
    description: 'Servidor de referência oficial de memória persistente baseada em grafo de conhecimento.',
    endpoint: null,
    auth: Object.freeze({ defaultMode: 'none', supported: ['none'], requiresInteractiveSetup: false }),
    allowedMethods: Object.freeze([]),
    toolPolicy: 'bridge-owned',
    capabilities: Object.freeze(['memory', 'knowledge-graph', 'context']),
    provenance: Object.freeze({
      sourceKind: 'official-reference-server',
      sourceUrl: 'https://github.com/modelcontextprotocol/servers',
      verifiedDomain: 'modelcontextprotocol.io',
      reviewedAt: MCP_MARKETPLACE_REVIEWED_AT
    })
  }),
  Object.freeze({
    id: 'semgrep-official-security',
    version: 1,
    category: 'security',
    title: 'Semgrep MCP',
    publisher: 'Semgrep',
    badge: 'SEC',
    risk: 'medium',
    trustLevel: 'verified-publisher',
    availability: 'bridge-required',
    transport: 'stdio',
    description: 'Integração MCP oficial do Semgrep para análise de código, supply chain e secrets. Exige bridge/local host no runtime atual.',
    endpoint: null,
    auth: Object.freeze({ defaultMode: 'none', supported: ['none'], requiresInteractiveSetup: true }),
    allowedMethods: Object.freeze([]),
    toolPolicy: 'bridge-owned',
    capabilities: Object.freeze(['sast', 'sca', 'secrets', 'security-findings']),
    provenance: Object.freeze({
      sourceKind: 'publisher-product',
      sourceUrl: 'https://semgrep.dev/products/product-updates/semgrep-x-cursor-introducing-cursor-plugins/',
      verifiedDomain: 'semgrep.dev',
      reviewedAt: MCP_MARKETPLACE_REVIEWED_AT
    })
  }),
  Object.freeze({
    id: 'datadog-official-observability',
    version: 1,
    category: 'observability',
    title: 'Datadog MCP Server',
    publisher: 'Datadog',
    badge: 'DD',
    risk: 'medium',
    trustLevel: 'verified-publisher',
    availability: 'endpoint-required',
    transport: 'streamable-http',
    description: 'Servidor MCP oficial do Datadog para APM, logs, métricas, monitores, dashboards e sinais de segurança.',
    endpoint: Object.freeze({
      mode: 'user',
      allowedHostSuffixes: ['datadoghq.com', 'datadoghq.eu'],
      allowedQueryKeys: ['toolsets', 'omit_tools']
    }),
    auth: Object.freeze({ defaultMode: 'oauth', supported: ['oauth'], requiresInteractiveSetup: true }),
    allowedMethods: Object.freeze(['server/discover', 'tools/list']),
    toolPolicy: 'manual-after-discovery',
    capabilities: Object.freeze(['apm', 'logs', 'metrics', 'monitors', 'dashboards', 'security-signals']),
    provenance: Object.freeze({
      sourceKind: 'official-docs',
      sourceUrl: 'https://docs.datadoghq.com/mcp_server/',
      verifiedDomain: 'datadoghq.com',
      reviewedAt: MCP_MARKETPLACE_REVIEWED_AT
    })
  })
]);

function nowIso() { return new Date().toISOString(); }
function text(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function clone(value) { return structuredClone(value); }

export function listCuratedMcpCatalog() {
  return CATALOG.map(item => clone(item));
}

export function getCuratedMcpItem(id = '') {
  const item = CATALOG.find(entry => entry.id === String(id || '').trim());
  if (!item) throw mcpError('MCP_MARKETPLACE_ITEM_NOT_FOUND', `MCP curado não encontrado: ${id}`);
  return clone(item);
}

function safeFeatureList(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(raw.map(item => text(item, 80).toLowerCase()).filter(item => SUPABASE_FEATURES.includes(item)))];
}

function validateHost(url, suffixes = []) {
  const host = String(url.hostname || '').toLowerCase();
  if (!suffixes.some(suffix => host === suffix || host.endsWith(`.${suffix}`))) {
    throw mcpError('MCP_MARKETPLACE_ENDPOINT_HOST_REJECTED', `Host não pertence ao publisher curado: ${host}`, { host });
  }
}

export function buildCuratedMcpEndpoint(itemOrId, configuration = {}) {
  const item = typeof itemOrId === 'string' ? getCuratedMcpItem(itemOrId) : clone(itemOrId);
  if (!item?.endpoint || item.availability === 'bridge-required') {
    throw mcpError('MCP_MARKETPLACE_BRIDGE_REQUIRED', 'Este MCP exige um bridge/local host que o browser não inicia diretamente.', { itemId: item?.id || '' });
  }
  let url;
  if (item.endpoint.mode === 'user') {
    const supplied = text(configuration?.endpoint, 3000);
    if (!supplied) throw mcpError('MCP_MARKETPLACE_ENDPOINT_REQUIRED', 'Informe o endpoint regional fornecido pelo publisher.');
    url = new URL(normalizeMcpEndpoint(supplied, { allowedQueryKeys: item.endpoint.allowedQueryKeys || [] }));
    validateHost(url, item.endpoint.allowedHostSuffixes || []);
  } else {
    url = new URL(item.endpoint.value);
  }

  if (item.id === 'supabase-official-remote') {
    const defaults = item.endpoint.defaults || {};
    const projectRef = text(configuration?.project_ref, 100);
    if (projectRef && !/^[a-z0-9_-]{6,64}$/i.test(projectRef)) {
      throw mcpError('MCP_MARKETPLACE_PROJECT_REF_INVALID', 'project_ref do Supabase possui formato inválido.');
    }
    const readOnly = configuration?.read_only == null ? defaults.read_only !== false : configuration.read_only === true;
    const features = safeFeatureList(configuration?.features?.length ? configuration.features : defaults.features || []);
    if (projectRef) url.searchParams.set('project_ref', projectRef);
    url.searchParams.set('read_only', readOnly ? 'true' : 'false');
    if (features.length) url.searchParams.set('features', features.join(','));
  }

  if (item.id === 'datadog-official-observability') {
    const toolsets = text(configuration?.toolsets, 500);
    const omitTools = text(configuration?.omit_tools, 1000);
    if (toolsets) url.searchParams.set('toolsets', toolsets);
    if (omitTools) url.searchParams.set('omit_tools', omitTools);
  }

  return normalizeMcpEndpoint(url.toString(), { allowedQueryKeys: item.endpoint.allowedQueryKeys || [] });
}

async function loadInstalls() {
  const stored = await chrome.storage.local.get(MCP_MARKETPLACE_INSTALLS_KEY);
  return stored[MCP_MARKETPLACE_INSTALLS_KEY] && typeof stored[MCP_MARKETPLACE_INSTALLS_KEY] === 'object'
    ? stored[MCP_MARKETPLACE_INSTALLS_KEY]
    : {};
}

async function saveInstalls(installs) {
  await chrome.storage.local.set({ [MCP_MARKETPLACE_INSTALLS_KEY]: installs && typeof installs === 'object' ? installs : {} });
}

export async function listMcpMarketplaceInstalls() {
  const installs = await loadInstalls();
  return clone(installs);
}

export async function reconcileMcpMarketplaceInstalls() {
  const installs = await loadInstalls();
  const servers = await listMcpServers();
  const serverIds = new Set(servers.map(server => server.id));
  let changed = false;
  for (const [itemId, record] of Object.entries(installs)) {
    if (record?.status === 'installed' && record?.serverId && !serverIds.has(record.serverId)) {
      installs[itemId] = { ...record, status: 'revoked', revokedAt: nowIso(), revokeReason: 'server_missing' };
      changed = true;
    }
  }
  if (changed) await saveInstalls(installs);
  return clone(installs);
}

export async function installCuratedMcp(itemId, configuration = {}) {
  const item = getCuratedMcpItem(itemId);
  if (item.availability === 'bridge-required') {
    throw mcpError('MCP_MARKETPLACE_BRIDGE_REQUIRED', 'Este item é curado, mas exige bridge/local MCP antes de poder ser instalado no browser.', { itemId: item.id });
  }
  const installs = await reconcileMcpMarketplaceInstalls();
  const existing = installs[item.id];
  if (existing?.status === 'installed' && existing?.serverId) {
    const servers = await listMcpServers();
    const server = servers.find(entry => entry.id === existing.serverId);
    if (server) return { installed: true, reused: true, item, record: clone(existing), server };
  }

  const endpoint = buildCuratedMcpEndpoint(item, configuration);
  const authMode = item.auth.supported.includes(configuration?.authMode) ? configuration.authMode : item.auth.defaultMode;
  const server = await registerMcpServer({
    name: item.title,
    endpoint,
    allowedQueryKeys: item.endpoint?.allowedQueryKeys || [],
    auth: {
      mode: authMode,
      issuer: text(configuration?.issuer, 1000),
      clientId: text(configuration?.clientId, 1000)
    },
    marketplace: {
      itemId: item.id,
      catalogVersion: MCP_MARKETPLACE_CATALOG_VERSION,
      publisher: item.publisher,
      provenance: item.provenance.sourceUrl,
      verifiedDomain: item.provenance.verifiedDomain
    }
  });

  await setMcpServerTrust(server.id, 'approved');
  for (const method of item.allowedMethods || []) await setMcpMethodPermission(server.id, method, true);

  // Curated installation never auto-enables write tools. Exact per-tool policies are enabled only after discovery/user review.
  if (item.id === 'supabase-official-remote') {
    await setMcpToolPolicy(server.id, 'search_docs', {
      enabled: true,
      mode: 'read',
      reason: 'Curated safe seed: official Supabase documentation search only.'
    });
  }

  const record = {
    itemId: item.id,
    itemVersion: item.version,
    catalogVersion: MCP_MARKETPLACE_CATALOG_VERSION,
    status: 'installed',
    serverId: server.id,
    endpoint,
    publisher: item.publisher,
    trustLevel: item.trustLevel,
    installedAt: nowIso(),
    revokedAt: '',
    configuration: item.id === 'supabase-official-remote' ? {
      project_ref: text(configuration?.project_ref, 100),
      read_only: configuration?.read_only == null ? true : configuration.read_only === true,
      features: safeFeatureList(configuration?.features?.length ? configuration.features : item.endpoint.defaults?.features || [])
    } : {}
  };
  installs[item.id] = record;
  await saveInstalls(installs);
  return { installed: true, reused: false, item, record: clone(record), server: (await listMcpServers()).find(entry => entry.id === server.id) || server };
}

export async function revokeCuratedMcp(itemId, reason = 'user_revoked') {
  const item = getCuratedMcpItem(itemId);
  const installs = await loadInstalls();
  const record = installs[item.id];
  if (!record || record.status !== 'installed' || !record.serverId) {
    return { revoked: false, reason: 'not_installed', item };
  }
  const removal = await removeMcpServer(record.serverId, { revoke: true }).catch(error => {
    if (error?.code === 'MCP_SERVER_NOT_FOUND') return { removed: false, missing: true };
    throw error;
  });
  installs[item.id] = {
    ...record,
    status: 'revoked',
    revokedAt: nowIso(),
    revokeReason: text(reason, 200) || 'user_revoked'
  };
  await saveInstalls(installs);
  return { revoked: true, item, record: clone(installs[item.id]), removal };
}

export async function setCuratedMcpToolPolicy(itemId, toolName, policy = {}) {
  const installs = await reconcileMcpMarketplaceInstalls();
  const record = installs[itemId];
  if (!record?.serverId || record.status !== 'installed') throw mcpError('MCP_MARKETPLACE_NOT_INSTALLED', 'MCP curado não está instalado.');
  return setMcpToolPolicy(record.serverId, toolName, policy);
}

export function marketplaceStatus() {
  return {
    schema: MCP_MARKETPLACE_SCHEMA,
    build: 63,
    catalogVersion: MCP_MARKETPLACE_CATALOG_VERSION,
    reviewedAt: MCP_MARKETPLACE_REVIEWED_AT,
    entries: CATALOG.length,
    categories: [...new Set(CATALOG.map(item => item.category))],
    remoteCodeExecution: false,
    arbitraryCatalogInstall: false,
    writesAutoEnabled: false,
    defaultTrustSource: 'embedded-curated-catalog'
  };
}
