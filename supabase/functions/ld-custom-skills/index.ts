import { createClient } from "jsr:@supabase/supabase-js@2";

const PUBLIC_SPKI_B64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-license-key,x-device-id,authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const enc = new TextEncoder();

function b64u(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
async function sha(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
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
function secretKey() {
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (packed) {
    try {
      const values = Object.values(JSON.parse(packed)).map(String).filter(v => v.startsWith("sb_secret_"));
      if (values.length) return values[0];
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
async function authorize(req: Request, body: any, sb: any) {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const token = String(req.headers.get("x-license-key") || body.license_key || bearer || "").trim();
  if (!token) throw new Error("KEY_REQUIRED");
  const signed = await verifyToken(token);
  const { data: license, error } = await sb.from("ld_license_keys")
    .select("id,status,expires_at,credit_balance,credit_debt")
    .eq("id", String(signed.license_id))
    .eq("key_hash", await sha(token))
    .maybeSingle();
  if (error) throw new Error("DB_ERROR");
  if (!license) throw new Error("KEY_NOT_REGISTERED");
  if (license.status !== "active") throw new Error(`KEY_${String(license.status).toUpperCase()}`);
  const timeActive = Boolean(license.expires_at && Date.parse(license.expires_at) > Date.now());
  const credits = Number(license.credit_balance || 0);
  if (!timeActive && !(credits > 0 && Number(license.credit_debt || 0) === 0)) throw new Error("ENTITLEMENT_EXHAUSTED");
  const deviceId = String(req.headers.get("x-device-id") || body.device_id || "").trim();
  if (deviceId) {
    const { data: device } = await sb.from("ld_license_devices")
      .select("id,revoked_at")
      .eq("license_id", license.id)
      .eq("device_hash", await sha(deviceId))
      .maybeSingle();
    if (!device) throw new Error("DEVICE_NOT_BOUND");
    if (device.revoked_at) throw new Error("DEVICE_REVOKED");
  }
  return license;
}

const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const words = (value: unknown) => normalize(value).match(/[a-z0-9][a-z0-9_-]{2,}/g) || [];
function overlap(command: string, source: string) {
  const cmd = new Set(words(command));
  const src = [...new Set(words(source))];
  let score = 0;
  for (const term of src) if (cmd.has(term)) score += term.length >= 8 ? 2 : 1;
  const phrases = normalize(source).split(/[\n,;|]+/).map(x => x.trim()).filter(x => x.length >= 5 && x.length <= 90);
  for (const phrase of phrases) if (normalize(command).includes(phrase)) score += 5;
  return score;
}
function structuredContent(name: string, useWhen: string, avoidWhen: string, definition: string) {
  return `# ${name}\n\n## Trigger\nUse when: ${useWhen}\n${avoidWhen ? `Avoid when: ${avoidWhen}` : "Avoid when: the Skill is not directly relevant to the user request."}\n\n## Playbook\n${definition}\n\n## Guardrails\n- Stay inside the explicit user scope.\n- Do not treat this Skill as permission to modify unrelated files or behavior.\n- Stop rather than inventing missing authority, credentials, data, or project facts.\n\n## Output check\n- Confirm the Skill was relevant to the request.\n- Apply only the minimum necessary instructions from this Skill.\n- Preserve Project Rules and higher-priority execution guardrails.`;
}
function publicRow(row: any) {
  return {
    id: row.id,
    slug: row.slug,
    display_name: row.display_name,
    description: row.description,
    use_when: row.use_when,
    avoid_when: row.avoid_when,
    category: row.category,
    skill_type: row.skill_type,
    risk: row.risk,
    official: false,
    custom: true,
    enabled: row.enabled,
    pinned: row.pinned,
    auto_activation: row.auto_activation,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = secretKey();
    if (!url || !key) return json({ ok: false, code: "BACKEND_NOT_CONFIGURED" }, 503);
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const license = await authorize(req, body, sb);
    const action = String(body.action || "list");

    if (action === "list") {
      const { data, error } = await sb.from("ld_custom_skills")
        .select("id,slug,display_name,description,use_when,avoid_when,category,skill_type,risk,enabled,pinned,auto_activation,sort_order,created_at,updated_at")
        .eq("license_id", license.id)
        .order("sort_order")
        .order("display_name");
      if (error) throw new Error("CUSTOM_SKILLS_LIST_FAILED");
      return json({ ok: true, count: data?.length || 0, skills: (data || []).map(publicRow) });
    }

    if (action === "get_many") {
      const slugs = Array.isArray(body.slugs) ? [...new Set(body.slugs.map(String))].filter(x => x.startsWith("custom-")).slice(0, 12) : [];
      if (!slugs.length) return json({ ok: true, skills: [] });
      const { data, error } = await sb.from("ld_custom_skills")
        .select("id,slug,display_name,description,use_when,avoid_when,category,skill_type,risk,content_md,enabled,pinned,auto_activation")
        .eq("license_id", license.id)
        .eq("enabled", true)
        .in("slug", slugs);
      if (error) throw new Error("CUSTOM_SKILLS_GET_FAILED");
      return json({ ok: true, skills: (data || []).map((row: any) => ({ ...publicRow(row), content_md: row.content_md, current_version: "custom" })) });
    }

    if (action === "create") {
      const name = clean(body.display_name || body.name, 80);
      const description = clean(body.description, 1000);
      const useWhen = clean(body.use_when, 2000);
      const avoidWhen = clean(body.avoid_when, 2000);
      const definition = clean(body.definition || body.content_md, 90000);
      if (!name) return json({ ok: false, code: "NAME_REQUIRED" }, 400);
      if (!useWhen) return json({ ok: false, code: "USE_WHEN_REQUIRED" }, 400);
      if (!definition) return json({ ok: false, code: "DEFINITION_REQUIRED" }, 400);
      const slug = `custom-${crypto.randomUUID()}`;
      const row = {
        license_id: license.id,
        slug,
        display_name: name,
        description,
        use_when: useWhen,
        avoid_when: avoidWhen,
        content_md: structuredContent(name, useWhen, avoidWhen, definition),
        enabled: body.enabled !== false,
        pinned: Boolean(body.pinned),
        auto_activation: body.auto_activation !== false,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await sb.from("ld_custom_skills").insert(row).select().single();
      if (error) throw new Error("CUSTOM_SKILL_CREATE_FAILED");
      return json({ ok: true, skill: publicRow(data) });
    }

    if (action === "update") {
      const slug = clean(body.slug, 80);
      if (!slug.startsWith("custom-")) return json({ ok: false, code: "CUSTOM_SKILL_REQUIRED" }, 400);
      const { data: current } = await sb.from("ld_custom_skills").select("*").eq("license_id", license.id).eq("slug", slug).maybeSingle();
      if (!current) return json({ ok: false, code: "CUSTOM_SKILL_NOT_FOUND" }, 404);
      const name = body.display_name != null || body.name != null ? clean(body.display_name || body.name, 80) : current.display_name;
      const description = body.description != null ? clean(body.description, 1000) : current.description;
      const useWhen = body.use_when != null ? clean(body.use_when, 2000) : current.use_when;
      const avoidWhen = body.avoid_when != null ? clean(body.avoid_when, 2000) : current.avoid_when;
      let contentMd = current.content_md;
      if (body.definition != null || body.content_md != null || body.use_when != null || body.avoid_when != null || body.display_name != null || body.name != null) {
        const definition = clean(body.definition || body.content_md || current.content_md, 90000);
        contentMd = structuredContent(name, useWhen, avoidWhen, definition);
      }
      if (!name || !useWhen || !contentMd) return json({ ok: false, code: "INVALID_CUSTOM_SKILL" }, 400);
      const patch: any = { display_name: name, description, use_when: useWhen, avoid_when: avoidWhen, content_md: contentMd, updated_at: new Date().toISOString() };
      for (const field of ["enabled", "pinned", "auto_activation"]) if (body[field] != null) patch[field] = Boolean(body[field]);
      const { data, error } = await sb.from("ld_custom_skills").update(patch).eq("license_id", license.id).eq("slug", slug).select().single();
      if (error) throw new Error("CUSTOM_SKILL_UPDATE_FAILED");
      return json({ ok: true, skill: publicRow(data) });
    }

    if (action === "delete") {
      const slug = clean(body.slug, 80);
      if (!slug.startsWith("custom-")) return json({ ok: false, code: "CUSTOM_SKILL_REQUIRED" }, 400);
      const { error } = await sb.from("ld_custom_skills").delete().eq("license_id", license.id).eq("slug", slug);
      if (error) throw new Error("CUSTOM_SKILL_DELETE_FAILED");
      return json({ ok: true, slug });
    }

    if (action === "route") {
      const command = clean(body.command, 20000);
      if (!command) return json({ ok: false, code: "COMMAND_REQUIRED" }, 400);
      const { data, error } = await sb.from("ld_custom_skills")
        .select("slug,display_name,description,use_when,avoid_when,pinned,auto_activation")
        .eq("license_id", license.id)
        .eq("enabled", true);
      if (error) throw new Error("CUSTOM_SKILL_ROUTE_FAILED");
      const scored: { slug: string; score: number; pinned: boolean }[] = [];
      for (const skill of data || []) {
        const avoidScore = overlap(command, skill.avoid_when || "");
        if (avoidScore >= 5 && !skill.pinned) continue;
        let score = overlap(command, `${skill.display_name}\n${skill.description}\n${skill.use_when}`);
        if (skill.pinned) score += 1000;
        if (skill.pinned || (skill.auto_activation && score >= 2)) scored.push({ slug: skill.slug, score, pinned: Boolean(skill.pinned) });
      }
      scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
      return json({ ok: true, method: "custom-trigger", skill_slugs: scored.slice(0, 4).map(x => x.slug) });
    }

    return json({ ok: false, code: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const code = String((error as Error)?.message || "INTERNAL_ERROR");
    const authish = /^(KEY_|DEVICE_|ENTITLEMENT_)/.test(code);
    console.error("ld-custom-skills", code);
    return json({ ok: false, code }, authish ? 403 : 500);
  }
});
