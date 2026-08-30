(() => {
  'use strict';
  if (window.__LD53_SETTINGS__) return;
  window.__LD53_SETTINGS__ = true;

  const BUILD = 53;
  const VERSION = chrome.runtime.getManifest().version;
  const ROOT_ID = 'ld2-root';
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => [...(root?.querySelectorAll?.(selector) || [])];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);

  const LIMITS = Object.freeze({
    minFiles: 6,
    maxFiles: 30,
    minContext: 100000,
    maxContext: 1000000,
    maxRules: 20000
  });

  let overlay = null;
  let generation = 0;
  let providerInstalled = false;

  function root() { return document.getElementById(ROOT_ID); }

  function toast(message, error = false) {
    const wrap = $('.ld2-toast-wrap', root());
    if (!wrap) return;
    const item = document.createElement('div');
    item.className = `ld2-toast${error ? ' error' : ''}`;
    item.textContent = String(message || '');
    wrap.appendChild(item);
    setTimeout(() => item.remove(), 3600);
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
  }

  function normalizedPreferences(settings = {}) {
    const ui = settings.ui || {};
    const agent = settings.agent || {};
    const gateway = settings.gateway || {};
    return {
      ui: {
        theme: 'nexus',
        background: ['glass','solid'].includes(ui.background) ? ui.background : 'glass',
        density: ['comfortable','compact'].includes(ui.density) ? ui.density : 'comfortable',
        motion: ['full','reduced'].includes(ui.motion) ? ui.motion : 'full',
        sounds: ui.sounds === true
      },
      gateway: {
        mode: ['auto','fast','deep'].includes(gateway.mode) ? gateway.mode : 'auto'
      },
      agent: {
        maxFiles: clamp(agent.maxFiles, LIMITS.minFiles, LIMITS.maxFiles, 18),
        maxContextBytes: clamp(agent.maxContextBytes, LIMITS.minContext, LIMITS.maxContext, 500000),
        rules: String(agent.rules || '').slice(0, LIMITS.maxRules)
      }
    };
  }

  function applyPreferences(settings = {}) {
    const host = root();
    if (!host) return false;
    const prefs = normalizedPreferences(settings);
    host.dataset.ld53Background = prefs.ui.background;
    host.dataset.ld53Density = prefs.ui.density;
    host.dataset.ld53Motion = prefs.ui.motion;
    host.dataset.ld53Sounds = prefs.ui.sounds ? 'on' : 'off';
    window.dispatchEvent(new CustomEvent('ld53:preferences-applied', {
      detail: {
        background: prefs.ui.background,
        density: prefs.ui.density,
        motion: prefs.ui.motion,
        sounds: prefs.ui.sounds
      }
    }));
    return true;
  }

  async function snapshot() {
    const settings = await runtime({ type:'LD2_SETTINGS_GET' });
    const prefs = normalizedPreferences(settings || {});
    return {
      ...prefs,
      integrations: {
        github: !!(settings?.github?.owner && settings?.github?.repo),
        githubRepo: settings?.github?.owner && settings?.github?.repo ? `${settings.github.owner}/${settings.github.repo}` : '',
        supabase: !!settings?.supabase?.projectRef,
        supabaseProject: settings?.supabase?.projectName || settings?.supabase?.projectRef || '',
        gemini: !!settings?.gemini?.apiKey,
        geminiModel: settings?.gemini?.model || '',
        lovable: !!window.LovableDecrypterProjectRuntime?.getContext?.()?.projectId
      },
      vault: {
        enabled: !!(settings?.auth?.vaultApiBase && settings?.auth?.licenseStatus === 'active'),
        lastSyncAt: settings?.auth?.lastVaultSyncAt || null
      }
    };
  }

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    const host = root();
    if (!host) return null;
    overlay = document.createElement('div');
    overlay.className = 'ld53-overlay';
    overlay.innerHTML = `
      <section class="ld53-shell" role="dialog" aria-modal="true" aria-label="Configurações do Lovable Decrypter">
        <header class="ld53-head">
          <div class="ld53-title"><span class="ld53-mark">⚙</span><div><small>SETTINGS · BUILD ${BUILD}</small><h2>Configurações</h2><p>Preferências do Decrypter separadas de contas, credenciais e integrações.</p></div></div>
          <div class="ld53-head-actions"><span>v${esc(VERSION)}</span><button type="button" data-ld53-close aria-label="Fechar">×</button></div>
        </header>
        <main class="ld53-body" data-ld53-body></main>
      </section>`;
    host.appendChild(overlay);
    $('[data-ld53-close]', overlay).onclick = close;
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && overlay?.classList.contains('open')) close();
    }, true);
    return overlay;
  }

  function close() {
    generation += 1;
    overlay?.classList.remove('open');
  }

  function loading() {
    const body = $('[data-ld53-body]', overlay);
    if (body) body.innerHTML = '<div class="ld53-loading"><i></i><b>Carregando preferências…</b><span>Credenciais não são exibidas nesta superfície.</span></div>';
  }

  function option(value, label, selected) {
    return `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;
  }

  function integrationCard(id, mark, title, connected, detail) {
    return `<button type="button" class="ld53-integration" data-ld53-integration="${esc(id)}">
      <span class="ld53-integration-mark">${esc(mark)}</span>
      <span><small>${connected ? 'CONECTADO' : 'CONFIGURAR'}</small><b>${esc(title)}</b><em>${esc(detail || (connected ? 'Pronto' : 'Não configurado'))}</em></span>
      <i data-tone="${connected ? 'ok' : 'idle'}"></i>
    </button>`;
  }

  function render(data) {
    const body = $('[data-ld53-body]', overlay);
    if (!body) return;
    const prefs = data || {};
    const ui = prefs.ui || {};
    const agent = prefs.agent || {};
    const gateway = prefs.gateway || {};
    const integrations = prefs.integrations || {};
    const vaultText = prefs.vault?.lastSyncAt
      ? `Último backup: ${new Date(prefs.vault.lastSyncAt).toLocaleString('pt-BR')}`
      : prefs.vault?.enabled ? 'Vault ativo · aguardando primeiro backup.' : 'Vault indisponível nesta sessão.';

    body.innerHTML = `
      <section class="ld53-grid">
        <article class="ld53-card">
          <header><div><small>INTERFACE</small><h3>Visual e comportamento</h3></div><span class="ld53-badge">NEXUS</span></header>
          <div class="ld53-form-grid">
            <label class="ld53-field"><span>Fundo</span><select data-ld53-background>${option('glass','Glass · transparência + blur',ui.background)}${option('solid','Solid · maior contraste',ui.background)}</select></label>
            <label class="ld53-field"><span>Densidade</span><select data-ld53-density>${option('comfortable','Confortável',ui.density)}${option('compact','Compacta',ui.density)}</select></label>
            <label class="ld53-field"><span>Movimento</span><select data-ld53-motion>${option('full','Completo',ui.motion)}${option('reduced','Reduzido',ui.motion)}</select></label>
            <label class="ld53-toggle"><span><b>Sons da interface</b><small>Preferência compartilhada pelos módulos compatíveis.</small></span><input type="checkbox" data-ld53-sounds ${ui.sounds ? 'checked' : ''}><i></i></label>
          </div>
          <div class="ld53-note"><b>Tema visual</b><span>Nexus / Matrix · Arial · escopo isolado dentro do Decrypter.</span></div>
        </article>

        <article class="ld53-card">
          <header><div><small>ENGINE</small><h3>Perfil de execução</h3></div><span class="ld53-badge">SAFE</span></header>
          <div class="ld53-form-grid">
            <label class="ld53-field"><span>Modo do gateway</span><select data-ld53-gateway>${option('auto','Auto · decide pelo contexto',gateway.mode)}${option('fast','Fast · menor latência',gateway.mode)}${option('deep','Deep · análise ampliada',gateway.mode)}</select></label>
            <label class="ld53-field"><span>Arquivos por contexto</span><input type="number" min="${LIMITS.minFiles}" max="${LIMITS.maxFiles}" step="1" data-ld53-max-files value="${esc(agent.maxFiles)}"></label>
            <label class="ld53-field ld53-wide"><span>Limite de contexto</span><select data-ld53-context>${option('250000','250 KB · leve',String(agent.maxContextBytes))}${option('500000','500 KB · recomendado',String(agent.maxContextBytes))}${option('750000','750 KB · ampliado',String(agent.maxContextBytes))}${option('1000000','1 MB · máximo',String(agent.maxContextBytes))}</select></label>
          </div>
          <label class="ld53-field ld53-rules"><span>Regras globais do agente</span><textarea data-ld53-rules maxlength="${LIMITS.maxRules}" placeholder="Regras que devem valer em todos os projetos…">${esc(agent.rules)}</textarea><small>Project Rules continuam independentes e têm contexto por projeto.</small></label>
        </article>
      </section>

      <section class="ld53-card ld53-connections">
        <header><div><small>INTEGRAÇÕES</small><h3>Contas e serviços</h3><p>Configurações sensíveis permanecem nas telas dedicadas da Build 49.</p></div></header>
        <div class="ld53-integrations">
          ${integrationCard('github','GH','GitHub',integrations.github,integrations.githubRepo)}
          ${integrationCard('supabase','SB','Supabase',integrations.supabase,integrations.supabaseProject)}
          ${integrationCard('gemini','✦','Gemini',integrations.gemini,integrations.geminiModel)}
          ${integrationCard('lovable','♥','Lovable',integrations.lovable,integrations.lovable ? 'Projeto detectado' : 'Projeto não detectado')}
        </div>
      </section>

      <footer class="ld53-footer">
        <div class="ld53-vault"><span>◈</span><div><b>Persistência segura</b><small>${esc(vaultText)}</small></div></div>
        <div class="ld53-footer-actions"><button type="button" class="ld53-secondary" data-ld53-reset-ui>Restaurar visual</button><button type="button" class="ld53-primary" data-ld53-save>Salvar configurações</button></div>
      </footer>`;

    $('[data-ld53-save]', body).onclick = save;
    $('[data-ld53-reset-ui]', body).onclick = resetVisual;
    $$('[data-ld53-integration]', body).forEach(button => button.onclick = () => openIntegration(button.dataset.ld53Integration));
  }

  function readForm() {
    const body = $('[data-ld53-body]', overlay);
    const maxFiles = clamp($('[data-ld53-max-files]', body)?.value, LIMITS.minFiles, LIMITS.maxFiles, 18);
    const maxContextBytes = clamp($('[data-ld53-context]', body)?.value, LIMITS.minContext, LIMITS.maxContext, 500000);
    const rules = String($('[data-ld53-rules]', body)?.value || '').slice(0, LIMITS.maxRules);
    return {
      ui: {
        theme: 'nexus',
        background: $('[data-ld53-background]', body)?.value === 'solid' ? 'solid' : 'glass',
        density: $('[data-ld53-density]', body)?.value === 'compact' ? 'compact' : 'comfortable',
        motion: $('[data-ld53-motion]', body)?.value === 'reduced' ? 'reduced' : 'full',
        sounds: !!$('[data-ld53-sounds]', body)?.checked
      },
      gateway: {
        mode: ['auto','fast','deep'].includes($('[data-ld53-gateway]', body)?.value) ? $('[data-ld53-gateway]', body).value : 'auto'
      },
      agent: { maxFiles, maxContextBytes, rules }
    };
  }

  async function save() {
    const button = $('[data-ld53-save]', overlay);
    if (button?.disabled) return false;
    if (button) { button.disabled = true; button.textContent = 'Salvando…'; }
    try {
      const patch = readForm();
      const saved = await runtime({ type:'LD2_SETTINGS_PATCH', patch });
      applyPreferences(saved || patch);
      toast('Configurações salvas.');
      window.dispatchEvent(new CustomEvent('ld53:settings-saved', { detail:{ build:BUILD } }));
      const current = await snapshot();
      render(current);
      return true;
    } catch (error) {
      toast(error?.message || String(error), true);
      return false;
    } finally {
      const next = $('[data-ld53-save]', overlay);
      if (next) { next.disabled = false; next.textContent = 'Salvar configurações'; }
    }
  }

  async function resetVisual() {
    const body = $('[data-ld53-body]', overlay);
    if (!body) return;
    $('[data-ld53-background]', body).value = 'glass';
    $('[data-ld53-density]', body).value = 'comfortable';
    $('[data-ld53-motion]', body).value = 'full';
    $('[data-ld53-sounds]', body).checked = false;
    toast('Visual restaurado no formulário. Salve para confirmar.');
  }

  async function openIntegration(id) {
    close();
    try {
      await window.LovableDecrypterUIActions?.run?.(id, { source:'settings-v53' });
    } catch (error) {
      toast(error?.message || String(error), true);
    }
  }

  async function open() {
    const node = ensureOverlay();
    if (!node) return false;
    node.classList.add('open');
    const token = ++generation;
    loading();
    try {
      const data = await snapshot();
      if (token !== generation) return false;
      applyPreferences({ ui:data.ui, gateway:data.gateway, agent:data.agent });
      render(data);
      return true;
    } catch (error) {
      if (token !== generation) return false;
      const body = $('[data-ld53-body]', overlay);
      if (body) body.innerHTML = `<div class="ld53-error"><b>Não foi possível carregar as configurações</b><span>${esc(error?.message || String(error))}</span><button type="button" data-ld53-retry>Tentar novamente</button></div>`;
      $('[data-ld53-retry]', body)?.addEventListener('click', open);
      return false;
    }
  }

  async function loadAndApply() {
    try {
      const settings = await runtime({ type:'LD2_SETTINGS_GET' });
      applyPreferences(settings || {});
    } catch (_) {}
  }

  function installProvider() {
    if (providerInstalled) return true;
    const registry = window.LovableDecrypterUIActions;
    if (!registry?.register) return false;
    registry.register('settings', open, { build:BUILD, suite:'settings-preferences', credentials:false });
    providerInstalled = true;
    return true;
  }

  window.LovableDecrypterSettings = Object.freeze({
    build: BUILD,
    version: VERSION,
    open,
    close,
    snapshot,
    applyPreferences
  });

  installProvider();
  loadAndApply();
  window.addEventListener('ld2:ui-mounted', () => { installProvider(); loadAndApply(); }, { once:true });
})();