const KNOWLEDGE_SCHEMA = 'ld-knowledge/1';
const TIMEOUT_MS = 7000;

function categoriesFor(command = '') {
  const text = String(command || '').toLowerCase();
  if (/\b(github|workflow|branch|commit|pull request|actions?)\b/.test(text)) return ['github', 'lovable'];
  if (/\b(supabase|postgres|sql|database|banco|migration|migracao|rls|policy|auth|storage|edge function|realtime)\b/.test(text)) return ['supabase', 'lovable'];
  return ['lovable', 'github', 'supabase'];
}

function citations(value) {
  return (Array.isArray(value) ? value : []).slice(0, 8).map(item => ({
    title: String(item?.title || '').slice(0, 240),
    url: String(item?.url || '').slice(0, 1000),
    category: String(item?.category || '').slice(0, 60)
  }));
}

export function publicKnowledge(value = {}) {
  return Object.freeze({
    active: value?.active === true,
    status: String(value?.status || (value?.active ? 'ready' : 'degraded')),
    schema: String(value?.schema || KNOWLEDGE_SCHEMA),
    embedding_model: String(value?.embedding_model || 'gte-small'),
    retrieval: String(value?.retrieval || 'hybrid-vector-keyword'),
    hit_count: Math.max(0, Number(value?.hit_count || 0)),
    vector_hits: Math.max(0, Number(value?.vector_hits || 0)),
    keyword_only_hits: Math.max(0, Number(value?.keyword_only_hits || 0)),
    sources: Math.max(0, Number(value?.sources || 0)),
    ready_chunks: Math.max(0, Number(value?.ready_chunks || 0)),
    pending_chunks: Math.max(0, Number(value?.pending_chunks || 0)),
    failed_chunks: Math.max(0, Number(value?.failed_chunks || 0)),
    total_chunks: Math.max(0, Number(value?.total_chunks || 0)),
    citations: citations(value?.citations),
    error: String(value?.error || '').slice(0, 240)
  });
}

function endpoint(agent) {
  return {
    base: String(agent?.backendBase || '').replace(/\/+$/, ''),
    licenseKey: String(agent?.licenseKey || ''),
    deviceId: String(agent?.deviceId || '')
  };
}

async function request(agent, body = {}) {
  const { base, licenseKey, deviceId } = endpoint(agent);
  if (!base || !licenseKey || !deviceId) throw new Error('knowledge-auth-unavailable');
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
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.code || `HTTP_${response.status}`);
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('knowledge-timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchKnowledge(agent, command = '') {
  try {
    const body = await request(agent, {
      action: 'search',
      query: String(command || '').slice(0, 6000),
      top_k: 8,
      match_threshold: 0.48,
      categories: categoriesFor(command)
    });
    const knowledge = body?.knowledge || {};
    return {
      ...publicKnowledge({ ...knowledge, active: true, status: Number(knowledge.hit_count || 0) > 0 ? 'ready' : 'empty' }),
      context_md: String(knowledge.context_md || '').slice(0, 24000)
    };
  } catch (error) {
    return { ...publicKnowledge({ active: false, status: 'degraded', error: error?.message || 'knowledge-unavailable' }), context_md: '' };
  }
}

export async function knowledgeStatus(agent) {
  try {
    const body = await request(agent, { action: 'status' });
    return publicKnowledge({ ...(body?.knowledge || {}), active: true, status: 'ready' });
  } catch (error) {
    return publicKnowledge({ active: false, status: 'degraded', error: error?.message || 'knowledge-unavailable' });
  }
}
