export async function testSupabase(config = {}) {
  const url = String(config.url || '').replace(/\/$/, '');
  const anonKey = config.anonKey || '';
  if (!url || !anonKey) throw new Error('Informe URL e anon key do Supabase.');
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  });
  if (!res.ok && res.status !== 404) throw new Error(`Supabase respondeu ${res.status}.`);
  return { ok: true, status: res.status };
}

export async function runSupabaseSql({ projectRef, managementToken, sql }) {
  if (!projectRef || !managementToken) throw new Error('Configure Project Ref e Management Token do Supabase.');
  if (!String(sql || '').trim()) throw new Error('SQL vazio.');
  const res = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query`, {
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
