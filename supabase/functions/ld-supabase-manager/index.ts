import { createClient } from "jsr:@supabase/supabase-js@2.112.4";

const PUBLIC_SPKI_B64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==";
const API_BASE = "https://api.supabase.com/v1";
const OAUTH_FUNCTION = "ld-supabase-oauth";
const REQUIRED_SCOPES = Object.freeze([
  "organizations:read",
  "projects:read",
  "projects:write",
  "database:read",
  "database:write"
]);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-license-key,x-device-id,authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      ...cors,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
    }
  });
}
function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function unb64url(value: string) {
  const s = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
function randomValue(size = 48) { return b64url(crypto.getRandomValues(new Uint8Array(size))); }
async function shaHex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function serviceKey() {
  const current = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (current) {
    try {
      const parsed = JSON.parse(current);
      if (parsed?.default) return String(parsed.default);
      const first = Object.values(parsed || {})[0];
      if (first) return String(first);
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = serviceKey();
  if (!url || !key) throw new Error("BACKEND_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function publicKey() {
  const der = Uint8Array.from(atob(PUBLIC_SPKI_B64), c => c.charCodeAt(0));
  return crypto.subtle.importKey("spki", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}
async function verifyLicenseToken(token: string) {
  const [prefix, payloadPart, sigPart] = token.trim().split(".");
  if (prefix !== "LD2" || !payloadPart || !sigPart) throw new Error("KEY_INVALID_FORMAT");
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    await publicKey(),
    unb64url(sigPart),
    enc.encode(payloadPart)
  );
  if (!ok) throw new Error("KEY_INVALID_SIGNATURE");
  const payload = JSON.parse(dec.decode(unb64url(payloadPart)));
  if (payload?.aud !== "lovable-decrypter" || Number(payload?.v) !== 1 || !payload?.license_id) {
    throw new Error("KEY_INVALID_PAYLOAD");
  }
  return payload;
}
async function authorize(req: Request, sb: any) {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const token = String(req.headers.get("x-license-key") || bearer || "").trim();
  const deviceId = String(req.headers.get("x-device-id") || "").trim();
  if (!token) throw new Error("KEY_REQUIRED");
  if (!deviceId) throw new Error("DEVICE_REQUIRED");
  const signed = await verifyLicenseToken(token);
  const { data: license, error } = await sb.from("ld_license_keys")
    .select("id,status,expires_at,credit_balance,credit_debt,metadata")
    .eq("id", String(signed.license_id))
    .eq("key_hash", await shaHex(token))
    .maybeSingle();
  if (error) throw new Error("DB_ERROR");
  if (!license) throw new Error("KEY_NOT_REGISTERED");
  if (license.status !== "active") throw new Error(`KEY_${String(license.status).toUpperCase()}`);
  const timeActive = Boolean(license.expires_at && Date.parse(license.expires_at) > Date.now());
  const creditActive = !timeActive && Number(license.credit_debt || 0) === 0 && Number(license.credit_balance || 0) > 0;
  if (!timeActive && !creditActive) throw new Error("ENTITLEMENT_EXHAUSTED");
  const deviceHash = await shaHex(deviceId);
  const { data: device, error: deviceError } = await sb.from("ld_license_devices")
    .select("id,revoked_at")
    .eq("license_id", license.id)
    .eq("device_hash", deviceHash)
    .maybeSingle();
  if (deviceError) throw new Error("DB_ERROR");
  if (!device) throw new Error("DEVICE_NOT_BOUND");
  if (device.revoked_at) throw new Error("DEVICE_REVOKED");
  return { license, deviceHash };
}
function ownerUnlimited(license: any) {
  return license?.metadata?.owner_unlimited === true;
}
async function getConfig(sb: any) {
  const { data, error } = await sb.from("ld_supabase_oauth_config").select("*").eq("singleton", true).maybeSingle();
  if (error) throw new Error("OAUTH_CONFIG_READ_FAILED");
  return data || null;
}
async function getSecret(sb: any, name: string) {
  const { data, error } = await sb.rpc("ld_backend_secret", { p_name: name });
  if (error || !data) throw new Error(`SECRET_MISSING:${name}`);
  return String(data);
}
async function storeSecret(sb: any, name: string, value: string, description: string) {
  const { error } = await sb.rpc("ld_backend_secret_set", { p_name: name, p_value: value, p_description: description });
  if (error) throw new Error(`SECRET_STORE_FAILED:${name}`);
}
async function connectionRow(sb: any, licenseId: string, deviceHash: string) {
  const { data, error } = await sb.from("ld_supabase_connections").select("*")
    .eq("license_id", licenseId)
    .eq("device_hash", deviceHash)
    .maybeSingle();
  if (error) throw new Error("CONNECTION_READ_FAILED");
  return data || null;
}
function basicAuth(clientId: string, secret: string) {
  return `Basic ${btoa(`${clientId}:${secret}`)}`;
}
async function refreshAccessToken(sb: any, config: any, connection: any) {
  const refresh = await getSecret(sb, String(connection.refresh_secret_name));
  const clientSecret = await getSecret(sb, "LD_SUPABASE_OAUTH_CLIENT_SECRET");
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh });
  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(String(config.client_id), clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    throw new Error(`TOKEN_REFRESH_FAILED:${response.status}:${data?.message || data?.error || "invalid response"}`);
  }
  if (data.refresh_token && String(data.refresh_token) !== refresh) {
    await storeSecret(sb, String(connection.refresh_secret_name), String(data.refresh_token), "Lovable Decrypter Supabase OAuth refresh token");
  }
  return {
    accessToken: String(data.access_token),
    scope: String(data.scope || connection.granted_scope || ""),
    tokenType: String(data.token_type || "Bearer")
  };
}
async function activeSession(sb: any, config: any, licenseId: string, deviceHash: string) {
  const connection = await connectionRow(sb, licenseId, deviceHash);
  if (!connection) throw new Error("SUPABASE_NOT_CONNECTED");
  return { connection, ...(await refreshAccessToken(sb, config, connection)) };
}
async function managementRequest(accessToken: string, path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`SUPABASE_MANAGEMENT_HTTP_${response.status}:${data?.message || data?.error || "request failed"}`);
    }
    return data;
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw new Error("SUPABASE_MANAGEMENT_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
function parseScopes(value: string) {
  return new Set(String(value || "").split(/[\s,]+/).map(x => x.trim()).filter(Boolean));
}
function missingScopes(value: string) {
  const granted = parseScopes(value);
  return REQUIRED_SCOPES.filter(scope => !granted.has(scope));
}
async function listOrganizations(accessToken: string) {
  const data = await managementRequest(accessToken, "/organizations");
  if (!Array.isArray(data)) throw new Error("ORGANIZATION_LIST_INVALID");
  return data.map((item: any) => ({
    id: String(item.id || ""),
    slug: String(item.slug || ""),
    name: String(item.name || item.slug || "Supabase organization")
  })).filter((item: any) => item.slug);
}
async function listProjects(accessToken: string) {
  const data = await managementRequest(accessToken, "/projects");
  if (!Array.isArray(data)) throw new Error("PROJECT_LIST_INVALID");
  return data.map((project: any) => ({
    id: String(project.id || project.ref || ""),
    ref: String(project.ref || project.id || ""),
    name: String(project.name || project.ref || "Supabase project"),
    organization_id: String(project.organization_id || ""),
    organization_slug: String(project.organization_slug || ""),
    region: String(project.region || ""),
    status: String(project.status || ""),
    created_at: String(project.created_at || ""),
    database_version: String(project.database?.version || ""),
    url: project.ref ? `https://${project.ref}.supabase.co` : ""
  })).filter((project: any) => /^[a-z0-9]{8,32}$/i.test(project.ref));
}
async function profile(accessToken: string) {
  try {
    const data = await managementRequest(accessToken, "/profile");
    return {
      username: String(data?.username || ""),
      email: String(data?.primary_email || "")
    };
  } catch (_) {
    return { username: "", email: "" };
  }
}
async function createBootstrapState(sb: any, licenseId: string, deviceHash: string) {
  await sb.from("ld_supabase_oauth_states").delete().lt("expires_at", new Date().toISOString());
  const raw = randomValue(32);
  const { error } = await sb.from("ld_supabase_oauth_states").insert({
    state_hash: await shaHex(raw),
    license_id: licenseId,
    device_hash: deviceHash,
    code_verifier: "bootstrap",
    purpose: "bootstrap",
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  });
  if (error) throw new Error("BOOTSTRAP_STATE_CREATE_FAILED");
  return raw;
}
async function bootstrapState(sb: any, raw: string) {
  if (!raw) throw new Error("BOOTSTRAP_STATE_REQUIRED");
  const { data, error } = await sb.from("ld_supabase_oauth_states")
    .select("state_hash,license_id,device_hash,expires_at,consumed_at,purpose")
    .eq("state_hash", await shaHex(raw))
    .eq("purpose", "bootstrap")
    .maybeSingle();
  if (error) throw new Error("BOOTSTRAP_STATE_READ_FAILED");
  if (!data || data.consumed_at || Date.parse(data.expires_at) <= Date.now()) throw new Error("BOOTSTRAP_STATE_INVALID");
  const { data: license } = await sb.from("ld_license_keys").select("metadata").eq("id", data.license_id).maybeSingle();
  if (!ownerUnlimited(license)) throw new Error("OWNER_REQUIRED");
  return data;
}
async function consumeState(sb: any, stateHash: string) {
  const { error } = await sb.from("ld_supabase_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("state_hash", stateHash)
    .is("consumed_at", null);
  if (error) throw new Error("BOOTSTRAP_STATE_CONSUME_FAILED");
}
function esc(value: string) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function selfUrl(url: URL) { return `${url.origin}${url.pathname}`; }
function callbackUrl(url: URL) { return `${url.origin}/functions/v1/${OAUTH_FUNCTION}?flow=callback`; }
function bootstrapPage(url: URL, state: string) {
  const callback = callbackUrl(url);
  const scopes = REQUIRED_SCOPES.join(" ");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configurar Supabase OAuth</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#050b08;color:#eafff2;font-family:Arial,sans-serif;display:grid;place-items:center;padding:24px}.card{width:min(720px,100%);border:1px solid #3ecf8e66;border-radius:18px;background:#07140e;padding:26px;box-shadow:0 20px 70px #0009}.mark{color:#3ecf8e;font-weight:900;letter-spacing:.12em;font-size:12px}h1{margin:8px 0 8px;font-size:24px}p{color:#a9bdb3;line-height:1.55}.box{margin:16px 0;padding:13px;border:1px solid #ffffff18;border-radius:12px;background:#0004}.box b{display:block;font-size:11px;color:#74f5b4;margin-bottom:6px}.box code{font-size:12px;color:#eafff2;word-break:break-all}label{display:block;margin:14px 0 6px;font-size:12px;font-weight:800;color:#b9d3c5}input{width:100%;padding:12px;border:1px solid #ffffff22;border-radius:10px;background:#020805;color:#fff;font:13px Arial}button,a.btn{display:inline-flex;align-items:center;justify-content:center;margin-top:16px;padding:11px 15px;border:1px solid #3ecf8e;border-radius:10px;background:#3ecf8e;color:#03130b;font-weight:900;text-decoration:none;cursor:pointer}.ghost{background:transparent!important;color:#80eeb7!important;margin-right:8px!important}.note{font-size:11px;color:#789286}.actions{display:flex;flex-wrap:wrap;gap:8px}</style></head><body><main class="card"><div class="mark">LOVABLE DECRYPTER · OWNER BOOTSTRAP</div><h1>Configurar OAuth App do Supabase</h1><p>Crie um OAuth App no Dashboard do Supabase usando exatamente o callback e os scopes abaixo. Depois cole o Client ID e Client Secret uma única vez. O secret será enviado diretamente a este backend e armazenado no Vault.</p><div class="box"><b>CALLBACK URL</b><code>${esc(callback)}</code></div><div class="box"><b>SCOPES DA BUILD 5</b><code>${esc(scopes)}</code></div><div class="actions"><a class="btn ghost" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Abrir Supabase Dashboard</a></div><form method="post" action="${esc(selfUrl(url))}?flow=bootstrap-submit"><input type="hidden" name="state" value="${esc(state)}"><label>Client ID</label><input name="client_id" autocomplete="off" required minlength="8"><label>Client Secret</label><input name="client_secret" type="password" autocomplete="new-password" required minlength="16"><button type="submit">Salvar no Vault</button></form><p class="note">Esta página expira em 15 minutos. Nenhuma credencial é salva no Lovable ou na extensão.</p></main></body></html>`;
}
function resultPage(ok: boolean, title: string, detail: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{margin:0;background:#050b08;color:#eafff2;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px}.card{max-width:560px;padding:28px;border:1px solid ${ok ? "#3ecf8e66" : "#ff647066"};border-radius:18px;background:#07140e}.icon{font-size:38px;color:${ok ? "#3ecf8e" : "#ff7b86"}}p{color:#a9bdb3;line-height:1.5}</style></head><body><div class="card"><div class="icon">${ok ? "✓" : "!"}</div><h1>${esc(title)}</h1><p>${esc(detail)}</p></div></body></html>`;
}
function dbPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=";
  const bytes = crypto.getRandomValues(new Uint8Array(40));
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}
function dbPassSecret(ref: string) { return `LD_SUPABASE_DBPASS_${ref.toUpperCase()}`; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  const sb = supabaseAdmin();
  try {
    if (req.method === "GET" && url.searchParams.get("flow") === "bootstrap") {
      const state = url.searchParams.get("state") || "";
      await bootstrapState(sb, state);
      return html(bootstrapPage(url, state));
    }
    if (req.method === "POST" && url.searchParams.get("flow") === "bootstrap-submit") {
      const form = await req.formData();
      const rawState = String(form.get("state") || "");
      const state = await bootstrapState(sb, rawState);
      const clientId = String(form.get("client_id") || "").trim();
      const clientSecret = String(form.get("client_secret") || "").trim();
      if (clientId.length < 8 || clientId.length > 256) throw new Error("CLIENT_ID_INVALID");
      if (clientSecret.length < 16 || clientSecret.length > 1024) throw new Error("CLIENT_SECRET_INVALID");
      const redirect = callbackUrl(url);
      const { error } = await sb.from("ld_supabase_oauth_config").upsert({ singleton: true, client_id: clientId, app_name: "Lovable Decrypter", redirect_uri: redirect, updated_at: new Date().toISOString() }, { onConflict: "singleton" });
      if (error) throw new Error("OAUTH_CONFIG_STORE_FAILED");
      await storeSecret(sb, "LD_SUPABASE_OAUTH_CLIENT_SECRET", clientSecret, "Lovable Decrypter Supabase OAuth client secret");
      await consumeState(sb, state.state_hash);
      return html(resultPage(true, "OAuth App configurado", "Client Secret salvo no Vault. Volte ao Lovable Decrypter e clique em Conectar Supabase."));
    }
    if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
    const auth = await authorize(req, sb);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");
    const config = await getConfig(sb);
    if (action === "bootstrap_start") {
      if (!ownerUnlimited(auth.license)) return json({ ok: false, code: "OWNER_REQUIRED" }, 403);
      const state = await createBootstrapState(sb, auth.license.id, auth.deviceHash);
      return json({ ok: true, url: `${selfUrl(url)}?flow=bootstrap&state=${encodeURIComponent(state)}`, callback_url: callbackUrl(url), required_scopes: REQUIRED_SCOPES });
    }
    if (action === "status") {
      if (!config) return json({ ok: true, app_configured: false, connected: false, can_bootstrap: ownerUnlimited(auth.license), required_scopes: REQUIRED_SCOPES });
      const connection = await connectionRow(sb, auth.license.id, auth.deviceHash);
      if (!connection) return json({ ok: true, app_configured: true, connected: false, app: { name: config.app_name }, required_scopes: REQUIRED_SCOPES });
      try {
        const token = await refreshAccessToken(sb, config, connection);
        const [organizations, projects, who] = await Promise.all([listOrganizations(token.accessToken), listProjects(token.accessToken), profile(token.accessToken)]);
        const missing = missingScopes(token.scope);
        return json({ ok: true, app_configured: true, connected: true, app: { name: config.app_name }, profile: who, scope: token.scope, required_scopes: REQUIRED_SCOPES, missing_scopes: missing, reauthorize_required: missing.length > 0, organizations, projects });
      } catch (error) {
        const message = String((error as Error)?.message || error);
        if (/TOKEN_REFRESH_FAILED:400|TOKEN_REFRESH_FAILED:401/.test(message)) return json({ ok: true, app_configured: true, connected: false, stale_connection: true, app: { name: config.app_name }, required_scopes: REQUIRED_SCOPES });
        throw error;
      }
    }
    if (!config) return json({ ok: false, code: "SUPABASE_OAUTH_APP_NOT_CONFIGURED" }, 409);
    const session = await activeSession(sb, config, auth.license.id, auth.deviceHash);
    if (action === "organizations") return json({ ok: true, organizations: await listOrganizations(session.accessToken) });
    if (action === "regions") {
      const slug = String(body.organization_slug || "").trim();
      if (!slug) return json({ ok: false, code: "ORGANIZATION_REQUIRED" }, 400);
      const data = await managementRequest(session.accessToken, `/projects/available-regions?organization_slug=${encodeURIComponent(slug)}`);
      return json({ ok: true, regions: data });
    }
    if (action === "create_project") {
      const missing = missingScopes(session.scope);
      if (missing.length) return json({ ok: false, code: "REAUTHORIZE_REQUIRED", missing_scopes: missing }, 403);
      const name = String(body.name || "").trim();
      const organizationSlug = String(body.organization_slug || "").trim();
      const regionType = String(body.region_type || "smartGroup");
      const regionCode = String(body.region_code || "").trim();
      if (!name || name.length > 80) return json({ ok: false, code: "PROJECT_NAME_INVALID" }, 400);
      if (!organizationSlug) return json({ ok: false, code: "ORGANIZATION_REQUIRED" }, 400);
      const organizations = await listOrganizations(session.accessToken);
      if (!organizations.some((item: any) => item.slug === organizationSlug)) return json({ ok: false, code: "ORGANIZATION_NOT_AUTHORIZED" }, 403);
      const password = dbPassword();
      const payload: Record<string, unknown> = { name, organization_slug: organizationSlug, db_pass: password };
      if (regionCode) {
        if (!["smartGroup", "specific"].includes(regionType)) return json({ ok: false, code: "REGION_TYPE_INVALID" }, 400);
        payload.region_selection = { type: regionType, code: regionCode };
      }
      const created = await managementRequest(session.accessToken, "/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const ref = String(created?.ref || created?.id || "");
      if (!/^[a-z0-9]{8,32}$/i.test(ref)) throw new Error("PROJECT_CREATE_RESPONSE_INVALID");
      await storeSecret(sb, dbPassSecret(ref), password, `Database password for Supabase project ${ref}`);
      return json({ ok: true, project: { ref, id: String(created?.id || ref), name: String(created?.name || name), organization_id: String(created?.organization_id || ""), organization_slug: String(created?.organization_slug || organizationSlug), region: String(created?.region || regionCode), status: String(created?.status || "INACTIVE"), url: `https://${ref}.supabase.co` }, database_password_stored: true }, 201);
    }
    if (action === "project_status") {
      const ref = String(body.project_ref || "").trim();
      if (!/^[a-z0-9]{8,32}$/i.test(ref)) return json({ ok: false, code: "PROJECT_REF_INVALID" }, 400);
      const project = await managementRequest(session.accessToken, `/projects/${encodeURIComponent(ref)}`);
      let health: unknown = null;
      try { health = await managementRequest(session.accessToken, `/projects/${encodeURIComponent(ref)}/health`); } catch (_) {}
      return json({ ok: true, project, health });
    }
    if (action === "project_test") {
      const ref = String(body.project_ref || "").trim();
      if (!/^[a-z0-9]{8,32}$/i.test(ref)) return json({ ok: false, code: "PROJECT_REF_INVALID" }, 400);
      const projects = await listProjects(session.accessToken);
      const project = projects.find((item: any) => item.ref === ref);
      if (!project) return json({ ok: false, code: "PROJECT_NOT_AUTHORIZED" }, 403);
      await managementRequest(session.accessToken, `/projects/${encodeURIComponent(ref)}/database/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "select 1 as lovable_decrypter_ok" }) });
      return json({ ok: true, project, database_access: true });
    }
    return json({ ok: false, code: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("ld-supabase-manager", error);
    const code = String((error as Error)?.message || "INTERNAL_ERROR");
    if (req.method === "GET" || url.searchParams.get("flow") === "bootstrap-submit") return html(resultPage(false, "Falha na configuração", code), 400);
    const status = /KEY_|DEVICE_|ENTITLEMENT|OWNER_REQUIRED|NOT_AUTHORIZED/.test(code) ? 403 : /REAUTHORIZE_REQUIRED/.test(code) ? 403 : 500;
    return json({ ok: false, code }, status);
  }
});