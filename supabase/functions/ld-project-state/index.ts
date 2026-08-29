import { createClient } from "jsr:@supabase/supabase-js@2.112.4";

const PUBLIC_SPKI_B64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==";
const API_BASE = "https://api.supabase.com/v1";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-license-key,x-device-id,authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function b64urlDecode(value: string) {
  const s = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
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
function admin() {
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
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    await publicKey(),
    b64urlDecode(sigPart),
    enc.encode(payloadPart)
  );
  if (!valid) throw new Error("KEY_INVALID_SIGNATURE");
  const payload = JSON.parse(dec.decode(b64urlDecode(payloadPart)));
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
    .select("id,status,expires_at,credit_balance,credit_debt")
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
  return { licenseId: String(license.id), deviceHash };
}
async function getConfig(sb: any) {
  const { data, error } = await sb.from("ld_supabase_oauth_config").select("*").eq("singleton", true).maybeSingle();
  if (error) throw new Error("OAUTH_CONFIG_READ_FAILED");
  if (!data) throw new Error("SUPABASE_OAUTH_APP_NOT_CONFIGURED");
  return data;
}
async function getSecret(sb: any, name: string) {
  const { data, error } = await sb.rpc("ld_backend_secret", { p_name: name });
  if (error || !data) throw new Error(`SECRET_MISSING:${name}`);
  return String(data);
}
async function setSecret(sb: any, name: string, value: string) {
  const { error } = await sb.rpc("ld_backend_secret_set", {
    p_name: name,
    p_value: value,
    p_description: "Lovable Decrypter Supabase OAuth refresh token"
  });
  if (error) throw new Error(`SECRET_STORE_FAILED:${name}`);
}
async function connectionRow(sb: any, licenseId: string, deviceHash: string) {
  const { data, error } = await sb.from("ld_supabase_connections").select("*")
    .eq("license_id", licenseId)
    .eq("device_hash", deviceHash)
    .maybeSingle();
  if (error) throw new Error("CONNECTION_READ_FAILED");
  if (!data) throw new Error("SUPABASE_NOT_CONNECTED");
  return data;
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
  if (!response.ok || !data?.access_token) throw new Error(`TOKEN_REFRESH_FAILED:${response.status}`);
  if (data.refresh_token && String(data.refresh_token) !== refresh) {
    await setSecret(sb, String(connection.refresh_secret_name), String(data.refresh_token));
  }
  return String(data.access_token);
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
  } finally {
    clearTimeout(timer);
  }
}
function normalizeRows(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.result)) return value.result;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
}
async function databaseQuery(accessToken: string, ref: string, query: string) {
  const data = await managementRequest(
    accessToken,
    `/projects/${encodeURIComponent(ref)}/database/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    }
  );
  return normalizeRows(data);
}
async function safeDatabaseQuery(accessToken: string, ref: string, query: string) {
  try { return await databaseQuery(accessToken, ref, query); }
  catch (_) { return []; }
}
function projectSummary(item: any) {
  return {
    ref: String(item?.ref || item?.id || ""),
    name: String(item?.name || item?.ref || ""),
    organization_id: String(item?.organization_id || ""),
    organization_slug: String(item?.organization_slug || ""),
    region: String(item?.region || ""),
    status: String(item?.status || ""),
    database_version: String(item?.database?.version || "")
  };
}
function safeAuthConfig(config: any) {
  const allowList = Array.isArray(config?.uri_allow_list)
    ? config.uri_allow_list.map(String)
    : String(config?.uri_allow_list || "").split(",").map((v: string) => v.trim()).filter(Boolean);
  return {
    site_url: String(config?.site_url || ""),
    uri_allow_list: allowList.slice(0, 100),
    disable_signup: Boolean(config?.disable_signup),
    external_email_enabled: config?.external_email_enabled !== false,
    mailer_autoconfirm: Boolean(config?.mailer_autoconfirm),
    google: {
      enabled: Boolean(config?.external_google_enabled),
      client_id_present: Boolean(String(config?.external_google_client_id || "").trim()),
      client_secret_present: Boolean(String(config?.external_google_secret || "").trim())
    }
  };
}
function safeEdgeFunctions(value: any) {
  const rows = Array.isArray(value) ? value : [];
  return rows.map(item => ({
    slug: String(item?.slug || item?.name || ""),
    name: String(item?.name || item?.slug || ""),
    status: String(item?.status || ""),
    version: Number(item?.version || 0),
    verify_jwt: item?.verify_jwt !== false,
    entrypoint_path: String(item?.entrypoint_path || ""),
    updated_at: item?.updated_at ?? null,
    ezbr_sha256: /^[a-f0-9]{64}$/i.test(String(item?.ezbr_sha256 || "")) ? String(item.ezbr_sha256) : ""
  })).filter(item => item.slug);
}
function safeSecretNames(value: any) {
  const rows = Array.isArray(value) ? value : [];
  return [...new Set(rows.map(item => String(item?.name || item?.key || "").trim()).filter(Boolean))].sort();
}
function compactRows(rows: any[], keys: string[]) {
  return rows.map(row => Object.fromEntries(keys.map(key => [key, row?.[key] ?? null])));
}

async function inspect(accessToken: string, ref: string) {
  const projectsRaw = await managementRequest(accessToken, "/projects");
  const projects = Array.isArray(projectsRaw) ? projectsRaw : [];
  const project = projects.find((item: any) => String(item?.ref || item?.id || "") === ref);
  if (!project) throw new Error("PROJECT_NOT_AUTHORIZED");

  const relationSql = `
    select n.nspname as schema_name,
           c.relname as relation_name,
           case c.relkind when 'r' then 'table' when 'p' then 'partitioned_table'
             when 'v' then 'view' when 'm' then 'materialized_view' else c.relkind::text end as relation_type,
           c.relrowsecurity as rls_enabled
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','p','v','m')
      and n.nspname not like 'pg_%'
      and n.nspname not in ('information_schema','auth','storage','realtime','extensions','vault','supabase_migrations','supabase_functions','graphql','graphql_public')
    order by n.nspname, c.relname
    limit 2000`;
  const columnSql = `
    select table_schema as schema_name, table_name, column_name, data_type, is_nullable,
           (column_default is not null) as has_default
    from information_schema.columns
    where table_schema not like 'pg_%'
      and table_schema not in ('information_schema','auth','storage','realtime','extensions','vault','supabase_migrations','supabase_functions','graphql','graphql_public')
    order by table_schema, table_name, ordinal_position
    limit 6000`;
  const policySql = `
    select schemaname as schema_name, tablename as table_name, policyname as policy_name,
           permissive, roles, cmd
    from pg_catalog.pg_policies
    where schemaname not like 'pg_%'
      and schemaname not in ('auth','storage','realtime','extensions','vault','supabase_migrations','supabase_functions')
    order by schemaname, tablename, policyname
    limit 3000`;
  const routineSql = `
    select routine_schema as schema_name, routine_name, routine_type, data_type
    from information_schema.routines
    where routine_schema not like 'pg_%'
      and routine_schema not in ('information_schema','auth','storage','realtime','extensions','vault','supabase_migrations','supabase_functions','graphql','graphql_public')
    order by routine_schema, routine_name
    limit 3000`;
  const triggerSql = `
    select trigger_schema as schema_name, event_object_table as table_name, trigger_name,
           event_manipulation, action_timing
    from information_schema.triggers
    where trigger_schema not like 'pg_%'
      and trigger_schema not in ('auth','storage','realtime','extensions','vault','supabase_migrations','supabase_functions')
    order by trigger_schema, event_object_table, trigger_name
    limit 3000`;
  const migrationSql = `select version from supabase_migrations.schema_migrations order by version limit 10000`;
  const storageBucketSql = `
    select id::text as id, name, public, file_size_limit, allowed_mime_types
    from storage.buckets
    order by name
    limit 500`;
  const storageObjectSql = `
    select bucket_id, name,
           metadata->>'mimetype' as mime_type,
           case when coalesce(metadata->>'size','') ~ '^[0-9]+$' then (metadata->>'size')::bigint else null end as size,
           created_at, updated_at
    from storage.objects
    where lower(name) ~ '\\.(png|jpe?g|gif|webp|svg|ico|avif|bmp|tiff?|woff2?|ttf|otf|eot|mp4|webm|mov|mp3|wav|ogg|pdf)$'
    order by bucket_id, name
    limit 10000`;

  const [
    relations,
    columns,
    policies,
    routines,
    triggers,
    migrations,
    storageBuckets,
    storageObjects,
    functionsResult,
    authResult,
    secretsResult
  ] = await Promise.all([
    safeDatabaseQuery(accessToken, ref, relationSql),
    safeDatabaseQuery(accessToken, ref, columnSql),
    safeDatabaseQuery(accessToken, ref, policySql),
    safeDatabaseQuery(accessToken, ref, routineSql),
    safeDatabaseQuery(accessToken, ref, triggerSql),
    safeDatabaseQuery(accessToken, ref, migrationSql),
    safeDatabaseQuery(accessToken, ref, storageBucketSql),
    safeDatabaseQuery(accessToken, ref, storageObjectSql),
    managementRequest(accessToken, `/projects/${encodeURIComponent(ref)}/functions`).catch(() => []),
    managementRequest(accessToken, `/projects/${encodeURIComponent(ref)}/config/auth`).catch(() => null),
    managementRequest(accessToken, `/projects/${encodeURIComponent(ref)}/secrets`).catch(() => [])
  ]);

  return {
    schema: "ld-supabase-project-state/1",
    collectedAt: new Date().toISOString(),
    project: projectSummary(project),
    database: {
      relations: compactRows(relations, ["schema_name", "relation_name", "relation_type", "rls_enabled"]),
      columns: compactRows(columns, ["schema_name", "table_name", "column_name", "data_type", "is_nullable", "has_default"]),
      policies: compactRows(policies, ["schema_name", "table_name", "policy_name", "permissive", "roles", "cmd"]),
      routines: compactRows(routines, ["schema_name", "routine_name", "routine_type", "data_type"]),
      triggers: compactRows(triggers, ["schema_name", "table_name", "trigger_name", "event_manipulation", "action_timing"]),
      migrations: migrations.map(row => ({ version: String(row?.version || "") })).filter(row => row.version)
    },
    storage: {
      buckets: compactRows(storageBuckets, ["id", "name", "public", "file_size_limit", "allowed_mime_types"]),
      objects: compactRows(storageObjects, ["bucket_id", "name", "mime_type", "size", "created_at", "updated_at"]),
      metadata_only: true
    },
    edgeFunctions: safeEdgeFunctions(functionsResult),
    auth: safeAuthConfig(authResult),
    secrets: safeSecretNames(secretsResult),
    capabilities: {
      database_schema_read: true,
      migration_history_read: true,
      edge_functions_read: true,
      auth_config_read: true,
      storage_metadata_read: true,
      storage_object_bytes_read: false,
      secret_names_read: true,
      secret_values_read: false,
      writes: false
    }
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);

  const sb = admin();
  try {
    const auth = await authorize(req, sb);
    const body = await req.json().catch(() => ({}));
    if (String(body?.action || "") !== "inspect") return json({ ok: false, code: "UNKNOWN_ACTION" }, 400);
    const ref = String(body?.project_ref || "").trim();
    if (!/^[a-z0-9]{8,32}$/i.test(ref)) return json({ ok: false, code: "PROJECT_REF_INVALID" }, 400);

    const config = await getConfig(sb);
    const connection = await connectionRow(sb, auth.licenseId, auth.deviceHash);
    const accessToken = await refreshAccessToken(sb, config, connection);
    const state = await inspect(accessToken, ref);
    return json({ ok: true, state });
  } catch (error) {
    console.error("ld-project-state", error);
    const code = String((error as Error)?.message || "INTERNAL_ERROR");
    const status = /KEY_|DEVICE_|ENTITLEMENT|NOT_AUTHORIZED|NOT_CONNECTED/.test(code) ? 403 : 500;
    return json({ ok: false, code }, status);
  }
});