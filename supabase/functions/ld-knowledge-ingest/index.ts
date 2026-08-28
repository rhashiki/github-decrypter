import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ADMIN_SECRET = 'LD_KNOWLEDGE_ADMIN_TOKEN';
const EMBEDDING_MODEL = 'gte-small';
const MAX_PAGE_CHARS = 1_500_000;
const MAX_CHUNKS = 48;
const CHUNK_TARGET = 3600;
const CHUNK_OVERLAP = 420;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-knowledge-admin-token',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const enc = new TextEncoder();

async function sha(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) || 32))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16) || 32));
}
function htmlToText(html: string) {
  let text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h[4-6]\b[^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n#### $1\n')
    .replace(/<(br|\/p|\/li|\/div|\/section|\/article)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<pre\b[^>]*>/gi, '\n```\n')
    .replace(/<\/pre>/gi, '\n```\n')
    .replace(/<code\b[^>]*>/gi, '`')
    .replace(/<\/code>/gi, '`')
    .replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}
function titleFrom(raw: string, contentType: string, fallback: string) {
  if (/html/i.test(contentType)) {
    const match = raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    if (match) return decodeEntities(match[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 240);
  }
  const h1 = raw.match(/^#\s+(.+)$/m);
  return (h1?.[1] || fallback).trim().slice(0, 240);
}
function classify(url: URL) {
  if (url.protocol !== 'https:') throw new Error('SOURCE_HTTPS_REQUIRED');
  const host = url.hostname.toLowerCase();
  if (host === 'docs.lovable.dev') return { domain: host, category: 'lovable' };
  if (host === 'docs.github.com') return { domain: host, category: 'github' };
  if (host === 'supabase.com' && url.pathname.startsWith('/docs/')) return { domain: host, category: 'supabase' };
  throw new Error('SOURCE_NOT_ALLOWLISTED');
}
function chunksFrom(text: string) {
  const blocks = text.split(/\n{2,}/).map(x => x.trim()).filter(x => x.length >= 20);
  const chunks: { content: string; headings: string[] }[] = [];
  let current = '';
  let headings: string[] = [];
  for (const block of blocks) {
    const heading = block.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      headings = [...headings.slice(0, Math.max(0, level - 1)), heading[2].trim()].slice(0, 4);
    }
    if (current && current.length + block.length + 2 > CHUNK_TARGET) {
      chunks.push({ content: current.trim(), headings: [...headings] });
      current = current.slice(Math.max(0, current.length - CHUNK_OVERLAP)) + '\n\n' + block;
    } else {
      current += (current ? '\n\n' : '') + block;
    }
    if (chunks.length >= MAX_CHUNKS) break;
  }
  if (current.trim().length >= 80 && chunks.length < MAX_CHUNKS) chunks.push({ content: current.trim(), headings: [...headings] });
  return chunks.filter(x => x.content.length >= 80).slice(0, MAX_CHUNKS);
}
function embeddingArray(raw: any): number[] {
  const value = raw?.data ?? raw;
  const arr = Array.isArray(value) ? value : value && typeof value[Symbol.iterator] === 'function' ? Array.from(value) : [];
  const out = arr.map(Number).filter(Number.isFinite);
  if (out.length !== 384) throw new Error(`EMBEDDING_DIMENSION_${out.length}`);
  return out;
}
async function embedChunks(chunks: { content: string; headings: string[] }[]) {
  const model = new Supabase.ai.Session(EMBEDDING_MODEL);
  const rows: any[] = new Array(chunks.length);
  for (let start = 0; start < chunks.length; start += 4) {
    const batch = chunks.slice(start, start + 4);
    const results = await Promise.all(batch.map(async (chunk, offset) => {
      const raw = await model.run(chunk.content, { mean_pool: true, normalize: true });
      return {
        chunk_index: start + offset,
        heading_path: chunk.headings,
        content: chunk.content,
        content_sha256: await sha(chunk.content),
        token_estimate: Math.ceil(chunk.content.length / 4),
        embedding: JSON.stringify(embeddingArray(raw)),
        metadata: { embedding_model: EMBEDDING_MODEL, source: 'official_docs' }
      };
    }));
    results.forEach((row, i) => rows[start + i] = row);
  }
  return rows;
}
async function requireAdmin(req: Request, sb: any) {
  const provided = String(req.headers.get('x-knowledge-admin-token') || '').trim();
  if (!provided) throw new Error('ADMIN_TOKEN_REQUIRED');
  const { data: expected, error } = await sb.rpc('ld_backend_secret', { p_name: ADMIN_SECRET });
  if (error || !expected) throw new Error('ADMIN_SECRET_UNAVAILABLE');
  if ((await sha(provided)) !== (await sha(String(expected)))) throw new Error('ADMIN_TOKEN_INVALID');
}
async function ingestUrl(sb: any, rawUrl: string) {
  const requested = new URL(String(rawUrl || '').trim());
  const requestedClass = classify(requested);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(requested.toString(), { headers: { 'user-agent': 'Lovable-Decrypter-Knowledge/2.4.16' }, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
  const resolved = new URL(response.url || requested.toString());
  const resolvedClass = classify(resolved);
  if (resolvedClass.category !== requestedClass.category) throw new Error('SOURCE_REDIRECT_CATEGORY_CHANGED');
  const contentType = String(response.headers.get('content-type') || 'text/plain');
  const raw = await response.text();
  if (!raw || raw.length > MAX_PAGE_CHARS) throw new Error('SOURCE_SIZE_INVALID');
  const normalized = /html/i.test(contentType) ? htmlToText(raw) : raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length < 200) throw new Error('SOURCE_CONTENT_TOO_SMALL');
  const chunks = chunksFrom(normalized);
  if (!chunks.length) throw new Error('SOURCE_NO_CHUNKS');
  const embedded = await embedChunks(chunks);
  const canonicalUrl = resolved.toString().split('#')[0];
  const sourceKey = `${resolvedClass.category}:${(await sha(canonicalUrl)).slice(0, 24)}`;
  const title = titleFrom(raw, contentType, resolved.pathname.split('/').filter(Boolean).pop() || resolvedClass.category);
  const pageHash = await sha(normalized);
  const now = new Date().toISOString();
  const { data: source, error: sourceError } = await sb.from('ld_knowledge_sources').upsert({
    source_key: sourceKey,
    canonical_url: canonicalUrl,
    domain: resolvedClass.domain,
    category: resolvedClass.category,
    title,
    source_type: 'official_docs',
    status: 'active',
    content_sha256: pageHash,
    fetched_at: now,
    updated_at: now,
    metadata: { content_type: contentType, embedding_model: EMBEDDING_MODEL }
  }, { onConflict: 'canonical_url' }).select('id,source_key,title,canonical_url,category').single();
  if (sourceError || !source) throw new Error('SOURCE_UPSERT_FAILED');
  const { error: deleteError } = await sb.from('ld_knowledge_chunks').delete().eq('source_id', source.id);
  if (deleteError) throw new Error('CHUNK_REPLACE_FAILED');
  const rows = embedded.map(row => ({ ...row, source_id: source.id, updated_at: now }));
  for (let start = 0; start < rows.length; start += 20) {
    const { error } = await sb.from('ld_knowledge_chunks').insert(rows.slice(start, start + 20));
    if (error) throw new Error('CHUNK_INSERT_FAILED');
  }
  return { ...source, chunks: rows.length, content_sha256: pageHash };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !service) return json({ ok: false, code: 'BACKEND_NOT_CONFIGURED' }, 503);
    const sb = createClient(url, service, { auth: { persistSession: false } });
    await requireAdmin(req, sb);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status');
    if (action === 'status') {
      const [{ count: sourceCount }, { count: chunkCount }] = await Promise.all([
        sb.from('ld_knowledge_sources').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        sb.from('ld_knowledge_chunks').select('*', { count: 'exact', head: true })
      ]);
      return json({ ok: true, schema: 'ld-knowledge/1', embedding_model: EMBEDDING_MODEL, sources: sourceCount || 0, chunks: chunkCount || 0 });
    }
    if (action === 'ingest_url') {
      const result = await ingestUrl(sb, String(body.url || ''));
      return json({ ok: true, result });
    }
    if (action === 'disable_url') {
      const target = new URL(String(body.url || '').trim());
      classify(target);
      const { error } = await sb.from('ld_knowledge_sources').update({ status: 'disabled', updated_at: new Date().toISOString() }).eq('canonical_url', target.toString().split('#')[0]);
      if (error) throw new Error('SOURCE_DISABLE_FAILED');
      return json({ ok: true });
    }
    return json({ ok: false, code: 'UNKNOWN_ACTION' }, 400);
  } catch (error) {
    const code = String((error as Error)?.message || 'INTERNAL_ERROR');
    const denied = /^ADMIN_/.test(code);
    console.error('ld-knowledge-ingest', code);
    return json({ ok: false, code }, denied ? 403 : 500);
  }
});
