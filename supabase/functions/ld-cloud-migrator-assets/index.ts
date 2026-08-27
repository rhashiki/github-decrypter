const nativeFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (input, init) => {
  const response = await nativeFetch(input, init);
  try {
    const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
    const url = new URL(rawUrl);
    const isApiKeys = url.hostname === 'api.supabase.com'
      && /^\/v1\/projects\/[^/]+\/api-keys$/.test(url.pathname)
      && url.searchParams.get('reveal') === 'true';
    if (!isApiKeys || !response.ok) return response;

    const data = await response.clone().json();
    if (!Array.isArray(data)) return response;
    const hasModernSecret = data.some(item => String(item?.api_key || item?.key || '').startsWith('sb_secret_'));
    if (!hasModernSecret) return response;

    const filtered = data.filter(item => {
      const name = String(item?.name || '').toLowerCase();
      const type = String(item?.type || '').toLowerCase();
      return name !== 'service_role' && type !== 'service_role' && !name.includes('service_role');
    });
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('transfer-encoding');
    headers.set('content-type', 'application/json');
    return new Response(JSON.stringify(filtered), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (_) {
    return response;
  }
};

await import('./legacy.ts');
