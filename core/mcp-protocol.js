export const MCP_PROTOCOL_VERSION = '2026-07-28';
export const MCP_SCHEMA = 'ld-mcp/1';
export const MCP_CLIENT_INFO_KEY = 'io.modelcontextprotocol/clientInfo';
export const MCP_CLIENT_CAPABILITIES_KEY = 'io.modelcontextprotocol/clientCapabilities';

const METHODS = new Set([
  'server/discover',
  'tools/list',
  'tools/call',
  'resources/list',
  'resources/read',
  'prompts/list',
  'prompts/get',
  'subscriptions/listen'
]);

function text(value, max = 500) { return String(value ?? '').slice(0, max); }

export function mcpError(code, message, details = {}) {
  const error = new Error(message || code);
  error.code = code;
  Object.assign(error, details || {});
  return error;
}

export function validateMcpMethod(method = '') {
  const value = text(method, 160).trim();
  if (!value || !/^[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(value)) {
    throw mcpError('MCP_METHOD_INVALID', `Método MCP inválido: ${value || '(vazio)'}`);
  }
  return value;
}

export function validateMcpName(name = '') {
  const value = text(name, 240).trim();
  if (!value || value.length > 240 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw mcpError('MCP_NAME_INVALID', 'Nome MCP inválido.');
  }
  return value;
}

export function normalizeMcpEndpoint(value = '') {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw mcpError('MCP_ENDPOINT_INVALID', 'Endpoint MCP inválido.'); }
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw mcpError('MCP_ENDPOINT_INSECURE', 'MCP remoto exige HTTPS; HTTP só é permitido em localhost.');
  }
  if (url.username || url.password) throw mcpError('MCP_ENDPOINT_CREDENTIALS_FORBIDDEN', 'Credenciais não podem ficar na URL MCP.');
  if (url.search || url.hash) throw mcpError('MCP_ENDPOINT_QUERY_FORBIDDEN', 'Endpoint MCP não pode conter query string ou fragmento.');
  url.hash = '';
  url.search = '';
  return url.toString();
}

export function originPermissionPattern(endpoint = '') {
  const url = new URL(normalizeMcpEndpoint(endpoint));
  return `${url.protocol}//${url.host}/*`;
}

export function buildMcpMeta({ clientName = 'lovable-decrypter', clientVersion = '2.6.62', capabilities = {} } = {}) {
  return {
    [MCP_CLIENT_INFO_KEY]: {
      name: text(clientName, 120) || 'lovable-decrypter',
      version: text(clientVersion, 80) || '2.6.62'
    },
    [MCP_CLIENT_CAPABILITIES_KEY]: capabilities && typeof capabilities === 'object' ? structuredClone(capabilities) : {}
  };
}

export function buildMcpRequest({ id = crypto.randomUUID(), method, params = {}, client = {} } = {}) {
  const safeMethod = validateMcpMethod(method);
  const bodyParams = params && typeof params === 'object' ? structuredClone(params) : {};
  const existingMeta = bodyParams._meta && typeof bodyParams._meta === 'object' ? bodyParams._meta : {};
  bodyParams._meta = { ...existingMeta, ...buildMcpMeta(client) };
  return {
    jsonrpc: '2.0',
    id: text(id, 160) || crypto.randomUUID(),
    method: safeMethod,
    params: bodyParams
  };
}

export function mcpRequestHeaders({ method, name = '', bearerToken = '', extra = {} } = {}) {
  const safeMethod = validateMcpMethod(method);
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    'Mcp-Method': safeMethod,
    ...extra
  };
  if (name) headers['Mcp-Name'] = validateMcpName(name);
  if (bearerToken) headers.Authorization = `Bearer ${String(bearerToken)}`;
  return headers;
}

function validateJsonRpcMessage(message, expectedId = '') {
  if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
    throw mcpError('MCP_RESPONSE_INVALID', 'Resposta MCP não é JSON-RPC 2.0.');
  }
  if (expectedId && String(message.id ?? '') !== String(expectedId)) return null;
  if (message.error) {
    const error = mcpError('MCP_REMOTE_ERROR', text(message.error?.message || 'Servidor MCP retornou erro.', 1000), {
      remoteCode: message.error?.code,
      remoteData: message.error?.data ?? null
    });
    throw error;
  }
  if (!Object.prototype.hasOwnProperty.call(message, 'result')) {
    throw mcpError('MCP_RESPONSE_RESULT_MISSING', 'Resposta MCP não contém result.');
  }
  return message;
}

function parseSseData(source = '') {
  const messages = [];
  let data = [];
  for (const line of String(source || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (!line) {
      if (data.length) {
        const joined = data.join('\n');
        try { messages.push(JSON.parse(joined)); } catch { throw mcpError('MCP_SSE_JSON_INVALID', 'Evento SSE MCP contém JSON inválido.'); }
        data = [];
      }
      continue;
    }
    if (line.startsWith(':')) continue;
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (data.length) {
    try { messages.push(JSON.parse(data.join('\n'))); } catch { throw mcpError('MCP_SSE_JSON_INVALID', 'Evento SSE MCP contém JSON inválido.'); }
  }
  return messages;
}

export async function parseMcpHttpResponse(response, expectedId = '') {
  const contentType = String(response?.headers?.get?.('content-type') || '').toLowerCase();
  const bodyText = await response.text();
  if (!response.ok) {
    throw mcpError(`MCP_HTTP_${response.status}`, `Servidor MCP respondeu HTTP ${response.status}.`, { status: response.status });
  }
  if (contentType.includes('text/event-stream')) {
    const messages = parseSseData(bodyText);
    for (const message of messages) {
      const valid = validateJsonRpcMessage(message, expectedId);
      if (valid) return valid.result;
    }
    throw mcpError('MCP_SSE_RESPONSE_MISSING', 'Stream MCP terminou sem resposta correspondente.');
  }
  let message;
  try { message = JSON.parse(bodyText); }
  catch { throw mcpError('MCP_JSON_INVALID', 'Servidor MCP retornou JSON inválido.'); }
  const valid = validateJsonRpcMessage(message, expectedId);
  if (!valid) throw mcpError('MCP_RESPONSE_ID_MISMATCH', 'Resposta MCP não corresponde à requisição.');
  return valid.result;
}

export function methodNameForHeaders(method, params = {}) {
  if (method === 'tools/call') return validateMcpName(params?.name || '');
  if (method === 'prompts/get') return validateMcpName(params?.name || '');
  return '';
}

export function isKnownMcpMethod(method = '') { return METHODS.has(String(method || '')); }
