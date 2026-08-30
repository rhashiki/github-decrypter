import {
  marketplaceStatus,
  listCuratedMcpCatalog,
  getCuratedMcpItem,
  listMcpMarketplaceInstalls,
  reconcileMcpMarketplaceInstalls,
  installCuratedMcp,
  revokeCuratedMcp,
  setCuratedMcpToolPolicy
} from '../core/mcp-marketplace.js';
import { getMcpServer } from '../core/mcp-trust-gateway.js';
import { originPermissionPattern, mcpError } from '../core/mcp-protocol.js';

const PORT_NAME = 'ld2-mcp-marketplace';
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

async function handle(action, payload = {}) {
  const op = text(action, 120).toLowerCase();
  if (op === 'status') return marketplaceStatus();
  if (op === 'catalog') return { ...marketplaceStatus(), catalog: listCuratedMcpCatalog() };
  if (op === 'item') return { item: getCuratedMcpItem(payload?.itemId) };
  if (op === 'installs') return { installs: await listMcpMarketplaceInstalls() };
  if (op === 'reconcile') return { installs: await reconcileMcpMarketplaceInstalls() };
  if (op === 'install') {
    const result = await installCuratedMcp(payload?.itemId, payload?.configuration || {});
    const permission = result?.server?.id ? await permissionStatus(result.server.id) : null;
    return { ...result, permission };
  }
  if (op === 'revoke') return revokeCuratedMcp(payload?.itemId, payload?.reason || 'user_revoked');
  if (op === 'permission_status') return permissionStatus(payload?.serverId);
  if (op === 'request_host_permission') return requestPermission(payload?.serverId);
  if (op === 'set_tool_policy') {
    const toolName = text(payload?.toolName, 240);
    if (!toolName) throw mcpError('MCP_TOOL_NAME_REQUIRED', 'Nome da ferramenta MCP é obrigatório.');
    return {
      server: await setCuratedMcpToolPolicy(payload?.itemId, toolName, {
        enabled: payload?.policy?.enabled === true,
        mode: payload?.policy?.mode === 'write' ? 'write' : 'read',
        allowedArgumentKeys: payload?.policy?.allowedArgumentKeys || [],
        constraints: payload?.policy?.constraints || {},
        reason: payload?.policy?.reason || 'Curated Marketplace user policy.'
      })
    };
  }
  throw mcpError('MCP_MARKETPLACE_ACTION_INVALID', `Ação do marketplace MCP inválida: ${op}`);
}

export function installMcpMarketplaceRuntime() {
  if (globalThis.__LD63_MCP_MARKETPLACE_RUNTIME__) return;
  globalThis.__LD63_MCP_MARKETPLACE_RUNTIME__ = true;
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
            code: error?.code || 'MCP_MARKETPLACE_FAILED',
            itemId: error?.itemId || ''
          });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(listener);
  });

  globalThis.LovableDecrypterMcpMarketplaceRuntime = Object.freeze({
    build: 63,
    schema: 'ld-mcp-marketplace/1',
    port: PORT_NAME,
    embeddedCatalog: true,
    arbitraryRemoteCatalog: false,
    remoteCodeExecution: false,
    writeToolsAutoEnabled: false,
    revocationSupported: true
  });
}
