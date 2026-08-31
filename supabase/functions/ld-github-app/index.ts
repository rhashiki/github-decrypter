import { createClient } from "jsr:@supabase/supabase-js@2.112.4";
import { normalizeRsaPrivateKeyToPkcs8Der } from "../_shared/github-rsa.js";

const API_VERSION = "2026-03-10";
const CALLBACK_SURFACE = "https://lovable.dev/";
const PUBLIC_SPKI_B64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==";
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
function redirect(location: string) {
  return new Response(null, { status: 303, headers: { ...cors, Location: location, "Cache-Control": "no-store" } });
}
function callbackRedirect(status: "connected" | "error", detail: Record<string, string | number> = {}) {
  const target = new URL(CALLBACK_SURFACE);
  target.searchParams.set("ld2_integration_callback", "github");
  target.searchParams.set("status", status);
  for (const [key, value] of Object.entries(detail)) {
    if (value !== "" && value !== null && value !== undefined) target.searchParams.set(key, String(value).slice(0, 180));
  }
  return redirect(target.toString());
}
function b64url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function unb64url(value: string) {
  const raw = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(raw), char => char.charCodeAt(0));
}
async function sha(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function randomState() { return b64url(crypto.getRandomValues(new Uint8Array(32))); }
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
  const der = Uint8Array.from(atob(PUBLIC_SPKI_B64), char => char.charCodeAt(0));
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
  if (payload?.aud !== "lovable-decrypter" || Number(payload?.v) !== 1 || !payload?.license_id) throw new Error("KEY_INVALID_PAYLOAD");
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
    .eq("key_hash", await sha(token))
    .maybeSingle();
  if (error) throw new Error("DB_ERROR");
  if (!license) throw new Error("KEY_NOT_REGISTERED");
  if (license.status !== "active") throw new Error(`KEY_${String(license.status).toUpperCase()}`);
  const timeActive = Boolean(license.expires_at && Date.parse(license.expires_at) > Date.now());
  const creditActive = !timeActive && Number(license.credit_debt || 0) === 0 && Number(license.credit_balance || 0) > 0;
  if (!timeActive && !creditActive) throw new Error("ENTITLEMENT_EXHAUSTED");
  const deviceHash = await sha(deviceId);
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
async function getAppConfig(sb: any) {
  const { data, error } = await sb.from("ld_github_app_config").select("*").eq("singleton", true).maybeSingle();
  if (error) throw new Error("APP_CONFIG_READ_FAILED");
  return data || null;
}
async function getPrivateKey(sb: any) {
  const { data, error } = await sb.rpc("ld_backend_secret", { p_name: "LD_GITHUB_APP_PRIVATE_KEY" });
  if (error || !data) throw new Error("GITHUB_APP_PRIVATE_KEY_MISSING");
  return String(data);
}
async function appJwt(sb: any, config: any) {
  const pem = await getPrivateKey(sb);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    normalizeRsaPrivateKeyToPkcs8Der(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64url(enc.encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(config.client_id || config.app_id) })));
  const input = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(input)));
  return `${input}.${b64url(signature)}`;
}
async function githubAppRequest(sb: any, config: any, path: string, options: RequestInit = {}) {
  const jwt = await appJwt(sb, config);
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
      Authorization: `Bearer ${jwt}`,
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`GITHUB_APP_HTTP_${res.status}:${body?.message || "request failed"}`);
  return body;
}
async function installationToken(sb: any, config: any, installationId: number) {
  const body = await githubAppRequest(sb, config, `/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions: { contents: "write", workflows: "write", metadata: "read" } })
  });
  if (!body?.token || !body?.expires_at) throw new Error("GITHUB_INSTALLATION_TOKEN_FAILED");
  return { token: String(body.token), expires_at: String(body.expires_at) };
}
async function installationRequest(token: string, path: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
      Authorization: `Bearer ${token}`
    }
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`GITHUB_INSTALLATION_HTTP_${res.status}:${body?.message || "request failed"}`);
  return body;
}
async function listRepositories(token: string) {
  const repos: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const body = await installationRequest(token, `/installation/repositories?per_page=100&page=${page}`);
    const batch = Array.isArray(body?.repositories) ? body.repositories : [];
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.map(repo => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    private: !!repo.private,
    default_branch: repo.default_branch || "main",
    html_url: repo.html_url || "",
    owner: repo.owner?.login || String(repo.full_name || "").split("/")[0] || "",
    permissions: repo.permissions || {}
  }));
}
async function createState(sb: any, licenseId: string, deviceHash: string) {
  await sb.from("ld_github_states").delete().lt("expires_at", new Date().toISOString());
  const raw = randomState();
  const { error } = await sb.from("ld_github_states").insert({
    state_hash: await sha(raw),
    license_id: licenseId,
    device_hash: deviceHash,
    purpose: "install",
    expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString()
  });
  if (error) throw new Error("STATE_CREATE_FAILED");
  return raw;
}
async function stateRow(sb: any, raw: string) {
  if (!raw) throw new Error("STATE_REQUIRED");
  const { data, error } = await sb.from("ld_github_states")
    .select("state_hash,license_id,device_hash,purpose,expires_at,consumed_at")
    .eq("state_hash", await sha(raw))
    .eq("purpose", "install")
    .maybeSingle();
  if (error) throw new Error("STATE_READ_FAILED");
  if (!data || data.consumed_at || Date.parse(data.expires_at) <= Date.now()) throw new Error("STATE_INVALID_OR_EXPIRED");
  return data;
}
async function consumeState(sb: any, stateHash: string) {
  const { error } = await sb.from("ld_github_states").update({ consumed_at: new Date().toISOString() })
    .eq("state_hash", stateHash).is("consumed_at", null);
  if (error) throw new Error("STATE_CONSUME_FAILED");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  const flow = url.searchParams.get("flow") || "";
  const sb = supabaseAdmin();
  try {
    if (req.method === "GET" && flow === "install_callback") {
      const installationId = Number(url.searchParams.get("installation_id") || 0);
      const rawState = url.searchParams.get("state") || "";
      if (!Number.isInteger(installationId) || installationId <= 0) throw new Error("INSTALLATION_ID_REQUIRED");
      const state = await stateRow(sb, rawState);
      const config = await getAppConfig(sb);
      if (!config) throw new Error("GITHUB_APP_NOT_CONFIGURED");
      const installation = await githubAppRequest(sb, config, `/app/installations/${installationId}`);
      if (Number(installation?.app_id) !== Number(config.app_id)) throw new Error("INSTALLATION_APP_MISMATCH");
      const row = {
        license_id: state.license_id,
        installation_id: installationId,
        account_login: String(installation.account?.login || "GitHub"),
        account_type: String(installation.account?.type || ""),
        repository_selection: String(installation.repository_selection || "selected"),
        permissions: installation.permissions || {},
        app_slug: config.app_slug,
        manage_url: String(installation.html_url || `https://github.com/settings/installations/${installationId}`),
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { error } = await sb.from("ld_github_installations").upsert(row, { onConflict: "license_id" });
      if (error) throw new Error("INSTALLATION_STORE_FAILED");
      await consumeState(sb, state.state_hash);
      return callbackRedirect("connected");
    }
    if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);

    const auth = await authorize(req, sb);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");
    const config = await getAppConfig(sb);

    if (action === "connect") {
      if (!config) return json({ ok: false, code: "GITHUB_APP_NOT_BOOTSTRAPPED" }, 409);
      const state = await createState(sb, auth.license.id, auth.deviceHash);
      return json({
        ok: true,
        mode: "install",
        url: `https://github.com/apps/${encodeURIComponent(config.app_slug)}/installations/new?state=${encodeURIComponent(state)}`,
        app: { slug: config.app_slug, name: config.app_name }
      });
    }

    if (action === "disconnect") {
      const { error } = await sb.from("ld_github_installations").delete().eq("license_id", auth.license.id);
      if (error) return json({ ok: false, code: "DISCONNECT_FAILED" }, 500);
      return json({ ok: true, disconnected: true });
    }

    if (action === "status") {
      if (!config) return json({ ok: true, app_configured: false, connected: false, can_bootstrap: false });
      const { data: installation, error } = await sb.from("ld_github_installations").select("*").eq("license_id", auth.license.id).maybeSingle();
      if (error) return json({ ok: false, code: "INSTALLATION_READ_FAILED" }, 500);
      if (!installation) return json({ ok: true, app_configured: true, connected: false, app: { slug: config.app_slug, name: config.app_name, html_url: config.html_url } });
      try {
        const issued = await installationToken(sb, config, Number(installation.installation_id));
        const repositories = await listRepositories(issued.token);
        return json({
          ok: true,
          app_configured: true,
          connected: true,
          app: { slug: config.app_slug, name: config.app_name, html_url: config.html_url },
          installation: {
            id: Number(installation.installation_id),
            account_login: installation.account_login,
            account_type: installation.account_type,
            repository_selection: installation.repository_selection,
            permissions: installation.permissions || {},
            manage_url: installation.manage_url || `https://github.com/settings/installations/${installation.installation_id}`
          },
          repositories
        });
      } catch (error) {
        const message = String((error as Error)?.message || error);
        if (/GITHUB_APP_HTTP_404|GITHUB_APP_HTTP_401/.test(message)) {
          await sb.from("ld_github_installations").delete().eq("license_id", auth.license.id);
          return json({ ok: true, app_configured: true, connected: false, stale_installation: true, app: { slug: config.app_slug, name: config.app_name } });
        }
        throw error;
      }
    }

    if (action === "token") {
      if (!config) return json({ ok: false, code: "GITHUB_APP_NOT_CONFIGURED" }, 409);
      const { data: installation, error } = await sb.from("ld_github_installations").select("installation_id").eq("license_id", auth.license.id).maybeSingle();
      if (error || !installation) return json({ ok: false, code: "GITHUB_NOT_CONNECTED" }, 409);
      const issued = await installationToken(sb, config, Number(installation.installation_id));
      return json({ ok: true, token: issued.token, expires_at: issued.expires_at, installation_id: Number(installation.installation_id) });
    }

    return json({ ok: false, code: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("ld-github-app", error);
    const code = String((error as Error)?.message || "INTERNAL_ERROR");
    if (req.method === "GET" && flow === "install_callback") return callbackRedirect("error", { code });
    const status = /KEY_|DEVICE_|ENTITLEMENT/.test(code) ? 403 : 500;
    return json({ ok: false, code }, status);
  }
});
