(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_COMMERCIAL_RUNTIME__) return;
  window.__LOVABLE_DECRYPTER_COMMERCIAL_RUNTIME__ = true;

  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  const ROOT_ID = 'ld2-root';
  let syncing = false;
  let catalogCache = null;

  function root() { return document.getElementById(ROOT_ID); }
  function esc(value = '') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  async function state() {
    const settings = await (runtime?.({ type: 'LD2_SETTINGS_GET' }).catch?.(() => ({})) || {});
    return { settings, auth: settings?.auth || {} };
  }
  async function call(action, body = {}) {
    const { auth } = await state();
    const base = String(auth.backendBase || 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1').replace(/\/+$/, '');
    const headers = { 'content-type': 'application/json' };
    if (auth.licenseKey) headers['x-license-key'] = auth.licenseKey;
    if (auth.deviceId) headers['x-device-id'] = auth.deviceId;
    const response = await fetch(`${base}/ld-commercial`, { method: 'POST', headers, body: JSON.stringify({ action, ...body }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw Object.assign(new Error(data?.code || `HTTP_${response.status}`), { data });
    return data;
  }
  async function catalog() {
    if (catalogCache) return catalogCache;
    catalogCache = await call('catalog');
    return catalogCache;
  }
  function tierLabel(commercial) {
    if (!commercial) return 'TRIAL 4H';
    if (commercial.tier === 'owner') return 'OWNER';
    if (commercial.tier === 'trial') {
      const exp = Date.parse(commercial?.trial?.expires_at || commercial.expires_at || '');
      const mins = Number.isFinite(exp) ? Math.max(0, Math.ceil((exp - Date.now()) / 60000)) : null;
      return mins == null ? 'TRIAL' : `TRIAL · ${mins}min`;
    }
    if (commercial.tier === 'subscription') return commercial?.subscription?.plan_name || 'ASSINATURA';
    if (Number(commercial.credits || 0) > 0) return `${Number(commercial.credits)} CRÉDITOS`;
    return 'AVULSO';
  }
  function ensureUi() {
    const shell = root()?.querySelector('.ld2-unified-shell');
    if (!shell) return false;
    if (!shell.querySelector('[data-ul-status="commercial"]')) {
      const grid = shell.querySelector('.ld2-ul-status-grid');
      if (grid) grid.insertAdjacentHTML('beforeend', '<div class="ld2-ul-status" data-ul-status="commercial" data-state="idle"><span>R$</span><div><small>Comercial</small><b>Verificando…</b></div><i></i></div>');
    }
    if (!shell.querySelector('[data-ul-action="commercial"]')) {
      const section = shell.querySelector('[data-ul-section="system"] .ld2-ul-grid');
      if (section) section.insertAdjacentHTML('beforeend', '<button type="button" class="ld2-ul-card" data-ul-action="commercial"><span>◆</span><div><b>Planos & Trial</b><small>Trial 4h, assinatura, créditos e BYOK</small></div><em data-ul-badge="commercial">—</em></button>');
    }
    const card = shell.querySelector('[data-ul-action="commercial"]');
    if (card && !card.dataset.ldCommercialBound) {
      card.dataset.ldCommercialBound = '1';
      card.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openPanel(); }, true);
    }
    return true;
  }
  function updateTile(label, stateName = 'good', title = '') {
    const tile = root()?.querySelector('.ld2-unified-shell [data-ul-status="commercial"]');
    if (tile) { tile.dataset.state = stateName; const b = tile.querySelector('b'); if (b) b.textContent = label; tile.title = title; }
    const badge = root()?.querySelector('.ld2-unified-shell [data-ul-badge="commercial"]');
    if (badge) { badge.textContent = label; badge.dataset.state = stateName; }
  }
  async function sync() {
    if (syncing || !ensureUi()) return;
    syncing = true;
    try {
      const { auth } = await state();
      if (!auth.licenseKey) { updateTile('TRIAL 4H', 'warn', 'Trial contínuo de 4 horas disponível uma vez por e-mail e dispositivo.'); return; }
      const data = await call('status');
      const commercial = data?.commercial || null;
      const exp = Date.parse(commercial?.expires_at || '');
      const active = Number(commercial?.credits || 0) > 0 || (Number.isFinite(exp) && exp > Date.now());
      updateTile(tierLabel(commercial), active ? 'good' : 'warn', commercial?.subscription?.status ? `Assinatura: ${commercial.subscription.status}` : 'Entitlement comercial validado pelo backend.');
    } catch (error) {
      updateTile(error?.message === 'ENTITLEMENT_EXHAUSTED' ? 'EXPIRADO' : 'VERIFICAR', 'warn', error?.message || 'Falha no status comercial');
    } finally { syncing = false; }
  }
  function modalHtml(catalogData, hasKey) {
    const plans = (catalogData?.plans || []).map(p => `<button type="button" class="ld2-commercial-plan" data-commercial-plan="${esc(p.code)}"><b>${esc(p.name)}</b><small>R$ ${(Number(p.price_cents || 0) / 100).toFixed(2).replace('.', ',')} · recorrente</small></button>`).join('');
    return `<div class="ld2-commercial-backdrop" data-commercial-close><div class="ld2-commercial-modal" role="dialog" aria-modal="true" aria-label="Planos e Trial" data-commercial-stop><button type="button" class="ld2-commercial-x" data-commercial-close>×</button><small>BUILD 22 · COMMERCIAL PLATFORM</small><h3>Planos & Trial</h3><p>${hasKey ? 'Sua KEY atual será mantida. Assinaturas e créditos ampliam o mesmo entitlement.' : 'Teste o Decrypter por 4 horas contínuas. O trial não reinicia ao fechar o navegador.'}</p>${!hasKey ? '<label>E-mail<input type="email" data-commercial-email placeholder="voce@exemplo.com"></label><button type="button" class="ld2-commercial-primary" data-commercial-trial>Iniciar trial de 4 horas</button>' : `<label>E-mail da cobrança<input type="email" data-commercial-email placeholder="voce@exemplo.com"></label><div class="ld2-commercial-plans">${plans}</div>`}<button type="button" data-commercial-store>Comprar créditos / acesso avulso</button><p class="ld2-commercial-note">BYOK é opcional. Sua chave do provedor continua no cliente e não é armazenada pela plataforma comercial.</p><div data-commercial-result></div></div></div>`;
  }
  function addModalStyle() {
    if (document.getElementById('ld2-commercial-style')) return;
    const s = document.createElement('style'); s.id = 'ld2-commercial-style'; s.textContent = `.ld2-commercial-backdrop{position:fixed;inset:0;z-index:2147483647;background:#000b;display:grid;place-items:center;padding:18px;font-family:Arial,sans-serif}.ld2-commercial-modal{width:min(520px,100%);max-height:88vh;overflow:auto;position:relative;background:#08100deF;border:1px solid #42ff9e66;border-radius:18px;padding:22px;color:#ecfff5;box-shadow:0 24px 80px #000}.ld2-commercial-modal h3{font-size:24px;margin:6px 0}.ld2-commercial-modal p,.ld2-commercial-modal small{color:#91a59b}.ld2-commercial-modal label{display:block;font-size:12px;margin:16px 0}.ld2-commercial-modal input{width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1px solid #1e3229;background:#030806;color:#fff}.ld2-commercial-modal button{width:100%;margin-top:9px;padding:12px;border-radius:11px;border:1px solid #1e3229;background:#0c1511;color:#ecfff5;font-weight:700;cursor:pointer}.ld2-commercial-modal .ld2-commercial-primary,.ld2-commercial-plan:hover{background:#42ff9e;color:#03130b;border-color:#42ff9e}.ld2-commercial-modal .ld2-commercial-x{position:absolute;right:12px;top:8px;width:38px;font-size:22px}.ld2-commercial-plans{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ld2-commercial-plan small{display:block;margin-top:4px}.ld2-commercial-note{font-size:12px}.ld2-commercial-result{margin-top:12px;word-break:break-word}.ld2-commercial-result.error{color:#ff8c99}@media(max-width:560px){.ld2-commercial-plans{grid-template-columns:1fr}}`;
    document.documentElement.appendChild(s);
  }
  async function openPanel() {
    addModalStyle();
    const { auth } = await state();
    let c; try { c = await catalog(); } catch (e) { c = { plans: [] }; }
    const wrap = document.createElement('div'); wrap.innerHTML = modalHtml(c, Boolean(auth.licenseKey)); const modal = wrap.firstElementChild; document.documentElement.appendChild(modal);
    const result = modal.querySelector('[data-commercial-result]');
    modal.addEventListener('click', async event => {
      if (event.target.closest('[data-commercial-stop]') && !event.target.closest('[data-commercial-close]')) event.stopPropagation();
      if (event.target.closest('[data-commercial-close]')) { modal.remove(); return; }
      if (event.target.closest('[data-commercial-store]')) { window.open('https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1/ld-store', '_blank', 'noopener'); return; }
      const email = String(modal.querySelector('[data-commercial-email]')?.value || '').trim();
      if (event.target.closest('[data-commercial-trial]')) {
        try { result.className=''; result.textContent='Criando trial…'; const out=await call('trial_start',{email}); await navigator.clipboard.writeText(out.license_key).catch(()=>{}); result.innerHTML=`<b>Trial ativo até ${new Date(out.trial.expires_at).toLocaleString('pt-BR')}.</b><br>KEY copiada para a área de transferência. Cole-a no login do Decrypter.`; setTimeout(sync,500); } catch(e){ result.className='ld2-commercial-result error'; result.textContent=e?.message||'Falha ao iniciar trial'; }
        return;
      }
      const plan = event.target.closest('[data-commercial-plan]');
      if (plan) {
        try { result.className=''; result.textContent='Abrindo assinatura…'; const out=await call('subscription_create',{plan_code:plan.dataset.commercialPlan,email,client_request_id:crypto.randomUUID()}); if(out?.subscription?.init_point) window.open(out.subscription.init_point,'_blank','noopener'); result.textContent=out?.subscription?.init_point?'Checkout recorrente aberto em nova guia.':'Assinatura criada; aguardando autorização do provedor.'; setTimeout(sync,1200); } catch(e){ result.className='ld2-commercial-result error'; result.textContent=e?.message||'Falha ao criar assinatura'; }
      }
    });
  }
  function boundedInstall() { let n=0; const tick=()=>{ if(ensureUi()){sync();return;} if(++n<40)setTimeout(tick,100+n*25); }; tick(); }
  window.addEventListener('ld2:unified-launcher-ready',()=>{ensureUi();sync();});
  document.addEventListener('click',event=>{if(event.target.closest?.('#ld2-root .ld2-fab'))setTimeout(sync,180);},true);
  setInterval(()=>{ if(root()?.querySelector('.ld2-panel.open')) sync(); },30000);
  window.LovableDecrypterCommercial=Object.freeze({ sync, open:openPanel, build:22 });
  boundedInstall();
})();
