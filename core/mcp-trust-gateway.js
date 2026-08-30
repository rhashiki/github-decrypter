import { normalizeMcpEndpoint, originPermissionPattern, mcpError } from './mcp-protocol.js';
import { sha256Text } from './patch-engine.js';

const SERVER_KEY = 'ld2_mcp_servers_v1';
const AUTH_KEY = 'ld2_mcp_auth_session_v1';
const APPROVAL_PREFIX = 'ld2_mcp_write_approval_v1_';
const APPROVAL_TTL_MS = 5 * 60 * 1000;
const MAX_SERVERS = 80;

function nowIso() { return new Date().toISOString(); }
function text(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function cleanId(value = '') { return text(value, 120).replace(/[^a-z0-9._-]/gi, ''); }
function safeQueryKeys(value = []) {
  return [...new Set((Array.isArray(value) ? value : []).map(item => text(item, 120)).filter(item => /^[a-z0-9._-]+$/i.test(item)))].slice(0, 40);
}

function publicServer(server = {}) {
  return {
    id: server.id,
    name: server.name,
    endpoint: server.endpoint,
    permissionOrigin: server.permissionOrigin,
    protocolVersion: server.protocolVersion,
    trust: server.trust,
    auth: server.auth || { mode: 'none', issuer: '', clientId: '' },
    allowedMethods: Array.isArray(server.allowedMethods) ? server.allowedMethods : [],
    allowedQueryKeys: safeQueryKeys(server.allowedQueryKeys),
    toolPolicies: server.toolPolicies && typeof server.toolPolicies === 'object' ? structuredClone(server.toolPolicies) : {},
    marketplace: server.marketplace && typeof server.marketplace === 'object' ? {
      itemId: text(server.marketplace.itemId, 160),
      catalogVersion: Number(server.marketplace.catalogVersion || 0) || 0,
      publisher: text(server.marketplace.publisher, 200),
      provenance: text(server.marketplace.provenance, 2000),
      verifiedDomain: text(server.marketplace.verifiedDomain, 300),
      installedAt: text(server.marketplace.installedAt, 100),
      revokedAt: text(server.marketplace.revokedAt, 100)
    } : null,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt
  };
}

async function loadServers() {
  const stored = await chrome.storage.local.get(SERVER_KEY);
  return Array.isArray(stored[SERVER_KEY]) ? stored[SERVER_KEY] : [];
}

async function saveServers(list) {
  await chrome.storage.local.set({ [SERVER_KEY]: (Array.isArray(list) ? list : []).slice(0, MAX_SERVERS) });
}

async function updateServer(id, mutator) {
  const servers = await loadServers();
  const index = servers.findIndex(item => item?.id === id);
  if (index < 0) throw mcpError('MCP_SERVER_NOT_FOUND', 'Servidor MCP não encontrado.');
  const next = mutator(structuredClone(servers[index]));
  next.updatedAt = nowIso();
  servers[index] = next;
  await saveServers(servers);
  return publicServer(next);
}

export async function registerMcpServer({ name = '', endpoint = '', auth = {}, allowedQueryKeys = [], marketplace = null } = {}) {
  const queryKeys = safeQueryKeys(allowedQueryKeys);
  const safeEndpoint = normalizeMcpEndpoint(endpoint, { allowedQueryKeys: queryKeys });
  const servers = await loadServers();
  const duplicate = servers.find(item => item?.endpoint === safeEndpoint);
  if (duplicate) return publicServer(duplicate);
  const installedAt = marketplace?.itemId ? nowIso() : '';
  const server = {
    id: crypto.randomUUID(),
    name: text(name, 160) || new URL(safeEndpoint).hostname,
    endpoint: safeEndpoint,
    permissionOrigin: originPermissionPattern(safeEndpoint),
    protocolVersion: '2026-07-28',
    trust: 'pending',
    auth: {
      mode: ['none', 'bearer', 'oauth'].includes(String(auth?.mode || 'none')) ? String(auth.mode || 'none') : 'none',
      issuer: text(auth?.issuer, 1000),
      clientId: text(auth?.clientId, 1000)
    },
    allowedMethods: ['server/discover', 'tools/list'],
    allowedQueryKeys: queryKeys,
    toolPolicies: {},
    marketplace: marketplace?.itemId ? {
      itemId: text(marketplace.itemId, 160),
      catalogVersion: Number(marketplace.catalogVersion || 0) || 0,
      publisher: text(marketplace.publisher, 200),
      provenance: text(marketplace.provenance, 2000),
      verifiedDomain: text(marketplace.verifiedDomain, 300),
      installedAt,
      revokedAt: ''
    } : null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  servers.unshift(server);
  await saveServers(servers);
  return publicServer(server);
}

export async function listMcpServers() { return (await loadServers()).map(publicServer); }

export async function getMcpServer(id = '') {
  const server = (await loadServers()).find(item => item?.id === cleanId(id));
  if (!server) throw mcpError('MCP_SERVER_NOT_FOUND', 'Servidor MCP não encontrado.');
  return structuredClone(server);
}

export async function removeMcpServer(id = '', { revoke = true } = {}) {
  const serverId = cleanId(id);
  const servers = await loadServers();
  const index = servers.findIndex(item => item?.id === serverId);
  if (index < 0) throw mcpError('MCP_SERVER_NOT_FOUND', 'Servidor MCP não encontrado.');
  const server = servers[index];
  if (revoke) {
    server.trust = 'blocked';
    if (server.marketplace) server.marketplace.revokedAt = nowIso();
  }
  servers.splice(index, 1);
  await saveServers(servers);
  await clearMcpSessionAuth(serverId).catch(() => null);
  const session = await chrome.storage.session.get(null);
  const approvalKeys = Object.entries(session)
    .filter(([key, value]) => key.startsWith(APPROVAL_PREFIX) && value?.serverId === serverId)
    .map(([key]) => key);
  if (approvalKeys.length) await chrome.storage.session.remove(approvalKeys);
  return { removed: true, server: publicServer(server), approvalsRevoked: approvalKeys.length };
}

export async function setMcpServerTrust(id, trust) {
  const value = ['pending', 'approved', 'blocked'].includes(String(trust)) ? String(trust) : 'pending';
  return updateServer(cleanId(id), server => ({ ...server, trust: value }));
}

export async function setMcpMethodPermission(id, method, enabled) {
  const safeMethod = text(method, 160);
  return updateServer(cleanId(id), server => {
    const set = new Set(Array.isArray(server.allowedMethods) ? server.allowedMethods : []);
    if (enabled) set.add(safeMethod); else set.delete(safeMethod);
    set.add('server/discover');
    set.add('tools/list');
    return { ...server, allowedMethods: [...set].sort() };
  });
}

function normalizeConstraints(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const [key, rule] of Object.entries(source).slice(0, 80)) {
    const safeKey = text(key, 160);
    if (!safeKey || !rule || typeof rule !== 'object') continue;
    const normalized = {};
    if (Object.prototype.hasOwnProperty.call(rule, 'equals')) normalized.equals = String(rule.equals);
    if (Array.isArray(rule.oneOf)) normalized.oneOf = rule.oneOf.slice(0, 100).map(value => String(value));
    if (rule.prefix != null) normalized.prefix = String(rule.prefix);
    out[safeKey] = normalized;
  }
  return out;
}

export async function setMcpToolPolicy(id, toolName, policy = {}) {
  const name = text(toolName, 240);
  if (!name) throw mcpError('MCP_TOOL_NAME_REQUIRED', 'Nome da ferramenta MCP é obrigatório.');
  const mode = policy?.mode === 'write' ? 'write' : 'read';
  return updateServer(cleanId(id), server => {
    const toolPolicies = { ...(server.toolPolicies || {}) };
    toolPolicies[name] = {
      enabled: policy?.enabled === true,
      mode,
      allowedArgumentKeys: Array.isArray(policy?.allowedArgumentKeys)
        ? [...new Set(policy.allowedArgumentKeys.map(value => text(value, 160)).filter(Boolean))].slice(0, 100)
        : [],
      constraints: normalizeConstraints(policy?.constraints),
      reason: text(policy?.reason, 500)
    };
    return { ...server, toolPolicies };
  });
}

export async function setMcpSessionAuth(id, credentials = {}) {
  const server = await getMcpServer(id);
  const mode = String(server?.auth?.mode || 'none');
  if (mode === 'none') return { configured: true, mode: 'none' };
  const token = text(credentials?.accessToken || credentials?.token, 20000);
  if (!token) throw mcpError('MCP_AUTH_TOKEN_REQUIRED', 'Token MCP ausente.');
  const issuer = text(credentials?.issuer || server?.auth?.issuer, 1000);
  if (mode === 'oauth' && server?.auth?.issuer && issuer !== server.auth.issuer) {
    throw mcpError('MCP_AUTH_ISSUER_MISMATCH', 'Token OAuth não corresponde ao issuer vinculado ao servidor MCP.');
  }
  const stored = await chrome.storage.session.get(AUTH_KEY);
  const map = stored[AUTH_KEY] && typeof stored[AUTH_KEY] === 'object' ? stored[AUTH_KEY] : {};
  map[server.id] = { token, issuer, mode, storedAt: nowIso() };
  await chrome.storage.session.set({ [AUTH_KEY]: map });
  return { configured: true, mode, issuer };
}

export async function clearMcpSessionAuth(id) {
  const stored = await chrome.storage.session.get(AUTH_KEY);
  const map = stored[AUTH_KEY] && typeof stored[AUTH_KEY] === 'object' ? stored[AUTH_KEY] : {};
  delete map[cleanId(id)];
  await chrome.storage.session.set({ [AUTH_KEY]: map });
  return true;
}

export async function mcpBearerToken(id) {
  const server = await getMcpServer(id);
  if (server?.auth?.mode === 'none') return '';
  const stored = await chrome.storage.session.get(AUTH_KEY);
  const auth = stored[AUTH_KEY]?.[server.id];
  if (!auth?.token) throw mcpError('MCP_AUTH_REQUIRED', 'Autenticação MCP necessária.');
  if (server?.auth?.mode === 'oauth' && server?.auth?.issuer && auth.issuer !== server.auth.issuer) {
    throw mcpError('MCP_AUTH_ISSUER_MISMATCH', 'Credencial OAuth não está vinculada ao issuer esperado.');
  }
  return String(auth.token);
}

function valueAt(object, dottedKey) {
  return dottedKey.split('.').reduce((value, key) => value && typeof value === 'object' ? value[key] : undefined, object);
}

function enforceArgumentPolicy(policy, args) {
  const source = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  const allowedKeys = Array.isArray(policy?.allowedArgumentKeys) ? policy.allowedArgumentKeys : [];
  if (allowedKeys.length) {
    const rejected = Object.keys(source).filter(key => !allowedKeys.includes(key));
    if (rejected.length) throw mcpError('MCP_SCOPE_LOCK_ARGUMENT_REJECTED', `Argumentos fora do escopo: ${rejected.join(', ')}`, { rejected });
  }
  for (const [key, rule] of Object.entries(policy?.constraints || {})) {
    const actual = valueAt(source, key);
    if (Object.prototype.hasOwnProperty.call(rule, 'equals') && String(actual ?? '') !== String(rule.equals)) {
      throw mcpError('MCP_SCOPE_LOCK_VALUE_REJECTED', `Valor fora do escopo em ${key}.`, { key });
    }
    if (Array.isArray(rule.oneOf) && !rule.oneOf.map(String).includes(String(actual ?? ''))) {
      throw mcpError('MCP_SCOPE_LOCK_VALUE_REJECTED', `Valor fora do allowlist em ${key}.`, { key });
    }
    if (rule.prefix != null && !String(actual ?? '').startsWith(String(rule.prefix))) {
      throw mcpError('MCP_SCOPE_LOCK_PREFIX_REJECTED', `Valor fora do prefixo permitido em ${key}.`, { key });
    }
  }
}

async function canonicalArgsHash(serverId, toolName, args) {
  return sha256Text(JSON.stringify({ serverId, toolName, args: args && typeof args === 'object' ? args : {} }));
}

export async function prepareMcpWriteApproval({ serverId, toolName, arguments: args = {} } = {}) {
  const server = await getMcpServer(serverId);
  if (server.trust !== 'approved') throw mcpError('MCP_SERVER_NOT_TRUSTED', 'Servidor MCP ainda não foi aprovado.');
  const policy = server.toolPolicies?.[toolName];
  if (!policy?.enabled || policy.mode !== 'write') throw mcpError('MCP_WRITE_POLICY_REQUIRED', 'Ferramenta MCP não está autorizada como escrita.');
  enforceArgumentPolicy(policy, args);
  const id = crypto.randomUUID();
  const ticket = {
    id,
    serverId: server.id,
    toolName: text(toolName, 240),
    argsHash: await canonicalArgsHash(server.id, toolName, args),
    status: 'prepared',
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + APPROVAL_TTL_MS).toISOString(),
    approvedAt: ''
  };
  await chrome.storage.session.set({ [`${APPROVAL_PREFIX}${id}`]: ticket });
  return { ...ticket, serverName: server.name, endpoint: server.endpoint, policy: structuredClone(policy) };
}

export async function approveMcpWriteApproval(ticketId, { humanDecision = false } = {}) {
  if (humanDecision !== true) throw mcpError('MCP_HUMAN_APPROVAL_REQUIRED', 'Aprovação humana explícita é obrigatória.');
  const key = `${APPROVAL_PREFIX}${cleanId(ticketId)}`;
  const stored = await chrome.storage.session.get(key);
  const ticket = stored[key];
  if (!ticket || ticket.status !== 'prepared') throw mcpError('MCP_APPROVAL_NOT_FOUND', 'Aprovação MCP não encontrada ou já utilizada.');
  if (Date.parse(ticket.expiresAt || '') <= Date.now()) {
    await chrome.storage.session.remove(key);
    throw mcpError('MCP_APPROVAL_EXPIRED', 'Aprovação MCP expirou.');
  }
  ticket.status = 'approved';
  ticket.approvedAt = nowIso();
  await chrome.storage.session.set({ [key]: ticket });
  return { id: ticket.id, status: ticket.status, approvedAt: ticket.approvedAt, expiresAt: ticket.expiresAt };
}

async function consumeWriteApproval(ticketId, serverId, toolName, args) {
  const key = `${APPROVAL_PREFIX}${cleanId(ticketId)}`;
  const stored = await chrome.storage.session.get(key);
  const ticket = stored[key];
  if (!ticket || ticket.status !== 'approved') throw mcpError('MCP_WRITE_APPROVAL_REQUIRED', 'Escrita MCP bloqueada sem aprovação humana válida.');
  if (Date.parse(ticket.expiresAt || '') <= Date.now()) {
    await chrome.storage.session.remove(key);
    throw mcpError('MCP_APPROVAL_EXPIRED', 'Aprovação MCP expirou.');
  }
  const hash = await canonicalArgsHash(serverId, toolName, args);
  if (ticket.serverId !== serverId || ticket.toolName !== toolName || ticket.argsHash !== hash) {
    throw mcpError('MCP_APPROVAL_BINDING_MISMATCH', 'A aprovação não corresponde exatamente à chamada MCP atual.');
  }
  await chrome.storage.session.remove(key);
  return true;
}

export async function authorizeMcpRequest({ serverId, method, params = {}, writeApprovalId = '' } = {}) {
  const server = await getMcpServer(serverId);
  if (server.trust === 'blocked') throw mcpError('MCP_SERVER_BLOCKED', 'Servidor MCP está bloqueado.');

  if (method === 'server/discover' || method === 'tools/list') {
    return { server, mode: 'read', policy: null };
  }
  if (server.trust !== 'approved') throw mcpError('MCP_SERVER_NOT_TRUSTED', 'Servidor MCP precisa ser aprovado antes do uso.');

  if (method === 'tools/call') {
    const toolName = text(params?.name, 240);
    const policy = server.toolPolicies?.[toolName];
    if (!policy?.enabled) throw mcpError('MCP_TOOL_NOT_ALLOWLISTED', `Ferramenta MCP não autorizada: ${toolName}`);
    enforceArgumentPolicy(policy, params?.arguments || {});
    if (policy.mode === 'write') {
      await consumeWriteApproval(writeApprovalId, server.id, toolName, params?.arguments || {});
    }
    return { server, mode: policy.mode, policy: structuredClone(policy) };
  }

  if (!Array.isArray(server.allowedMethods) || !server.allowedMethods.includes(method)) {
    throw mcpError('MCP_METHOD_NOT_ALLOWLISTED', `Método MCP não autorizado: ${method}`);
  }
  return { server, mode: 'read', policy: null };
}

export { SERVER_KEY, AUTH_KEY, APPROVAL_PREFIX, APPROVAL_TTL_MS };
