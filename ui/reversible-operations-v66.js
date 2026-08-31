(() => {
  'use strict';
  if (window.__LD66_REVERSIBLE_UI__) return;
  window.__LD66_REVERSIBLE_UI__ = true;

  const ROOT_ID = 'ld2-root';
  let selected = null;
  let lastPreview = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const text = value => String(value ?? '').trim();
  const projectId = () => text(window.LovableDecrypterV2?.getProjectId?.());
  const api = () => window.LovableDecrypterReversibleOperations;
  const root = () => document.getElementById(ROOT_ID);

  function modalParts() {
    const r = root();
    return { modal: r?.querySelector('.ld2-modal'), card: r?.querySelector('.ld2-card') };
  }

  function toast(message, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const node = document.createElement('div');
    node.className = `ld2-toast${error ? ' error' : ''}`;
    node.textContent = message;
    wrap.appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  function installCard() {
    const grid = root()?.querySelector('.ld2-unified-shell [data-ul-section="principal"] .ld2-ul-grid');
    if (!grid || grid.querySelector('[data-ld66-open]')) return Boolean(grid);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ld2-ul-card ld66-entry';
    button.dataset.ld66Open = '1';
    button.innerHTML = '<span>↶</span><div><b>Smart Undo / Redo</b><small>Reverter operações sem apagar sua edição manual</small></div><em>66</em>';
    button.onclick = () => open().catch(error => toast(error?.message || String(error), true));
    grid.appendChild(button);
    return true;
  }

  function stateText(item) {
    if (item?.canRedo) return 'DESFEITA · REDO DISPONÍVEL';
    return 'APLICADA · UNDO DISPONÍVEL';
  }

  function operationRows(items = []) {
    if (!items.length) return '<div class="ld66-empty">Nenhuma operação reversível registrada neste projeto.</div>';
    return items.map(item => `<button type="button" class="ld66-op ${selected?.id === item.id ? 'selected' : ''}" data-ld66-op="${esc(item.id)}">
      <div><b>${esc(item.tool || 'operação')}</b><small>${esc(stateText(item))}</small></div>
      <span>${esc(String(item.commitSha || '').slice(0, 8))}</span>
      <small>${(item.paths || []).slice(0, 3).map(esc).join(' · ')}${(item.paths || []).length > 3 ? ' …' : ''}</small>
    </button>`).join('');
  }

  function actionButtons(item) {
    if (!item) return '';
    return `<div class="ld66-action-grid">
      ${item.canUndo ? '<button type="button" class="primary" data-ld66-preview="undo:preserve">Desfazer preservando alterações posteriores</button>' : ''}
      ${item.canRedo ? '<button type="button" class="primary" data-ld66-preview="redo:preserve">Refazer preservando alterações posteriores</button>' : ''}
      ${item.canUndo ? '<button type="button" data-ld66-preview="undo:replace-target">Desfazer e substituir arquivos-alvo</button>' : ''}
      ${item.canRedo ? '<button type="button" data-ld66-preview="redo:replace-target">Refazer e substituir arquivos-alvo</button>' : ''}
      ${item.canUndo ? '<button type="button" class="danger" data-ld66-preview="undo:cascade">Desfazer a operação e tudo que veio depois</button>' : ''}
      ${item.canRedo && item.state?.lastStrategy === 'cascade' ? '<button type="button" class="danger" data-ld66-preview="redo:cascade">Refazer o estado removido pelo cascade</button>' : ''}
    </div>`;
  }

  function detail(item) {
    if (!item) return '<div class="ld66-empty"><b>Selecione uma operação</b><span>Undo e Redo trabalham por operação, não por snapshot cego.</span></div>';
    return `<div class="ld66-detail-head"><div><small>OPERATION JOURNAL</small><h3>${esc(item.tool || 'Operação')}</h3><p>${esc(item.origin || 'ai')} · commit ${esc(String(item.commitSha || '').slice(0, 12))}</p></div><span class="ld66-state">${esc(stateText(item))}</span></div>
      <section><small>ARQUIVOS DA OPERAÇÃO</small><div class="ld66-paths">${(item.paths || []).map(path => `<code>${esc(path)}</code>`).join('') || '<span>Sem paths no journal.</span>'}</div></section>
      <section><small>POLÍTICA</small><p>O modo recomendado tenta inverter somente o hunk desta operação usando BASE / OPERATION / CURRENT. Edições posteriores fora do hunk são preservadas. Se a mesma região foi alterada manualmente, o Decrypter bloqueia e mostra conflito.</p></section>
      ${actionButtons(item)}
      <div data-ld66-preview-host></div>`;
  }

  function conflictMarkup(plan) {
    const conflicts = Array.isArray(plan?.conflicts) ? plan.conflicts : [];
    if (!conflicts.length) return '';
    return `<div class="ld66-conflicts"><b>Conflitos — nada será aplicado</b>${conflicts.map(item => `<p><code>${esc(item.path)}</code><span>${esc(item.message || item.code)}</span></p>`).join('')}</div>`;
  }

  function previewMarkup(preview) {
    const plan = preview?.plan || {};
    const files = Array.isArray(plan.files) ? plan.files : [];
    const deps = Array.isArray(plan.dependentOperations) ? plan.dependentOperations : [];
    const destructive = plan.destructive === true;
    return `<div class="ld66-preview ${destructive ? 'destructive' : ''}">
      <header><div><small>${esc(String(plan.direction || '').toUpperCase())} · ${esc(plan.strategy || '')}</small><h4>${plan.allowed ? 'Preview pronto' : 'Preview bloqueado'}</h4></div><span>${(plan.changes || []).length} alteração(ões)</span></header>
      ${destructive ? '<div class="ld66-danger-note"><b>Modo destrutivo</b><span>Este modo pode remover alterações posteriores. Leia o preview antes de confirmar.</span></div>' : '<div class="ld66-safe-note"><b>Preservação ativa</b><span>Alterações manuais conflitantes não são descartadas silenciosamente.</span></div>'}
      ${conflictMarkup(plan)}
      ${deps.length ? `<div class="ld66-deps"><b>Mudanças posteriores relacionadas</b>${deps.map(dep => `<span>${esc(dep.tool)} · ${(dep.paths || []).map(esc).join(', ')}</span>`).join('')}</div>` : ''}
      <div class="ld66-file-previews">${files.map(file => `<article><div><code>${esc(file.path)}</code><span>${esc(file.status)} · ${esc(file.action || 'none')}</span></div>${file.laterHumanEdits?.length ? `<small>⚠ ${file.laterHumanEdits.length} edição(ões) humana(s) posterior(es)</small>` : ''}${file.preview ? `<pre>${esc(file.preview)}</pre>` : ''}</article>`).join('')}</div>
      ${plan.strategy === 'cascade' ? `<div class="ld66-cascade"><b>CASCADE</b><span>O branch inteiro será restaurado para o snapshot ${esc(String(plan?.cascade?.destinationRef || '').slice(0, 12))}. ${(plan?.cascade?.changedPaths || []).length} path(s) serão afetados.</span></div>` : ''}
      <footer><button type="button" data-ld66-cancel-preview>Cancelar</button>${plan.allowed ? `<button type="button" class="${destructive ? 'danger' : 'primary'}" data-ld66-apply>${destructive ? (plan.strategy === 'cascade' ? 'Restaurar este snapshot' : 'Aplicar substituição destrutiva') : 'Aplicar preservando alterações'}</button>` : ''}</footer>
    </div>`;
  }

  async function loadOperations() {
    const response = await api()?.list?.(projectId(), 50);
    return response?.operations || [];
  }

  async function open() {
    if (!api()) throw new Error('Smart Undo/Redo runtime indisponível.');
    const items = await loadOperations();
    selected = items[0] || null;
    lastPreview = null;
    const { modal, card } = modalParts();
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card ld66-card';
    card.innerHTML = `<div class="ld66-head"><div><small>BUILD 66 · REVERSIBLE OPERATIONS</small><h2>Smart Undo / Redo</h2><p>Reversão por operação, 3-way merge e proteção de intenção humana.</p></div><button type="button" data-ld66-close>×</button></div><div class="ld66-layout"><aside data-ld66-list></aside><main data-ld66-detail></main></div>`;
    card.querySelector('[data-ld66-close]').onclick = () => modal.classList.remove('open');
    card.addEventListener('click', async event => {
      const row = event.target.closest?.('[data-ld66-op]');
      if (row) {
        selected = items.find(item => item.id === row.dataset.ld66Op) || null;
        lastPreview = null;
        render(items);
        return;
      }
      const previewButton = event.target.closest?.('[data-ld66-preview]');
      if (previewButton && selected) {
        const [direction, strategy] = String(previewButton.dataset.ld66Preview).split(':');
        previewButton.disabled = true;
        try {
          lastPreview = await api().preview(selected.id, { projectId: projectId(), direction, strategy });
          render(items);
        } catch (error) {
          toast(`Bloqueado: ${error?.message || error}`, true);
        } finally { previewButton.disabled = false; }
        return;
      }
      if (event.target.closest?.('[data-ld66-cancel-preview]')) {
        lastPreview = null;
        render(items);
        return;
      }
      const applyButton = event.target.closest?.('[data-ld66-apply]');
      if (applyButton && lastPreview) {
        const destructive = lastPreview?.plan?.destructive === true;
        if (destructive) {
          const label = lastPreview?.plan?.strategy === 'cascade'
            ? 'Isso restaurará o branch inteiro ao snapshot mostrado e removerá alterações posteriores. Continuar?'
            : 'Isso substituirá o estado atual dos arquivos-alvo e pode apagar alterações posteriores. Continuar?';
          if (!window.confirm(label)) return;
        }
        applyButton.disabled = true;
        try {
          const outcome = await api().apply(lastPreview.previewId, { confirmDestructive: destructive });
          toast(`${String(outcome.direction || '').toUpperCase()} aplicado · commit ${String(outcome?.result?.commitSha || '').slice(0, 8)}`);
          const refreshed = await loadOperations();
          const selectedId = selected.id;
          items.splice(0, items.length, ...refreshed);
          selected = items.find(item => item.id === selectedId) || items[0] || null;
          lastPreview = null;
          render(items);
        } catch (error) {
          toast(`Bloqueado: ${error?.message || error}`, true);
        } finally { applyButton.disabled = false; }
      }
    });
    render(items);
  }

  function render(items) {
    const card = root()?.querySelector('.ld66-card');
    if (!card) return;
    const list = card.querySelector('[data-ld66-list]');
    const detailHost = card.querySelector('[data-ld66-detail]');
    if (list) list.innerHTML = operationRows(items);
    if (detailHost) {
      detailHost.innerHTML = detail(selected);
      const previewHost = detailHost.querySelector('[data-ld66-preview-host]');
      if (previewHost && lastPreview) previewHost.innerHTML = previewMarkup(lastPreview);
    }
  }

  window.addEventListener('ld2:unified-launcher-ready', installCard);
  const observer = new MutationObserver(() => installCard());
  queueMicrotask(() => {
    installCard();
    if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  window.LovableDecrypterSmartUndoUI = Object.freeze({ open });
})();
