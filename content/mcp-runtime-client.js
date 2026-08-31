(() => {
  'use strict';
  if (window.__LD62_MCP_RUNTIME_CLIENT__) return;
  window.__LD62_MCP_RUNTIME_CLIENT__ = true;

  const PORT_NAME = 'ld2-mcp-runtime';

  function request(action, payload = {}, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const id = crypto.randomUUID();
      let settled = false;
      const cleanup = () => { try { port.disconnect(); } catch (_) {} };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = new Error(`MCP Runtime timeout: ${action}`);
        error.code = 'MCP_RUNTIME_TIMEOUT';
        reject(error);
      }, Math.max(5000, Math.min(180000, Number(timeoutMs || 120000))));

      port.onMessage.addListener(message => {
        if (message?.id !== id || settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        if (message.ok) resolve(message.data);
        else {
          const error = new Error(message?.error || 'MCP_RUNTIME_FAILED');
          error.code = message?.code || 'MCP_RUNTIME_FAILED';
          error.operationId = message?.operationId || '';
          error.origin = message?.origin || '';
          reject(error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const error = new Error(chrome.runtime.lastError?.message || 'MCP Runtime desconectado.');
        error.code = 'MCP_RUNTIME_DISCONNECTED';
        reject(error);
      });
      port.postMessage({ id, action, payload });
    });
  }

  window.LovableDecrypterMCP = Object.freeze({
    build: 62,
    protocolVersion: '2026-07-28',
    status() { return request('status', {}, 30000); },
    servers() { return request('list_servers', {}, 30000); },
    register(config) { return request('register', config || {}, 30000); },
    setTrust(serverId, trust) { return request('set_trust', { serverId, trust }, 30000); },
    setMethodPermission(serverId, method, enabled) { return request('set_method_permission', { serverId, method, enabled }, 30000); },
    setToolPolicy(serverId, toolName, policy) { return request('set_tool_policy', { serverId, toolName, policy }, 30000); },
    setSessionAuth(serverId, credentials) { return request('set_auth', { serverId, credentials }, 30000); },
    clearSessionAuth(serverId) { return request('clear_auth', { serverId }, 30000); },
    oauthConnect(serverId, scopes = []) { return request('oauth_connect', { serverId, scopes, requireIssuerResponse: true }, 180000); },
    permissionStatus(serverId) { return request('permission_status', { serverId }, 30000); },
    requestHostPermission(serverId) { return request('request_host_permission', { serverId }, 30000); },
    discover(serverId, options = {}) { return request('discover', { serverId, ...options }, options.timeoutMs || 60000); },
    listTools(serverId, options = {}) { return request('list_tools', { serverId, ...options }, options.timeoutMs || 60000); },
    prepareWrite(serverId, toolName, args = {}) { return request('prepare_write', { serverId, toolName, arguments: args }, 30000); },
    approveWrite(ticketId) {
      // This method is intended to be called only from an explicit user-confirmation UI event.
      return request('approve_write', { ticketId, humanDecision: true }, 30000);
    },
    callTool(serverId, toolName, args = {}, options = {}) {
      return request('call_tool', {
        serverId,
        toolName,
        arguments: args,
        writeApprovalId: options.writeApprovalId || '',
        origin: options.origin || 'tool',
        taskId: options.taskId || '',
        timeoutMs: options.timeoutMs
      }, options.timeoutMs || 120000);
    }
  });
})();
