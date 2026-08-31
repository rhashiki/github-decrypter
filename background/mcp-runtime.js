import { McpClient } from '../core/mcp-client.js';
import { originPermissionPattern, MCP_PROTOCOL_VERSION, mcpError } from '../core/mcp-protocol.js';
import {
  registerMcpServer,
  listMcpServers,
  getMcpServer,
  setMcpServerTrust,
  setMcpMethodPermission,
  setMcpToolPolicy,
  setMcpSessionAuth,
  clearMcpSessionAuth,
  prepareMcpWriteApproval,
  approveMcpWriteApproval
} from '../core/mcp-trust-gateway.js';
import { authorizeMcpOAuth } from '../security/mcp-oauth.js';
import { VERSION } from '../settings/config.js';

const PORT_NAME = 'ld2-mcp-runtime';
const client = new McpClient({ clientVersion: VERSION, capabilities: { tools: {}, resources: {}, prompts: {} } });

function text(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }

async function permissionStatus(serverId) {
  const server = await getMcpServer(serverId);
  const origin = originPermissionPattern(server.endpoint);
  const granted = await chrome.permissions.contains({ origins: [origin] });
  return { serverId: server.id, origin, granted };
}

async function requestPermission(serverId) {
  const server = await getMcpServer(serverId);
  const origin = originPermissionPattern(server.endpoint);
  const granted = await chrome.permissions.request({ origins: [origin] });
  return { serverId: server.id, origin, granted };
}

async function assertHostPermission(serverId) {
  const status = await permissionStatus(serverId);
  if (!status.granted) {
    throw mcpError('MCP_HOST_PERMISSION_REQUIRED', `Permissão de rede necessária para ${status.origin}`, { origin: status.origin });
  }
  return status;
}

async function handle(action, payload = {}) {
  const op = text(action, 120).toLowerCase();
  if (op === 'status') return {
    schema: 'ld-mcp-runtime/1',
    build: 62,
    protocolVersion: MCP_PROTOCOL_VERSION,
    stateless: true,
    transport: ['streamable-http'],
    legacyHttpSse: false,
    stdioBrowserProcessSpawn: false,
    writePolicy: 'explicit-tool-allowlist+scope-lock+one-time-human-approval',
    auth: ['none', 'bearer-session', 'oauth2.1-pkce-session'],
    secretPersistence: false
  };
  if (op === 'list_servers') return { servers: await listMcpServers() };
  if (op === 'register') return { server: await registerMcpServer(payload) };
  if (op === 'set_trust') return { server: await setMcpServerTrust(payload?.serverId, payload?.trust) };
  if (op === 'set_method_permission') return { server: await setMcpMethodPermission(payload?.serverId, payload?.method, payload?.enabled === true) };
  if (op === 'set_tool_policy') return { server: await setMcpToolPolicy(payload?.serverId, payload?.toolName, payload?.policy || {}) };
  if (op === 'set_auth') return { auth: await setMcpSessionAuth(payload?.serverId, payload?.credentials || {}) };
  if (op === 'clear_auth') return { cleared: await clearMcpSessionAuth(payload?.serverId) };
  if (op === 'oauth_connect') {
    await assertHostPermission(payload?.serverId);
    return { oauth: await authorizeMcpOAuth(payload?.serverId, { scopes: payload?.scopes || [], requireIssuerResponse: payload?.requireIssuerResponse !== false }) };
  }
  if (op === 'permission_status') return permissionStatus(payload?.serverId);
  if (op === 'request_host_permission') return requestPermission(payload?.serverId);
  if (op === 'prepare_write') return { approval: await prepareMcpWriteApproval(payload || {}) };
  if (op === 'approve_write') return { approval: await approveMcpWriteApproval(payload?.ticketId, { humanDecision: payload?.humanDecision === true }) };

  if (['discover', 'list_tools', 'call_tool', 'request'].includes(op)) await assertHostPermission(payload?.serverId);
  if (op === 'discover') return client.discover(payload?.serverId, { origin: payload?.origin || 'tool', taskId: payload?.taskId || '' });
  if (op === 'list_tools') return client.listTools(payload?.serverId, { cursor: payload?.cursor || '', origin: payload?.origin || 'tool', taskId: payload?.taskId || '' });
  if (op === 'call_tool') return client.callTool(payload?.serverId, payload?.toolName, payload?.arguments || {}, {
    writeApprovalId: payload?.writeApprovalId || '',
    timeoutMs: payload?.timeoutMs,
    origin: payload?.origin || 'tool',
    taskId: payload?.taskId || ''
  });
  if (op === 'request') return client.request({
    serverId: payload?.serverId,
    method: payload?.method,
    params: payload?.params || {},
    writeApprovalId: payload?.writeApprovalId || '',
    timeoutMs: payload?.timeoutMs,
    origin: payload?.origin || 'tool',
    taskId: payload?.taskId || ''
  });
  throw mcpError('MCP_RUNTIME_ACTION_INVALID', `Ação MCP inválida: ${op}`);
}

export function installMcpRuntime() {
  if (globalThis.__LD62_MCP_RUNTIME__) return;
  globalThis.__LD62_MCP_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 160);
      try {
        const data = await handle(message?.action || 'status', message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || 'MCP_RUNTIME_FAILED',
            operationId: error?.operationId || '',
            origin: error?.origin || ''
          });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(listener);
  });

  globalThis.LovableDecrypterMcpRuntime = Object.freeze({
    build: 62,
    schema: 'ld-mcp-runtime/1',
    protocolVersion: MCP_PROTOCOL_VERSION,
    authority: 'trust-gateway',
    stateless: true,
    unknownToolsDefaultDeny: true,
    serverAnnotationsTrustedForSecurity: false,
    writesRequireHumanApproval: true,
    secretPersistence: false,
    port: PORT_NAME
  });
}
