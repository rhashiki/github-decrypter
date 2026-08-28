import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PUBLIC_SPKI_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==';
const EMBEDDING_MODEL = 'gte-small';
const MAX_QUERY = 6000;
const MAX_CONTEXT = 24000;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-license-key,x-device-id,authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const enc = new TextEncoder();

function b64u(value: string) {
  const s = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function sha(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
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
async function auth(req: Request, body: any, sb: any) {
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
  return license;
}
function embeddingArray(raw: any): number[] {
  const value = raw?.data ?? raw;
  const arr = Array.isArray(value) ? value : value && typeof value[Symbol.iterator] === 'function' ? Array.from(value) : [];
  const out = arr.map(Number).filter(Number.isFinite);
  if (out.length !== 384) throw new Error(`EMBEDDING_DIMENSION_${out.length}`);
  return out;
}
function list(value: unknown, max = 8) {
  return Array.isArray(value) ? [...new Set(value.map(String).map(x => x.trim().toLowerCase()).filter(Boolean))].slice(0, max) : null;
}
function contextMarkdown(rows: any[]) {
  let used = 0;
  const parts: string[] = [];
  for (const [index, row] of rows.entries()) {
    const heading = Array.isArray(row.heading_path) && row.heading_path.length ? row.heading_path.join(' > ') : row.title || 'Documentação';
    const indexType = row.embedding_ready ? 'vector+keyword' : 'keyword fallback';
    const block = `\n## KNOWLEDGE ${index + 1}: ${row.title || row.source_key}\nFonte: ${row.canonical_url}\nSeção: ${heading}\nÍndice: ${indexType}\nScore: ${Number(row.score || 0).toFixed(4)}\n\n${String(row.content || '').trim()}\n`;
    if (used + block.length > MAX_CONTEXT) {
      const room = MAX_CONTEXT - used;
      if (room > 500) parts.push(block.slice(0, room));
      break;
    }
    parts.push(block);
    used += block.length;
  }
  return parts.join('\n').trim();
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
    await auth(req, body, sb);
    const action = String(body.action || 'search').toLowerCase();

    if (action === 'status') {
      const [{ count: sources }, { count: total }, { count: ready }, { count: pending }, { count: failed }] = await Promise.all([
        sb.from('ld_knowledge_sources').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        sb.from('ld_knowledge_chunks').select('*', { count: 'exact', head: true }),
        sb.from('ld_knowledge_chunks').select('*', { count: 'exact', head: true }).eq('embedding_status', 'ready'),
        sb.from('ld_knowledge_chunks').select('*', { count: 'exact', head: true }).in('embedding_status', ['pending', 'processing']),
        sb.from('ld_knowledge_chunks').select('*', { count: 'exact', head: true }).eq('embedding_status', 'failed')
      ]);
      return json({
        ok: true,
        knowledge: {
          active: true,
          schema: 'ld-knowledge/1',
          embedding_model: EMBEDDING_MODEL,
          retrieval: 'hybrid-vector-keyword',
          sources: sources || 0,
          total_chunks: total || 0,
          ready_chunks: ready || 0,
          pending_chunks: pending || 0,
          failed_chunks: failed || 0,
          hit_count: 0,
          citations: []
        }
      });
    }
    if (action !== 'search') return json({ ok: false, code: 'UNKNOWN_ACTION' }, 400);

    const query = String(body.query || '').trim().slice(0, MAX_QUERY);
    if (!query) return json({ ok: false, code: 'QUERY_REQUIRED' }, 400);
    const topK = Math.max(1, Math.min(12, Number(body.top_k || 8)));
    const threshold = Math.max(0.35, Math.min(0.95, Number(body.match_threshold || 0.50)));
    const domains = list(body.domains);
    const categories = list(body.categories);

    const model = new Supabase.ai.Session(EMBEDDING_MODEL);
    const rawEmbedding = await model.run(query, { mean_pool: true, normalize: true });
    const embedding = embeddingArray(rawEmbedding);
    const { data: rows, error } = await sb.rpc('ld_match_knowledge', {
      query_embedding: JSON.stringify(embedding),
      query_text: query,
      match_threshold: threshold,
      match_count: topK,
      filter_domains: domains,
      filter_categories: categories
    });
    if (error) throw new Error('KNOWLEDGE_SEARCH_FAILED');
    const results = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      source_key: String(row.source_key || ''),
      title: String(row.title || ''),
      url: String(row.canonical_url || ''),
      domain: String(row.domain || ''),
      category: String(row.category || ''),
      heading_path: Array.isArray(row.heading_path) ? row.heading_path.map(String).slice(0, 8) : [],
      content: String(row.content || '').slice(0, 8000),
      embedding_ready: row.embedding_ready === true,
      semantic_similarity: Number(row.semantic_similarity || 0),
      keyword_rank: Number(row.keyword_rank || 0),
      score: Number(row.score || 0)
    }));
    const citations = [...new Map(results.map((row: any) => [row.url, { title: row.title, url: row.url, category: row.category }])).values()].slice(0, 8);
    const vectorHits = results.filter((row: any) => row.embedding_ready).length;
    const keywordOnlyHits = Math.max(0, results.length - vectorHits);
    return json({
      ok: true,
      knowledge: {
        active: true,
        schema: 'ld-knowledge/1',
        embedding_model: EMBEDDING_MODEL,
        retrieval: 'hybrid-vector-keyword',
        hit_count: results.length,
        vector_hits: vectorHits,
        keyword_only_hits: keywordOnlyHits,
        citations,
        context_md: contextMarkdown(results)
      }
    });
  } catch (error) {
    const code = String((error as Error)?.message || 'INTERNAL_ERROR');
    const authish = /^(KEY_|DEVICE_|ENTITLEMENT_)/.test(code);
    console.error('ld-knowledge-search', code);
    return json({ ok: false, code }, authish ? 403 : 500);
  }
});
