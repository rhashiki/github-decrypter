(() => {
  'use strict';
  if (window.__LD70_ACCOUNT_INTEGRATION_GATE__) return;
  window.__LD70_ACCOUNT_INTEGRATION_GATE__ = true;

  const ROOT_ID = 'ld2-root';
  const OVERLAY_CLASS = 'ld70-account-gate';
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let overlay = null;
  let checking = false;
  let lastReady = false;
  let started = false;

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

  function render(status) {
    const node = ensureOverlay();
    if (!node) return;
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
    $('[data-ld70-refresh]', node)?.addEventListener('click', () => check(true));
  }

  async function check(force = false) {
    if (checking && !force) return;
    const api = window.LovableDecrypterAccountIntegrationGate;
    if (!api?.status || !root()) return;
    checking = true;
    try {
      const status = await api.status(projectId());
      if (!status?.account?.ready) {
        hide();
        return;
      }
      if (status.ready) {
        hide();
        if (!lastReady) window.dispatchEvent(new CustomEvent('ld70:account-integrations-ready', { detail:status }));
        lastReady = true;
        return;
      }
      lastReady = false;
      render(status);
    } catch (_) {
      // Fail-closed write protection remains in the background. The visual gate
      // stays visible only after Decrypter login has been established.
      if (lastReady) lastReady = false;
    } finally {
      checking = false;
    }
  }

  function start() {
    if (started) return;
    started = true;
    check().catch(() => {});
    setInterval(() => {
      const providerModalOpen = Boolean(document.querySelector('#ld2-root .ld49-overlay.open'));
      if (!providerModalOpen) check().catch(() => {});
    }, 8000);
  }

  window.addEventListener('ld2:ui-mounted', start, { once:true });
  window.addEventListener('ld2:github-connected', () => setTimeout(() => check(true), 300));
  window.addEventListener('ld2:supabase-connected', () => setTimeout(() => check(true), 300));
  window.addEventListener('ld2:settings-changed', () => setTimeout(() => check(true), 300));
  if (document.readyState !== 'loading') setTimeout(start, 0);
})();
