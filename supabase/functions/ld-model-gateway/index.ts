import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SCHEMA = 'ld-model-gateway/1';
const PUBLIC_SPKI_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==';
const DEFAULT_FAST = 'gemini-3.6-flash';
const DEFAULT_DEEP = 'gemini-2.5-pro';
const LOCAL_PROVIDER = 'decrypter-local';
const LOCAL_HEALTH_TTL_MS = 15_000;
const FREE_MODELS = new Set(['gemini-3.6-flash','gemini-3.5-flash-lite','gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite']);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-license-key,x-device-id,x-gemini-key,authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const enc = new TextEncoder();
let localHealthCache: { checkedAt: number; expiresAt: number; value: any } | null = null;

function b64u(value: string) {
  const s = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function sha(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function verifyToken(token: string) {
  const [prefix, payloadPart, signaturePart] = token.trim().split('.');
  if (prefix !== 'LD2' || !payloadPart || !signaturePart) throw new Error('KEY_INVALID_FORMAT');
  const der = Uint8Array.from(atob(PUBLIC_SPKI_B64), c => c.charCodeAt(0));
  const publicKey = await crypto.subtle.importKey('spki', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, b64u(signaturePart), enc.encode(payloadPart));
  if (!valid) throw new Error('KEY_INVALID_SIGNATURE');
  const payload = JSON.parse(new TextDecoder().decode(b64u(payloadPart)));
  if (payload?.aud !== 'lovable-decrypter' || !payload?.license_id) throw new Error('KEY_INVALID_PAYLOAD');
  return payload;
}
async function authorize(req: Request, body: any, sb: any) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const token = String(req.headers.get('x-license-key') || body.license_key || bearer || '').trim();
  if (!token) throw new Error('KEY_REQUIRED');
  const signed = await verifyToken(token);
  const { data: license, error } = await sb.from('ld_license_keys').select('id,status,expires_at,credit_balance,credit_debt').eq('id', String(signed.license_id)).eq('key_hash', await sha(token)).maybeSingle();
  if (error) throw new Error('DB_ERROR');
  if (!license) throw new Error('KEY_NOT_REGISTERED');
  if (license.status !== 'active') throw new Error('KEY_' + String(license.status).toUpperCase());
  const timeActive = Boolean(license.expires_at && Date.parse(license.expires_at) > Date.now());
  const credits = Number(license.credit_balance || 0);
  if (!timeActive && !(credits > 0 && Number(license.credit_debt || 0) === 0)) throw new Error('ENTITLEMENT_EXHAUSTED');
  const deviceId = String(req.headers.get('x-device-id') || body.device_id || '').trim();
  if (!deviceId) throw new Error('DEVICE_REQUIRED');
  const { data: device } = await sb.from('ld_license_devices').select('id,revoked_at').eq('license_id', license.id).eq('device_hash', await sha(deviceId)).maybeSingle();
  if (!device) throw new Error('DEVICE_NOT_BOUND');
  if (device.revoked_at) throw new Error('DEVICE_REVOKED');
  return { token, deviceId, licenseId: license.id };
}
function normalizeModel(value = '') {
  return String(value || '').trim().replace(/^models\//, '');
}
function supportedTextModel(value = '') {
  const id = normalizeModel(value).toLowerCase();
  return /^gemini-[a-z0-9._-]+$/.test(id) && !/(embedding|imagen|veo|tts|live|native-audio|image-generation|aqa|robotics)/.test(id);
}
function freeModel(value = '') {
  const id = normalizeModel(value);
  return FREE_MODELS.has(id) || [...FREE_MODELS].some(base => id === `${base}-latest` || id === `${base}-001`);
}
function mode(value: unknown) {
  const v = String(value || 'auto').toLowerCase();
  return ['auto','fast','deep'].includes(v) ? v : 'auto';
}
function executionBrief(agentRules = '') {
  const match = String(agentRules || '').match(/<DECRYPTER_EXECUTION_BRIEF>\s*([\s\S]*?)\s*<\/DECRYPTER_EXECUTION_BRIEF>/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}
function autoProfile(brief: any, commandMode: string) {
  const risk = String(brief?.risk?.level || '').toLowerCase();
  const intent = String(brief?.intent?.primary || '').toLowerCase();
  if (risk === 'high' || risk === 'critical') return 'deep';
  if (commandMode === 'build' && ['security','database','auth','migration'].includes(intent) && risk === 'medium') return 'deep';
  return 'fast';
}
function resolveGeminiModel(preferred: string, fallback: string, billingMode: string) {
  const wanted = normalizeModel(preferred);
  if (wanted && supportedTextModel(wanted) && (billingMode === 'user_paid' || freeModel(wanted))) {
    return { model: wanted, fallback: { applied: false, from: '', to: '', reason: '' } };
  }
  return {
    model: fallback,
    fallback: {
      applied: Boolean(wanted && wanted !== fallback),
      from: wanted,
      to: fallback,
      reason: wanted ? (billingMode === 'free' && !freeModel(wanted) ? 'zero-cost-allowlist' : 'unsupported-model') : 'preferred-model-empty'
    }
  };
}
function localAttachmentsEligible(items: any[]) {
  return (Array.isArray(items) ? items : []).every(item => /^(text\/|application\/(json|xml|javascript|typescript|x-javascript))/i.test(String(item?.mime_type || item?.mimeType || '')));
}
async function internalCommand(url: string, serviceRole: string, body: any, headers: Record<string,string> = {}) {
  const commandId = String(body.command_id || crypto.randomUUID());
  const signature = await hmacHex(serviceRole, `ld-gateway:${commandId}`);
  return fetch(`${url}/functions/v1/ld-command`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-decrypter-gateway': 'build18', 'x-decrypter-gateway-signature': signature, ...headers },
    body: JSON.stringify({ ...body, command_id: commandId })
  });
}
async function localRuntimeStatus(url: string, serviceRole: string) {
  const commandId = crypto.randomUUID();
  const response = await internalCommand(url, serviceRole, { action: 'provider_status', command_id: commandId });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) return { configured: false, healthy: false, code: body?.code || `LOCAL_STATUS_HTTP_${response.status}`, served_model: 'decrypter-local', model_label: 'Qwen/Qwen3-Coder-30B-A3B-Instruct' };
  return body?.runtime || { configured: false, healthy: false, code: 'LOCAL_STATUS_INVALID' };
}
async function cachedLocalRuntimeStatus(url: string, serviceRole: string) {
  const now = Date.now();
  if (localHealthCache && now < localHealthCache.expiresAt) {
    return {
      ...localHealthCache.value,
      health_cached: true,
      health_checked_at: new Date(localHealthCache.checkedAt).toISOString(),
      health_cache_ttl_ms: LOCAL_HEALTH_TTL_MS
    };
  }
  const value = await localRuntimeStatus(url, serviceRole);
  const checkedAt = Date.now();
  localHealthCache = { value, checkedAt, expiresAt: checkedAt + LOCAL_HEALTH_TTL_MS };
  return {
    ...value,
    health_cached: false,
    health_checked_at: new Date(checkedAt).toISOString(),
    health_cache_ttl_ms: LOCAL_HEALTH_TTL_MS
  };
}
function registry(local: any) {
  return [
    { id: 'gemini', label: 'Gemini', active: true, role: 'executor', credential: 'user-key', capabilities: ['structured-output','multimodal','coding'] },
    { id: LOCAL_PROVIDER, label: 'Decrypter Local', active: local?.healthy === true, configured: local?.configured === true, health: local?.code || 'UNKNOWN', served_model: local?.served_model || 'decrypter-local', model_label: local?.model_label || 'Qwen/Qwen3-Coder-30B-A3B-Instruct', latency_ms: local?.latency_ms ?? null, health_cached: local?.health_cached === true, health_checked_at: local?.health_checked_at || null, health_cache_ttl_ms: Number(local?.health_cache_ttl_ms || LOCAL_HEALTH_TTL_MS), role: 'executor', credential: 'backend-only', capabilities: ['structured-output','coding'] },
    { id: 'premium', label: 'Premium Provider', active: false, deferred: true, capabilities: ['coding'] }
  ];
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !service) return json({ ok: false, code: 'BACKEND_NOT_CONFIGURED' }, 503);
    const sb = createClient(url, service, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const auth = await authorize(req, body, sb);
    const action = String(body.action || 'execute');
    const local = await cachedLocalRuntimeStatus(url, service).catch(() => ({ configured: false, healthy: false, code: 'LOCAL_STATUS_FAILED', served_model: 'decrypter-local', model_label: 'Qwen/Qwen3-Coder-30B-A3B-Instruct', health_cached: false, health_checked_at: new Date().toISOString(), health_cache_ttl_ms: LOCAL_HEALTH_TTL_MS }));

    if (action === 'status') {
      return json({
        ok: true,
        schema: SCHEMA,
        active: true,
        authority: 'server',
        modes: ['auto','fast','deep'],
        default_mode: 'auto',
        providers: registry(local),
        policy: { cross_provider_fallback: false, zero_cost_revalidated_server_side: true, local_health_gated: true, local_health_cache_ttl_ms: LOCAL_HEALTH_TTL_MS, retry_across_providers: false },
        defaults: { fast: DEFAULT_FAST, deep: DEFAULT_DEEP, local: local?.model_label || 'Qwen/Qwen3-Coder-30B-A3B-Instruct' }
      });
    }
    if (action !== 'execute') return json({ ok: false, code: 'UNKNOWN_ACTION' }, 400);

    const requestedMode = mode(body.gateway_mode);
    const commandMode = body.mode === 'plan' ? 'plan' : 'build';
    const brief = executionBrief(body.agent_rules);
    const profile = requestedMode === 'auto' ? autoProfile(brief, commandMode) : requestedMode;
    const attachmentsEligible = localAttachmentsEligible(body.attachments || []);
    const localEligible = local?.healthy === true && attachmentsEligible;
    const provider = localEligible ? LOCAL_PROVIDER : 'gemini';
    const billingMode = body.gemini_billing_mode === 'user_paid' ? 'user_paid' : 'free';
    const preferred = profile === 'deep' ? String(body.preferred_deep_model || '') : String(body.preferred_fast_model || '');
    const resolved = provider === 'gemini'
      ? resolveGeminiModel(preferred, profile === 'deep' ? DEFAULT_DEEP : DEFAULT_FAST, billingMode)
      : { model: String(local?.served_model || 'decrypter-local'), fallback: { applied: false, from: '', to: '', reason: '' } };
    const reasonBase = requestedMode === 'auto'
      ? `auto:${String(brief?.intent?.primary || 'general')}:${String(brief?.risk?.level || 'unknown')}`
      : `explicit:${requestedMode}`;
    const providerReason = provider === LOCAL_PROVIDER
      ? 'provider:decrypter-local:healthy'
      : local?.healthy !== true ? `provider:gemini:local-${String(local?.code || 'unavailable').toLowerCase()}` : 'provider:gemini:attachments-not-local-compatible';
    const gateway = {
      schema: SCHEMA,
      requested_mode: requestedMode,
      profile,
      provider,
      model: provider === LOCAL_PROVIDER ? String(local?.model_label || resolved.model) : resolved.model,
      executor_model: resolved.model,
      reason: `${reasonBase}:${providerReason}`,
      fallback: resolved.fallback,
      authoritative: true,
      cross_provider_fallback: false,
      local_runtime: provider === LOCAL_PROVIDER ? { served_model: resolved.model, health: local?.code || 'OK', latency_ms: local?.latency_ms ?? null, health_cached: local?.health_cached === true, health_checked_at: local?.health_checked_at || null } : null,
      resolved_at: new Date().toISOString()
    };

    const geminiKey = String(req.headers.get('x-gemini-key') || body.gemini_api_key || '').trim();
    if (provider === 'gemini' && !geminiKey) return json({ ok: false, code: 'GEMINI_KEY_REQUIRED', gateway }, 400);
    const headers: Record<string,string> = { 'x-license-key': auth.token, 'x-device-id': auth.deviceId };
    if (geminiKey) headers['x-gemini-key'] = geminiKey;
    const downstream = await internalCommand(url, service, {
      ...body,
      action: undefined,
      provider,
      model: resolved.model,
      gemini_billing_mode: billingMode,
      gateway_mode: undefined,
      preferred_fast_model: undefined,
      preferred_deep_model: undefined,
      max_output_tokens: provider === LOCAL_PROVIDER
        ? Math.min(Number(body.max_output_tokens || 16384), profile === 'fast' ? 16384 : 32768)
        : body.max_output_tokens
    }, headers);
    const result = await downstream.json().catch(() => ({}));
    if (!downstream.ok || result?.ok === false) {
      return json({ ...result, ok: false, gateway, code: result?.code || `EXECUTOR_HTTP_${downstream.status}`, cross_provider_retry_attempted: false }, downstream.status);
    }
    return json({ ...result, ok: true, gateway, provider, model: gateway.model });
  } catch (error) {
    const code = String((error as Error)?.message || 'INTERNAL_ERROR');
    const authish = /^(KEY_|DEVICE_|ENTITLEMENT_)/.test(code);
    console.error('ld-model-gateway', code);
    return json({ ok: false, code }, authish ? 403 : 500);
  }
});
