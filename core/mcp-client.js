import {
  MCP_PROTOCOL_VERSION,
  buildMcpRequest,
  mcpRequestHeaders,
  methodNameForHeaders,
  parseMcpHttpResponse,
  validateMcpMethod,
  mcpError
} from './mcp-protocol.js';
import { authorizeMcpRequest, mcpBearerToken } from './mcp-trust-gateway.js';
import { beginOperation, finishOperation } from './operation-journal.js';

const DEFAULT_TIMEOUT_MS = 60_000;

function text(value, max = 500) { return String(value ?? '').slice(0, max); }

async function fetchMcp(endpoint, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(3000, Math.min(180000, Number(timeoutMs || DEFAULT_TIMEOUT_MS))));
  try {
    return await fetch(endpoint, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw mcpError('MCP_TIMEOUT', 'Servidor MCP excedeu o tempo limite.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function publicTool(tool = {}) {
  return {
    name: text(tool?.name, 240),
    title: text(tool?.title, 300),
    description: text(tool?.description, 4000),
    inputSchema: tool?.inputSchema && typeof tool.inputSchema === 'object' ? structuredClone(tool.inputSchema) : {},
    outputSchema: tool?.outputSchema && typeof tool.outputSchema === 'object' ? structuredClone(tool.outputSchema) : null,
    annotations: tool?.annotations && typeof tool.annotations === 'object' ? structuredClone(tool.annotations) : {},
    // MCP annotations are hints from the remote server, never local security authority.
    securityAuthority: 'local-trust-gateway'
  };
}

export class McpClient {
  constructor({ clientName = 'lovable-decrypter', clientVersion = '2.6.62', capabilities = {} } = {}) {
    this.client = { clientName, clientVersion, capabilities };
  }

  async request({ serverId, method, params = {}, writeApprovalId = '', timeoutMs = DEFAULT_TIMEOUT_MS, origin = 'tool', taskId = '' } = {}) {
    const safeMethod = validateMcpMethod(method);
    const authorization = await authorizeMcpRequest({ serverId, method: safeMethod, params, writeApprovalId });
    const server = authorization.server;
    const request = buildMcpRequest({ method: safeMethod, params, client: this.client });
    const toolName = safeMethod === 'tools/call' ? text(params?.name, 240) : '';
    const operation = await beginOperation({
      tool: toolName ? `mcp:${server.id}:${toolName}` : `mcp:${server.id}:${safeMethod}`,
      mode: authorization.mode === 'write' ? 'write' : 'read',
      origin,
      input: { action: safeMethod, paths: [], query: toolName },
      context: { projectId: '', owner: 'mcp', repo: server.name, branch: '', taskId }
    });

    try {
      const bearerToken = await mcpBearerToken(server.id);
      const name = methodNameForHeaders(safeMethod, params);
      const response = await fetchMcp(server.endpoint, {
        method: 'POST',
        headers: mcpRequestHeaders({ method: safeMethod, name, bearerToken }),
        body: JSON.stringify(request),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error'
      }, timeoutMs);
      const result = await parseMcpHttpResponse(response, request.id);
      await finishOperation(operation, {
        status: 'ok',
        result: {
          code: 'OK',
          matchCount: Array.isArray(result?.tools) ? result.tools.length : 0,
          fileCount: 0
        }
      });
      return {
        schema: 'ld-mcp-result/1',
        protocolVersion: MCP_PROTOCOL_VERSION,
        server: { id: server.id, name: server.name, endpoint: server.endpoint },
        method: safeMethod,
        mode: authorization.mode,
        operationId: operation.id,
        result
      };
    } catch (error) {
      await finishOperation(operation, { status: 'failed', error }).catch(() => null);
      error.operationId = operation.id;
      throw error;
    }
  }

  async discover(serverId, options = {}) {
    return this.request({ serverId, method: 'server/discover', params: {}, ...options });
  }

  async listTools(serverId, options = {}) {
    const response = await this.request({ serverId, method: 'tools/list', params: options?.cursor ? { cursor: options.cursor } : {}, ...options });
    const raw = response?.result || {};
    return {
      ...response,
      result: {
        tools: (Array.isArray(raw.tools) ? raw.tools : []).map(publicTool).filter(tool => tool.name),
        nextCursor: text(raw.nextCursor, 1000),
        ttlMs: Math.max(0, Number(raw.ttlMs || 0) || 0),
        cacheScope: text(raw.cacheScope, 120)
      }
    };
  }

  async callTool(serverId, name, args = {}, options = {}) {
    return this.request({
      serverId,
      method: 'tools/call',
      params: { name: text(name, 240), arguments: args && typeof args === 'object' ? args : {} },
      writeApprovalId: options?.writeApprovalId || '',
      timeoutMs: options?.timeoutMs || DEFAULT_TIMEOUT_MS,
      origin: options?.origin || 'tool',
      taskId: options?.taskId || ''
    });
  }
}

export { DEFAULT_TIMEOUT_MS };
