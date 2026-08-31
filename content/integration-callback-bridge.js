(() => {
  'use strict';
  const url = new URL(window.location.href);
  const provider = String(url.searchParams.get('ld2_integration_callback') || '').toLowerCase();
  if (!['github','supabase'].includes(provider)) return;

  const status = url.searchParams.get('status') === 'connected' ? 'connected' : 'error';
  const count = Math.max(0, Number(url.searchParams.get('count') || 0) || 0);
  const code = String(url.searchParams.get('code') || '').slice(0, 180);
  const success = status === 'connected';
  const providerName = provider === 'github' ? 'GitHub' : 'Supabase';
  const eventType = provider === 'github'
    ? (success ? 'LD2_GITHUB_APP_CONNECTED' : 'LD2_GITHUB_APP_ERROR')
    : (success ? 'LD2_SUPABASE_CONNECTED' : 'LD2_SUPABASE_ERROR');

  for (const key of ['ld2_integration_callback','status','count','code']) url.searchParams.delete(key);
  try { history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}` || '/'); } catch (_) {}

  function render() {
    document.title = `${providerName} ${success ? 'conectado' : 'não conectado'}`;
    const style = document.createElement('style');
    style.textContent = 'html,body{margin:0;min-height:100%;background:#050b08;color:#eafff2;font-family:Arial,sans-serif}body{min-height:100vh;display:grid;place-items:center}.ld2cb{max-width:520px;margin:24px;padding:28px;border:1px solid #3ecf8e77;border-radius:18px;background:#07140e;box-shadow:0 20px 70px #0008,0 0 30px #3ecf8e18}.ld2cb-mark{font-size:38px;color:#3ecf8e}.ld2cb.error{border-color:#ff6b7a77}.ld2cb.error .ld2cb-mark{color:#ff6b7a}.ld2cb h1{font-size:22px;margin:12px 0}.ld2cb p{color:#a9bdb3;line-height:1.5}.ld2cb small{color:#70877b}';
    const card = document.createElement('main');
    card.className = `ld2cb${success ? '' : ' error'}`;
    const mark = document.createElement('div');
    mark.className = 'ld2cb-mark';
    mark.textContent = success ? '✓' : '!';
    const title = document.createElement('h1');
    title.textContent = success ? `${providerName} conectado` : `Falha ao conectar ${providerName}`;
    const detail = document.createElement('p');
    detail.textContent = success
      ? (provider === 'supabase' && count ? `${count} projeto(s) autorizado(s). O Lovable Decrypter já pode atualizar o estado.` : 'Autorização concluída. O Lovable Decrypter já pode atualizar o estado.')
      : (code ? `Código: ${code}` : 'A autorização não foi concluída. Volte ao Lovable Decrypter e tente novamente.');
    const foot = document.createElement('small');
    foot.textContent = 'Esta aba será fechada automaticamente quando possível.';
    card.append(mark, title, detail, foot);
    document.head?.appendChild(style);
    document.body?.replaceChildren(card);
  }

  const payload = { type:eventType, provider, status, count, code };
  try { window.opener?.postMessage(payload, '*'); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent('ld2:integration-callback', { detail:payload })); } catch (_) {}

  const ready = () => {
    render();
    setTimeout(() => {
      try {
        chrome.runtime.sendMessage({ type:'LD2_INTEGRATION_CALLBACK_COMPLETE', provider, status });
      } catch (_) {}
    }, 1200);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once:true });
  else ready();
})();
