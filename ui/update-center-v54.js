(() => {
  'use strict';
  if (window.__LD54_UPDATE_CENTER__) return;
  window.__LD54_UPDATE_CENTER__ = true;

  const BUILD = 54;
  const VERSION = chrome.runtime.getManifest().version;
  const ROOT_ID = 'ld2-root';
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => [...(root?.querySelectorAll?.(selector) || [])];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);

  let overlay = null;
  let generation = 0;
  let providerInstalled = false;
  let checking = false;
  let lastCheck = null;

  function root() { return document.getElementById(ROOT_ID); }

  function toast(message, error = false) {
    const wrap = $('.ld2-toast-wrap', root());
    if (!wrap) return;
    const node = document.createElement('div');
    node.className = `ld2-toast${error ? ' error' : ''}`;
    node.textContent = String(message || '');
    wrap.appendChild(node);
    setTimeout(() => node.remove(), 3900);
  }

  function fmtDate(value) {
    if (!value) return '—';
    try { return new Date(value).toLocaleString('pt-BR'); } catch (_) { return String(value); }
  }

  function healthInfo(health) {
    const status = String(health?.status || 'unknown');
    if (status === 'healthy') return { tone:'ok', label:'SAUDÁVEL', detail:'Runtime validado após atualização.' };
    if (status === 'failed') return { tone:'bad', label:'FALHOU', detail:(health?.failures || []).join(', ') || 'Health check falhou.' };
    if (status === 'pending') return { tone:'warn', label:'PENDENTE', detail:'Aguardando relatório pós-update.' };
    return { tone:'idle', label:'SEM RELATÓRIO', detail:'Nenhuma atualização recente exige validação.' };
  }

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    const host = root();
    if (!host) return null;
    overlay = document.createElement('div');
    overlay.className = 'ld54-overlay';
    overlay.innerHTML = `
      <section class="ld54-shell" role="dialog" aria-modal="true" aria-label="Update & Recovery Center">
        <header class="ld54-head">
          <div class="ld54-title"><span class="ld54-mark">↻</span><div><small>UPDATE & RECOVERY · BUILD ${BUILD}</small><h2>Update & Recovery Center</h2><p>Atualização assinada, rollback verificável e reparo explícito do Lovable.</p></div></div>
          <div class="ld54-head-actions"><span>v${esc(VERSION)}</span><button type="button" data-ld54-close aria-label="Fechar">×</button></div>
        </header>
        <main class="ld54-body" data-ld54-body></main>
      </section>`;
    host.appendChild(overlay);
    $('[data-ld54-close]', overlay).onclick = close;
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay?.classList.contains('open')) close(); }, true);
    return overlay;
  }

  function close() {
    generation += 1;
    overlay?.classList.remove('open');
  }

  function loading(text = 'Lendo estado de atualização…') {
    const body = $('[data-ld54-body]', overlay);
    if (body) body.innerHTML = `<div class="ld54-loading"><i></i><b>${esc(text)}</b><span>Nenhum pacote é baixado ou aplicado durante esta leitura.</span></div>`;
  }

  async function snapshot() {
    const state = await runtime({ type:'LD2_RECOVERY_STATUS' });
    return {
      ...(state || {}),
      currentVersion: state?.currentVersion || VERSION,
      channel: String(state?.channel || 'stable').toLowerCase() === 'beta' ? 'beta' : 'stable'
    };
  }

  function releaseFrom(state) {
    return lastCheck?.release || state?.lastCheck?.release || null;
  }

  function render(state) {
    const body = $('[data-ld54-body]', overlay);
    if (!body) return;
    const health = healthInfo(state?.postUpdateHealth);
    const channel = state?.channel || 'stable';
    const check = lastCheck || state?.lastCheck || null;
    const release = releaseFrom(state);
    const available = !!check?.available;
    const signature = !!(release?.signature_verified || check?.signatureVerified || release?.verification_token);
    const nativeReady = channel === 'stable' && check?.browser?.status === 'update_available';
    const snapshotState = state?.snapshot || null;

    body.innerHTML = `
      <section class="ld54-stats">
        <article><small>VERSÃO ATUAL</small><b>${esc(state?.currentVersion || VERSION)}</b><span>Runtime instalado</span></article>
        <article><small>CANAL</small><b>${esc(channel.toUpperCase())}</b><span>Release selecionada</span></article>
        <article data-tone="${health.tone}"><small>HEALTH CHECK</small><b>${esc(health.label)}</b><span>${esc(health.detail)}</span></article>
        <article><small>ÚLTIMA AÇÃO</small><b>${esc(String(state?.lastAction || '—').replaceAll('_',' '))}</b><span>${esc(fmtDate(state?.updatedAt))}</span></article>
      </section>

      <section class="ld54-grid">
        <article class="ld54-card">
          <header><div><small>RELEASE CHANNEL</small><h3>Atualização assinada</h3><p>O runtime continua responsável por assinatura, SHA-256, snapshot e aplicação.</p></div><span class="ld54-badge ${signature ? 'ok' : ''}">${release ? (signature ? 'VERIFICADA' : 'NÃO VERIFICADA') : 'NÃO CONSULTADA'}</span></header>
          <div class="ld54-segmented" role="group" aria-label="Canal de atualização">
            <button type="button" data-ld54-channel="stable" class="${channel === 'stable' ? 'active' : ''}">Stable</button>
            <button type="button" data-ld54-channel="beta" class="${channel === 'beta' ? 'active' : ''}">Beta</button>
          </div>
          ${release ? `<div class="ld54-release"><div><small>VERSÃO</small><b>v${esc(release.version || '—')}</b></div><div><small>SHA-256</small><code>${esc(release.sha256 || '—')}</code></div><p>${esc(release.notes || 'Sem notas da release.')}</p></div>` : '<div class="ld54-empty">Consulte o feed assinado para verificar a versão disponível.</div>'}
          <div class="ld54-actions">
            <button type="button" class="ld54-primary" data-ld54-check>${checking ? 'Verificando…' : 'Verificar atualização'}</button>
            ${available && release && signature ? '<button type="button" data-ld54-download>Baixar pacote verificado</button>' : ''}
            ${nativeReady ? '<button type="button" data-ld54-native>Aplicar atualização nativa</button>' : ''}
          </div>
          ${check ? `<div class="ld54-result" data-tone="${available ? 'ok' : 'idle'}">${available ? `Atualização disponível: v${esc(release?.version || 'nativa')}.` : `Nenhuma versão mais nova disponível no canal ${esc(channel)}.`}</div>` : ''}
        </article>

        <article class="ld54-card">
          <header><div><small>RECOVERY</small><h3>Snapshot e rollback</h3><p>Rollback nunca é aplicado silenciosamente; o pacote anterior precisa ser verificado.</p></div></header>
          ${snapshotState ? `<div class="ld54-snapshot"><span class="ld54-snapshot-mark">◈</span><div><small>SNAPSHOT DISPONÍVEL</small><b>v${esc(snapshotState.previousVersion || '—')}</b><span>${esc(fmtDate(snapshotState.createdAt))} · ${esc(snapshotState.mode || 'manual')}</span></div></div><div class="ld54-kv"><span>Backup Vault</span><b>${snapshotState.vaultBackup?.ok ? 'OK' : snapshotState.vaultBackup?.attempted ? 'FALHOU' : 'NÃO NECESSÁRIO'}</b><span>Instalação</span><b>REINSTALAÇÃO MANUAL</b></div><button type="button" class="ld54-wide-button" data-ld54-rollback>Baixar rollback verificado</button>` : '<div class="ld54-empty tall">Nenhum snapshot anterior. Um snapshot é criado pelo runtime antes de baixar/aplicar uma atualização.</div>'}
          <button type="button" class="ld54-link-button" data-ld54-advanced>Ver detalhes avançados do Update Center</button>
        </article>
      </section>

      <section class="ld54-card ld54-repair">
        <header><div><small>REPAIR LOVABLE</small><h3>Recuperação por níveis</h3><p>Operações destrutivas permanecem no motor legado validado e exigem confirmação explícita.</p></div><span class="ld54-badge safe">NADA AUTOMÁTICO</span></header>
        <div class="ld54-repair-actions">
          <button type="button" data-ld54-clear-cache><span>1</span><div><b>Cache do Decrypter</b><small>Preserva KEY, configurações e histórico.</small></div></button>
          <button type="button" data-ld54-repair><span>∞</span><div><b>Repair Lovable</b><small>Cache, Service Worker, IndexedDB e recarga por níveis.</small></div></button>
          <button type="button" data-ld54-reload><span>↻</span><div><b>Recarregar página</b><small>Sem apagar dados locais.</small></div></button>
        </div>
      </section>`;

    $$('[data-ld54-channel]', body).forEach(button => button.onclick = () => setChannel(button.dataset.ld54Channel));
    $('[data-ld54-check]', body).onclick = checkUpdate;
    $('[data-ld54-download]', body)?.addEventListener('click', () => downloadRelease(release, channel));
    $('[data-ld54-native]', body)?.addEventListener('click', () => applyNative(channel));
    $('[data-ld54-rollback]', body)?.addEventListener('click', downloadRollback);
    $('[data-ld54-advanced]', body).onclick = openLegacyUpdate;
    $('[data-ld54-repair]', body).onclick = openRepair;
    $('[data-ld54-clear-cache]', body).onclick = clearDecrypterCache;
    $('[data-ld54-reload]', body).onclick = () => location.reload();
  }

  async function refresh() {
    const token = generation;
    try {
      const state = await snapshot();
      if (token !== generation) return false;
      render(state);
      return true;
    } catch (error) {
      const body = $('[data-ld54-body]', overlay);
      if (body) body.innerHTML = `<div class="ld54-error"><b>Não foi possível ler Update & Recovery</b><span>${esc(error?.message || String(error))}</span><button type="button" data-ld54-retry>Tentar novamente</button></div>`;
      $('[data-ld54-retry]', body)?.addEventListener('click', refresh);
      return false;
    }
  }

  async function setChannel(channel) {
    try {
      lastCheck = null;
      await runtime({ type:'LD2_UPDATE_V2_CHANNEL_SET', channel });
      toast(`Canal ${String(channel).toUpperCase()} selecionado.`);
      await refresh();
    } catch (error) { toast(error?.message || String(error), true); }
  }

  async function checkUpdate() {
    if (checking) return;
    checking = true;
    const state = await snapshot().catch(() => ({ channel:'stable' }));
    render(state);
    try {
      lastCheck = await runtime({ type:'LD2_UPDATE_V2_CHECK', channel:state.channel });
      toast(lastCheck?.available ? 'Atualização disponível.' : 'Nenhuma atualização mais nova disponível.');
    } catch (error) {
      toast(error?.message || String(error), true);
    } finally {
      checking = false;
      await refresh();
    }
  }

  async function downloadRelease(release, channel) {
    if (!release) return toast('Consulte o feed assinado novamente.', true);
    try {
      const result = await runtime({ type:'LD2_UPDATE_V2_DOWNLOAD', release, channel });
      toast(`Pacote v${result?.version || release.version || ''} verificado e enviado para Downloads.`);
      await refresh();
    } catch (error) { toast(error?.message || String(error), true); }
  }

  async function applyNative(channel) {
    if (channel !== 'stable') return toast('Atualização nativa só é aceita no canal Stable.', true);
    try {
      await runtime({ type:'LD2_UPDATE_V2_NATIVE_APPLY', channel });
      toast('Atualização nativa preparada. O navegador concluirá a troca de versão.');
      await refresh();
    } catch (error) { toast(error?.message || String(error), true); }
  }

  async function downloadRollback() {
    try {
      const result = await runtime({ type:'LD2_UPDATE_V2_ROLLBACK_DOWNLOAD' });
      toast(`Rollback v${result?.release?.version || ''} verificado. Reinstalação manual necessária.`);
      await refresh();
    } catch (error) { toast(error?.message || String(error), true); }
  }

  async function clearDecrypterCache() {
    if (!confirm('Limpar somente o cache técnico do Decrypter? KEY, configurações e histórico serão preservados.')) return;
    try {
      const result = await runtime({ type:'LD2_RECOVERY_CLEAR_DECRYPTER_CACHE' });
      toast(`Cache limpo · ${Number(result?.removedStorageKeys || 0)} chave(s) técnica(s) removida(s).`);
      await refresh();
    } catch (error) { toast(error?.message || String(error), true); }
  }

  function legacyApi() { return window.LovableDecrypterUpdateRecovery || null; }

  function openLegacyUpdate() {
    const api = legacyApi();
    close();
    if (api?.openUpdateCenter) return api.openUpdateCenter();
    toast('Motor avançado de Update & Recovery indisponível.', true);
  }

  function openRepair() {
    const api = legacyApi();
    close();
    if (api?.openRepairCenter) return api.openRepairCenter();
    toast('Motor de Repair Lovable indisponível.', true);
  }

  async function open() {
    const node = ensureOverlay();
    if (!node) return false;
    node.classList.add('open');
    generation += 1;
    lastCheck = null;
    loading();
    return refresh();
  }

  function installProvider() {
    if (providerInstalled) return true;
    const registry = window.LovableDecrypterUIActions;
    if (!registry?.register) return false;
    registry.register('update', open, { build:BUILD, suite:'update-recovery', signed:true, failClosed:true });
    providerInstalled = true;
    return true;
  }

  window.LovableDecrypterUpdateCenter = Object.freeze({ build:BUILD, version:VERSION, open, close, refresh, snapshot });

  installProvider();
  window.addEventListener('ld2:ui-mounted', installProvider, { once:true });
})();