(() => {
  'use strict';
  if (window.__LD40_PRODUCTIVITY_SUITE__) return;
  window.__LD40_PRODUCTIVITY_SUITE__ = true;

  const ROOT_ID = 'ld2-root';
  const RECENTS_KEY = 'ld40_productivity_recents';
  const FAVORITES_KEY = 'ld40_productivity_favorites';
  const MAX_RECENTS = 8;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const ACTIONS = Object.freeze([
    { id:'chat', title:'Chat IA', group:'Engenharia', description:'Voltar ao composer do Decrypter', shortcut:'', selectors:['[data-action="chat"]'] },
    { id:'brain', title:'Project Brain', group:'Inteligência', description:'Treinar e consultar o contexto do projeto', shortcut:'', selectors:['[data-cc-action="train"]','[data-action="train"]'] },
    { id:'rules', title:'Project Rules', group:'Inteligência', description:'Gerenciar regras permanentes do projeto', shortcut:'', selectors:['[data-cc-intel="rules"]'] },
    { id:'impact', title:'Impact Map', group:'Inteligência', description:'Visualizar arquivos, dependências e risco', shortcut:'', selectors:['[data-cc-intel="impact"]'] },
    { id:'explain', title:'Explain Project', group:'Inteligência', description:'Resumo técnico sem nova chamada Gemini', shortcut:'', selectors:['[data-cc-intel="explain"]'] },
    { id:'skills', title:'Skills', group:'Produtividade', description:'Comandos reutilizáveis salvos', shortcut:'Ctrl+Shift+S', selectors:['[data-cc-action="skills"]','[data-action="skills"]'] },
    { id:'queue', title:'Fila / Batch', group:'Produtividade', description:'Executar tarefas em sequência', shortcut:'Ctrl+Shift+Q', selectors:['[data-cc-batch]'] },
    { id:'notes', title:'Notas rápidas', group:'Produtividade', description:'Scratchpad local ligado ao projeto', shortcut:'Ctrl+Shift+N', custom:'notes' },
    { id:'history', title:'Histórico', group:'Produtividade', description:'Pesquisar planos e aplicações recentes', shortcut:'Ctrl+Shift+H', custom:'history' },
    { id:'github', title:'GitHub', group:'Integrações', description:'Repositório, branch e sincronização', shortcut:'', selectors:['[data-cc-github]','[data-action="github"]'] },
    { id:'supabase', title:'Supabase', group:'Integrações', description:'Projeto e infraestrutura conectada', shortcut:'', selectors:['[data-cc-supabase]','[data-sbm-open]'] },
    { id:'zip', title:'Baixar ZIP', group:'Projeto', description:'Gerar snapshot do projeto', shortcut:'', selectors:['[data-cc-action="zip"]','[data-action="zip"]'] },
    { id:'diagnosis', title:'Diagnóstico', group:'Sistema', description:'Verificar configuração e runtime', shortcut:'', selectors:['[data-cc-action="diag"]','[data-action="diag"]'] },
    { id:'update', title:'Update Center', group:'Sistema', description:'Verificar atualizações disponíveis', shortcut:'', selectors:['[data-cc-action="update"]','[data-action="update"]'] },
    { id:'settings', title:'Configurações', group:'Sistema', description:'Credenciais e preferências', shortcut:'', selectors:['[data-cc-settings]','[data-settings]'] }
  ]);

  let palette = null;
  let activeIndex = 0;
  let currentList = [];
  let saveTimer = 0;

  function root() { return document.getElementById(ROOT_ID); }
  function projectId() { return window.LovableDecrypterV2?.getProjectId?.() || ''; }
  function runtime(message) {
    const api = window.LovableDecrypterV2;
    if (!api?.runtime) return Promise.reject(new Error('Runtime do Decrypter indisponível.'));
    return api.runtime(message);
  }

  function toast(message, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const node = document.createElement('div');
    node.className = `ld2-toast${error ? ' error' : ''}`;
    node.textContent = message;
    wrap.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  async function readLocal(key, fallback) {
    try { const data = await chrome.storage.local.get(key); return data[key] ?? fallback; }
    catch (_) { return fallback; }
  }

  async function writeLocal(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }

  async function recordRecent(id) {
    const prev = await readLocal(RECENTS_KEY, []);
    const next = [id, ...prev.filter(x => x !== id)].slice(0, MAX_RECENTS);
    await writeLocal(RECENTS_KEY, next);
  }

  function findAction(id) { return ACTIONS.find(action => action.id === id); }

  function findTarget(action) {
    const r = root();
    if (!r) return null;
    for (const selector of action.selectors || []) {
      const node = r.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  async function runAction(action) {
    if (!action) return;
    closePalette();
    await recordRecent(action.id);
    if (action.custom === 'notes') return openNotes();
    if (action.custom === 'history') return openHistory();
    const target = findTarget(action);
    if (!target) return toast(`${action.title} ainda não terminou de inicializar.`, true);
    target.click();
  }

  async function toggleFavorite(id) {
    const current = await readLocal(FAVORITES_KEY, []);
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    await writeLocal(FAVORITES_KEY, next);
    await renderPalette($('.ld40-palette-input', palette)?.value || '');
  }

  function paletteMarkup() {
    return `<div class="ld40-palette-backdrop" data-ld40-close></div>
      <section class="ld40-palette" role="dialog" aria-modal="true" aria-label="Produtividade">
        <header class="ld40-palette-head">
          <div><span class="ld40-eyebrow">LOVABLE DECRYPTER</span><h2>Produtividade</h2></div>
          <kbd>Esc</kbd>
        </header>
        <label class="ld40-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg><input class="ld40-palette-input" type="search" placeholder="Buscar ação, ferramenta ou atalho…" autocomplete="off"></label>
        <div class="ld40-palette-list" role="listbox"></div>
        <footer><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>★</kbd> favorito</span></footer>
      </section>`;
  }

  async function ensurePalette() {
    if (palette?.isConnected) return palette;
    const r = root();
    if (!r) return null;
    palette = document.createElement('div');
    palette.className = 'ld40-palette-shell';
    palette.hidden = true;
    palette.innerHTML = paletteMarkup();
    r.appendChild(palette);
    palette.addEventListener('click', async event => {
      if (event.target.closest('[data-ld40-close]')) return closePalette();
      const fav = event.target.closest('[data-ld40-favorite]');
      if (fav) { event.preventDefault(); event.stopPropagation(); return toggleFavorite(fav.dataset.ld40Favorite); }
      const item = event.target.closest('[data-ld40-action]');
      if (item) return runAction(findAction(item.dataset.ld40Action));
    });
    const input = $('.ld40-palette-input', palette);
    input.addEventListener('input', () => renderPalette(input.value));
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-1); }
      else if (event.key === 'Enter') { event.preventDefault(); runAction(currentList[activeIndex]); }
      else if (event.key === 'Escape') { event.preventDefault(); closePalette(); }
    });
    return palette;
  }

  function scoreAction(action, query) {
    if (!query) return 1;
    const haystack = `${action.title} ${action.group} ${action.description} ${action.shortcut}`.toLocaleLowerCase('pt-BR');
    const words = query.toLocaleLowerCase('pt-BR').split(/\s+/).filter(Boolean);
    return words.every(word => haystack.includes(word)) ? words.reduce((score, word) => score + (action.title.toLocaleLowerCase('pt-BR').includes(word) ? 3 : 1), 0) : 0;
  }

  async function renderPalette(query = '') {
    if (!palette) return;
    const list = $('.ld40-palette-list', palette);
    const favorites = await readLocal(FAVORITES_KEY, []);
    const recents = await readLocal(RECENTS_KEY, []);
    const filtered = ACTIONS.map(action => ({ action, score:scoreAction(action, query) })).filter(x => x.score > 0);
    filtered.sort((a,b) => {
      const af = favorites.includes(a.action.id) ? 1 : 0, bf = favorites.includes(b.action.id) ? 1 : 0;
      if (af !== bf) return bf - af;
      const ar = recents.indexOf(a.action.id), br = recents.indexOf(b.action.id);
      if (ar !== br) return (ar < 0 ? 999 : ar) - (br < 0 ? 999 : br);
      return b.score - a.score || a.action.title.localeCompare(b.action.title, 'pt-BR');
    });
    currentList = filtered.map(x => x.action);
    activeIndex = Math.min(activeIndex, Math.max(0, currentList.length - 1));
    if (!currentList.length) {
      list.innerHTML = '<div class="ld40-empty">Nenhuma ação encontrada.</div>';
      return;
    }
    let previousGroup = '';
    list.innerHTML = currentList.map((action, index) => {
      const group = action.group !== previousGroup ? `<div class="ld40-group">${esc(action.group)}</div>` : '';
      previousGroup = action.group;
      const favored = favorites.includes(action.id);
      return `${group}<div class="ld40-command ${index === activeIndex ? 'active' : ''}" role="option" aria-selected="${index === activeIndex}" data-ld40-action="${action.id}">
        <div class="ld40-command-copy"><b>${esc(action.title)}</b><small>${esc(action.description)}</small></div>
        <div class="ld40-command-meta">${action.shortcut ? `<kbd>${esc(action.shortcut)}</kbd>` : ''}<button type="button" class="ld40-favorite${favored ? ' active' : ''}" data-ld40-favorite="${action.id}" aria-label="${favored ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">★</button></div>
      </div>`;
    }).join('');
  }

  function moveActive(delta) {
    if (!currentList.length) return;
    activeIndex = (activeIndex + delta + currentList.length) % currentList.length;
    const commands = $$('.ld40-command', palette);
    commands.forEach((node, index) => {
      node.classList.toggle('active', index === activeIndex);
      node.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');
    });
    commands[activeIndex]?.scrollIntoView({ block:'nearest' });
  }

  async function openPalette() {
    const shell = await ensurePalette();
    if (!shell) return;
    shell.hidden = false;
    activeIndex = 0;
    const input = $('.ld40-palette-input', shell);
    input.value = '';
    await renderPalette('');
    requestAnimationFrame(() => input.focus());
  }

  function closePalette() {
    if (!palette) return;
    palette.hidden = true;
  }

  function notesKey() { return `ld2_notes_${projectId() || 'global'}`; }

  async function openNotes() {
    const r = root();
    if (!r) return;
    closeUtility();
    const key = notesKey();
    const value = await readLocal(key, '');
    const shell = document.createElement('div');
    shell.className = 'ld40-utility-shell';
    shell.dataset.ld40Utility = 'notes';
    shell.innerHTML = `<div class="ld40-utility-backdrop" data-ld40-utility-close></div><section class="ld40-utility ld40-notes" role="dialog" aria-modal="true" aria-label="Notas rápidas">
      <header><div><span class="ld40-eyebrow">PRODUTIVIDADE</span><h2>Notas rápidas</h2><small>${esc(projectId() ? `Projeto ${projectId().slice(0,12)}…` : 'Notas globais')}</small></div><button type="button" data-ld40-utility-close aria-label="Fechar">×</button></header>
      <textarea data-ld40-note placeholder="Anote decisões, pendências, links e lembretes do projeto…">${esc(value)}</textarea>
      <footer><span data-ld40-note-status>Salvo localmente</span><div><button type="button" data-ld40-timestamp>Inserir horário</button><button type="button" data-ld40-copy>Copiar</button></div></footer>
    </section>`;
    r.appendChild(shell);
    const note = $('[data-ld40-note]', shell), status = $('[data-ld40-note-status]', shell);
    const save = async () => { await writeLocal(key, note.value); status.textContent = `Salvo · ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`; };
    note.addEventListener('input', () => { status.textContent = 'Salvando…'; clearTimeout(saveTimer); saveTimer = setTimeout(() => save().catch(() => status.textContent = 'Falha ao salvar'), 450); });
    shell.addEventListener('click', async event => {
      if (event.target.closest('[data-ld40-utility-close]')) { clearTimeout(saveTimer); await save().catch(()=>{}); shell.remove(); return; }
      if (event.target.closest('[data-ld40-timestamp]')) {
        const stamp = `[${new Date().toLocaleString('pt-BR')}] `;
        const start = note.selectionStart, end = note.selectionEnd;
        note.setRangeText(stamp, start, end, 'end'); note.dispatchEvent(new Event('input')); note.focus();
      }
      if (event.target.closest('[data-ld40-copy]')) {
        try { await navigator.clipboard.writeText(note.value); toast('Notas copiadas.'); } catch (_) { toast('Não foi possível copiar as notas.', true); }
      }
    });
    requestAnimationFrame(() => note.focus());
  }

  async function openHistory() {
    const r = root();
    if (!r) return;
    closeUtility();
    let items = [];
    try { items = await runtime({ type:'LD2_HISTORY_GET' }) || []; }
    catch (error) { return toast(error?.message || String(error), true); }
    const shell = document.createElement('div');
    shell.className = 'ld40-utility-shell';
    shell.dataset.ld40Utility = 'history';
    shell.innerHTML = `<div class="ld40-utility-backdrop" data-ld40-utility-close></div><section class="ld40-utility ld40-history" role="dialog" aria-modal="true" aria-label="Histórico">
      <header><div><span class="ld40-eyebrow">PRODUTIVIDADE</span><h2>Histórico</h2><small>${items.length} registro(s) disponíveis</small></div><button type="button" data-ld40-utility-close aria-label="Fechar">×</button></header>
      <label class="ld40-history-search"><input type="search" data-ld40-history-search placeholder="Pesquisar comando, resumo ou repositório…"></label>
      <div class="ld40-history-list" data-ld40-history-list></div>
    </section>`;
    r.appendChild(shell);
    const input = $('[data-ld40-history-search]', shell), list = $('[data-ld40-history-list]', shell);
    const draw = query => {
      const q = String(query || '').trim().toLocaleLowerCase('pt-BR');
      const rows = items.filter(item => !q || `${item.command || ''} ${item.summary || ''} ${item.repo || ''} ${item.type || ''}`.toLocaleLowerCase('pt-BR').includes(q)).slice(0,100);
      list.innerHTML = rows.length ? rows.map(item => `<article class="ld40-history-item"><div><span class="ld40-history-type ${item.type === 'apply' ? 'apply' : ''}">${item.type === 'apply' ? 'APLICADO' : 'PLANO'}</span><time>${esc(item.at ? new Date(item.at).toLocaleString('pt-BR') : '—')}</time></div><b>${esc(item.command || 'Sem comando')}</b><small>${esc([item.repo,item.summary].filter(Boolean).join(' · '))}</small></article>`).join('') : '<div class="ld40-empty">Nenhum registro encontrado.</div>';
    };
    draw('');
    input.addEventListener('input', () => draw(input.value));
    shell.addEventListener('click', event => { if (event.target.closest('[data-ld40-utility-close]')) shell.remove(); });
    requestAnimationFrame(() => input.focus());
  }

  function closeUtility() { root()?.querySelectorAll('[data-ld40-utility]').forEach(node => node.remove()); }

  function installRailButton() {
    const r = root();
    const list = r?.querySelector('.ld3-rail-list');
    if (!list || list.querySelector('[data-ld40-productivity]')) return !!list;
    const activity = list.querySelector('[data-rail-id="activity"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ld3-rail-btn ld40-productivity-rail';
    button.dataset.ld40Productivity = '1';
    button.setAttribute('aria-label','Produtividade');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5Z"/><path d="M8 8h8"/><path d="M8 12h5"/><path d="m14 16 2 2 3-4"/></svg><span class="ld3-rail-tip">Produtividade</span>';
    button.addEventListener('click', event => { event.preventDefault(); openPalette(); });
    if (activity?.nextSibling) list.insertBefore(button, activity.nextSibling); else list.appendChild(button);
    return true;
  }

  function shortcutHandler(event) {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return;
    const key = event.key.toLowerCase();
    if (!event.shiftKey && key === 'k') { event.preventDefault(); event.stopPropagation(); openPalette(); return; }
    if (!event.shiftKey) return;
    if (key === 'n') { event.preventDefault(); event.stopPropagation(); openNotes(); }
    else if (key === 'h') { event.preventDefault(); event.stopPropagation(); openHistory(); }
    else if (key === 's') { event.preventDefault(); event.stopPropagation(); runAction(findAction('skills')); }
    else if (key === 'q') { event.preventDefault(); event.stopPropagation(); runAction(findAction('queue')); }
  }

  document.addEventListener('keydown', shortcutHandler, true);
  document.addEventListener('click', event => {
    const notes = event.target.closest?.('#ld2-root [data-action="notes"]');
    if (notes) { event.preventDefault(); event.stopImmediatePropagation(); openNotes(); return; }
    const history = event.target.closest?.('#ld2-root [data-action="history"], #ld2-root [data-cc-action="history"]');
    if (history) { event.preventDefault(); event.stopImmediatePropagation(); openHistory(); }
  }, true);

  const delivery = window.LovableDecrypterDeliveryScheduler;
  if (delivery?.register) delivery.register('build40:productivity-rail', () => installRailButton(), { interval:100, maxAttempts:120 });
  else queueMicrotask(installRailButton);

  window.addEventListener('ld3:design-system-ready', installRailButton);
  window.LovableDecrypterProductivitySuite = Object.freeze({
    build:40,
    open:openPalette,
    notes:openNotes,
    history:openHistory,
    run:id => runAction(findAction(id)),
    actions:ACTIONS.map(({id,title,group,shortcut}) => ({id,title,group,shortcut}))
  });
})();
