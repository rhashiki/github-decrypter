import { createClient } from "jsr:@supabase/supabase-js@2";

const PUBLIC_SPKI_B64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-license-key,x-device-id,authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};
const enc = new TextEncoder();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }
});

function b64u(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function sha(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyToken(token: string) {
  const [prefix, payloadPart, signaturePart] = token.trim().split(".");
  if (prefix !== "LD2" || !payloadPart || !signaturePart) throw new Error("KEY_INVALID_FORMAT");
  const der = Uint8Array.from(atob(PUBLIC_SPKI_B64), c => c.charCodeAt(0));
  const publicKey = await crypto.subtle.importKey("spki", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, b64u(signaturePart), enc.encode(payloadPart));
  if (!valid) throw new Error("KEY_INVALID_SIGNATURE");
  const payload = JSON.parse(new TextDecoder().decode(b64u(payloadPart)));
  if (payload?.aud !== "lovable-decrypter" || !payload?.license_id) throw new Error("KEY_INVALID_PAYLOAD");
  return payload;
}

async function authorize(req: Request, body: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  const token = String(req.headers.get("x-license-key") || body.license_key || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") || "").trim();
  const device = String(req.headers.get("x-device-id") || body.device_id || "").trim();
  if (!token) throw new Error("KEY_REQUIRED");
  if (!device) throw new Error("DEVICE_REQUIRED");

  const signed = await verifyToken(token);
  const { data: license, error } = await sb
    .from("ld_license_keys")
    .select("id,status,expires_at,credit_balance,credit_debt")
    .eq("id", String(signed.license_id))
    .eq("key_hash", await sha(token))
    .maybeSingle();
  if (error) throw new Error("DB_ERROR");
  if (!license) throw new Error("KEY_NOT_REGISTERED");
  if (license.status !== "active") throw new Error(`KEY_${String(license.status).toUpperCase()}`);

  const timeActive = Boolean(license.expires_at && Date.parse(license.expires_at) > Date.now());
  const creditsActive = Number(license.credit_balance || 0) > 0 && Number(license.credit_debt || 0) === 0;
  if (!timeActive && !creditsActive) throw new Error("ENTITLEMENT_EXHAUSTED");

  const deviceHash = await sha(device);
  const { data: boundDevice } = await sb
    .from("ld_license_devices")
    .select("id,revoked_at")
    .eq("license_id", license.id)
    .eq("device_hash", deviceHash)
    .maybeSingle();
  if (!boundDevice) throw new Error("DEVICE_NOT_BOUND");
  if (boundDevice.revoked_at) throw new Error("DEVICE_REVOKED");
  return license;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) return json({ ok: false, code: "BACKEND_NOT_CONFIGURED" }, 503);

    const sb = createClient(url, serviceRole, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const license = await authorize(req, body, sb);
    const itemId = String(body.item_id || "").trim();
    const projectId = String(body.project_id || "").trim() || null;
    if (!itemId) return json({ ok: false, code: "ITEM_REQUIRED" }, 400);

    const { data, error } = await sb.rpc("ld_skip_queue_item", {
      p_license_id: license.id,
      p_item_id: itemId,
      p_project_id: projectId
    });
    if (error) throw new Error("QUEUE_SKIP_FAILED");
    if (!data?.ok) {
      const code = String(data?.code || "QUEUE_SKIP_FAILED");
      return json({ ok: false, code }, code === "QUEUE_ALREADY_RUNNING" || code === "ITEM_NOT_SKIPPABLE" ? 409 : 400);
    }
    return json(data);
  } catch (error) {
    const code = String((error as Error)?.message || "INTERNAL_ERROR");
    const authish = /^(KEY_|DEVICE_|ENTITLEMENT_)/.test(code);
    console.error("ld-queue-skip", code);
    return json({ ok: false, code }, authish ? 403 : 500);
  }
});
