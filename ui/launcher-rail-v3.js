(() => {
  'use strict';
  if (window.__LD3_PREMIUM_RAIL__) return;
  window.__LD3_PREMIUM_RAIL__ = true;

  const ROOT_ID = 'ld2-root';
  const COMMUNITY_URL = 'https://chat.whatsapp.com/BRBQfHORPYeFb7KJHicKYh?s=cl&p=a&mlu=4';
  const MONITOR_KEY = 'ld2_monitor_enabled';
  const VERSION = chrome.runtime.getManifest().version;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  let shell = null;
  let railMask = null;
  let rail = null;
  let flyout = null;
  let detail = null;
  let activeCategory = '';
  let activeItem = '';
  let closeTimer = 0;
  let mounted = false;
  let panelObserver = null;
  let gateObserver = null;

  const ICONS = Object.freeze({
    integrations: '<svg viewBox="0 0 24 24"><path d="M8 7V5a3 3 0 0 1 6 0v2"/><path d="M5 7h12v5a6 6 0 0 1-12 0Z"/><path d="M11 18v3"/><path d="M8 21h6"/></svg>',
    project: '<svg viewBox="0 0 24 24"><path d="M3.5 6.5h6l1.7 2H20.5v10H3.5Z"/><path d="M3.5 6.5v-2h6l1.5 2"/></svg>',
    intelligence: '<svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M8.2 14.7A6 6 0 1 1 15.8 14.7c-1 .7-1.8 1.6-1.8 2.3h-4c0-.7-.8-1.6-1.8-2.3Z"/><path d="M12 2v2"/><path d="m4.9 5 1.4 1.4"/><path d="m19.1 5-1.4 1.4"/></svg>',
    engineering: '<svg viewBox="0 0 24 24"><path d="m14.8 4.3 4.9 4.9"/><path d="M13.5 5.6 4.2 14.9 3 21l6.1-1.2 9.3-9.3"/><path d="m11.5 7.6 4.9 4.9"/></svg>',
    recovery: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/><path d="M12 8v4l2.5 1.5"/></svg>',
    activity: '<svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
    monitor: '<svg viewBox="0 0 24 24"><path d="M12 3v8"/><path d="M7.2 5.6a8 8 0 1 0 9.6 0"/></svg>',
    security: '<svg viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6Z"/><path d="m9 12 2 2 4-4"/></svg>',
    update: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>',
    account: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
    community: '<svg viewBox="0 0 24 24"><path d="M7 19.5 4 21l1-3.5A8 8 0 1 1 7 19.5Z"/><path d="M8.5 10.2c.7 2 2.2 3.5 4.3 4.3"/><path d="M8.2 8.2c.3-.4.8-.4 1.1 0l1 1.5c.2.3.2.6 0 .9l-.6.8"/><path d="m12.6 14.2.8-.6c.3-.2.6-.2.9 0l1.5 1c.4.3.4.8 0 1.1"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/><path d="M4 12h5"/><path d="M13 12h7"/><circle cx="11" cy="12" r="2"/></svg>',
    github: '<svg viewBox="0 0 24 24"><path d="M12 2.7a9.4 9.4 0 0 0-3 18.3c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.7-1.3-2.3-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.8-.3 2.8 1a9.6 9.6 0 0 1 5.1 0c2-1.3 2.8-1 2.8-1a3.6 3.6 0 0 1 .1 2.7 3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7 1 .7 2v3c0 .3.2.6.7.5A9.4 9.4 0 0 0 12 2.7Z"/></svg>',
    lovable: '<svg viewBox="0 0 24 24"><path d="M12 20.5S4 15.6 4 9.4A4.4 4.4 0 0 1 12 6.8a4.4 4.4 0 0 1 8 2.6c0 6.2-8 11.1-8 11.1Z"/></svg>',
    gemini: '<svg viewBox="0 0 24 24"><path d="M12 2c.7 5.7 4.3 9.3 10 10-5.7.7-9.3 4.3-10 10-.7-5.7-4.3-9.3-10-10 5.7-.7 9.3-4.3 10-10Z"/></svg>',
    zip: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h5"/><path d="M10 3v3h2V9h-2v3h2v3h-2"/></svg>',
    brain: '<svg viewBox="0 0 24 24"><path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 2.8A3.2 3.2 0 0 0 7 14v1a3 3 0 0 0 3 3h2V6a2 2 0 0 0-3-2Z"/><path d="M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 2.8A3.2 3.2 0 0 1 17 14v1a3 3 0 0 1-3 3h-2"/></svg>',
    rules: '<svg viewBox="0 0 24 24"><path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><path d="m3 6 1 1 2-2"/><path d="m3 12 1 1 2-2"/><path d="m3 18 1 1 2-2"/></svg>',
    skills: '<svg viewBox="0 0 24 24"><path d="m12 3 2.1 4.3L19 8l-3.5 3.4.8 4.8L12 14l-4.3 2.2.8-4.8L5 8l4.9-.7Z"/><path d="M12 14v7"/></svg>',
    explain: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.9 1.7c-.9.8-1.7 1.2-1.7 2.3"/><path d="M12 17h.01"/></svg>',
    impact: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3"/><path d="M22 12h-3"/><path d="M12 22v-3"/><path d="M2 12h3"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4Z"/><path d="M8 9h8"/><path d="M8 12h5"/></svg>',
    queue: '<svg viewBox="0 0 24 24"><path d="M5 6h14"/><path d="M5 12h14"/><path d="M5 18h9"/><path d="m17 16 3 2-3 2"/></svg>',
    diagnostics: '<svg viewBox="0 0 24 24"><path d="M4 19h16"/><path d="M6 16V9"/><path d="M10 16V5"/><path d="M14 16v-4"/><path d="M18 16V7"/></svg>',
    history: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/><path d="M12 8v4l3 2"/></svg>',
    notes: '<svg viewBox="0 0 24 24"><path d="M5 3h14v18H5Z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>'
  });

  const SUPABASE_ICON = '<svg viewBox="0 0 128 128"><defs><linearGradient id="ld3-sb-a" x1="53.974" x2="94.163" y1="54.974" y2="71.829" gradientTransform="translate(29.387 60.096) scale(1.1436)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#249361"/><stop offset="1" stop-color="#3ecf8e"/></linearGradient><linearGradient id="ld3-sb-b" x1="36.156" x2="54.484" y1="30.578" y2="65.081" gradientTransform="translate(29.387 60.096) scale(1.1436)" gradientUnits="userSpaceOnUse"><stop offset="0"/><stop offset="1" stop-opacity="0"/></linearGradient></defs><path fill="url(#ld3-sb-a)" d="M102.24 186.21c-3.267 4.117-9.904 1.862-9.977-3.397l-1.156-76.906h51.715c9.365 0 14.587 10.817 8.763 18.149z" transform="translate(-27.722 -60.338)"/><path fill="url(#ld3-sb-b)" fill-opacity=".2" d="M102.24 186.21c-3.267 4.117-9.904 1.862-9.977-3.397l-1.156-76.906h51.715c9.365 0 14.587 10.817 8.763 18.149z" transform="translate(-27.722 -60.338)"/><path fill="#3ecf8e" d="M53.484 2.128c3.267-4.117 9.905-1.862 9.977 3.396l.508 76.907H12.902c-9.365 0-14.587-10.817-8.764-18.149z"/></svg>';

  const ACTION_SELECTORS = Object.freeze({
    github: ['[data-cc-github]','[data-action="github"]'],
    supabase: ['[data-cc-supabase]','[data-sbm-open]'],
    project: ['[data-cc-new-project]'],
    zip: ['[data-cc-action="zip"]','[data-action="zip"]'],
    cloud: ['[data-cc-action="cloud-migrate"]'],
    brain: ['[data-cc-action="train"]','[data-action="train"]'],
    rules: ['[data-cc-intel="rules"]'],
    skills: ['[data-cc-action="skills"]','[data-action="skills"]'],
    explain: ['[data-cc-intel="explain"]'],
    impact: ['[data-cc-intel="impact"]'],
    chat: ['[data-action="chat"]'],
    queue: ['[data-cc-batch]'],
    diagnosis: ['[data-cc-action="diag"]','[data-action="diag"]'],
    history: ['[data-cc-action="history"]','[data-action="history"]'],
    notes: ['[data-action="notes"]'],
    update: ['[data-cc-action="update"]','[data-action="update"]'],
    license: ['[data-action="license"]'],
    settings: ['[data-cc-settings]','[data-settings]']
  });

  const CATEGORIES = Object.freeze({
    integrations: {
      label: 'Integrações',
      items: [
        { id:'github', icon:'github', title:'GitHub', subtitle:'Repositório, branch e sincronização', action:'github', badge:'Git' },
        { id:'supabase', icon:'supabase', title:'Supabase', subtitle:'Projeto, OAuth e infraestrutura', action:'supabase', badge:'Cloud' },
        { id:'lovable', icon:'lovable', title:'Lovable', subtitle:'Workspace e criação de projeto', action:'project', badge:'Project' },
        { id:'gemini', icon:'gemini', title:'Gemini', subtitle:'Modelo e configuração da IA', action:'settings', badge:'AI' }
      ]
    },
    project: {
      label: 'Projeto',
      items: [
        { id:'workspace', icon:'project', title:'Workspace', subtitle:'Projeto e arquivos do Lovable', action:'project', badge:'Project' },
        { id:'zip', icon:'zip', title:'Baixar ZIP', subtitle:'Exportar uma cópia do projeto', action:'zip', badge:'ZIP' },
        { id:'cloud', icon:'supabase', title:'Cloud Migrator', subtitle:'Lovable Cloud para Supabase', action:'cloud', badge:'Migrate' },
        { id:'github-project', icon:'github', title:'GitHub Sync', subtitle:'Mapeamento do projeto no repositório', action:'github', badge:'Sync' }
      ]
    },
    intelligence: {
      label: 'Inteligência',
      items: [
        { id:'brain', icon:'brain', title:'Project Brain', subtitle:'Memória técnica do projeto', action:'brain', badge:'Brain' },
        { id:'rules', icon:'rules', title:'Project Rules', subtitle:'Regras permanentes e contexto', action:'rules', badge:'Rules' },
        { id:'skills', icon:'skills', title:'Skills', subtitle:'Capacidades e preferências', action:'skills', badge:'Skills' },
        { id:'explain', icon:'explain', title:'Explain Project', subtitle:'Arquitetura e paths importantes', action:'explain', badge:'Explain' },
        { id:'impact', icon:'impact', title:'Impact Maps', subtitle:'Dependências, alcance e risco', action:'impact', badge:'Map' }
      ]
    },
    engineering: {
      label: 'Engenharia',
      items: [
        { id:'chat', icon:'chat', title:'Decrypter Chat', subtitle:'Planejar e construir com o agente', action:'chat', badge:'Chat' },
        { id:'composer', icon:'engineering', title:'Editor Direto', subtitle:'Focar o composer nativo protegido', action:'editor', badge:'Direct' },
        { id:'queue', icon:'queue', title:'Queue', subtitle:'Execução sequencial e controlada', action:'queue', badge:'Queue' },
        { id:'diagnostics-engineering', icon:'diagnostics', title:'Diagnóstico', subtitle:'Saúde da execução e integrações', action:'diagnosis', badge:'Health' }
      ]
    },
    recovery: {
      label: 'Recovery',
      items: [
        { id:'diagnosis', icon:'diagnostics', title:'Error Intelligence', subtitle:'Erros, causas e recuperação', action:'diagnosis', badge:'EIC' },
        { id:'project-recovery', icon:'recovery', title:'Project Recovery', subtitle:'Reconciliação e recuperação do projeto', action:'diagnosis', badge:'Doctor' },
        { id:'update-recovery', icon:'update', title:'Update & Recovery', subtitle:'Atualização e mecanismos de recuperação', action:'update', badge:'Update' }
      ]
    },
    activity: {
      label: 'Atividade',
      items: [
        { id:'history', icon:'history', title:'Histórico', subtitle:'Execuções, commits e alterações', action:'history', badge:'Log' },
        { id:'notes', icon:'notes', title:'Notas rápidas', subtitle:'Anotações ligadas ao projeto', action:'notes', badge:'Notes' },
        { id:'activity-diagnostics', icon:'activity', title:'Operações', subtitle:'Estado atual e atividade técnica', action:'diagnosis', badge:'Live' }
      ]
    }
  });

  const RAIL_ITEMS = Object.freeze([
    { type:'category', id:'integrations', icon:'integrations', label:'Integrações' },
    { type:'category', id:'project', icon:'project', label:'Projeto' },
    { type:'category', id:'intelligence', icon:'intelligence', label:'Inteligência' },
    { type:'category', id:'engineering', icon:'engineering', label:'Engenharia' },
    { type:'category', id:'recovery', icon:'recovery', label:'Recovery' },
    { type:'category', id:'activity', icon:'activity', label:'Atividade' },
    { type:'separator' },
    { type:'monitor', id:'monitor', icon:'monitor', label:'Monitor' },
    { type:'direct', id:'security', icon:'security', label:'Segurança', action:'diagnosis' },
    { type:'direct', id:'update', icon:'update', label:'Update Center', action:'update' },
    { type:'direct', id:'account', icon:'account', label:'Conta & Licença', action:'license' },
    { type:'external', id:'community', icon:'community', label:'Comunidade Decrrypter', url:COMMUNITY_URL },
    { type:'direct', id:'settings', icon:'settings', label:'Configurações', action:'settings' }
  ]);

  function root() { return document.getElementById(ROOT_ID); }
  function panel() { return root()?.querySelector('.ld2-panel'); }
  function gate() { return root()?.querySelector('[data-license-gate]'); }
  function fab() { return root()?.querySelector('.ld2-fab'); }
  function licensed() { const g = gate(); return !!g && g.hidden === true; }
  function icon(name) { return name === 'supabase' ? SUPABASE_ICON : (ICONS[name] || ICONS.project); }

  function clearActiveRail() {
    $$('.ld3-rail-btn[data-active="1"]', shell).forEach(btn => btn.dataset.active = '0');
  }

  function setOpenState() {
    if (!shell || !railMask) return;
    const open = licensed() && panel()?.classList.contains('open');
    railMask.dataset.open = open ? '1' : '0';
    if (!open) hideMenus();
    syncGeometry();
  }

  function syncLicenseState() {
    const r = root();
    if (!r) return;
    r.dataset.ld3Licensed = licensed() ? '1' : '0';
    setOpenState();
  }

  function railHeightFor(fabRect) {
    const desired = Math.min(760, Math.max(560, innerHeight * .72));
    const available = Math.max(420, fabRect.top - 34);
    return Math.min(desired, available);
  }

  function syncGeometry() {
    if (!railMask || !fab()) return;
    const rect = fab().getBoundingClientRect();
    const width = innerWidth <= 700 ? 62 : 68;
    const gap = 18;
    const height = railHeightFor(rect);
    const left = Math.max(8, Math.min(innerWidth - width - 8, rect.left + (rect.width - width) / 2));
    const top = Math.max(8, rect.top - gap - height);
    railMask.style.left = `${Math.round(left)}px`;
    railMask.style.top = `${Math.round(top)}px`;
    railMask.style.height = `${Math.round(height)}px`;
    if (flyout?.dataset.show === '1') placeFlyout($('.ld3-rail-btn[data-active="1"]', shell));
    if (detail?.dataset.show === '1') {
      const item = $('.ld3-menu-item[data-active="1"]', flyout);
      if (item) placeDetail(item);
    }
  }

  function hideDetail() {
    if (!detail) return;
    detail.dataset.show = '0';
    detail.innerHTML = '';
    activeItem = '';
    $$('.ld3-menu-item[data-active="1"]', flyout).forEach(el => el.dataset.active = '0');
  }

  function hideMenus() {
    clearTimeout(closeTimer);
    if (flyout) { flyout.dataset.show = '0'; flyout.innerHTML = ''; }
    hideDetail();
    activeCategory = '';
    clearActiveRail();
  }

  function scheduleHide(delay = 150) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(hideMenus, delay);
  }

  function cancelHide() { clearTimeout(closeTimer); }

  function placeNaturalPanel(el, anchorRect, railRect, left, topGap = 8) {
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(anchorRect.top)}px`;
    el.style.height = 'auto';
    el.style.maxHeight = 'none';
    el.style.overflowY = 'hidden';
    el.dataset.show = '1';
    const naturalHeight = el.scrollHeight;
    const railHeight = Math.floor(railRect.height);
    const finalHeight = Math.min(naturalHeight, railHeight);
    el.style.height = `${finalHeight}px`;
    el.style.maxHeight = `${finalHeight}px`;
    el.style.overflowY = naturalHeight > railHeight ? 'auto' : 'hidden';
    let top = anchorRect.top;
    if (top + finalHeight > railRect.bottom) top = railRect.bottom - finalHeight;
    top = Math.max(railRect.top + topGap, top);
    el.style.top = `${Math.round(top)}px`;
  }

  function placeFlyout(anchor) {
    if (!anchor || !flyout || !rail) return;
    const a = anchor.getBoundingClientRect();
    const rr = rail.getBoundingClientRect();
    const gap = 16;
    let left = a.right + gap;
    if (left + 260 > innerWidth - 10) left = rr.left - 260 - gap;

    if (activeCategory === 'integrations') {
      flyout.style.left = `${Math.round(left)}px`;
      flyout.style.top = `${Math.round(rr.top)}px`;
      flyout.style.height = `${Math.floor(rr.height)}px`;
      flyout.style.maxHeight = `${Math.floor(rr.height)}px`;
      flyout.dataset.show = '1';
      const natural = flyout.scrollHeight;
      flyout.style.overflowY = natural > rr.height ? 'auto' : 'hidden';
      return;
    }
    placeNaturalPanel(flyout, a, rr, left);
  }

  function placeDetail(anchor) {
    if (!anchor || !detail || !rail || !flyout) return;
    const a = anchor.getBoundingClientRect();
    const rr = rail.getBoundingClientRect();
    const fr = flyout.getBoundingClientRect();
    const gap = 14;
    let left = fr.right + gap;
    if (left + 310 > innerWidth - 10) left = fr.left - 310 - gap;
    placeNaturalPanel(detail, a, rr, left);
  }

  function menuItemMarkup(item) {
    return `<button type="button" class="ld3-menu-item" data-item="${item.id}"><span class="ld3-menu-icon">${icon(item.icon)}</span><span class="ld3-menu-copy"><b>${item.title}</b><small>${item.subtitle}</small></span><span class="ld3-menu-arrow">›</span></button>`;
  }

  function openCategory(id, anchor) {
    const category = CATEGORIES[id];
    if (!category || !flyout) return;
    cancelHide();
    activeCategory = id;
    hideDetail();
    clearActiveRail();
    anchor.dataset.active = '1';
    flyout.innerHTML = `<div class="ld3-panel-eyebrow">${category.label}</div><div class="ld3-menu-list">${category.items.map(menuItemMarkup).join('')}</div>`;
    $$('.ld3-menu-item', flyout).forEach(el => {
      const item = category.items.find(row => row.id === el.dataset.item);
      const activate = () => openDetail(item, el);
      el.addEventListener('mouseenter', activate);
      el.addEventListener('focus', activate);
      el.addEventListener('click', event => { event.preventDefault(); activate(); });
    });
    placeFlyout(anchor);
  }

  async function detailMeta(item) {
    const rows = [];
    try {
      const settings = await window.LovableDecrypterV2?.runtime?.({ type:'LD2_SETTINGS_GET' });
      if (item.action === 'github') {
        const g = settings?.github || {};
        rows.push(['Estado', g.owner && g.repo ? 'Configurado' : 'Não configurado']);
        if (g.owner && g.repo) rows.push(['Repositório', `${g.owner}/${g.repo}`]);
      } else if (item.action === 'supabase' || item.id === 'cloud') {
        const s = settings?.supabase || {};
        rows.push(['Estado', s.projectRef || s.ref ? 'Configurado' : 'Não configurado']);
        if (s.projectRef || s.ref) rows.push(['Projeto', s.projectRef || s.ref]);
      } else if (item.id === 'gemini') {
        const g = settings?.gemini || {};
        rows.push(['Modelo', String(g.model || 'Não configurado').replace(/^models\//,'')]);
        rows.push(['Política', 'Free-only']);
      }
    } catch (_) {}
    if (!rows.length) {
      rows.push(['Versão', `v${VERSION}`]);
      rows.push(['Módulo', item.badge || 'Decrypter']);
    }
    return rows;
  }

  async function openDetail(item, anchor) {
    if (!item || !detail) return;
    cancelHide();
    activeItem = item.id;
    $$('.ld3-menu-item[data-active="1"]', flyout).forEach(el => el.dataset.active = '0');
    anchor.dataset.active = '1';
    const rows = await detailMeta(item);
    if (activeItem !== item.id) return;
    detail.innerHTML = `<div class="ld3-detail-head"><div><div class="ld3-panel-eyebrow">Lovable Decrypter</div><h3>${item.title}</h3></div><span class="ld3-detail-badge">${item.badge || 'Ready'}</span></div><p class="ld3-detail-copy">${item.subtitle}. Abra o módulo para acessar as funções reais já configuradas na extensão.</p><div class="ld3-detail-meta">${rows.map(([k,v]) => `<div><small>${k}</small><b title="${String(v).replace(/"/g,'&quot;')}">${v}</b></div>`).join('')}</div><div class="ld3-detail-actions"><button type="button" class="primary" data-detail-open>Abrir</button><button type="button" data-detail-close>Fechar</button></div>`;
    $('[data-detail-open]', detail).addEventListener('click', () => triggerAction(item.action));
    $('[data-detail-close]', detail).addEventListener('click', hideDetail);
    placeDetail(anchor);
  }

  function findTarget(action) {
    const r = root();
    if (!r) return null;
    for (const selector of ACTION_SELECTORS[action] || []) {
      const target = r.querySelector(selector);
      if (target) return target;
    }
    return null;
  }

  function focusNativeComposer() {
    const candidates = [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
      .filter(el => !el.closest('#ld2-root') && !el.disabled && !el.readOnly)
      .filter(el => {
        const rect = el.getBoundingClientRect?.();
        if (!rect || rect.width < 180 || rect.height < 24 || rect.bottom <= 0 || rect.top >= innerHeight) return false;
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .sort((a,b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    const target = candidates[0];
    if (target) { hideMenus(); target.focus(); return true; }
    return false;
  }

  function toast(message, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  function triggerAction(action) {
    hideMenus();
    if (action === 'editor') {
      if (!focusNativeComposer()) toast('O composer do Lovable ainda não foi localizado.', true);
      return;
    }
    const target = findTarget(action);
    if (!target) { toast(`O módulo ${action} ainda não terminou de inicializar.`, true); return; }
    target.click();
  }

  async function readMonitor() {
    try { const data = await chrome.storage.local.get(MONITOR_KEY); return data[MONITOR_KEY] !== false; }
    catch (_) { return true; }
  }

  function monitorButton() { return shell?.querySelector('[data-monitor="1"]'); }

  function renderMonitor(enabled) {
    const btn = monitorButton();
    if (!btn) return;
    btn.dataset.enabled = enabled ? '1' : '0';
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.querySelector('.ld3-rail-tip').textContent = enabled ? 'Monitor ativado' : 'Monitor desativado';
  }

  async function toggleMonitor() {
    const btn = monitorButton();
    const current = btn?.dataset.enabled !== '0';
    try {
      if (window.LovableDecrypterVoice?.setMonitor) await window.LovableDecrypterVoice.setMonitor(!current, true);
      else {
        await chrome.storage.local.set({ [MONITOR_KEY]: !current });
        window.dispatchEvent(new CustomEvent('ld2:monitor-changed', { detail:{ enabled:!current } }));
      }
      renderMonitor(!current);
    } catch (_) { toast('Não foi possível alterar o Monitor.', true); }
  }

  function railButtonMarkup(item) {
    if (item.type === 'separator') return '<div class="ld3-rail-separator" aria-hidden="true"></div>';
    const monitor = item.type === 'monitor' ? ' data-monitor="1" aria-pressed="true"' : '';
    return `<button type="button" class="ld3-rail-btn" data-rail-type="${item.type}" data-rail-id="${item.id}"${monitor} aria-label="${item.label}">${icon(item.icon)}<span class="ld3-rail-tip">${item.label}</span></button>`;
  }

  function buildShell() {
    const r = root();
    if (!r) return false;
    shell = document.createElement('div');
    shell.className = 'ld3-launcher-shell';
    shell.innerHTML = `<div class="ld3-rail-mask" data-open="0"><div class="ld3-rail"><div class="ld3-rail-list">${RAIL_ITEMS.map(railButtonMarkup).join('')}</div></div></div><div class="ld3-flyout" data-show="0"></div><div class="ld3-detail" data-show="0"></div>`;
    r.appendChild(shell);
    railMask = $('.ld3-rail-mask', shell);
    rail = $('.ld3-rail', shell);
    flyout = $('.ld3-flyout', shell);
    detail = $('.ld3-detail', shell);

    $$('.ld3-rail-btn', shell).forEach(btn => {
      const spec = RAIL_ITEMS.find(item => item.id === btn.dataset.railId);
      if (!spec) return;
      if (spec.type === 'category') {
        btn.addEventListener('mouseenter', () => openCategory(spec.id, btn));
        btn.addEventListener('focus', () => openCategory(spec.id, btn));
        btn.addEventListener('click', event => { event.preventDefault(); openCategory(spec.id, btn); });
      } else if (spec.type === 'monitor') {
        btn.addEventListener('click', event => { event.preventDefault(); toggleMonitor(); });
      } else if (spec.type === 'external') {
        btn.addEventListener('click', event => {
          event.preventDefault(); hideMenus(); window.open(spec.url, '_blank', 'noopener,noreferrer'); toast('Comunidade Decrrypter · abrindo link');
        });
      } else {
        btn.addEventListener('click', event => { event.preventDefault(); triggerAction(spec.action); });
      }
    });

    rail.addEventListener('mouseenter', cancelHide);
    rail.addEventListener('mouseleave', () => scheduleHide(180));
    flyout.addEventListener('mouseenter', cancelHide);
    flyout.addEventListener('mouseleave', () => scheduleHide(180));
    detail.addEventListener('mouseenter', cancelHide);
    detail.addEventListener('mouseleave', () => scheduleHide(180));
    return true;
  }

  async function install() {
    const r = root();
    if (!r || mounted) return !!mounted;
    const p = panel();
    const g = gate();
    const f = fab();
    if (!p || !g || !f) return false;

    r.dataset.ld3DesignSystem = '1';
    if (!buildShell()) return false;

    panelObserver = new MutationObserver(setOpenState);
    panelObserver.observe(p, { attributes:true, attributeFilter:['class'] });
    gateObserver = new MutationObserver(syncLicenseState);
    gateObserver.observe(g, { attributes:true, attributeFilter:['hidden'] });

    window.addEventListener('resize', syncGeometry);
    document.addEventListener('pointermove', event => { if (event.target?.closest?.('.ld2-fab')) requestAnimationFrame(syncGeometry); }, true);
    document.addEventListener('pointerup', event => { if (event.target?.closest?.('.ld2-fab')) setTimeout(setOpenState, 0); }, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') hideMenus(); }, true);
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[MONITOR_KEY]) renderMonitor(changes[MONITOR_KEY].newValue !== false);
    });

    renderMonitor(await readMonitor());
    syncLicenseState();
    syncGeometry();
    mounted = true;
    window.dispatchEvent(new CustomEvent('ld3:design-system-ready', { detail:{ build:36, version:VERSION } }));
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install()) clearInterval(timer);
    if (attempts >= 120) clearInterval(timer);
  }, 100);

  window.LovableDecrypterDesignSystem = Object.freeze({
    build:36,
    version:VERSION,
    sync:syncGeometry,
    closeMenus:hideMenus
  });
})();
