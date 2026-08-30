const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-license-key,x-device-id,x-decrypter-client-version,authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

const VOICE = Object.freeze({ lang: 'pt-BR', rate: 0.96, pitch: 0.94, volume: 1, preferNatural: true });

type MessageDef = { text: string; tone?: 'info'|'success'|'warning'|'error'; speak?: boolean; dedupeMs?: number };

const CATALOG: Record<string, MessageDef> = Object.freeze({
  welcome: { text: 'Bem-vindo ao Lovable Decrypter. Tudo pronto para começar.', tone: 'success', speak: true, dedupeMs: 10000 },
  'license-success': { text: 'Licença ativada com sucesso. Bem-vindo ao Lovable Decrypter.', tone: 'success', speak: true, dedupeMs: 5000 },
  'github-success': { text: 'Conexão com o GitHub realizada com sucesso. Repositório pronto para trabalhar.', tone: 'success', speak: true },
  'supabase-success': { text: 'Conexão com o Supabase realizada com sucesso. Projeto sincronizado e disponível.', tone: 'success', speak: true },
  'zip-success': { text: 'Download concluído. O arquivo ZIP do projeto está pronto.', tone: 'success', speak: true },
  'lovable-github-success': { text: 'Migração concluída. Seu projeto do Lovable foi enviado para o GitHub com sucesso.', tone: 'success', speak: true, dedupeMs: 8000 },
  'cloud-supabase-success': { text: 'Migração concluída. Seu projeto saiu do Lovable Cloud e agora está configurado no Supabase.', tone: 'success', speak: true, dedupeMs: 8000 },
  'github-failure': { text: 'Não foi possível conectar ao GitHub. Verifique sua conta, permissões e tente novamente.', tone: 'error', speak: true },
  'supabase-failure': { text: 'Não foi possível conectar ao Supabase. Verifique o projeto, as credenciais e tente novamente.', tone: 'error', speak: true },
  'zip-failure': { text: 'O download do ZIP não pôde ser concluído. Verifique o projeto e tente novamente.', tone: 'error', speak: true },
  'lovable-github-failure': { text: 'A migração para o GitHub falhou. Nenhuma alteração incompleta será considerada concluída. Verifique os detalhes antes de tentar novamente.', tone: 'error', speak: true, dedupeMs: 8000 },
  'cloud-supabase-failure': { text: 'A migração para o Supabase não pôde ser concluída. Verifique o diagnóstico antes de tentar novamente.', tone: 'error', speak: true, dedupeMs: 8000 },
  'monitor-on': { text: 'Monitor ativado. O Decrypter está acompanhando o projeto.', tone: 'success', speak: true, dedupeMs: 1200 },
  'monitor-off': { text: 'Monitor desativado. O acompanhamento automático foi interrompido.', tone: 'warning', speak: true, dedupeMs: 1200 },
  'credits-consuming': { text: 'Atenção. Esta operação está utilizando seus créditos do Decrypter. O consumo continuará enquanto a execução estiver ativa.', tone: 'warning', speak: true, dedupeMs: 12000 }
});

const NORMALIZERS: Array<[RegExp, string]> = [
  [/GitHub conectado:/i, 'github-success'],
  [/Supabase conectado\.?/i, 'supabase-success'],
  [/Download iniciado|ZIP.*pronto|download.*ZIP/i, 'zip-success'],
  [/Login concluído|Licença ativada/i, 'license-success'],
  [/Migração completa concluída|Migração concluída e verificada/i, 'cloud-supabase-success'],
  [/falh.*GitHub|GitHub.*falh|não foi possível conectar ao GitHub/i, 'github-failure'],
  [/falh.*Supabase|Supabase.*falh|não foi possível conectar ao Supabase/i, 'supabase-failure'],
  [/falh.*ZIP|ZIP.*falh|download.*não pôde/i, 'zip-failure']
];

function interpolate(input: string, params: Record<string, unknown>) {
  return input.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_m, key) => {
    const value = params?.[key];
    return value === undefined || value === null ? '' : String(value).slice(0, 500);
  });
}

async function validateLicense(req: Request) {
  const base = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const key = String(req.headers.get('x-license-key') || '').trim();
  if (!base || !key) return { ok: false, code: 'LICENSE_REQUIRED' };
  const res = await fetch(`${base}/functions/v1/ld-license-validate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-license-key': key,
      ...(req.headers.get('x-device-id') ? { 'x-device-id': String(req.headers.get('x-device-id')) } : {}),
      ...(req.headers.get('x-decrypter-client-version') ? { 'x-decrypter-client-version': String(req.headers.get('x-decrypter-client-version')) } : {})
    },
    body: '{}'
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.valid) return { ok: false, code: body?.code || `LICENSE_HTTP_${res.status}` };
  return { ok: true, subject: body?.subject || '', entitlement: body?.entitlement || null };
}

function messagePayload(key: string, def: MessageDef, params: Record<string, unknown> = {}) {
  return {
    schema: 'ld-message/2',
    key,
    text: interpolate(def.text, params),
    tone: def.tone || 'info',
    voice: { ...VOICE, speak: def.speak !== false, dedupeMs: Number(def.dedupeMs || 3500) },
    authority: 'backend',
    generatedAt: new Date().toISOString()
  };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('health') === '1') return json({ ok: true, schema: 'ld-messaging/2', build: 55, authority: 'backend' });
    return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (req.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  const auth = await validateLicense(req);
  if (!auth.ok) return json({ ok: false, code: auth.code }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'resolve');
    if (action === 'resolve') {
      const key = String(body?.key || '').trim();
      const def = CATALOG[key];
      if (!def) return json({ ok: false, code: 'MESSAGE_KEY_NOT_FOUND', key }, 404);
      return json({ ok: true, data: messagePayload(key, def, body?.params && typeof body.params === 'object' ? body.params : {}) });
    }
    if (action === 'normalize') {
      const raw = String(body?.text || '').trim().slice(0, 4000);
      if (!raw) return json({ ok: false, code: 'MESSAGE_EMPTY' }, 400);
      const matched = NORMALIZERS.find(([pattern]) => pattern.test(raw));
      if (matched) return json({ ok: true, data: messagePayload(matched[1], CATALOG[matched[1]], {}) });
      const tone = body?.tone === 'error' || body?.error === true ? 'error' : body?.tone === 'warning' ? 'warning' : 'info';
      return json({ ok: true, data: {
        schema: 'ld-message/2', key: 'dynamic', text: raw, tone,
        voice: { ...VOICE, speak: tone === 'error', dedupeMs: 3500 },
        authority: 'backend', generatedAt: new Date().toISOString()
      }});
    }
    return json({ ok: false, code: 'ACTION_INVALID' }, 400);
  } catch (error) {
    console.error('ld-messaging', error);
    return json({ ok: false, code: 'INTERNAL_ERROR' }, 500);
  }
});
