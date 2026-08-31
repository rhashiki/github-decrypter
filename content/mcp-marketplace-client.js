(() => {
  'use strict';
  if (window.__LD63_MCP_MARKETPLACE_CLIENT__) return;
  window.__LD63_MCP_MARKETPLACE_CLIENT__ = true;

  const PORT_NAME = 'ld2-mcp-marketplace';
  function request(action, payload = {}, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const id = crypto.randomUUID();
      let settled = false;
      const cleanup = () => { try { port.disconnect(); } catch (_) {} };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = new Error(`MCP Marketplace timeout: ${action}`);
        error.code = 'MCP_MARKETPLACE_TIMEOUT';
        reject(error);
      }, Math.max(5000, Math.min(180000, Number(timeoutMs || 60000))));

      port.onMessage.addListener(message => {
        if (message?.id !== id || settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        if (message.ok) resolve(message.data);
        else {
          const error = new Error(message?.error || 'MCP_MARKETPLACE_FAILED');
          error.code = message?.code || 'MCP_MARKETPLACE_FAILED';
          error.itemId = message?.itemId || '';
          reject(error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const error = new Error(chrome.runtime.lastError?.message || 'MCP Marketplace desconectado.');
        error.code = 'MCP_MARKETPLACE_DISCONNECTED';
        reject(error);
      });
      port.postMessage({ id, action, payload });
    });
  }

  window.LovableDecrypterMCPMarketplace = Object.freeze({
    build: 63,
    schema: 'ld-mcp-marketplace/1',
    status: () => request('status', {}, 30000),
    catalog: () => request('catalog', {}, 30000),
    item: itemId => request('item', { itemId }, 30000),
    installs: () => request('installs', {}, 30000),
    reconcile: () => request('reconcile', {}, 30000),
    install: (itemId, configuration = {}) => request('install', { itemId, configuration }, 60000),
    revoke: (itemId, reason = 'user_revoked') => request('revoke', { itemId, reason }, 30000),
    permissionStatus: serverId => request('permission_status', { serverId }, 30000),
    requestHostPermission: serverId => request('request_host_permission', { serverId }, 30000),
    setToolPolicy: (itemId, toolName, policy = {}) => request('set_tool_policy', { itemId, toolName, policy }, 30000)
  });
})();
