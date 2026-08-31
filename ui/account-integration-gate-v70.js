(() => {
  'use strict';
  if (window.__LD70_ACCOUNT_INTEGRATION_GATE__) return;
  window.__LD70_ACCOUNT_INTEGRATION_GATE__ = true;

  const ROOT_ID = 'ld2-root';
  const OVERLAY_CLASS = 'ld70-account-gate';
  const PENDING_POLL_MS = 20000;
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let overlay = null;
  let checking = false;
  let lastReady = false;
  let started = false;
  let shouldPoll = false;
  let pollTimer = 0;
  let lastRenderFingerprint = '';

  function root() { return document.getElementById(ROOT_ID); }
  function projectId() { return String(window.LovableDecrypterV2?.getProjectId?.() || ''); }

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    root()?.appendChild(overlay);
    return overlay;
  }

  function hide() {
    if (overlay) overlay.classList.remove('open');
  }

  function providerState(provider) {
    if (provider.ready) return { label:'Conectado', tone:'ok' };
    if (provider.connected) return { label:'Mapeamento pendente', tone:'warn' };
    if (provider.appConfigured) return { label:'Conta não conectada', tone:'warn' };
    return { label:'Configuração inicial pendente', tone:'bad' };
  }

  function providerDetail(kind, readiness) {
    if (kind === 'github') {
      if (readiness.ready) return readiness.repository || 'Repositório autorizado';
      if (!readiness.appConfigured) return 'Criar/configurar o GitHub App do Lovable Decrypter.';
      if (!readiness.connected) return 'Autorizar sua conta GitHub e os repositórios desejados.';
      if (!readiness.repository) return 'Selecionar o repositório deste projeto Lovable.';
      if (!readiness.repositoryAuthorized) return 'O repositório mapeado não está autorizado pela instalação atual.';
      return 'Revise a instalação e selecione novamente o repositório.';
    }
    if (readiness.ready) return readiness.projectName || readiness.projectRef || 'Projeto autorizado';
    if (!readiness.appConfigured) return 'Configurar o OAuth App do Lovable Decrypter no Supabase.';
    if (!readiness.connected) return 'Autorizar sua conta Supabase.';
    if (readiness.reauthorizeRequired) return 'Reautorizar os escopos necessários.';
    if (!readiness.projectRef) return 'Selecionar o projeto Supabase deste projeto Lovable.';
    if (!readiness.projectAuthorized) return 'O projeto mapeado não está autorizado nesta conta.';
    return 'Revise a conexão Supabase.';
  }

  function openProvider(kind) {
    const api = window.LovableDecrypterIntegrations;
    const fn = kind === 'github' ? api?.github : api?.supabase;
    if (typeof fn !== 'function') return;
    fn().catch?.(() => {});
  }

  function fingerprint(status) {
    const gh = status?.github || {};
    const sb = status?.supabase || {};
    return JSON.stringify({
      ready:!!status?.ready,
      accountReady:!!status?.account?.ready,
      gh:[!!gh.ready,!!gh.connected,!!gh.appConfigured,gh.repository||'',!!gh.repositoryAuthorized],
      sb:[!!sb.ready,!!sb.connected,!!sb.appConfigured,!!sb.reauthorizeRequired,sb.projectRef||'',!!sb.projectAuthorized]
    });
  }

  function render(status) {
    const fp = fingerprint(status);
    const node = ensureOverlay();
    if (!node) return;
    if (fp === lastRenderFingerprint && node.classList.contains('open')) return;
    lastRenderFingerprint = fp;
    const gh = providerState(status.github || {});
    const sb = providerState(status.supabase || {});
    node.innerHTML = `
      <section class="ld70-card" role="dialog" aria-modal="true" aria-label="Conecte GitHub e Supabase">
        <header class="ld70-head">
          <div class="ld70-mark">LD</div>
          <div><small>CONFIGURAÇÃO OBRIGATÓRIA</small><h2>Conecte GitHub e Supabase</h2><p>O Decrypter precisa das duas contas para alterar frontend e backend com autorização verificável.</p></div>
        </header>
        <main class="ld70-body">
          <article class="ld70-provider ${gh.tone}">
            <div class="ld70-provider-top"><span class="ld70-provider-mark">GH</span><div><b>GitHub</b><small>${esc(gh.label)}</small></div></div>
            <p>${esc(providerDetail('github', status.github || {}))}</p>
            <button type="button" data-ld70-provider="github">${status.github?.ready ? 'Revisar GitHub' : 'Conectar GitHub'}</button>
          </article>
          <article class="ld70-provider ${sb.tone}">
            <div class="ld70-provider-top"><span class="ld70-provider-mark sb">SB</span><div><b>Supabase</b><small>${esc(sb.label)}</small></div></div>
            <p>${esc(providerDetail('supabase', status.supabase || {}))}</p>
            <button type="button" data-ld70-provider="supabase">${status.supabase?.ready ? 'Revisar Supabase' : 'Conectar Supabase'}</button>
          </article>
        </main>
        <footer class="ld70-foot"><span>Nenhum PAT, service_role, senha ou token de instalação é salvo na extensão.</span><button type="button" data-ld70-refresh>Atualizar estado</button></footer>
      </section>`;
    node.classList.add('open');
    node.querySelectorAll('[data-ld70-provider]').forEach(button => button.addEventListener('click', () => openProvider(button.dataset.ld70Provider)));
    $('[data-ld70-refresh]', node)?.addEventListener('click', () => refreshNow());
  }

  function cancelPoll() {
    clearTimeout(pollTimer);
    pollTimer = 0;
  }

  function schedulePoll() {
    cancelPoll();
    if (!started || !shouldPoll || document.hidden) return;
    pollTimer = setTimeout(async () => {
      await check().catch(() => {});
      schedulePoll();
    }, PENDING_POLL_MS);
  }

  async function check(force = false) {
    if (checking) return null;
    const api = window.LovableDecrypterAccountIntegrationGate;
    if (!api?.status || !root()) return null;
    checking = true;
    try {
      const status = await api.status(projectId());
      const accountReady = !!status?.account?.ready;
      shouldPoll = accountReady && !status?.ready;
      if (!accountReady) {
        lastReady = false;
        lastRenderFingerprint = '';
        hide();
        return status;
      }
      if (status.ready) {
        hide();
        if (!lastReady) window.dispatchEvent(new CustomEvent('ld70:account-integrations-ready', { detail:status }));
        lastReady = true;
        shouldPoll = false;
        cancelPoll();
        return status;
      }
      lastReady = false;
      render(status);
      return status;
    } catch (_) {
      shouldPoll = false;
      if (lastReady) lastReady = false;
      return null;
    } finally {
      checking = false;
      if (force) schedulePoll();
    }
  }

  async function refreshNow() {
    cancelPoll();
    await check(true).catch(() => {});
    schedulePoll();
  }

  function start() {
    if (started) return;
    started = true;
    check().finally(schedulePoll);
  }

  window.addEventListener('ld2:ui-mounted', start, { once:true });
  window.addEventListener('ld2:github-connected', () => setTimeout(refreshNow, 300));
  window.addEventListener('ld2:supabase-connected', () => setTimeout(refreshNow, 300));
  window.addEventListener('ld2:settings-changed', () => setTimeout(refreshNow, 300));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelPoll();
    else if (started) refreshNow();
  });
  if (document.readyState !== 'loading') setTimeout(start, 0);
})();
