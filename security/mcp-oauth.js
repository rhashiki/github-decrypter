import { normalizeMcpEndpoint, mcpError } from '../core/mcp-protocol.js';
import { getMcpServer, setMcpSessionAuth } from '../core/mcp-trust-gateway.js';

function text(value, max = 4000) { return String(value ?? '').trim().slice(0, max); }
function b64url(bytes) {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return new Uint8Array(digest);
}
function randomVerifier() { return b64url(crypto.getRandomValues(new Uint8Array(64))); }

async function jsonFetch(url, options = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw mcpError('MCP_OAUTH_INSECURE_DISCOVERY', 'Descoberta OAuth MCP exige HTTPS.');
  }
  const response = await fetch(parsed.toString(), { ...options, redirect: 'error', cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw mcpError(`MCP_OAUTH_HTTP_${response.status}`, `OAuth MCP respondeu HTTP ${response.status}.`);
  const body = await response.json().catch(() => null);
  if (!body || typeof body !== 'object') throw mcpError('MCP_OAUTH_JSON_INVALID', 'Metadata OAuth MCP inválida.');
  return body;
}

function protectedResourceCandidates(endpoint) {
  const url = new URL(normalizeMcpEndpoint(endpoint));
  const path = url.pathname === '/' ? '' : url.pathname;
  const origin = url.origin;
  const values = [];
  if (path) values.push(`${origin}/.well-known/oauth-protected-resource${path}`);
  values.push(`${origin}/.well-known/oauth-protected-resource`);
  return [...new Set(values)];
}

function authorizationMetadataCandidates(issuer) {
  const url = new URL(issuer);
  if (url.protocol !== 'https:') throw mcpError('MCP_OAUTH_ISSUER_INSECURE', 'Issuer OAuth MCP precisa usar HTTPS.');
  const path = url.pathname.replace(/\/$/, '');
  if (!path) return [
    `${url.origin}/.well-known/oauth-authorization-server`,
    `${url.origin}/.well-known/openid-configuration`
  ];
  return [
    `${url.origin}/.well-known/oauth-authorization-server${path}`,
    `${url.origin}/.well-known/openid-configuration${path}`,
    `${url.origin}${path}/.well-known/openid-configuration`
  ];
}

async function firstMetadata(urls) {
  let last = null;
  for (const url of urls) {
    try { return { url, metadata: await jsonFetch(url) }; }
    catch (error) { last = error; }
  }
  throw last || mcpError('MCP_OAUTH_DISCOVERY_FAILED', 'Não foi possível descobrir metadata OAuth MCP.');
}

export async function discoverMcpOAuth(serverId) {
  const server = await getMcpServer(serverId);
  if (server?.auth?.mode !== 'oauth') throw mcpError('MCP_OAUTH_MODE_REQUIRED', 'Servidor MCP não está configurado para OAuth.');
  const protectedResource = await firstMetadata(protectedResourceCandidates(server.endpoint));
  const authServers = Array.isArray(protectedResource.metadata?.authorization_servers)
    ? protectedResource.metadata.authorization_servers.map(value => text(value, 2000)).filter(Boolean)
    : [];
  if (!authServers.length) throw mcpError('MCP_OAUTH_AUTH_SERVER_MISSING', 'Protected Resource Metadata não informa authorization_servers.');

  const configuredIssuer = text(server?.auth?.issuer, 2000);
  const issuer = configuredIssuer || authServers[0];
  if (!authServers.includes(issuer)) throw mcpError('MCP_OAUTH_ISSUER_NOT_ADVERTISED', 'Issuer configurado não é anunciado pelo recurso MCP.');
  const auth = await firstMetadata(authorizationMetadataCandidates(issuer));
  const metadataIssuer = text(auth.metadata?.issuer, 2000);
  if (!metadataIssuer || metadataIssuer.replace(/\/$/, '') !== issuer.replace(/\/$/, '')) {
    throw mcpError('MCP_OAUTH_ISSUER_MISMATCH', 'Metadata OAuth retornou issuer diferente do recurso MCP.');
  }
  if (!text(auth.metadata?.authorization_endpoint, 2000) || !text(auth.metadata?.token_endpoint, 2000)) {
    throw mcpError('MCP_OAUTH_ENDPOINTS_MISSING', 'Metadata OAuth não informa authorization_endpoint/token_endpoint.');
  }
  if (!Array.isArray(auth.metadata?.code_challenge_methods_supported) || !auth.metadata.code_challenge_methods_supported.includes('S256')) {
    throw mcpError('MCP_OAUTH_PKCE_S256_REQUIRED', 'Authorization Server MCP não anuncia suporte PKCE S256.');
  }
  return {
    resource: normalizeMcpEndpoint(server.endpoint),
    protectedResourceMetadataUrl: protectedResource.url,
    protectedResource: protectedResource.metadata,
    authorizationServerMetadataUrl: auth.url,
    issuer: metadataIssuer,
    metadata: auth.metadata
  };
}

export async function authorizeMcpOAuth(serverId, { scopes = [], requireIssuerResponse = true } = {}) {
  if (!chrome?.identity?.launchWebAuthFlow || !chrome?.identity?.getRedirectURL) {
    throw mcpError('MCP_OAUTH_IDENTITY_UNAVAILABLE', 'Chrome Identity API indisponível para OAuth MCP.');
  }
  const server = await getMcpServer(serverId);
  const clientId = text(server?.auth?.clientId, 2000);
  if (!clientId) throw mcpError('MCP_OAUTH_CLIENT_ID_REQUIRED', 'OAuth MCP exige clientId pré-registrado ou Client ID Metadata Document.');
  const discovery = await discoverMcpOAuth(serverId);
  const redirectUri = chrome.identity.getRedirectURL(`mcp-${server.id}`);
  const verifier = randomVerifier();
  const challenge = b64url(await sha256(verifier));
  const state = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const requestedScopes = [...new Set((Array.isArray(scopes) ? scopes : []).map(value => text(value, 240)).filter(Boolean))];
  const authorizationUrl = new URL(discovery.metadata.authorization_endpoint);
  if (authorizationUrl.protocol !== 'https:') throw mcpError('MCP_OAUTH_AUTH_ENDPOINT_INSECURE', 'authorization_endpoint precisa usar HTTPS.');
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('code_challenge', challenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('resource', discovery.resource);
  if (requestedScopes.length) authorizationUrl.searchParams.set('scope', requestedScopes.join(' '));

  const callback = await chrome.identity.launchWebAuthFlow({ url: authorizationUrl.toString(), interactive: true });
  if (!callback) throw mcpError('MCP_OAUTH_CANCELLED', 'Autorização MCP cancelada.');
  const returned = new URL(callback);
  if (returned.searchParams.get('state') !== state) throw mcpError('MCP_OAUTH_STATE_MISMATCH', 'OAuth MCP state inválido.');
  const remoteError = returned.searchParams.get('error');
  if (remoteError) throw mcpError('MCP_OAUTH_REMOTE_ERROR', returned.searchParams.get('error_description') || remoteError);
  const code = returned.searchParams.get('code');
  if (!code) throw mcpError('MCP_OAUTH_CODE_MISSING', 'OAuth MCP não retornou authorization code.');
  const responseIssuer = returned.searchParams.get('iss');
  if (requireIssuerResponse && !responseIssuer) throw mcpError('MCP_OAUTH_ISS_REQUIRED', 'Resposta OAuth MCP não trouxe iss para validação anti-mix-up.');
  if (responseIssuer && responseIssuer.replace(/\/$/, '') !== discovery.issuer.replace(/\/$/, '')) {
    throw mcpError('MCP_OAUTH_RESPONSE_ISSUER_MISMATCH', 'Issuer da resposta OAuth não corresponde ao Authorization Server descoberto.');
  }

  const tokenEndpoint = new URL(discovery.metadata.token_endpoint);
  if (tokenEndpoint.protocol !== 'https:') throw mcpError('MCP_OAUTH_TOKEN_ENDPOINT_INSECURE', 'token_endpoint precisa usar HTTPS.');
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
    resource: discovery.resource
  });
  const tokenResponse = await fetch(tokenEndpoint.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form.toString(),
    redirect: 'error',
    cache: 'no-store',
    credentials: 'omit'
  });
  const tokenBody = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || !tokenBody?.access_token) {
    throw mcpError('MCP_OAUTH_TOKEN_EXCHANGE_FAILED', text(tokenBody?.error_description || tokenBody?.error || `HTTP ${tokenResponse.status}`, 1000));
  }
  await setMcpSessionAuth(server.id, { accessToken: tokenBody.access_token, issuer: discovery.issuer });
  return {
    connected: true,
    serverId: server.id,
    issuer: discovery.issuer,
    tokenType: text(tokenBody.token_type, 80) || 'Bearer',
    expiresIn: Math.max(0, Number(tokenBody.expires_in || 0) || 0),
    scope: text(tokenBody.scope, 4000),
    refreshTokenReceived: Boolean(tokenBody.refresh_token),
    persistentTokenStorage: false
  };
}
