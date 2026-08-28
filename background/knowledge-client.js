const KNOWLEDGE_SCHEMA = 'ld-knowledge/1';
const TIMEOUT_MS = 7000;

function categoriesFor(command = '') {
  const text = String(command || '').toLowerCase();
  if (/\b(github|workflow|branch|commit|pull request|actions?)\b/.test(text)) return ['github', 'lovable'];
  if (/\b(supabase|postgres|sql|database|banco|migration|migracao|rls|policy|auth|storage|edge function|realtime)\b/.test(text)) return ['supabase', 'lovable'];
  return ['lovable', 'github', 'supabase'];
}

export function publicKnowledge(value = {}) {
  return Object.freeze({
    active: value?.active === true,
    status: String(value?.status || (value?.active ? 'ready' : 'degraded')),
    schema: String(value?.schema || KNOWLEDGE_SCHEMA),
    embedding_model: String(value?.embedding_model || 'gte-small'),
    retrieval: String(value?.retrieval || 'hybrid-vector-keyword'),
    hit_count: Math.max(0, Number(value?.hit_count || 0)),
    citations: (Array.isArray(value?.citations) ? value.citations : []).slice(0, 8).map(item => ({
      title: String(item?.title || '').slice(0, 240),
      url: String(item?.url || '').slice(0, 1000),
      category: String(item?.category || '').slice(0, 60)
    })),
    error: String(value?.error || '').slice(0, 240)
  });
}

export async function searchKnowledge(agent, command = '') {
  const base = String(agent?.backendBase || '').replace(/\/+$/, '');
  const licenseKey = String(agent?.licenseKey || '');
  const deviceId = String(agent?.deviceId || '');
  if (!base || !licenseKey || !deviceId) return { ...publicKnowledge({ active: false, status: 'degraded', error: 'knowledge-auth-unavailable' }), context_md: '' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/ld-knowledge-search`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': deviceId
      },
      body: JSON.stringify({ query: String(command || '').slice(0, 6000), top_k: 8, match_threshold: 0.48, categories: categoriesFor(command) }),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false || !body?.knowledge) {
      return { ...publicKnowledge({ active: false, status: 'degraded', error: body?.code || `HTTP_${response.status}` }), context_md: '' };
    }
    const knowledge = body.knowledge || {};
    return {
      ...publicKnowledge({ ...knowledge, active: true, status: Number(knowledge.hit_count || 0) > 0 ? 'ready' : 'empty' }),
      context_md: String(knowledge.context_md || '').slice(0, 24000)
    };
  } catch (error) {
    const code = error?.name === 'AbortError' ? 'knowledge-timeout' : (error?.message || 'knowledge-unavailable');
    return { ...publicKnowledge({ active: false, status: 'degraded', error: code }), context_md: '' };
  } finally {
    clearTimeout(timer);
  }
}
