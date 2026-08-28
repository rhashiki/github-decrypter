(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_UNIFIED_LAUNCHER__) return;
  window.__LOVABLE_DECRYPTER_UNIFIED_LAUNCHER__ = true;

  const ROOT_ID = 'ld2-root';
  const VERSION = chrome.runtime.getManifest().version;
  const $ = (selector, root = document) => root.querySelector(selector);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  let mounted = false;
  let syncing = false;
  let syncTimer = 0;

  const LEGACY_ACTIONS = Object.freeze({
    brain: '[data-cc-action="train"]',
    skills: '[data-cc-action="skills"]',
    queue: '[data-cc-batch]',
    github: '[data-cc-github]',
    supabase: '[data-cc-supabase]',
    cloud: '[data-cc-action="cloud-migrate"]',
    zip: '[data-cc-action="zip"]',
    project: '[data-cc-new-project]',
    rules: '[data-cc-intel="rules"]',
    explain: '[data-cc-intel="explain"]',
    impact: '[data-cc-intel="impact"]',
    history: '[data-cc-action="history"]',
    diagnosis: '[data-cc-action="diag"]',
    settings: '[data-cc-settings]',
    update: '[data-cc-action="update"]'
  });

  function root() { return document.getElementById(ROOT_ID); }
  function panelOpen() { return !!root()?.querySelector('.ld2-panel.open'); }

  function toast(text, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  function shellMarkup() {
    return `
      <div class="ld2-ul-hero">
        <div class="ld2-ul-hero-copy">
          <small>LOVABLE DECRYPTER · BUILD 12</small>
          <h2>Unified Launcher</h2>
          <p>Projeto, inteligência, execução e integrações em uma única interface.</p>
        </div>
        <div class="ld2-ul-live"><i></i><span>v${VERSION}</span></div>
      </div>

      <div class="ld2-ul-status-grid" aria-label="Status do Decrypter">
        ${statusTile('license', '◉', 'Licença')}
        ${statusTile('ai', 'AI', 'Decrypter AI')}
        ${statusTile('github', 'GH', 'GitHub')}
        ${statusTile('supabase', 'SB', 'Supabase')}
        ${statusTile('composer', '⌘', 'Composer')}
        ${statusTile('project', '◇', 'Projeto')}
      </div>

      <nav class="ld2-ul-nav" aria-label="Seções">
        <button type="button" data-ul-jump="principal">Principal</button>
        <button type="button" data-ul-jump="project">Projeto</button>
        <button type="button" data-ul-jump="intelligence">Inteligência</button>
        <button type="button" data-ul-jump="system">Sistema</button>
      </nav>

      ${section('principal', 'PRINCIPAL', 'Operação diária', [
        card('editor', '⌘', 'Editor Direto', 'Usar Plan/Build no composer nativo', 'READY'),
        card('brain', '◎', 'Project Brain', 'Treinar e consultar memória técnica'),
        card('skills', '✳', 'Skills', 'Biblioteca, preferências e Skills customizadas'),
        card('queue', '☷', 'Queue', 'Execução sequencial com recovery', '—')
      ])}

      ${section('project', 'PROJETO', 'Código e infraestrutura', [
        card('github', 'GH', 'GitHub', 'Repositório, branch e autorização oficial'),
        card('supabase', 'SB', 'Supabase', 'OAuth e projeto conectado'),
        card('cloud', '☁', 'Cloud Migrator', 'Lovable Cloud → Supabase completo'),
        card('zip', '⇩', 'Exportar ZIP', 'Baixar uma cópia do projeto'),
        card('project', '＋', 'Novo projeto', 'Criar projeto vazio no Lovable')
      ])}

      ${section('intelligence', 'INTELIGÊNCIA', 'Contexto e explicabilidade', [
        card('rules', '≡', 'Project Rules', 'Regras permanentes do projeto'),
        card('explain', '?', 'Explain Project', 'Arquitetura, regras e paths importantes'),
        card('impact', '◈', 'Impact Maps', 'Arquivos, dependências e risco'),
        card('history', '↺', 'Histórico', 'Execuções, commits e alterações')
      ])}

      ${section('system', 'SISTEMA', 'Controle e manutenção', [
        card('diagnosis', '◇', 'Diagnóstico', 'Saúde real dos módulos e integrações'),
        card('settings', '⚙', 'Configurações', 'IA, preferências e integrações'),
        card('update', '↻', 'Atualizar', 'OTA assinado e verificação de versão'),
        card('repair', '✚', 'Repair Lovable', 'Recuperação profunda do ambiente', 'BUILD 14', true)
      ])}

      <footer class="ld2-ul-footer">
        <span><i data-ul-footer-dot></i><b data-ul-footer-state>Sincronizando…</b></span>
        <button type="button" data-ul-refresh title="Atualizar status">Atualizar status</button>
      </footer>`;
  }

  function statusTile(key, icon, title) {
    return `<div class="ld2-ul-status" data-ul-status="${key}" data-state="idle"><span>${icon}</span><div><small>${title}</small><b>Verificando…</b></div><i></i></div>`;
  }

  function section(id, eyebrow, title, cards) {
    return `<section class="ld2-ul-section" data-ul-section="${id}"><div class="ld2-ul-section-head"><div><small>${eyebrow}</small><h3>${title}</h3></div></div><div class="ld2-ul-grid">${cards.join('')}</div></section>`;
  }

  function card(action, icon, title, subtitle, badge = '', future = false) {
    return `<button type="button" class="ld2-ul-card${future ? ' future' : ''}" data-ul-action="${action}" ${future ? 'data-ul-future="1"' : ''}><span>${icon}</span><div><b>${title}</b><small>${subtitle}</small></div>${badge ? `<em data-ul-badge="${action}">${badge}</em>` : ''}</button>`;
  }

  function legacyHost() {
    return root()?.querySelector('.ld2-control-center');
  }

  async function waitForLegacy(selector, attempts = 22) {
    for (let i = 0; i < attempts; i++) {
      const host = legacyHost();
      const target = host?.querySelector(selector);
      if (target) return target;
      await sleep(90 + i * 12);
    }
    return null;
  }

  function closeLauncher() {
    root()?.querySelector('[data-close]')?.click();
  }

  function focusEditor() {
    const candidates = [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
      .filter(el => !el.closest('#ld2-root') && !el.disabled && !el.readOnly)
      .filter(el => {
        const rect = el.getBoundingClientRect?.();
        if (!rect || rect.width < 180 || rect.height < 24 || rect.bottom <= 0 || rect.top >= innerHeight) return false;
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    const input = candidates[0];
    if (!input) {
      toast('O composer do Lovable ainda não foi localizado.', true);
      return;
    }
    closeLauncher();
    setTimeout(() => input.focus(), 80);
  }

  async function trigger(action) {
    if (action === 'editor') return focusEditor();
    if (action === 'repair') {
      toast('Repair Lovable está reservado para a Build 14. Nenhuma limpeza destrutiva foi executada.');
      return;
    }
    const selector = LEGACY_ACTIONS[action];
    if (!selector) return toast(`Ação ${action} ainda não possui roteamento.`, true);
    const target = await waitForLegacy(selector);
    if (!target) return toast(`O módulo ${action} ainda não terminou de inicializar.`, true);
    target.click();
  }

  function setStatus(key, value, state = 'idle', title = '') {
    const tile = root()?.querySelector(`.ld2-unified-shell [data-ul-status="${key}"]`);
    if (!tile) return;
    tile.dataset.state = state;
    const label = tile.querySelector('b');
    if (label && label.textContent !== value) label.textContent = value;
    if (title) tile.title = title;
  }

  function setBadge(key, value, state = '') {
    const badge = root()?.querySelector(`.ld2-unified-shell [data-ul-badge="${key}"]`);
    if (!badge) return;
    badge.textContent = value;
    badge.dataset.state = state;
  }

  async function readState() {
    const [settings, license, queueHealth] = await Promise.all([
      runtime?.({ type: 'LD2_SETTINGS_GET' }).catch?.(() => ({})) || {},
      runtime?.({ type: 'LD2_LICENSE_STATUS' }).catch?.(() => ({ valid: false })) || { valid: false },
      window.LovableDecrypterBuild10?.health?.(false).catch?.(() => ({ ok: false, code: 'UNAVAILABLE' })) || { ok: false, code: 'UNAVAILABLE' }
    ]);
    const projectId = String(window.LovableDecrypterV2?.getProjectId?.() || '');
    const projectContext = window.LovableDecrypterProjectRuntime?.getContext?.() || null;
    const map = projectId ? settings?.projectMappings?.[projectId] || {} : {};
    const github = { ...(settings?.github || {}), ...map };
    const sbMap = projectId ? settings?.supabaseMappings?.[projectId] || {} : {};
    const supabase = { ...(settings?.supabase || {}), ...sbMap };
    const guardian = window.LovableDecrypterComposerGuardian?.snapshot?.() || { health: 'INACTIVE', reason: 'guardian_unavailable' };
    return { settings, license, queueHealth, projectId, projectContext, github, supabase, guardian };
  }

  async function sync(force = false) {
    if (syncing) return;
    if (!force && !panelOpen()) return;
    syncing = true;
    try {
      const state = await readState();
      setStatus('license', state.license?.valid ? 'VALIDADA' : 'KEY NECESSÁRIA', state.license?.valid ? 'good' : 'bad');

      const model = String(state.settings?.gemini?.model || '').replace(/^models\//, '');
      const aiReady = !!state.settings?.gemini?.apiKey;
      setStatus('ai', aiReady ? model || 'CONFIGURADA' : 'CONFIGURAR', aiReady ? 'good' : 'warn', aiReady ? `Modelo atual: ${model}` : 'A IA atual ainda depende da configuração Gemini desta fase do produto.');

      const repo = state.github?.owner && state.github?.repo ? `${state.github.owner}/${state.github.repo}` : '';
      setStatus('github', repo || 'NÃO CONECTADO', repo ? 'good' : 'warn', repo ? `${repo} · ${state.github.branch || 'main'}` : 'Nenhum repositório mapeado.');

      const sbRef = String(state.supabase?.projectRef || state.supabase?.ref || '');
      setStatus('supabase', sbRef ? (state.supabase?.projectName || sbRef) : 'NÃO CONECTADO', sbRef ? 'good' : 'warn', sbRef || 'Nenhum projeto Supabase mapeado.');

      const health = String(state.guardian?.health || 'INACTIVE').toUpperCase();
      setStatus('composer', health, health === 'OK' ? 'good' : health === 'DEGRADED' ? 'warn' : 'bad', `${state.guardian?.reason || 'sem diagnóstico'}${state.guardian?.fingerprintShort ? ` · ${state.guardian.fingerprintShort}` : ''}`);

      const projectName = String(state.projectContext?.project?.name || state.projectContext?.name || '');
      setStatus('project', state.projectId ? (projectName || state.projectId.slice(0, 12)) : 'NÃO IDENTIFICADO', state.projectId ? 'good' : 'warn', state.projectId || 'Projeto Lovable não identificado.');

      const queueReady = !!state.queueHealth?.ok && !!window.__LOVABLE_DECRYPTER_QUEUE_EXECUTOR__;
      setBadge('queue', queueReady ? 'ATIVA' : 'DEGRADADA', queueReady ? 'good' : 'warn');

      const footer = root()?.querySelector('.ld2-unified-shell [data-ul-footer-state]');
      const footerDot = root()?.querySelector('.ld2-unified-shell [data-ul-footer-dot]');
      const overallGood = state.license?.valid && health === 'OK' && !!state.projectId;
      if (footer) footer.textContent = overallGood ? 'Sistema operacional' : health === 'INACTIVE' ? 'Proteção bloqueando envio' : 'Atenção necessária';
      if (footerDot) footerDot.dataset.state = overallGood ? 'good' : health === 'INACTIVE' ? 'bad' : 'warn';
    } catch (error) {
      const footer = root()?.querySelector('.ld2-unified-shell [data-ul-footer-state]');
      if (footer) footer.textContent = 'Falha ao atualizar status';
      toast(error?.message || String(error), true);
    } finally {
      syncing = false;
    }
  }

  function bind(shell) {
    shell.addEventListener('click', event => {
      const action = event.target.closest?.('[data-ul-action]');
      if (action) {
        event.preventDefault();
        trigger(action.dataset.ulAction);
        return;
      }
      const jump = event.target.closest?.('[data-ul-jump]');
      if (jump) {
        const section = shell.querySelector(`[data-ul-section="${jump.dataset.ulJump}"]`);
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (event.target.closest?.('[data-ul-refresh]')) sync(true);
    });
  }

  function install() {
    const r = root();
    const host = r?.querySelector('.ld2-control-center');
    if (!r || !host) return false;
    if (host.querySelector(':scope > .ld2-unified-shell')) {
      mounted = true;
      return true;
    }

    r.dataset.ld2UnifiedLauncher = '1';
    host.classList.add('ld2-unified-host');
    const shell = document.createElement('div');
    shell.className = 'ld2-unified-shell';
    shell.innerHTML = shellMarkup();
    host.prepend(shell);
    bind(shell);

    const brand = r.querySelector('.ld2-brand b');
    const version = r.querySelector('.ld2-brand small');
    if (brand) brand.textContent = 'LOVABLE DECRYPTER';
    if (version) version.textContent = `UNIFIED LAUNCHER · v${VERSION}`;

    mounted = true;
    sync(true);
    window.dispatchEvent(new CustomEvent('ld2:unified-launcher-ready', { detail: { build: 12, version: VERSION } }));
    return true;
  }

  function boundedInstall() {
    let attempts = 0;
    const run = () => {
      if (install()) return;
      attempts += 1;
      if (attempts < 36) setTimeout(run, 90 + attempts * 20);
    };
    run();
  }

  window.addEventListener('ld2:control-center-ready', () => { install(); sync(true); });
  window.addEventListener('ld2:ui-mounted', () => { install(); sync(true); });
  window.addEventListener('ld2:project', () => sync(true));
  window.addEventListener('ld2:queue-changed', () => sync(true));
  window.addEventListener('ld2:composer-guardian-state', () => sync(true));
  document.addEventListener('click', event => {
    if (event.target.closest?.('#ld2-root .ld2-fab')) setTimeout(() => sync(true), 100);
  }, true);

  syncTimer = setInterval(() => sync(false), 8000);
  addEventListener('beforeunload', () => clearInterval(syncTimer), { once: true });

  window.LovableDecrypterUnifiedLauncher = Object.freeze({
    mount: install,
    refresh: () => sync(true),
    mounted: () => mounted,
    build: 12
  });

  boundedInstall();
})();