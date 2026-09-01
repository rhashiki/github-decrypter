(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_UPDATE_RECOVERY_UI__) return;
  window.__LOVABLE_DECRYPTER_UPDATE_RECOVERY_UI__ = true;

  const ROOT_ID = 'ld2-root';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  let fullRepairArmedUntil = 0;

  function send(type, payload = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, ...payload }, response => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.ok) return reject(new Error(response?.error || 'Falha no Update & Recovery.'));
        resolve(response.data);
      });
    });
  }

  function root() { return document.getElementById(ROOT_ID); }
  function toast(text, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function modal(title, subtitle) {
    const r = root();
    const wrap = r?.querySelector('.ld2-modal');
    const card = r?.querySelector('.ld2-card');
    if (!wrap || !card) return null;
    wrap.classList.add('open');
    card.className = 'ld2-card ld2-ur-card';
    card.innerHTML = `<header class="ld2-ur-head"><div><small>BUILD 14 · UPDATE & RECOVERY</small><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button type="button" data-ur-close>×</button></header><main class="ld2-ur-body"><div class="ld2-ur-loading">Carregando estado real…</div></main>`;
    $('[data-ur-close]', card).onclick = () => wrap.classList.remove('open');
    return card;
  }

  function fmtDate(value) {
    if (!value) return '—';
    try { return new Date(value).toLocaleString('pt-BR'); } catch { return String(value); }
  }

  function healthBadge(health) {
    const status = String(health?.status || 'unknown');
    const label = status === 'healthy' ? 'SAUDÁVEL' : status === 'failed' ? 'FALHOU' : status === 'pending' ? 'PENDENTE' : 'SEM RELATÓRIO';
    const cls = status === 'healthy' ? 'good' : status === 'failed' ? 'bad' : 'warn';
    return `<span class="ld2-ur-badge ${cls}">${label}</span>`;
  }

  async function openUpdateCenter() {
    const card = modal('Update Center', 'Atualizações assinadas, canais e rollback verificável.');
    if (!card) return;
    try {
      const state = await send('LD2_RECOVERY_STATUS');
      renderUpdate(card, state);
    } catch (error) {
      $('.ld2-ur-body', card).innerHTML = `<div class="ld2-ur-error">${esc(error?.message || error)}</div>`;
    }
  }

  async function renderUpdate(card, state, checkResult = null) {
    const body = $('.ld2-ur-body', card);
    if (!body) return;
    const channel = String(state?.channel || 'stable');
    const health = state?.postUpdateHealth || null;
    const snapshot = state?.snapshot || null;
    const release = checkResult?.release || state?.lastCheck?.release || null;
    const available = !!checkResult?.available;
    const browserNative = checkResult?.browser?.status === 'update_available';
    const signature = release?.signature_verified || checkResult?.signatureVerified;

    body.innerHTML = `
      <section class="ld2-ur-summary">
        <div><small>VERSÃO ATUAL</small><b>${esc(state?.currentVersion || chrome.runtime.getManifest().version)}</b></div>
        <div><small>CANAL</small><b>${channel.toUpperCase()}</b></div>
        <div><small>HEALTH CHECK</small>${healthBadge(health)}</div>
      </section>

      <section class="ld2-ur-section">
        <div class="ld2-ur-section-head"><div><small>CANAL DE RELEASE</small><h3>Stable / Beta</h3></div></div>
        <div class="ld2-ur-segmented">
          <button type="button" data-ur-channel="stable" class="${channel === 'stable' ? 'active' : ''}">Stable</button>
          <button type="button" data-ur-channel="beta" class="${channel === 'beta' ? 'active' : ''}">Beta</button>
        </div>
        <p class="ld2-ur-help">Stable aceita atualização nativa quando o navegador oferecer. Beta usa pacote assinado verificado.</p>
      </section>

      <section class="ld2-ur-section">
        <div class="ld2-ur-section-head"><div><small>RELEASE ASSINADA</small><h3>${release ? `v${esc(release.version)}` : 'Ainda não consultada'}</h3></div>${release ? `<span class="ld2-ur-badge ${signature ? 'good' : 'bad'}">${signature ? 'ASSINATURA OK' : 'NÃO VERIFICADA'}</span>` : ''}</div>
        ${release ? `<div class="ld2-ur-kv"><span>SHA-256</span><code>${esc(release.sha256 || '—')}</code><span>Canal</span><b>${esc(release.channel || channel)}</b><span>Notas</span><b>${esc(release.notes || '—')}</b></div>` : '<p class="ld2-ur-help">Consulte o feed para verificar a release disponível.</p>'}
        <div class="ld2-ur-actions">
          <button type="button" class="primary" data-ur-check>Verificar atualização</button>
          ${available && release ? '<button type="button" data-ur-download>Baixar pacote verificado</button>' : ''}
          ${available && browserNative && channel === 'stable' ? '<button type="button" data-ur-native>Aplicar atualização nativa</button>' : ''}
        </div>
        ${checkResult ? `<p class="ld2-ur-result ${available ? 'good' : ''}">${available ? `Atualização disponível: v${esc(release?.version || 'nativa')}.` : `Nenhuma versão mais nova disponível no canal ${esc(channel)}.`}</p>` : ''}
      </section>

      <section class="ld2-ur-section">
        <div class="ld2-ur-section-head"><div><small>ROLLBACK</small><h3>${snapshot?.previousVersion ? `Snapshot v${esc(snapshot.previousVersion)}` : 'Nenhum snapshot'}</h3></div></div>
        ${snapshot ? `<div class="ld2-ur-kv"><span>Criado</span><b>${esc(fmtDate(snapshot.createdAt))}</b><span>Modo</span><b>${esc(snapshot.mode || '—')}</b><span>Backup Vault</span><b>${snapshot.vaultBackup?.ok ? 'OK' : snapshot.vaultBackup?.attempted ? 'FALHOU' : 'NÃO NECESSÁRIO'}</b></div><p class="ld2-ur-help">Rollback de código em instalação manual exige reinstalar o pacote anterior. O Decrypter verifica assinatura e SHA antes de baixá-lo.</p><div class="ld2-ur-actions"><button type="button" data-ur-rollback>Baixar rollback verificado</button></div>` : '<p class="ld2-ur-help">Um snapshot é criado antes de baixar/aplicar uma atualização.</p>'}
      </section>`;

    body.querySelectorAll('[data-ur-channel]').forEach(btn => btn.onclick = async () => {
      try {
        const result = await send('LD2_UPDATE_V2_CHANNEL_SET', { channel: btn.dataset.urChannel });
        const fresh = await send('LD2_RECOVERY_STATUS');
        fresh.channel = result.channel;
        renderUpdate(card, fresh);
      } catch (e) { toast(e?.message || String(e), true); }
    });
    $('[data-ur-check]', body).onclick = async event => {
      const btn = event.currentTarget; btn.disabled = true; btn.textContent = 'Verificando…';
      try {
        const result = await send('LD2_UPDATE_V2_CHECK', { channel });
        const fresh = await send('LD2_RECOVERY_STATUS');
        renderUpdate(card, fresh, result);
      } catch (e) { toast(e?.message || String(e), true); btn.disabled = false; btn.textContent = 'Verificar atualização'; }
    };
    const download = $('[data-ur-download]', body);
    if (download) download.onclick = async () => {
      download.disabled = true; download.textContent = 'Verificando SHA e baixando…';
      try {
        const result = await send('LD2_UPDATE_V2_DOWNLOAD', { release, channel });
        toast(`Pacote v${result.version} verificado por SHA-256 e enviado para Downloads.`);
        const fresh = await send('LD2_RECOVERY_STATUS'); renderUpdate(card, fresh, checkResult);
      } catch (e) { toast(e?.message || String(e), true); download.disabled = false; download.textContent = 'Baixar pacote verificado'; }
    };
    const nativeBtn = $('[data-ur-native]', body);
    if (nativeBtn) nativeBtn.onclick = async () => {
      nativeBtn.disabled = true; nativeBtn.textContent = 'Preparando update nativo…';
      try { await send('LD2_UPDATE_V2_NATIVE_APPLY', { channel }); toast('Atualização nativa preparada. O navegador concluirá a troca de versão.'); }
      catch (e) { toast(e?.message || String(e), true); nativeBtn.disabled = false; nativeBtn.textContent = 'Aplicar atualização nativa'; }
    };
    const rollback = $('[data-ur-rollback]', body);
    if (rollback) rollback.onclick = async () => {
      rollback.disabled = true; rollback.textContent = 'Verificando rollback…';
      try {
        const result = await send('LD2_UPDATE_V2_ROLLBACK_DOWNLOAD');
        toast(`Rollback v${result.release.version} verificado. Reinstalação manual será necessária.`);
        const fresh = await send('LD2_RECOVERY_STATUS'); renderUpdate(card, fresh, checkResult);
      } catch (e) { toast(e?.message || String(e), true); rollback.disabled = false; rollback.textContent = 'Baixar rollback verificado'; }
    };
  }

  async function deleteCacheStorage() {
    if (typeof caches === 'undefined') return { supported: false, deleted: 0 };
    const names = await caches.keys();
    const result = await Promise.all(names.map(name => caches.delete(name)));
    return { supported: true, deleted: result.filter(Boolean).length, total: names.length };
  }

  async function unregisterServiceWorkers() {
    if (!navigator.serviceWorker?.getRegistrations) return { supported: false, removed: 0 };
    const regs = await navigator.serviceWorker.getRegistrations();
    const sameOrigin = regs.filter(reg => {
      try { return new URL(reg.scope).origin === location.origin; } catch { return false; }
    });
    const result = await Promise.all(sameOrigin.map(reg => reg.unregister().catch(() => false)));
    return { supported: true, removed: result.filter(Boolean).length, total: sameOrigin.length };
  }

  function deleteDatabase(name) {
    return new Promise(resolve => {
      let done = false;
      const finish = ok => { if (done) return; done = true; resolve(ok); };
      try {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => finish(true);
        req.onerror = () => finish(false);
        req.onblocked = () => setTimeout(() => finish(false), 900);
        setTimeout(() => finish(false), 3000);
      } catch (_) { finish(false); }
    });
  }

  async function clearIndexedDb() {
    if (!indexedDB?.databases) return { supported: false, deleted: 0, reason: 'indexedDB.databases indisponível' };
    const dbs = await indexedDB.databases();
    const names = [...new Set(dbs.map(db => db?.name).filter(Boolean))];
    const result = await Promise.all(names.map(deleteDatabase));
    return { supported: true, deleted: result.filter(Boolean).length, total: names.length };
  }

  async function executeRepair(kind) {
    if (kind === 'decrypter') return send('LD2_RECOVERY_CLEAR_DECRYPTER_CACHE');
    if (kind === 'cache') return deleteCacheStorage();
    if (kind === 'sw') return unregisterServiceWorkers();
    if (kind === 'idb') return clearIndexedDb();
    if (kind === 'reload') { location.reload(); return { reloading: true }; }
    if (kind === 'full') {
      const [decrypter, cache, sw, idb] = await Promise.all([
        send('LD2_RECOVERY_CLEAR_DECRYPTER_CACHE'),
        deleteCacheStorage(),
        unregisterServiceWorkers(),
        clearIndexedDb()
      ]);
      setTimeout(() => location.reload(), 250);
      return { decrypter, cache, sw, idb, reloading: true };
    }
    throw new Error('Tipo de reparo desconhecido.');
  }

  async function openRepairCenter() {
    const card = modal('Repair Lovable', 'Recuperação explícita por níveis. Nada é apagado automaticamente.');
    if (!card) return;
    const body = $('.ld2-ur-body', card);
    body.innerHTML = `
      <div class="ld2-ur-warning"><b>Atenção</b><span>Service Workers e IndexedDB pertencem ao domínio do Lovable. Limpá-los pode remover sessão/cache local e exige recarregar a página.</span></div>
      <section class="ld2-ur-repair-grid">
        ${repairCard('decrypter','1','Cache do Decrypter','Limpa cache de repositório, planos pendentes e Cache Storage da extensão. Preserva KEY, configurações e histórico.')}
        ${repairCard('cache','2','Cache Storage do Lovable','Apaga somente entradas da Cache Storage disponíveis para esta origem.')}
        ${repairCard('sw','3','Service Workers do Lovable','Desregistra apenas Service Workers cujo scope pertence ao domínio atual.')}
        ${repairCard('idb','4','IndexedDB do Lovable','Apaga bancos IndexedDB desta origem. Pode exigir novo login.','danger')}
        ${repairCard('reload','5','Recarregar página','Recarrega a aba atual sem apagar dados.')}
        ${repairCard('full','∞','Reparo completo','Executa cache Decrypter + Cache Storage + Service Workers + IndexedDB e recarrega.','danger')}
      </section>
      <div class="ld2-ur-repair-log" data-ur-repair-log><small>RESULTADO</small><p>Nenhuma ação executada.</p></div>`;

    body.querySelectorAll('[data-ur-repair]').forEach(btn => btn.onclick = async () => {
      const kind = btn.dataset.urRepair;
      const log = $('[data-ur-repair-log] p', body);
      if (kind === 'idb' && !confirm('Apagar o IndexedDB do Lovable nesta origem? Isso pode exigir novo login.')) return;
      if (kind === 'sw' && !confirm('Desregistrar os Service Workers do Lovable nesta origem? A página será recarregada depois se necessário.')) return;
      if (kind === 'full') {
        if (Date.now() > fullRepairArmedUntil) {
          fullRepairArmedUntil = Date.now() + 10000;
          btn.textContent = 'CONFIRMAR REPARO COMPLETO';
          log.textContent = 'Reparo completo armado por 10 segundos. Clique novamente para confirmar.';
          return;
        }
      }
      const original = btn.textContent; btn.disabled = true; btn.textContent = 'Executando…';
      try {
        const result = await executeRepair(kind);
        log.textContent = JSON.stringify(result);
        toast(`Reparo ${kind} concluído.`);
        if (kind !== 'reload' && kind !== 'full') { btn.disabled = false; btn.textContent = original; }
      } catch (error) {
        log.textContent = error?.message || String(error);
        toast(error?.message || String(error), true);
        btn.disabled = false; btn.textContent = original;
      }
    });
  }

  function repairCard(kind, icon, title, text, tone = '') {
    return `<article class="ld2-ur-repair ${tone}"><span>${icon}</span><div><b>${esc(title)}</b><small>${esc(text)}</small></div><button type="button" data-ur-repair="${kind}">Executar</button></article>`;
  }

  document.addEventListener('click', event => {
    const update = event.target.closest?.('#ld2-root .ld2-unified-shell [data-ul-action="update"]');
    if (update) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      openUpdateCenter(); return;
    }
    const repair = event.target.closest?.('#ld2-root .ld2-unified-shell [data-ul-action="repair"]');
    if (repair) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      openRepairCenter();
    }
  }, true);

  window.LovableDecrypterUpdateRecovery = Object.freeze({
    openUpdateCenter,
    openRepairCenter,
    clearLovableCacheStorage: deleteCacheStorage,
    unregisterLovableServiceWorkers: unregisterServiceWorkers,
    clearLovableIndexedDb: clearIndexedDb,
    build: 14
  });
})();
