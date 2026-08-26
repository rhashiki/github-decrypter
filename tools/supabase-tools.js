function normalizeSupabaseProjectUrl(value = '') {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  let url;
  try { url = new URL(raw); }
  catch { throw new Error('Project URL do Supabase inválida.'); }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
    throw new Error('Project URL deve usar HTTPS em um domínio *.supabase.co.');
  }
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/+$/, '');
}

export async function testSupabase(config = {}) {
  const url = normalizeSupabaseProjectUrl(config.url || '');
  const anonKey = config.anonKey || '';
  if (!anonKey) throw new Error('Informe URL e anon key do Supabase.');
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  });
  if (!res.ok && res.status !== 404) throw new Error(`Supabase respondeu ${res.status}.`);
  return { ok: true, status: res.status };
}

export async function runSupabaseSql({ projectRef, managementToken, sql }) {
  const safeRef = String(projectRef || '').trim();
  if (!/^[a-z0-9]{8,32}$/i.test(safeRef) || !managementToken) throw new Error('Configure Project Ref e Management Token do Supabase.');
  if (!String(sql || '').trim()) throw new Error('SQL vazio.');
  const res = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(safeRef)}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${managementToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.error || `Supabase Management HTTP ${res.status}`);
  return data;
}
