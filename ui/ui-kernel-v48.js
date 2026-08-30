(() => {
  'use strict';
  if (window.__LD48_UI_KERNEL__) return;
  window.__LD48_UI_KERNEL__ = true;

  const ROOT_ID = 'ld2-root';
  const VERSION = chrome.runtime.getManifest().version;
  const FAB_POS_KEY = 'ld2_fab_pos';
  const COMMUNITY_URL = 'https://chat.whatsapp.com/BRBQfHORPYeFb7KJHicKYh?s=cl&p=a&mlu=4';
  const $ = (s, r = document) => r?.querySelector?.(s) || null;
  const $$ = (s, r = document) => [...(r?.querySelectorAll?.(s) || [])];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  const ICONS = Object.freeze({
    project:'▰', intelligence:'◉', engineering:'◇', integrations:'⊞', recovery:'↻', activity:'⌁',
    account:'♙', security:'♢', community:'◌', update:'↻', settings:'≡', monitor:'◉',
    workspace:'▰', zip:'⇩', github:'GH', cloud:'⇄', lovable:'♥', brain:'◎', rules:'☷', skills:'✳', explain:'?', impact:'◉',
    chat:'⌘', editor:'✎', queue:'☷', diagnostics:'◇', supabase:'SB', gemini:'✦', history:'↺', notes:'▤'
  });

  const GROUPS = Object.freeze([
    { id:'project', title:'Projeto', sub:'Workspace, ZIP e sincronização', items:[
      ['workspace','workspace','Workspace','Contexto e visão do projeto'],
      ['zip','zip','Baixar ZIP','Exportar projeto'],
      ['github-sync','github','GitHub Sync','Repositório e sincronização'],
      ['cloud-migrator','cloud','Migrar Cloud','Cloud → Supabase'],
      ['lovable-new-project','lovable','Novo projeto','Criar projeto vazio']
    ]},
    { id:'intelligence', title:'Inteligência', sub:'Brain, regras, impacto e skills', items:[
      ['brain','brain','Project Brain','Treinar contexto do projeto'],
      ['rules','rules','Project Rules','Regras permanentes'],
      ['skills','skills','Skills','Capacidades personalizadas'],
      ['explain','explain','Explain Project','Explicar arquitetura'],
      ['impact','impact','Impact Maps','Dependências e alcance']
    ]},
    { id:'engineering', title:'Engenharia', sub:'Chat, editor, queue e diagnóstico', items:[
      ['decrypter-chat','chat','Decrypter Chat','Planejar e construir'],
      ['editor','editor','Editor direto','Composer protegido'],
      ['queue','queue','Queue','Execução sequencial'],
      ['diagnostics','diagnostics','Diagnóstico','Saúde e integrações']
    ]},
    { id:'integrations', title:'Integrações', sub:'GitHub, Supabase, Lovable e Gemini', items:[
      ['github','github','GitHub','Conta, OAuth e repositório'],
      ['supabase','supabase','Supabase','OAuth, projeto e infraestrutura'],
      ['lovable','lovable','Lovable','Workspace e projeto'],
      ['gemini','gemini','Gemini','Modelo, chave e Free Tier']
    ]},
    { id:'recovery', title:'Recovery', sub:'Erro, recuperação e atualização', items:[
      ['error-intelligence','diagnostics','Error Intelligence','Erros, causas e recuperação'],
      ['project-recovery','recovery','Project Recovery','Reconciliação do projeto'],
      ['update','update','Update & Recovery','Atualização e rollback']
    ]},
    { id:'activity', title:'Atividade', sub:'Histórico, notas e operações', items:[
      ['history','history','Histórico','Execuções e alterações'],
      ['notes','notes','Anotação','Notas do projeto'],
      ['operations','activity','Operações','Estado técnico atual']
    ]}
  ]);

  const actions = new Map();
  function register(id, handler, meta = {}) {
    if (!id || typeof handler !== 'function') throw new TypeError('UI_ACTION_INVALID');
    actions.set(String(id), { handler, meta: { ...meta } });
    window.dispatchEvent(new CustomEvent('ld48:action-registered', { detail: { id: String(id) } }));
    return () => actions.delete(String(id));
  }
  function has(id) { return actions.has(String(id)); }
  async function run(id, payload = {}) {
    const action = actions.get(String(id));
    if (!action) throw Object.assign(new Error(`Ação ${id} ainda não está disponível.`), { code:'UI_ACTION_UNAVAILABLE' });
    return action.handler(payload);
  }

  let shell = null;
  let panel = null;
  let cascade = null;
  let activeGroup = '';
  let closeTimer = 0;
  let openState = false;
  let drag = null;

  function root() { return document.getElementById(ROOT_ID); }
  function fab() { return $('.ld2-fab', root()); }
  function legacyPanel() { return $('.ld2-panel', root()); }
  function legacyGate() { return $('[data-license-gate]', root()); }

  function mark() {
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="ld48g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ef3da3"/><stop offset=".52" stop-color="#8358ff"/><stop offset="1" stop-color="#4f7cff"/></linearGradient></defs><path d="M13 10h12c9 0 16 6 16 14s-7 14-16 14H13V29h5v4h7c6 0 10-3.6 10-9s-4-9-10-9h-7v4h-5z" fill="url(#ld48g)"/><path d="m21 26-3-2 3-2m7 0 3 2-3 2m-2-6-3 8" fill="none" stroke="url(#ld48g)" stroke-width="2" stroke-linecap="round"/><rect x="8" y="20" width="3" height="3" rx=".6" fill="#ef3da3"/><rect x="6" y="25" width="2.5" height="2.5" rx=".5" fill="#8358ff"/></svg>`;
  }
  function icon(name) { return `<span class="ld48-icon-glyph" aria-hidden="true">${ICONS[name] || '◇'}</span>`; }
  function toast(message, tone = 'info') {
    const wrap = $('.ld2-toast-wrap', root());
    if (!wrap) return;
    const node = document.createElement('div');
    node.className = `ld2-toast${tone === 'error' ? ' error' : ''}`;
    node.textContent = String(message || '');
    wrap.appendChild(node);
    setTimeout(() => node.remove(), 3600);
  }

  async function licenseStatus() {
    try { return await window.LovableDecrypterV2?.runtime?.({ type:'LD2_LICENSE_STATUS' }); }
    catch (_) { return null; }
  }

  function menuRow(group) {
    return `<button class="ld48-menu-btn" type="button" data-group="${group.id}"><span class="ld48-menu-icon">${icon(group.id)}</span><span class="ld48-copy"><b>${group.title}</b><small>${group.sub}</small></span><span class="ld48-arrow">›</span></button>`;
  }

  function build() {
    const r = root();
    if (!r || shell?.isConnected) return !!shell;
    const wrap = document.createElement('div');
    wrap.className = 'ld48-shell';
    wrap.dataset.ld48Kernel = '1';
    wrap.innerHTML = `
      <aside class="ld48-panel" data-open="0" aria-label="Lovable Decrypter">
        <header class="ld48-head"><span class="ld48-brand-logo">${mark()}</span><span class="ld48-brand"><b>Lovable Decrypter</b><span>Extensão ativa · v${VERSION}</span></span></header>
        <div class="ld48-scroll">
          <button class="ld48-monitor" type="button" data-direct="monitor"><span class="ld48-dot"></span><span class="ld48-copy"><b>Monitor</b><small>Proteção do projeto</small></span><span class="ld48-switch"></span></button>
          <div class="ld48-build"><div><small>BUILD</small><b>48</b></div><div><small>RUNTIME</small><b>${VERSION}</b></div></div>
          <div class="ld48-label">Principal</div><nav>${GROUPS.slice(0,3).map(menuRow).join('')}</nav>
          <div class="ld48-label">Sistema</div><nav>${GROUPS.slice(3).map(menuRow).join('')}</nav>
          <div class="ld48-label">Conta e suporte</div><nav>
            <button class="ld48-menu-btn" type="button" data-direct="account"><span class="ld48-menu-icon">${icon('account')}</span><span class="ld48-copy"><b>Minha conta</b><small>Licença, plano e sessão</small></span></button>
            <button class="ld48-menu-btn" type="button" data-direct="security"><span class="ld48-menu-icon">${icon('security')}</span><span class="ld48-copy"><b>Segurança</b><small>Integridade e proteção</small></span></button>
            <button class="ld48-menu-btn" type="button" data-direct="community"><span class="ld48-menu-icon">${icon('community')}</span><span class="ld48-copy"><b>Comunidade</b><small>Canal oficial</small></span></button>
            <button class="ld48-menu-btn" type="button" data-direct="update"><span class="ld48-menu-icon">${icon('update')}</span><span class="ld48-copy"><b>Atualizar</b><small>Update Center e recovery</small></span></button>
            <button class="ld48-menu-btn" type="button" data-direct="settings"><span class="ld48-menu-icon">${icon('settings')}</span><span class="ld48-copy"><b>Configurações</b><small>Preferências do Decrypter</small></span></button>
          </nav>
        </div>
        <footer class="ld48-footer"><button type="button" data-minimize>Minimizar</button><button type="button" data-top>Voltar ao topo</button></footer>
      </aside>
      <section class="ld48-cascade" data-show="0" aria-label="Submenu"></section>`;
    r.appendChild(wrap);
    shell = wrap;
    panel = $('.ld48-panel', wrap);
    cascade = $('.ld48-cascade', wrap);
    wire();
    wireFab();
    syncMonitor().catch(() => {});
    return true;
  }

  function cancelClose() { clearTimeout(closeTimer); }
  function scheduleClose() { clearTimeout(closeTimer); closeTimer = setTimeout(hideCascade, 220); }
  function hideCascade() {
    activeGroup = '';
    if (cascade) { cascade.dataset.show = '0'; cascade.innerHTML = ''; }
    $$('.ld48-menu-btn.active', panel).forEach(x => x.classList.remove('active'));
  }

  function placeCascade(anchor) {
    if (!cascade || !panel) return;
    cascade.dataset.show = '1';
    cascade.style.left = '0px'; cascade.style.top = '0px';
    const ar = anchor.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const cr = cascade.getBoundingClientRect();
    const gap = 10, margin = 10;
    let left = pr.left - cr.width - gap;
    if (left < margin) left = pr.right + gap;
    let top = Math.max(margin, Math.min(innerHeight - cr.height - margin, ar.top));
    Object.assign(cascade.style, { left:`${Math.round(left)}px`, top:`${Math.round(top)}px` });
  }

  function openGroup(group, anchor) {
    cancelClose();
    activeGroup = group.id;
    $$('.ld48-menu-btn.active', panel).forEach(x => x.classList.remove('active'));
    anchor.classList.add('active');
    cascade.innerHTML = `<header><b>${group.title}</b><span>${group.sub}</span></header><div class="ld48-cascade-list">${group.items.map(([action,ic,title,sub]) => `<button type="button" class="ld48-cascade-item" data-action="${action}"><span class="ld48-menu-icon">${icon(ic)}</span><span class="ld48-copy"><b>${title}</b><small>${sub}</small></span></button>`).join('')}</div>`;
    $$('.ld48-cascade-item', cascade).forEach(button => {
      button.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        const id = button.dataset.action;
        closeLauncher();
        try { await run(id, { source:'launcher', group:group.id }); }
        catch (error) { toast(error?.message || String(error), 'error'); }
      });
    });
    placeCascade(anchor);
  }

  function position() {
    const f = fab();
    if (!panel || !f || !openState) return;
    const fr = f.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const M = 10, G = 10, pw = pr.width || 320, ph = Math.min(pr.height || 720, innerHeight - 20);
    let left = fr.left - pw - G;
    if (left < M) left = fr.right + G;
    left = Math.max(M, Math.min(innerWidth - pw - M, left));
    let top = Math.max(M, Math.min(innerHeight - ph - M, fr.bottom - ph));
    Object.assign(panel.style, { left:`${Math.round(left)}px`, top:`${Math.round(top)}px` });
  }

  function openLauncher() {
    if (!panel) return;
    openState = true;
    panel.dataset.open = '1';
    fab()?.setAttribute('data-open', '1');
    requestAnimationFrame(position);
  }
  function closeLauncher() {
    openState = false;
    hideCascade();
    if (panel) panel.dataset.open = '0';
    fab()?.setAttribute('data-open', '0');
  }
  function toggleLauncher() { openState ? closeLauncher() : openLauncher(); }

  async function saveFabPosition(f) {
    try { await chrome.storage.local.set({ [FAB_POS_KEY]: { left:f.offsetLeft, top:f.offsetTop } }); } catch (_) {}
  }

  function wireFab() {
    const f = fab();
    if (!f || f.dataset.ld48Bound === '1') return;
    f.dataset.ld48Bound = '1';
    f.dataset.ld48 = '1';
    const stop = event => { event.stopImmediatePropagation(); event.stopPropagation(); };
    f.addEventListener('pointerdown', event => {
      stop(event);
      drag = { id:event.pointerId, sx:event.clientX, sy:event.clientY, left:f.offsetLeft, top:f.offsetTop, moved:false };
      try { f.setPointerCapture(event.pointerId); } catch (_) {}
      f.classList.add('dragging');
    }, true);
    f.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      stop(event);
      const dx = event.clientX - drag.sx, dy = event.clientY - drag.sy;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      f.style.left = `${Math.max(6, Math.min(innerWidth - f.offsetWidth - 6, drag.left + dx))}px`;
      f.style.top = `${Math.max(6, Math.min(innerHeight - f.offsetHeight - 6, drag.top + dy))}px`;
      f.style.right = 'auto'; f.style.bottom = 'auto';
      position();
    }, true);
    f.addEventListener('pointerup', event => {
      if (!drag || event.pointerId !== drag.id) return;
      stop(event); event.preventDefault();
      const moved = drag.moved; drag = null; f.classList.remove('dragging'); saveFabPosition(f);
      if (!moved) toggleLauncher();
    }, true);
    f.addEventListener('click', event => { stop(event); event.preventDefault(); }, true);
  }

  async function syncMonitor() {
    let enabled = true;
    try { enabled = (await chrome.storage.local.get('ld2_monitor_enabled')).ld2_monitor_enabled !== false; } catch (_) {}
    const button = $('[data-direct="monitor"]', panel);
    if (button) {
      button.dataset.enabled = enabled ? '1' : '0';
      $('.ld48-copy small', button).textContent = enabled ? 'ON · Proteção ativa' : 'OFF · Proteção desativada';
    }
  }

  function focusDecrypterChat() {
    const host = document.getElementById('ld2-decrypter-chat-host');
    const input = host?.shadowRoot?.querySelector('[data-ldc-input]');
    if (input) { input.focus(); return true; }
    window.LovableDecrypterChat?.mount?.();
    setTimeout(() => document.getElementById('ld2-decrypter-chat-host')?.shadowRoot?.querySelector('[data-ldc-input]')?.focus(), 120);
    return true;
  }

  function installBuiltins() {
    register('workspace', () => window.LovableDecrypterWorkspace?.open?.() ?? Promise.reject(new Error('Workspace ainda não está disponível.')));
    register('brain', () => window.LovableDecrypterProjectIntelligence?.openBrain?.() ?? Promise.reject(new Error('Project Brain ainda não está disponível.')));
    register('rules', () => window.LovableDecrypterProjectIntelligence?.openRules?.() ?? Promise.reject(new Error('Project Rules ainda não está disponível.')));
    register('impact', () => window.LovableDecrypterProjectIntelligence?.openImpacts?.() ?? Promise.reject(new Error('Impact Maps ainda não estão disponíveis.')));
    register('explain', () => window.LovableDecrypterProjectIntelligence?.openExplain?.() ?? Promise.reject(new Error('Explain Project ainda não está disponível.')));
    register('project-recovery', () => window.LovableDecrypterRecoveryDoctor?.open?.() ?? Promise.reject(new Error('Project Recovery ainda não está disponível.')));
    register('error-intelligence', () => window.LovableDecrypterErrorIntelligence?.open?.() ?? Promise.reject(new Error('Error Intelligence ainda não está disponível.')));
    register('operations', () => window.LovableDecrypterActivityCenter?.open?.() ?? Promise.reject(new Error('Operações ainda não estão disponíveis.')));
    register('history', () => window.LovableDecrypterProductivitySuite?.history?.() ?? Promise.reject(new Error('Histórico ainda não está disponível.')));
    register('notes', () => window.LovableDecrypterProductivitySuite?.notes?.() ?? Promise.reject(new Error('Notas ainda não estão disponíveis.')));
    register('decrypter-chat', focusDecrypterChat);
    register('community', () => window.open(COMMUNITY_URL, '_blank', 'noopener,noreferrer'));
    register('monitor', async () => {
      const current = $('[data-direct="monitor"]', panel)?.dataset.enabled !== '0';
      if (window.LovableDecrypterVoice?.setMonitor) await window.LovableDecrypterVoice.setMonitor(!current, true);
      else await chrome.storage.local.set({ ld2_monitor_enabled: !current });
      await syncMonitor();
    });
    // Providers for these actions are replaced by dedicated Builds 49–53.
    for (const id of ['zip','github-sync','cloud-migrator','lovable-new-project','skills','editor','queue','diagnostics','github','supabase','lovable','gemini','update','account','security','settings']) {
      if (!has(id)) register(id, () => Promise.reject(Object.assign(new Error('Este módulo está sendo migrado para a nova interface.'), { code:'UI_PROVIDER_PENDING' })));
    }
  }

  function wire() {
    $$('.ld48-menu-btn[data-group]', panel).forEach(button => {
      const group = GROUPS.find(item => item.id === button.dataset.group);
      const open = () => openGroup(group, button);
      button.addEventListener('mouseenter', open);
      button.addEventListener('focus', open);
      button.addEventListener('click', event => { event.preventDefault(); open(); });
    });
    $$('.ld48-menu-btn[data-direct]', panel).forEach(button => button.addEventListener('click', async event => {
      event.preventDefault();
      const id = button.dataset.direct;
      if (id !== 'monitor') closeLauncher();
      try { await run(id, { source:'launcher' }); }
      catch (error) { toast(error?.message || String(error), 'error'); }
    }));
    $('[data-minimize]', panel).addEventListener('click', closeLauncher);
    $('[data-top]', panel).addEventListener('click', () => $('.ld48-scroll', panel)?.scrollTo({ top:0, behavior:'smooth' }));
    panel.addEventListener('mouseenter', cancelClose); panel.addEventListener('mouseleave', scheduleClose);
    cascade.addEventListener('mouseenter', cancelClose); cascade.addEventListener('mouseleave', scheduleClose);
    addEventListener('resize', () => { position(); hideCascade(); }, { passive:true });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') openState ? closeLauncher() : hideCascade(); }, true);
    chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.ld2_monitor_enabled) syncMonitor(); });
  }

  async function reconcileLicenseSurface() {
    const legacy = legacyPanel();
    const gate = legacyGate();
    if (!legacy || !gate) return;
    const status = await licenseStatus();
    const valid = !!status?.valid;
    legacy.classList.toggle('ld48-activation-mode', !valid);
    if (valid) legacy.classList.remove('open');
  }

  function install() {
    if (!build()) return false;
    wireFab();
    reconcileLicenseSurface().catch(() => {});
    return true;
  }

  installBuiltins();
  window.LovableDecrypterUIActions = Object.freeze({ build:48, register, run, has, list:() => [...actions.keys()] });
  window.LovableDecrypterUI = Object.freeze({ build:48, version:VERSION, open:openLauncher, close:closeLauncher, toggle:toggleLauncher, refresh:install });

  for (const event of ['ld2:ui-mounted','ld2:dom-reconcile','ld2:project','ld2:license-changed']) window.addEventListener(event, install);
  const scheduler = window.LovableDecrypterDeliveryScheduler;
  if (scheduler?.register) scheduler.register('build48-ui-kernel', install, { interval:120, maxAttempts:160, startDelay:0 });
  else { let attempts = 0; const go = async () => { attempts += 1; if (install() || attempts >= 160) return; await wait(120); go(); }; go(); }
})();
