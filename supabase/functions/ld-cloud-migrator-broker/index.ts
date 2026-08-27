import { createClient } from "jsr:@supabase/supabase-js@2.112.4";
import postgres from "npm:postgres@3.4.9";

const PUBLIC_SPKI_B64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==";
const API_BASE = "https://api.supabase.com/v1";
const SOURCE_SECRET_PREFIX = "LD_CLOUD_SOURCE_";
const CHUNK_ROWS = 150;
const MAX_LOGS = 120;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-license-key,x-device-id,authorization,x-ld-helper-token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};
const enc = new TextEncoder();
const dec = new TextDecoder();

type Json = Record<string, unknown>;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function b64url(bytes: Uint8Array) {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return btoa(out).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" }, await publicKey(), unb64url(sigPart), enc.encode(payloadPart)
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
    .select("id,status,expires_at,credit_balance,credit_debt")
    .eq("id", String(signed.license_id)).eq("key_hash", await shaHex(token)).maybeSingle();
  if (error) throw new Error("DB_ERROR");
  if (!license) throw new Error("KEY_NOT_REGISTERED");
  if (license.status !== "active") throw new Error(`KEY_${String(license.status).toUpperCase()}`);
  const timeActive = Boolean(license.expires_at && Date.parse(license.expires_at) > Date.now());
  const creditActive = !timeActive && Number(license.credit_debt || 0) === 0 && Number(license.credit_balance || 0) > 0;
  if (!timeActive && !creditActive) throw new Error("ENTITLEMENT_EXHAUSTED");
  const deviceHash = await shaHex(deviceId);
  const { data: device, error: deviceError } = await sb.from("ld_license_devices")
    .select("id,revoked_at").eq("license_id", license.id).eq("device_hash", deviceHash).maybeSingle();
  if (deviceError) throw new Error("DB_ERROR");
  if (!device) throw new Error("DEVICE_NOT_BOUND");
  if (device.revoked_at) throw new Error("DEVICE_REVOKED");
  return { licenseId: String(license.id), deviceHash };
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
async function deleteSecret(sb: any, name: string) {
  const { error } = await sb.rpc("ld_backend_secret_delete", { p_name: name });
  if (error) throw new Error(`SECRET_DELETE_FAILED:${name}`);
}
async function oauthConfig(sb: any) {
  const { data, error } = await sb.from("ld_supabase_oauth_config").select("*").eq("singleton", true).maybeSingle();
  if (error || !data) throw new Error("SUPABASE_OAUTH_APP_NOT_CONFIGURED");
  return data;
}
async function oauthConnection(sb: any, licenseId: string, deviceHash: string) {
  const { data, error } = await sb.from("ld_supabase_connections").select("*")
    .eq("license_id", licenseId).eq("device_hash", deviceHash).maybeSingle();
  if (error) throw new Error("CONNECTION_READ_FAILED");
  if (!data) throw new Error("SUPABASE_NOT_CONNECTED");
  return data;
}
function basicAuth(clientId: string, secret: string) { return `Basic ${btoa(`${clientId}:${secret}`)}`; }
async function accessToken(sb: any, licenseId: string, deviceHash: string) {
  const config = await oauthConfig(sb);
  const connection = await oauthConnection(sb, licenseId, deviceHash);
  const refresh = await getSecret(sb, String(connection.refresh_secret_name));
  const clientSecret = await getSecret(sb, "LD_SUPABASE_OAUTH_CLIENT_SECRET");
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh });
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(String(config.client_id), clientSecret), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error(`TOKEN_REFRESH_FAILED:${res.status}`);
  if (data.refresh_token && String(data.refresh_token) !== refresh) {
    await storeSecret(sb, String(connection.refresh_secret_name), String(data.refresh_token), "Lovable Decrypter Supabase OAuth refresh token");
  }
  return String(data.access_token);
}
async function management(accessToken: string, path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...(options.headers || {}) }
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`SUPABASE_MANAGEMENT_HTTP_${res.status}:${data?.message || data?.error || "request failed"}`);
    return data;
  } finally { clearTimeout(timer); }
}
async function destQuery(accessToken: string, ref: string, sql: string) {
  return management(accessToken, `/projects/${encodeURIComponent(ref)}/database/query`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: sql })
  });
}
function qid(value: string) { return `"${String(value).replace(/"/g, '""')}"`; }
function qlit(value: string) { return `'${String(value).replace(/'/g, "''")}'`; }
function sourceSecret(jobId: string) { return `${SOURCE_SECRET_PREFIX}${jobId.replace(/-/g, "").toUpperCase()}`; }
function terminal(status: string) { return ["cancelled", "failed", "completed"].includes(status); }
function sanitizeJob(job: any) {
  if (!job) return null;
  const { handoff_token_hash, source_secret_name, device_hash, ...safe } = job;
  return safe;
}
function appendLog(job: any, level: string, message: string) {
  const logs = Array.isArray(job?.logs) ? [...job.logs] : [];
  logs.push({ at: new Date().toISOString(), level, message: String(message).slice(0, 900) });
  return logs.slice(-MAX_LOGS);
}
async function updateJob(sb: any, job: any, patch: Json, log?: { level: string; message: string }) {
  const next: Json = { ...patch, updated_at: new Date().toISOString() };
  if (log) next.logs = appendLog(job, log.level, log.message);
  const { data, error } = await sb.from("ld_cloud_migration_jobs").update(next).eq("id", job.id).select("*").single();
  if (error) throw new Error("JOB_UPDATE_FAILED");
  return data;
}
async function ownedJob(sb: any, jobId: string, auth: { licenseId: string; deviceHash: string }) {
  const { data, error } = await sb.from("ld_cloud_migration_jobs").select("*")
    .eq("id", jobId).eq("license_id", auth.licenseId).eq("device_hash", auth.deviceHash).maybeSingle();
  if (error) throw new Error("JOB_READ_FAILED");
  if (!data) throw new Error("JOB_NOT_FOUND");
  return data;
}
function normalize(value: any): any {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `\\x${[...value].map(b => b.toString(16).padStart(2, "0")).join("")}`;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = normalize(item);
    return out;
  }
  return value;
}
async function withSource<T>(sb: any, job: any, fn: (sql: any) => Promise<T>) {
  const secretName = String(job.source_secret_name || sourceSecret(job.id));
  const url = await getSecret(sb, secretName);
  if (!/^postgres(?:ql)?:\/\//i.test(url)) throw new Error("SOURCE_DB_URL_INVALID");
  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 12, idle_timeout: 5 });
  try { return await fn(sql); }
  finally { await sql.end({ timeout: 2 }).catch(() => {}); }
}
async function countTable(sql: any, schema: string, table: string) {
  const rows = await sql.unsafe(`select count(*)::bigint as n from ${qid(schema)}.${qid(table)}`);
  return Number(rows?.[0]?.n || 0);
}
async function inspectSource(sb: any, job: any) {
  return withSource(sb, job, async sql => {
    await sql`select 1 as ok`;
    const tables = await sql.unsafe(`
      select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'
      order by c.relname`);
    const columns = await sql.unsafe(`
      select c.relname as table_name, a.attname as column_name, a.attnum as ordinal,
             pg_catalog.format_type(a.atttypid,a.atttypmod) as data_type,
             a.attnotnull as not_null, a.attidentity as identity_kind, a.attgenerated as generated_kind,
             pg_catalog.pg_get_expr(ad.adbin,ad.adrelid) as default_expr
      from pg_catalog.pg_attribute a
      join pg_catalog.pg_class c on c.oid=a.attrelid
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      left join pg_catalog.pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
      where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped
      order by c.relname,a.attnum`);
    const enums = await sql.unsafe(`
      select t.typname as type_name, e.enumlabel as label, e.enumsortorder as sort_order
      from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid=t.typnamespace
      join pg_catalog.pg_enum e on e.enumtypid=t.oid
      where n.nspname='public' order by t.typname,e.enumsortorder`);
    const sequences = await sql.unsafe(`
      select sequence_name, start_value, minimum_value, maximum_value, increment, cycle_option
      from information_schema.sequences where sequence_schema='public' order by sequence_name`);
    const constraints = await sql.unsafe(`
      select c.relname as table_name, con.conname as constraint_name, con.contype as constraint_type,
             pg_catalog.pg_get_constraintdef(con.oid,true) as definition
      from pg_catalog.pg_constraint con join pg_catalog.pg_class c on c.oid=con.conrelid
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and con.contype in ('p','u','c','f') order by c.relname,con.conname`);
    const functions = await sql.unsafe(`
      select p.oid::text as oid, p.proname as name, pg_catalog.pg_get_functiondef(p.oid) as definition
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' order by p.proname,p.oid`);
    const views = await sql.unsafe(`select viewname as name, definition from pg_catalog.pg_views where schemaname='public' order by viewname`);
    const triggers = await sql.unsafe(`
      select c.relname as table_name, t.tgname as name, pg_catalog.pg_get_triggerdef(t.oid,true) as definition
      from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname`);
    const policies = await sql.unsafe(`
      select tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_catalog.pg_policies where schemaname='public' order by tablename,policyname`);
    const grants = await sql.unsafe(`
      select table_name, grantee, privilege_type
      from information_schema.table_privileges
      where table_schema='public' and grantee in ('anon','authenticated','service_role')
      order by table_name,grantee,privilege_type`);
    const tableList: any[] = [];
    for (const table of tables) {
      tableList.push({ ...normalize(table), rows: await countTable(sql, "public", String(table.table_name)) });
    }
    const auth: any[] = [];
    for (const name of ["users", "identities"]) {
      try {
        const cols = await sql.unsafe(`select column_name,ordinal_position from information_schema.columns where table_schema='auth' and table_name=${qlit(name)} order by ordinal_position`);
        auth.push({ table: name, columns: cols.map((c: any) => String(c.column_name)), rows: await countTable(sql, "auth", name) });
      } catch (_) { auth.push({ table: name, columns: [], rows: 0, unavailable: true }); }
    }
    const totalRows = tableList.reduce((sum, item) => sum + Number(item.rows || 0), 0);
    const warnings: string[] = [];
    if (functions.length) warnings.push(`${functions.length} função(ões) public serão recriadas; extensões externas continuam para a Build 7.`);
    if (views.length) warnings.push(`${views.length} view(s) serão recriadas após as tabelas.`);
    warnings.push("A Build 6 não migra Storage, Edge Functions, Secrets, Cron ou configuração de provedores Auth.");
    warnings.push("Sessões e refresh tokens do Auth não são migrados; usuários podem precisar entrar novamente no destino.");
    return normalize({ tables: tableList, columns, enums, sequences, constraints, functions, views, triggers, policies, grants, auth, totalRows, warnings });
  });
}
function columnsFor(inventory: any, table: string) {
  return (inventory.columns || []).filter((c: any) => c.table_name === table);
}
function enumGroups(inventory: any) {
  const groups = new Map<string, string[]>();
  for (const row of inventory.enums || []) {
    const key = String(row.type_name); if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(String(row.label));
  }
  return [...groups.entries()];
}
function tableDdl(inventory: any, table: string) {
  const cols = columnsFor(inventory, table);
  const defs = cols.map((c: any) => {
    let def = `${qid(c.column_name)} ${c.data_type}`;
    if (c.identity_kind === 'a') def += " GENERATED ALWAYS AS IDENTITY";
    else if (c.identity_kind === 'd') def += " GENERATED BY DEFAULT AS IDENTITY";
    else if (c.generated_kind) def += ` GENERATED ALWAYS AS (${c.default_expr}) STORED`;
    else if (c.default_expr) def += ` DEFAULT ${c.default_expr}`;
    if (c.not_null) def += " NOT NULL";
    return def;
  });
  return `create table if not exists public.${qid(table)} (\n  ${defs.join(",\n  ")}\n);`;
}
function schemaUnits(inventory: any) {
  const units: { label: string; sql: string }[] = [];
  for (const [name, labels] of enumGroups(inventory)) {
    const values = labels.map(qlit).join(",");
    units.push({ label: `enum ${name}`, sql: `do $$ begin create type public.${qid(name)} as enum (${values}); exception when duplicate_object then null; end $$;` });
  }
  for (const seq of inventory.sequences || []) {
    units.push({ label: `sequence ${seq.sequence_name}`, sql: `create sequence if not exists public.${qid(seq.sequence_name)} increment by ${Number(seq.increment || 1)} minvalue ${Number(seq.minimum_value || 1)} maxvalue ${Number(seq.maximum_value || 9223372036854775807)} start with ${Number(seq.start_value || 1)} ${String(seq.cycle_option).toUpperCase()==='YES'?'cycle':'no cycle'};` });
  }
  for (const table of inventory.tables || []) units.push({ label: `table ${table.table_name}`, sql: tableDdl(inventory, String(table.table_name)) });
  for (const c of (inventory.constraints || []).filter((x: any) => x.constraint_type !== 'f')) {
    units.push({ label: `constraint ${c.constraint_name}`, sql: `alter table public.${qid(c.table_name)} drop constraint if exists ${qid(c.constraint_name)}; alter table public.${qid(c.table_name)} add constraint ${qid(c.constraint_name)} ${c.definition};` });
  }
  for (const f of inventory.functions || []) units.push({ label: `function ${f.name}`, sql: String(f.definition) });
  for (const v of inventory.views || []) units.push({ label: `view ${v.name}`, sql: `create or replace view public.${qid(v.name)} with (security_invoker=true) as ${String(v.definition).replace(/;\s*$/,'')};` });
  return units;
}
function rlsUnits(inventory: any) {
  const units: { label: string; sql: string }[] = [];
  for (const fk of (inventory.constraints || []).filter((x: any) => x.constraint_type === 'f')) {
    units.push({ label: `foreign key ${fk.constraint_name}`, sql: `alter table public.${qid(fk.table_name)} drop constraint if exists ${qid(fk.constraint_name)}; alter table public.${qid(fk.table_name)} add constraint ${qid(fk.constraint_name)} ${fk.definition};` });
  }
  for (const trg of inventory.triggers || []) {
    units.push({ label: `trigger ${trg.name}`, sql: `drop trigger if exists ${qid(trg.name)} on public.${qid(trg.table_name)}; ${String(trg.definition)};` });
  }
  for (const table of inventory.tables || []) {
    const t = qid(table.table_name);
    units.push({ label: `RLS ${table.table_name}`, sql: `alter table public.${t} ${table.rls_enabled ? 'enable' : 'disable'} row level security; alter table public.${t} ${table.rls_forced ? 'force' : 'no force'} row level security;` });
  }
  for (const p of inventory.policies || []) {
    const roles = Array.isArray(p.roles) ? p.roles : String(p.roles || '').replace(/[{}]/g,'').split(',').filter(Boolean);
    const to = roles.length ? ` to ${roles.map((r: string) => qid(r)).join(',')}` : '';
    const using = p.qual ? ` using (${p.qual})` : '';
    const check = p.with_check ? ` with check (${p.with_check})` : '';
    const perm = String(p.permissive || '').toUpperCase() === 'RESTRICTIVE' ? 'restrictive' : 'permissive';
    const cmd = String(p.cmd || 'ALL').toLowerCase();
    units.push({ label: `policy ${p.policyname}`, sql: `drop policy if exists ${qid(p.policyname)} on public.${qid(p.tablename)}; create policy ${qid(p.policyname)} on public.${qid(p.tablename)} as ${perm} for ${cmd}${to}${using}${check};` });
  }
  const grantMap = new Map<string, string[]>();
  for (const g of inventory.grants || []) {
    const key = `${g.table_name}\u0000${g.grantee}`; if (!grantMap.has(key)) grantMap.set(key, []); grantMap.get(key)!.push(String(g.privilege_type).toLowerCase());
  }
  for (const [key, privileges] of grantMap) {
    const [table, grantee] = key.split('\u0000');
    units.push({ label: `grant ${table} ${grantee}`, sql: `revoke all on table public.${qid(table)} from ${qid(grantee)}; grant ${[...new Set(privileges)].join(', ')} on table public.${qid(table)} to ${qid(grantee)};` });
  }
  return units;
}
function dataInsertSql(schema: string, table: string, columns: any[], rows: any[]) {
  const insertCols = columns.filter((c: any) => !c.generated_kind);
  if (!rows.length || !insertCols.length) return '';
  const names = insertCols.map((c: any) => qid(c.column_name)).join(',');
  const hasIdentity = insertCols.some((c: any) => c.identity_kind);
  const payload = JSON.stringify(rows.map(row => {
    const obj: Record<string, unknown> = {};
    for (const c of insertCols) obj[c.column_name] = normalize(row[c.column_name]);
    return obj;
  }));
  return `insert into ${qid(schema)}.${qid(table)} (${names})${hasIdentity ? ' overriding system value' : ''} select ${names} from json_populate_recordset(null::${qid(schema)}.${qid(table)}, ${qlit(payload)}::json) on conflict do nothing;`;
}
async function runSchema(access: string, job: any) {
  const inv = job.inventory || {}; const units = schemaUnits(inv);
  const progress = { ...(job.progress || {}) }; const index = Number(progress.schema_index || 0);
  if (index >= units.length) return { phaseDone: true, patch: { progress: { ...progress, schema_total: units.length } } };
  const unit = units[index]; await destQuery(access, job.destination_project_ref, unit.sql);
  return { phaseDone: index + 1 >= units.length, patch: { progress: { ...progress, schema_index: index + 1, schema_total: units.length, current: unit.label } } };
}
async function runData(sb: any, access: string, job: any) {
  const inv = job.inventory || {}; const tables = inv.tables || []; const progress = { ...(job.progress || {}) };
  let tableIndex = Number(progress.data_table_index || 0); let offset = Number(progress.data_offset || 0);
  if (tableIndex >= tables.length) return { phaseDone: true, patch: { progress } };
  const table = tables[tableIndex]; const name = String(table.table_name); const total = Number(table.rows || 0);
  if (total === 0 || offset >= total) {
    tableIndex += 1; offset = 0;
    return { phaseDone: tableIndex >= tables.length, patch: { progress: { ...progress, data_table_index: tableIndex, data_offset: 0, current: tableIndex < tables.length ? `data ${tables[tableIndex].table_name}` : 'data complete' } } };
  }
  const rows = await withSource(sb, job, async source => source.unsafe(`select * from public.${qid(name)} order by ctid limit ${CHUNK_ROWS} offset ${offset}`));
  const normalized = rows.map((r: any) => normalize(r));
  if (normalized.length) {
    const sql = dataInsertSql('public', name, columnsFor(inv, name), normalized);
    if (sql) await destQuery(access, job.destination_project_ref, sql);
  }
  const nextOffset = offset + normalized.length;
  const doneTable = normalized.length === 0 || nextOffset >= total;
  const rowsDone = Number(progress.data_rows_done || 0) + normalized.length;
  return {
    phaseDone: false,
    patch: { progress: { ...progress, data_table_index: doneTable ? tableIndex + 1 : tableIndex, data_offset: doneTable ? 0 : nextOffset, data_rows_done: rowsDone, data_rows_total: Number(inv.totalRows || 0), current: `data ${name} ${Math.min(nextOffset,total)}/${total}` } }
  };
}
async function runRls(access: string, job: any) {
  const inv = job.inventory || {}; const units = rlsUnits(inv); const progress = { ...(job.progress || {}) }; const index = Number(progress.rls_index || 0);
  if (index >= units.length) return { phaseDone: true, patch: { progress: { ...progress, rls_total: units.length } } };
  const unit = units[index]; await destQuery(access, job.destination_project_ref, unit.sql);
  return { phaseDone: index + 1 >= units.length, patch: { progress: { ...progress, rls_index: index + 1, rls_total: units.length, current: unit.label } } };
}
async function destColumns(access: string, ref: string, schema: string, table: string) {
  const result = await destQuery(access, ref, `select column_name from information_schema.columns where table_schema=${qlit(schema)} and table_name=${qlit(table)} order by ordinal_position`);
  const rows = Array.isArray(result) ? result : Array.isArray(result?.result) ? result.result : [];
  return rows.map((r: any) => String(r.column_name));
}
async function runAuth(sb: any, access: string, job: any) {
  const inv = job.inventory || {}; const authInv = inv.auth || []; const progress = { ...(job.progress || {}) };
  let tableIndex = Number(progress.auth_table_index || 0); let offset = Number(progress.auth_offset || 0);
  if (tableIndex >= authInv.length) return { phaseDone: true, patch: { progress } };
  const info = authInv[tableIndex]; const table = String(info.table); const total = Number(info.rows || 0);
  if (info.unavailable || total === 0 || offset >= total) {
    tableIndex += 1; return { phaseDone: tableIndex >= authInv.length, patch: { progress: { ...progress, auth_table_index: tableIndex, auth_offset: 0, current: tableIndex < authInv.length ? `auth ${authInv[tableIndex].table}` : 'auth complete' } } };
  }
  const destCols = await destColumns(access, job.destination_project_ref, 'auth', table);
  const common = (info.columns || []).filter((c: string) => destCols.includes(c)).map((name: string) => ({ column_name: name, identity_kind: '', generated_kind: '' }));
  if (!common.length) throw new Error(`AUTH_NO_COMMON_COLUMNS:${table}`);
  const rows = await withSource(sb, job, async source => source.unsafe(`select * from auth.${qid(table)} order by 1 limit ${CHUNK_ROWS} offset ${offset}`));
  const normalized = rows.map((r: any) => normalize(r));
  if (normalized.length) {
    const insert = dataInsertSql('auth', table, common, normalized);
    if (insert) await destQuery(access, job.destination_project_ref, insert);
  }
  const nextOffset = offset + normalized.length; const doneTable = normalized.length === 0 || nextOffset >= total;
  return { phaseDone: false, patch: { progress: { ...progress, auth_table_index: doneTable ? tableIndex + 1 : tableIndex, auth_offset: doneTable ? 0 : nextOffset, current: `auth ${table} ${Math.min(nextOffset,total)}/${total}` } } };
}
async function verifyMigration(sb: any, access: string, job: any) {
  const inv = job.inventory || {}; const mismatches: any[] = [];
  for (const t of inv.tables || []) {
    const result = await destQuery(access, job.destination_project_ref, `select count(*)::bigint as n from public.${qid(t.table_name)}`);
    const rows = Array.isArray(result) ? result : Array.isArray(result?.result) ? result.result : [];
    const dest = Number(rows?.[0]?.n || 0); const source = Number(t.rows || 0);
    if (dest !== source) mismatches.push({ table: t.table_name, source, destination: dest });
  }
  const authCounts: any[] = [];
  for (const a of inv.auth || []) {
    if (a.unavailable) continue;
    try {
      const result = await destQuery(access, job.destination_project_ref, `select count(*)::bigint as n from auth.${qid(a.table)}`);
      const rows = Array.isArray(result) ? result : Array.isArray(result?.result) ? result.result : [];
      authCounts.push({ table: a.table, source: Number(a.rows || 0), destination: Number(rows?.[0]?.n || 0) });
    } catch (_) {}
  }
  return { ok: mismatches.length === 0, mismatches, auth: authCounts };
}
async function cleanupSourceSecret(sb: any, job: any) {
  const name = String(job.source_secret_name || '');
  if (name) { try { await deleteSecret(sb, name); } catch (_) {} }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url); const sb = admin();
  try {
    if (url.searchParams.get('flow') === 'handoff') {
      if (req.method !== 'POST') return response({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
      const body = await req.json().catch(() => ({}));
      const jobId = String(body.job_id || ''); const token = String(body.token || req.headers.get('x-ld-helper-token') || ''); const dbUrl = String(body.db_url || '');
      if (!jobId || !token || !/^postgres(?:ql)?:\/\//i.test(dbUrl)) return response({ ok: false, code: 'HANDOFF_INVALID' }, 400);
      const { data: job, error } = await sb.from('ld_cloud_migration_jobs').select('*').eq('id', jobId).maybeSingle();
      if (error || !job || terminal(job.status)) return response({ ok: false, code: 'JOB_NOT_AVAILABLE' }, 404);
      if (await shaHex(token) !== String(job.handoff_token_hash)) return response({ ok: false, code: 'HANDOFF_TOKEN_INVALID' }, 403);
      const secretName = sourceSecret(job.id);
      await storeSecret(sb, secretName, dbUrl, `Temporary Lovable Cloud source database URL for migration ${job.id}`);
      const next = await updateJob(sb, job, { source_secret_name: secretName, status: 'helper_ready', phase: 'inspect' }, { level: 'info', message: 'Helper entregou a conexão da origem diretamente ao broker.' });
      return response({ ok: true, job: sanitizeJob(next) });
    }

    if (req.method !== 'POST') return response({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
    const auth = await authorize(req, sb); const body = await req.json().catch(() => ({})); const action = String(body.action || 'status');

    if (action === 'active') {
      const projectId = String(body.lovable_project_id || '').trim();
      if (!projectId) return response({ ok: false, code: 'LOVABLE_PROJECT_REQUIRED' }, 400);
      const { data, error } = await sb.from('ld_cloud_migration_jobs').select('*')
        .eq('license_id', auth.licenseId).eq('device_hash', auth.deviceHash).eq('lovable_project_id', projectId)
        .in('status', ['prepared','helper_ready','inspecting','ready','running','paused'])
        .order('created_at', { ascending: false }).limit(1);
      if (error) throw new Error('JOB_ACTIVE_READ_FAILED');
      return response({ ok: true, job: sanitizeJob(Array.isArray(data) ? data[0] : null) });
    }

    if (action === 'prepare') {
      const lovableProjectId = String(body.lovable_project_id || '').trim(); const destRef = String(body.destination_project_ref || '').trim();
      if (!lovableProjectId) return response({ ok: false, code: 'LOVABLE_PROJECT_REQUIRED' }, 400);
      if (!/^[a-z0-9]{8,32}$/i.test(destRef)) return response({ ok: false, code: 'DESTINATION_PROJECT_INVALID' }, 400);
      const token = await accessToken(sb, auth.licenseId, auth.deviceHash);
      const projects = await management(token, '/projects');
      if (!Array.isArray(projects) || !projects.some((p: any) => String(p.ref || p.id) === destRef)) return response({ ok: false, code: 'DESTINATION_NOT_AUTHORIZED' }, 403);
      const { data: existing, error: existingError } = await sb.from('ld_cloud_migration_jobs').select('id,status')
        .eq('license_id', auth.licenseId).eq('device_hash', auth.deviceHash).eq('lovable_project_id', lovableProjectId)
        .in('status', ['prepared','helper_ready','inspecting','ready','running','paused']).limit(1);
      if (existingError) throw new Error('JOB_ACTIVE_READ_FAILED');
      if (Array.isArray(existing) && existing.length) return response({ ok: false, code: 'ACTIVE_JOB_EXISTS', job_id: existing[0].id }, 409);
      const rawHandoff = randomValue(40);
      const { data: created, error } = await sb.from('ld_cloud_migration_jobs').insert({
        license_id: auth.licenseId, device_hash: auth.deviceHash, lovable_project_id: lovableProjectId,
        lovable_project_name: String(body.lovable_project_name || ''), framework: String(body.framework || ''),
        source_project_ref: String(body.source_project_ref || ''), destination_project_ref: destRef,
        destination_project_name: String(body.destination_project_name || ''), helper_path: String(body.helper_path || ''), helper_url: String(body.helper_url || ''),
        handoff_token_hash: await shaHex(rawHandoff), status: 'prepared', phase: 'prepare',
        progress: { schema_index: 0, data_table_index: 0, data_offset: 0, data_rows_done: 0, rls_index: 0, auth_table_index: 0, auth_offset: 0 },
        logs: [{ at: new Date().toISOString(), level: 'info', message: 'Job preparado; aguardando helper temporário.' }]
      }).select('*').single();
      if (error) throw new Error(`JOB_CREATE_FAILED:${error.message}`);
      return response({ ok: true, job: sanitizeJob(created), handoff_token: rawHandoff, broker_handoff_url: `${url.origin}${url.pathname}?flow=handoff` }, 201);
    }

    const job = await ownedJob(sb, String(body.job_id || ''), auth);
    if (action === 'status') return response({ ok: true, job: sanitizeJob(job) });
    if (action === 'cancel') {
      if (terminal(job.status)) return response({ ok: true, job: sanitizeJob(job) });
      await cleanupSourceSecret(sb, job);
      const next = await updateJob(sb, job, { status: 'cancelled', cancelled_at: new Date().toISOString(), error_code: null, error_detail: null }, { level: 'warn', message: 'Migração cancelada pelo usuário; credencial temporária da origem removida.' });
      return response({ ok: true, job: sanitizeJob(next) });
    }
    if (terminal(job.status)) return response({ ok: false, code: `JOB_${String(job.status).toUpperCase()}` }, 409);

    const token = await accessToken(sb, auth.licenseId, auth.deviceHash);
    if (action === 'inspect') {
      if (!job.source_secret_name) return response({ ok: false, code: 'SOURCE_HANDOFF_REQUIRED' }, 409);
      let current = await updateJob(sb, job, { status: 'inspecting', phase: 'inspect', started_at: job.started_at || new Date().toISOString() }, { level: 'info', message: 'Inventariando schema, dados, RLS e Auth da origem.' });
      const inventory = await inspectSource(sb, current);
      current = await updateJob(sb, current, { status: 'ready', phase: 'schema', inventory, warnings: inventory.warnings || [], progress: { ...(current.progress || {}), schema_index: 0, data_rows_total: inventory.totalRows || 0 } }, { level: 'info', message: `Inventário concluído: ${(inventory.tables || []).length} tabela(s), ${inventory.totalRows || 0} linha(s) public.` });
      return response({ ok: true, job: sanitizeJob(current) });
    }
    if (action === 'run_next') {
      if (!job.source_secret_name) return response({ ok: false, code: 'SOURCE_HANDOFF_REQUIRED' }, 409);
      let current = job;
      if (current.status === 'ready' || current.status === 'paused') current = await updateJob(sb, current, { status: 'running', started_at: current.started_at || new Date().toISOString() });
      let result: any;
      if (current.phase === 'schema') result = await runSchema(token, current);
      else if (current.phase === 'data') result = await runData(sb, token, current);
      else if (current.phase === 'rls') result = await runRls(token, current);
      else if (current.phase === 'auth') result = await runAuth(sb, token, current);
      else if (current.phase === 'verify') {
        const verification = await verifyMigration(sb, token, current);
        await cleanupSourceSecret(sb, current);
        const warnings = [...(Array.isArray(current.warnings) ? current.warnings : [])];
        if (!verification.ok) warnings.push(`Verificação encontrou ${verification.mismatches.length} divergência(s) de contagem.`);
        const done = await updateJob(sb, current, { status: 'completed', phase: 'done', completed_at: new Date().toISOString(), progress: { ...(current.progress || {}), verification }, warnings }, { level: verification.ok ? 'info' : 'warn', message: verification.ok ? 'Verificação concluída sem divergências de contagem.' : 'Migração concluída com divergências de contagem para revisão.' });
        return response({ ok: true, job: sanitizeJob(done) });
      } else if (current.phase === 'done') return response({ ok: true, job: sanitizeJob(current) });
      else return response({ ok: false, code: `PHASE_INVALID:${current.phase}` }, 409);

      const phaseOrder: Record<string, string> = { schema: 'data', data: 'rls', rls: 'auth', auth: 'verify' };
      const nextPhase = result.phaseDone ? phaseOrder[current.phase] : current.phase;
      const log = result.phaseDone ? { level: 'info', message: `Fase ${current.phase.toUpperCase()} concluída.` } : undefined;
      const next = await updateJob(sb, current, { ...result.patch, phase: nextPhase }, log);
      return response({ ok: true, job: sanitizeJob(next) });
    }
    return response({ ok: false, code: 'UNKNOWN_ACTION' }, 400);
  } catch (error) {
    console.error('ld-cloud-migrator-broker', error);
    const code = String((error as Error)?.message || 'INTERNAL_ERROR');
    return response({ ok: false, code }, /KEY_|DEVICE_|ENTITLEMENT|NOT_AUTHORIZED/.test(code) ? 403 : 500);
  }
});
