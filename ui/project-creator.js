(() => {
  'use strict';
  if (window.__LD2_PROJECT_CREATOR_UI__) return;
  window.__LD2_PROJECT_CREATOR_UI__ = true;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const moneyish = value => Number.isFinite(Number(value)) ? String(Number(value)) : '—';
  let workspaces = [];

  function root() { return document.getElementById('ld2-root'); }
  function modalParts() {
    const r = root();
    return { root: r, modal: r?.querySelector('.ld2-modal'), card: r?.querySelector('.ld2-card') };
  }
  function close() { modalParts().modal?.classList.remove('open'); }

  function toast(message, error = false) {
    const r = root();
    const wrap = r?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  function open(html) {
    const { modal, card } = modalParts();
    if (!modal || !card) return null;
    card.innerHTML = `<div class="ld2-project-create-modal">${html}</div>`;
    modal.classList.add('open');
    card.querySelector('[data-pcreate-close]')?.addEventListener('click', close);
    return card;
  }

  function shell(body) {
    return `<div class="ld2-project-create-head"><div><span>＋</span><div><small>LOVABLE PROJECT</small><h2>Novo projeto</h2></div></div><button type="button" data-pcreate-close aria-label="Fechar">×</button></div><div class="ld2-project-create-body">${body}</div>`;
  }

  function workspaceOption(ws) {
    const limits = `Build ${moneyish(ws.totalRemaining)} · Diário ${moneyish(ws.dailyRemaining)}`;
    return `<option value="${esc(ws.id)}">${esc(ws.name)} · ${esc(limits)}</option>`;
  }

  function selectedWorkspace(card) {
    const id = card.querySelector('[data-pcreate-workspace]')?.value || '';
    return workspaces.find(ws => ws.id === id) || null;
  }

  function refreshWorkspaceDetail(card) {
    const ws = selectedWorkspace(card);
    const box = card.querySelector('[data-pcreate-workspace-detail]');
    if (!box) return;
    if (!ws) { box.innerHTML = '<span>Workspace não selecionado.</span>'; return; }
    box.innerHTML = `<div><small>WORKSPACE</small><b>${esc(ws.name)}</b></div><div><small>BUILD DISPONÍVEL</small><b>${esc(moneyish(ws.totalRemaining))}</b></div><div><small>DIÁRIO</small><b>${esc(moneyish(ws.dailyRemaining))}</b></div>${ws.outOfBuildCredits ? '<div class="warn"><small>STATUS</small><b>Sem Build credits</b></div>' : ''}`;
  }

  async function load() {
    const card = open(shell('<div class="ld2-project-create-loading"><span></span><b>Lendo workspaces do Lovable…</b><small>A sessão é usada somente em memória.</small></div>'));
    if (!card) return;
    try {
      const creator = window.LovableDecrypterProjectCreator;
      if (!creator?.listWorkspaces) throw new Error('Project Creator não foi carregado. Recarregue a página.');
      const result = await creator.listWorkspaces();
      workspaces = Array.isArray(result?.workspaces) ? result.workspaces : [];
      if (!workspaces.length) throw new Error('Nenhum workspace Lovable disponível para esta conta.');
      renderForm();
    } catch (error) {
      const errorCard = open(shell(`<div class="ld2-project-create-error"><b>Não foi possível preparar a criação</b><p>${esc(error?.message || String(error))}</p><button type="button" class="primary" data-pcreate-retry>Tentar novamente</button></div>`));
      errorCard?.querySelector('[data-pcreate-retry]')?.addEventListener('click', load);
    }
  }

  function renderForm() {
    const card = open(shell(`
      <div class="ld2-project-create-intro"><b>Criar projeto vazio no Lovable</b><p>Esta ação cria somente o projeto. Nenhum prompt será enviado ao agente do Lovable.</p></div>
      <label><span>Nome do projeto</span><input type="text" data-pcreate-name maxlength="80" autocomplete="off" placeholder="Meu novo projeto"></label>
      <label><span>Workspace</span><select data-pcreate-workspace>${workspaces.map(workspaceOption).join('')}</select></label>
      <div class="ld2-project-create-workspace" data-pcreate-workspace-detail></div>
      <div class="ld2-project-create-facts"><div><span>Template</span><b>Modern · vazio</b></div><div><span>Visibilidade</span><b>Privado</b></div><div><span>Prompt automático</span><b>Não</b></div></div>
      <div class="ld2-project-create-warning">A extensão não envia mensagem ao Lovable nesta operação. Limites, elegibilidade ou eventual cobrança da criação são definidos pelo próprio Lovable e são verificados pela resposta da plataforma.</div>
      <div class="ld2-project-create-actions"><button type="button" data-pcreate-close>Cancelar</button><button type="button" class="primary" data-pcreate-review>Revisar criação</button></div>`));
    if (!card) return;
    card.querySelector('[data-pcreate-workspace]')?.addEventListener('change', () => refreshWorkspaceDetail(card));
    card.querySelector('[data-pcreate-name]')?.focus();
    refreshWorkspaceDetail(card);
    card.querySelector('[data-pcreate-review]')?.addEventListener('click', () => review(card));
  }

  function review(card) {
    const name = String(card.querySelector('[data-pcreate-name]')?.value || '').trim();
    const ws = selectedWorkspace(card);
    if (!name) return toast('Digite um nome para o projeto.', true);
    if (!ws) return toast('Selecione um workspace.', true);
    const reviewCard = open(shell(`
      <div class="ld2-project-create-review"><span class="ready">✓</span><h3>Confirmar criação</h3><p>Nenhum prompt será enviado ao Lovable.</p></div>
      <div class="ld2-project-create-summary"><div><small>PROJETO</small><b>${esc(name)}</b></div><div><small>WORKSPACE</small><b>${esc(ws.name)}</b></div><div><small>TIPO</small><b>Modern · privado · vazio</b></div></div>
      <div class="ld2-project-create-actions"><button type="button" data-pcreate-back>Voltar</button><button type="button" class="primary" data-pcreate-confirm>Criar no Lovable</button></div>`));
    reviewCard?.querySelector('[data-pcreate-back]')?.addEventListener('click', renderForm);
    reviewCard?.querySelector('[data-pcreate-confirm]')?.addEventListener('click', event => createNow(reviewCard, ws.id, name, event.currentTarget));
  }

  async function createNow(card, workspaceId, name, button) {
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Criando…';
    try {
      const result = await window.LovableDecrypterProjectCreator.createProject({ workspaceId, name });
      card.innerHTML = shell(`<div class="ld2-project-create-success"><span>✓</span><h3>Projeto criado</h3><p><b>${esc(result.name)}</b> foi criado no Lovable sem envio automático de prompt.</p><div class="ld2-project-create-project-id">${esc(result.id)}</div><div class="ld2-project-create-actions"><button type="button" data-pcreate-close>Ficar aqui</button><button type="button" class="primary" data-pcreate-open>Abrir projeto</button></div></div>`);
      card.querySelector('[data-pcreate-close]')?.addEventListener('click', close);
      card.querySelector('[data-pcreate-open]')?.addEventListener('click', () => {
        const url = String(result.url || '');
        if (/^https:\/\/lovable\.dev\/projects\/[a-z0-9-]+$/i.test(url)) location.assign(url);
      });
      toast('Projeto Lovable criado com sucesso.');
    } catch (error) {
      toast(error?.message || String(error), true);
      button.disabled = false;
      button.textContent = original;
    }
  }

  function ensureButton() {
    const r = root();
    if (!r || r.querySelector('[data-cc-new-project]')) return !!r?.querySelector('[data-cc-new-project]');
    const grid = r.querySelector('.ld2-cc-section .ld2-cc-grid');
    if (!grid) return false;
    const button = document.createElement('button');
    button.className = 'ld2-cc-card accent';
    button.type = 'button';
    button.dataset.ccNewProject = '1';
    button.innerHTML = '<span>＋</span><div><b>Novo projeto</b><small>Criar projeto vazio diretamente no Lovable</small></div>';
    button.addEventListener('click', load);
    grid.prepend(button);
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (ensureButton() || attempts >= 120) clearInterval(timer);
  }, 500);
  setTimeout(ensureButton, 0);
})();
