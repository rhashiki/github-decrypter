(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_BUILD17_RECONCILIATION__) return;
  window.__LOVABLE_DECRYPTER_BUILD17_RECONCILIATION__ = true;

  const ROOT_ID = 'ld2-root';
  const LAST_KEY = 'ld2_gateway_last_v1';
  const ROUTES_KEY = 'ld2_gateway_operation_routes_v1';
  const MAX_ROUTES = 200;
  const STATUS_TTL = 30_000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  let statusCache = null;
  let statusAt = 0;

  function root() { return document.getElementById(ROOT_ID); }
  function api() { return window.LovableDecrypterV2; }
  function modeLabel(value) { return ({ auto: 'AUTOMÁTICO', fast: 'RÁPIDO', deep: 'PROFUNDO' })[String(value || 'auto')] || 'AUTOMÁTICO'; }

  async function settings() {
    try { return await api()?.runtime?.({ type: 'LD2_SETTINGS_GET' }) || {}; }
    catch (_) { return {}; }
  }

  async function status(force = false) {
    const now = Date.now();
    if (!force && statusCache && now - statusAt < STATUS_TTL) return statusCache;
    const s = await settings();
    const base = String(s?.auth?.backendBase || '').replace(/\/+$/, '');
    const licenseKey = String(s?.auth?.licenseKey || '');
    const deviceId = String(s?.auth?.deviceId || '');
    if (!base || !licenseKey || !deviceId) return { ok: false, code: 'GATEWAY_AUTH_UNAVAILABLE', settings: s };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(`${base}/ld-model-gateway`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-license-key': licenseKey, 'x-device-id': deviceId },
        body: JSON.stringify({ action: 'status' }),
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));
      statusCache = { ...body, ok: response.ok && body?.ok !== false, settings: s };
      statusAt = now;
      return statusCache;
    } catch (error) {
      statusCache = { ok: false, code: error?.name === 'AbortError' ? 'GATEWAY_TIMEOUT' : (error?.message || 'GATEWAY_UNAVAILABLE'), settings: s };
      statusAt = now;
      return statusCache;
    } finally {
      clearTimeout(timer);
    }
  }

  async function lastRoute() {
    const data = await chrome.storage.local.get(LAST_KEY).catch(() => ({}));
    return data?.[LAST_KEY] || null;
  }

  async function operationRoutes() {
    const data = await chrome.storage.local.get(ROUTES_KEY).catch(() => ({}));
    return data?.[ROUTES_KEY] && typeof data[ROUTES_KEY] === 'object' ? data[ROUTES_KEY] : {};
  }

  async function mapRouteToActive(route) {
    if (!route?.authoritative) return;
    const live = window.LovableDecrypterLiveOperations?.snapshot?.();
    const candidates = Array.isArray(live?.active) ? live.active : [];
    if (!candidates.length) return;
    const target = [...candidates].sort((a, b) => Number(b.updatedAt || b.startedAt || 0) - Number(a.updatedAt || a.startedAt || 0))[0];
    if (!target?.id) return;
    const routes = await operationRoutes();
    routes[String(target.id)] = {
      schema: String(route.schema || 'ld-model-gateway/1'),
      requested_mode: String(route.requested_mode || 'auto'),
      profile: String(route.profile || ''),
      provider: String(route.provider || ''),
      model: String(route.model || ''),
      reason: String(route.reason || '').slice(0, 500),
      fallback: route.fallback ? {
        applied: route.fallback.applied === true,
        from: String(route.fallback.from || ''),
        to: String(route.fallback.to || ''),
        reason: String(route.fallback.reason || '').slice(0, 240)
      } : { applied: false, from: '', to: '', reason: '' },
      authoritative: route.authoritative === true,
      resolved_at: String(route.resolved_at || route.at || new Date().toISOString())
    };
    const entries = Object.entries(routes).slice(-MAX_ROUTES);
    await chrome.storage.local.set({ [ROUTES_KEY]: Object.fromEntries(entries) });
    patchActivity();
  }

  function addCard() {
    const grid = root()?.querySelector('.ld2-unified-shell [data-ul-section="intelligence"] .ld2-ul-grid');
    if (!grid) return null;
    let card = grid.querySelector('[data-ul-action="model-gateway"]');
    if (!card) {
      card = document.createElement('button');
      card.type = 'button';
      card.className = 'ld2-ul-card';
      card.dataset.ulAction = 'model-gateway';
      card.innerHTML = '<span>GW</span><div><b>Model Gateway</b><small>Decrypter AI · roteamento automático</small></div><em data-ul-badge="model-gateway" data-state="warn">VERIFICANDO</em>';
      const knowledge = grid.querySelector('[data-ul-action="knowledge"]');
      if (knowledge?.nextSibling) grid.insertBefore(card, knowledge.nextSibling);
      else grid.appendChild(card);
    }
    return card;
  }

  async function reconcile(force = false) {
    const r = root();
    if (!r) return false;
    r.dataset.ld2Build = '17';
    const hero = r.querySelector('.ld2-unified-shell .ld2-ul-hero small');
    if (hero && hero.textContent !== 'LOVABLE DECRYPTER · BUILD 17') hero.textContent = 'LOVABLE DECRYPTER · BUILD 17';
    const card = addCard();
    if (!card) return false;
    const [state, last] = await Promise.all([status(force), lastRoute()]);
    const currentMode = String(state?.settings?.gateway?.mode || 'auto');
    const badge = card.querySelector('[data-ul-badge="model-gateway"]');
    if (badge) {
      badge.textContent = state?.ok && state?.active !== false ? modeLabel(currentMode) : 'DEGRADADO';
      badge.dataset.state = state?.ok && state?.active !== false ? 'good' : 'warn';
    }
    card.title = state?.ok
      ? `Autoridade: servidor · modo ${modeLabel(currentMode)} · última rota ${last?.provider || '—'} / ${last?.model || '—'}`
      : `Gateway degradado: ${state?.code || 'indisponível'}`;

    const tile = r.querySelector('.ld2-unified-shell [data-ul-status="ai"]');
    if (tile) {
      const label = tile.querySelector('small');
      const value = tile.querySelector('b');
      if (label) label.textContent = 'Decrypter AI';
      if (value) value.textContent = modeLabel(currentMode);
      tile.dataset.state = state?.ok ? 'good' : 'warn';
      tile.title = last?.model ? `${last.provider || 'provider'} · ${last.model} · perfil ${last.profile || '—'}` : 'Model Gateway aguardando primeira execução.';
    }
    return true;
  }

  function providerMarkup(providers = []) {
    return (Array.isArray(providers) ? providers : []).map(provider => {
      const state = provider.active ? '<span class="ld2-ul-diag-good">ATIVO</span>' : '<span class="ld2-ul-diag-warn">INATIVO</span>';
      const deferred = provider.deferred_build ? ` · Build ${provider.deferred_build}` : provider.deferred ? ' · futuro' : '';
      return `<div>${esc(provider.label || provider.id)}</div><div>${state}${esc(deferred)}</div>`;
    }).join('');
  }

  async function openGateway() {
    const r = root();
    const modal = r?.querySelector('.ld2-modal');
    const card = r?.querySelector('.ld2-card');
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card ld2-cloud-card';
    card.innerHTML = '<div class="ld2-modal-head"><div><small>BUILD 17 · MODEL GATEWAY</small><h2>Decrypter AI</h2><p>O Decrypter escolhe o perfil; o backend resolve provider e modelo.</p></div><button class="ld2-close" type="button" data-b17-close>×</button></div><div class="ld2-modal-body"><p class="ld2-help">Consultando Gateway…</p></div>';
    $('[data-b17-close]', card).onclick = () => modal.classList.remove('open');

    const [state, last] = await Promise.all([status(true), lastRoute()]);
    const current = String(state?.settings?.gateway?.mode || 'auto');
    const body = $('.ld2-modal-body', card);
    if (!body) return;
    body.innerHTML = `<div class="ld2-kv">
      <div>Gateway</div><div>${state?.ok ? '<span class="ld2-ul-diag-good">ATIVO</span>' : '<span class="ld2-ul-diag-warn">DEGRADADO</span>'} · ld-model-gateway/1</div>
      <div>Autoridade</div><div>Servidor · fail-closed</div>
      <div>Modo atual</div><div>${esc(modeLabel(current))}</div>
      <div>Último perfil</div><div>${esc(last?.profile || '—')}</div>
      <div>Último provider</div><div>${esc(last?.provider || '—')}</div>
      <div>Último modelo</div><div>${esc(last?.model || '—')}</div>
      <div>Fallback</div><div>${last?.fallback?.applied ? `${esc(last.fallback.from)} → ${esc(last.fallback.to)} · ${esc(last.fallback.reason)}` : 'nenhum'}</div>
      <div>Cross-provider fallback</div><div><span class="ld2-ul-diag-good">DESATIVADO</span></div>
      ${providerMarkup(state?.providers)}
    </div>
    <section style="margin-top:16px"><small>MODO DE ROTEAMENTO</small><div class="ld2-mode-row" style="margin-top:8px">
      <button type="button" data-b17-mode="auto" class="${current === 'auto' ? 'active' : ''}">Automático</button>
      <button type="button" data-b17-mode="fast" class="${current === 'fast' ? 'active' : ''}">Rápido</button>
      <button type="button" data-b17-mode="deep" class="${current === 'deep' ? 'active' : ''}">Profundo</button>
    </div></section>
    <p class="ld2-help" style="margin-top:12px">Automático usa o risco/intenção do Execution Brief. Rápido favorece o perfil de baixa latência. Profundo força o perfil de maior capacidade. O servidor reaplica a política ZERO COST e nunca troca para outro provider silenciosamente.</p>`;
    card.querySelectorAll('[data-b17-mode]').forEach(button => button.onclick = async () => {
      const next = String(button.dataset.b17Mode || 'auto');
      try {
        await api()?.runtime?.({ type: 'LD2_SETTINGS_PATCH', patch: { gateway: { mode: next } } });
        statusCache = null;
        statusAt = 0;
        await reconcile(true);
        openGateway();
      } catch (error) {
        const help = document.createElement('p');
        help.className = 'ld2-help';
        help.textContent = error?.message || String(error);
        body.appendChild(help);
      }
    });
  }

  async function patchActivity() {
    const r = root();
    const detail = r?.querySelector('.ld2-activity-card [data-activity-detail]');
    const selected = r?.querySelector('.ld2-activity-card .ld2-activity-row.selected');
    if (!detail || !selected?.dataset?.activityId) return;
    detail.querySelector('[data-b17-gateway-activity]')?.remove();
    const routes = await operationRoutes();
    const route = routes[String(selected.dataset.activityId)];
    if (!route) return;
    const section = document.createElement('section');
    section.dataset.b17GatewayActivity = '1';
    section.innerHTML = `<small>MODEL GATEWAY</small><div class="ld2-activity-telemetry"><span>${esc(modeLabel(route.requested_mode))} → ${esc(String(route.profile || '').toUpperCase())} · ${esc(route.provider || '—')} · ${esc(route.model || '—')}</span>${route.fallback?.applied ? `<span>Fallback: ${esc(route.fallback.from)} → ${esc(route.fallback.to)} · ${esc(route.fallback.reason)}</span>` : '<span>Fallback: nenhum</span>'}</div>`;
    detail.appendChild(section);
  }

  document.addEventListener('click', event => {
    const gateway = event.target.closest?.('#ld2-root .ld2-unified-shell [data-ul-action="model-gateway"]');
    if (gateway) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openGateway();
      return;
    }
    if (event.target.closest?.('#ld2-root [data-activity-id], #ld2-root [data-activity-open]')) setTimeout(patchActivity, 40);
  }, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[LAST_KEY]?.newValue) {
      mapRouteToActive(changes[LAST_KEY].newValue);
      reconcile(false);
    }
    if (changes[ROUTES_KEY]) patchActivity();
  });
  window.addEventListener('ld2:activity-operation', () => setTimeout(patchActivity, 30));
  window.addEventListener('ld2:activity-history', () => setTimeout(patchActivity, 30));
  window.addEventListener('ld2:unified-launcher-ready', () => reconcile(true));
  window.addEventListener('ld2:ui-mounted', () => reconcile(true));

  window.LovableDecrypterBuild17 = Object.freeze({ build: 17, schema: 'ld-model-gateway/1', status, reconcile, open: openGateway, patchActivity });

  let attempts = 0;
  const bounded = () => {
    Promise.resolve(reconcile(attempts === 0)).then(done => {
      if (!done && ++attempts < 30) setTimeout(bounded, 100 + attempts * 25);
    });
  };
  bounded();
})();
