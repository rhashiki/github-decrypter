(() => {
  'use strict';
  if (window.__LD2_VOICE_FEEDBACK__) return;
  window.__LD2_VOICE_FEEDBACK__ = true;

  const VOICE_KEY = 'ld2_voice_enabled';
  const MONITOR_KEY = 'ld2_monitor_enabled';
  const ROOT_ID = 'ld2-root';
  const DEFAULT_RATE = 0.95;
  const DEFAULT_PITCH = 0.92;
  const DEFAULT_VOLUME = 1;
  const dedupe = new Map();
  const pending = new Map();
  let voiceEnabled = true;
  let selectedVoice = null;
  let welcomeSpoken = false;
  let toastObserver = null;
  let gateObserver = null;

  const MESSAGES = Object.freeze({
    welcome: 'Bem-vindo ao Lovable Decrypter. Tudo pronto para começar.',
    'license-success': 'Licença ativada com sucesso. Bem-vindo ao Lovable Decrypter.',
    'github-success': 'Conexão com o GitHub realizada com sucesso. Repositório pronto para trabalhar.',
    'supabase-success': 'Conexão com o Supabase realizada com sucesso. Projeto sincronizado e disponível.',
    'zip-success': 'Download concluído. O arquivo ZIP do projeto está pronto.',
    'lovable-github-success': 'Migração concluída. Seu projeto do Lovable foi enviado para o GitHub com sucesso.',
    'cloud-supabase-success': 'Migração concluída. Seu projeto saiu do Lovable Cloud e agora está configurado no Supabase.',
    'github-failure': 'Não foi possível conectar ao GitHub. Verifique sua conta, permissões e tente novamente.',
    'supabase-failure': 'Não foi possível conectar ao Supabase. Verifique o projeto, as credenciais e tente novamente.',
    'zip-failure': 'O download do ZIP não pôde ser concluído. Verifique o projeto e tente novamente.',
    'lovable-github-failure': 'A migração para o GitHub falhou. Nenhuma alteração incompleta será considerada concluída. Verifique os detalhes antes de tentar novamente.',
    'cloud-supabase-failure': 'A migração para o Supabase não pôde ser concluída. Verifique o diagnóstico antes de tentar novamente.',
    'monitor-on': 'Monitor ativado. O Decrypter está acompanhando o projeto.',
    'monitor-off': 'Monitor desativado. O acompanhamento automático foi interrompido.',
    'credits-consuming': 'Atenção. Esta operação está utilizando seus créditos do Decrypter. O consumo continuará enquanto a execução estiver ativa.'
  });

  const PREFERRED_MALE_PTBR = [
    /microsoft antonio.*natural/i,
    /antonio/i,
    /microsoft donato.*natural/i,
    /donato/i,
    /microsoft daniel/i,
    /daniel/i,
    /ricardo/i,
    /felipe/i,
    /paulo/i,
    /lucas/i,
    /google.*portugu[eê]s.*brasil/i,
    /portugu[eê]s.*brasil/i
  ];

  function root() { return document.getElementById(ROOT_ID); }
  function now() { return Date.now(); }
  function canSpeak() { return voiceEnabled && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; }

  function availableVoices() {
    try { return window.speechSynthesis.getVoices() || []; } catch (_) { return []; }
  }

  function pickVoice() {
    const voices = availableVoices();
    if (!voices.length) return null;
    const ptBr = voices.filter(v => /^pt[-_]BR$/i.test(String(v.lang || '')) || /portugu[eê]s.*brasil/i.test(String(v.name || '')));
    const pt = ptBr.length ? ptBr : voices.filter(v => /^pt\b/i.test(String(v.lang || '')) || /portugu[eê]s/i.test(String(v.name || '')));
    const pool = pt.length ? pt : voices;
    for (const pattern of PREFERRED_MALE_PTBR) {
      const match = pool.find(v => pattern.test(String(v.name || '')));
      if (match) return match;
    }
    return pool[0] || null;
  }

  function refreshVoice() { selectedVoice = pickVoice(); return selectedVoice; }

  function recentlySpoken(key, ms = 3500) {
    const previous = Number(dedupe.get(key) || 0);
    if (now() - previous < ms) return true;
    dedupe.set(key, now());
    return false;
  }

  function speak(key, options = {}) {
    const text = options.text || MESSAGES[key];
    if (!text || !canSpeak() || recentlySpoken(key, Number(options.dedupeMs || 3500))) return false;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = Number(options.rate || DEFAULT_RATE);
      utterance.pitch = Number(options.pitch || DEFAULT_PITCH);
      utterance.volume = Number(options.volume || DEFAULT_VOLUME);
      utterance.voice = selectedVoice || refreshVoice();
      if (options.interrupt !== false) window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (_) {
      return false;
    }
  }

  function mark(action, ttlMs = 60000) {
    pending.set(action, now() + ttlMs);
  }

  function active(action) {
    const until = Number(pending.get(action) || 0);
    if (!until || until < now()) { pending.delete(action); return false; }
    return true;
  }

  function clear(action) { pending.delete(action); }

  async function maybeWarnCredits() {
    try {
      const runtime = window.LovableDecrypterV2?.runtime;
      if (!runtime) return;
      const status = await runtime({ type: 'LD2_LICENSE_STATUS' });
      if (status?.valid && status?.entitlement?.source === 'credits') speak('credits-consuming', { dedupeMs: 12000 });
    } catch (_) {}
  }

  function classifyToast(node) {
    if (!(node instanceof Element) || !node.classList.contains('ld2-toast')) return;
    const text = String(node.textContent || '').trim();
    const error = node.classList.contains('error');
    if (!text) return;

    if (/GitHub conectado:/i.test(text)) { clear('github'); speak('github-success'); return; }
    if (/Supabase conectado\.?/i.test(text)) { clear('supabase'); speak('supabase-success'); return; }
    if (/Download iniciado/i.test(text) && active('zip')) { clear('zip'); speak('zip-success'); return; }
    if (/Login concluído/i.test(text) && active('license')) { clear('license'); speak('license-success', { dedupeMs: 5000 }); return; }
    if (/Migração completa concluída|Migração concluída e verificada/i.test(text) && active('cloud-supabase')) {
      clear('cloud-supabase'); speak('cloud-supabase-success', { dedupeMs: 8000 }); return;
    }

    if (!error) return;
    if (active('github')) { clear('github'); speak('github-failure'); return; }
    if (active('supabase')) { clear('supabase'); speak('supabase-failure'); return; }
    if (active('zip')) { clear('zip'); speak('zip-failure'); return; }
    if (active('cloud-supabase')) { clear('cloud-supabase'); speak('cloud-supabase-failure'); }
  }

  function installToastObserver() {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap || toastObserver) return false;
    toastObserver = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) classifyToast(node);
    });
    toastObserver.observe(wrap, { childList: true });
    return true;
  }

  async function maybeWelcome() {
    if (welcomeSpoken) return;
    try {
      const status = await window.LovableDecrypterV2?.runtime?.({ type: 'LD2_LICENSE_STATUS' });
      if (!status?.valid) return;
      welcomeSpoken = true;
      setTimeout(() => speak('welcome', { dedupeMs: 10000 }), 180);
    } catch (_) {}
  }

  function monitorIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8"/><path d="M7.2 5.6a8 8 0 1 0 9.6 0"/></svg>';
  }

  function installStyle() {
    if (document.getElementById('ld2-voice-monitor-style')) return;
    const style = document.createElement('style');
    style.id = 'ld2-voice-monitor-style';
    style.textContent = `
      #ld2-root .ld2-monitor-toggle{display:grid;place-items:center;padding:0}
      #ld2-root .ld2-monitor-toggle svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round}
      #ld2-root .ld2-monitor-toggle[data-enabled="1"]{color:var(--ld2-green);border-color:rgba(57,255,132,.48);box-shadow:0 0 16px rgba(57,255,132,.10)}
      #ld2-root .ld2-monitor-toggle[data-enabled="0"]{color:var(--ld2-danger);border-color:rgba(255,82,99,.35)}
      #ld2-root .ld2-fab.monitor-off .ld2-fab-status{background:var(--ld2-danger)!important}
    `;
    document.documentElement.appendChild(style);
  }

  async function readMonitor() {
    try {
      const data = await chrome.storage.local.get(MONITOR_KEY);
      return data[MONITOR_KEY] !== false;
    } catch (_) { return true; }
  }

  function renderMonitorState(button, enabled) {
    if (!button) return;
    button.dataset.enabled = enabled ? '1' : '0';
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.title = enabled ? 'Monitor ativado' : 'Monitor desativado';
    root()?.querySelector('.ld2-fab')?.classList.toggle('monitor-off', !enabled);
  }

  async function setMonitor(enabled, announce = true) {
    const value = enabled !== false;
    await chrome.storage.local.set({ [MONITOR_KEY]: value });
    const button = root()?.querySelector('[data-monitor-toggle]');
    renderMonitorState(button, value);
    window.dispatchEvent(new CustomEvent('ld2:monitor-changed', { detail: { enabled: value } }));
    if (announce) speak(value ? 'monitor-on' : 'monitor-off', { dedupeMs: 1200 });
    return value;
  }

  async function installMonitorButton() {
    const header = root()?.querySelector('.ld2-head');
    const settings = header?.querySelector('[data-settings]');
    if (!header || !settings) return false;
    let button = header.querySelector('[data-monitor-toggle]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'ld2-icon-btn ld2-monitor-toggle';
      button.dataset.monitorToggle = '1';
      button.setAttribute('aria-label', 'Ativar ou desativar monitor');
      button.innerHTML = monitorIcon();
      settings.parentNode.insertBefore(button, settings);
      button.addEventListener('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        const current = button.dataset.enabled !== '0';
        await setMonitor(!current, true);
      });
    }
    renderMonitorState(button, await readMonitor());
    return true;
  }

  function trackActions(event) {
    const target = event.target instanceof Element ? event.target.closest('#ld2-root button, #ld2-root [role="button"]') : null;
    if (!target) return;
    if (target.matches('[data-test-gh]')) mark('github', 90000);
    if (target.matches('[data-action="zip"], [data-cc-action="zip"], [data-ul-action="zip"]')) mark('zip', 90000);
    if (target.matches('[data-sbm-connect]')) mark('supabase', 150000);
    if (target.matches('[data-cm-start], [data-cm-run]')) mark('cloud-supabase', 30 * 60 * 1000);
    if (target.matches('[data-license-login]')) mark('license', 90000);
    if (target.matches('[data-send]')) maybeWarnCredits();
  }

  function trackKeyboard(event) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.target instanceof Element && event.target.matches('#ld2-root [data-command]')) maybeWarnCredits();
  }

  function installGateObserver() {
    const gate = root()?.querySelector('[data-license-gate]');
    if (!gate || gateObserver) return;
    gateObserver = new MutationObserver(() => {
      if (gate.hidden && active('license')) {
        clear('license');
        speak('license-success', { dedupeMs: 5000 });
      }
    });
    gateObserver.observe(gate, { attributes: true, attributeFilter: ['hidden'] });
  }

  function bindCustomEvents() {
    window.addEventListener('ld2:github-connected', () => speak('github-success'));
    window.addEventListener('ld2:lovable-github-migration-success', () => speak('lovable-github-success', { dedupeMs: 8000 }));
    window.addEventListener('ld2:lovable-github-migration-failure', () => speak('lovable-github-failure', { dedupeMs: 8000 }));
    window.addEventListener('ld2:cloud-supabase-migration-success', () => speak('cloud-supabase-success', { dedupeMs: 8000 }));
    window.addEventListener('ld2:cloud-supabase-migration-failure', () => speak('cloud-supabase-failure', { dedupeMs: 8000 }));
    window.addEventListener('ld2:voice', event => {
      const key = String(event?.detail?.key || '');
      if (MESSAGES[key]) speak(key, event.detail || {});
    });
  }

  async function install() {
    installStyle();
    await installMonitorButton();
    installToastObserver();
    installGateObserver();
    maybeWelcome();
  }

  chrome.storage.local.get(VOICE_KEY).then(data => { voiceEnabled = data[VOICE_KEY] !== false; }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[VOICE_KEY]) voiceEnabled = changes[VOICE_KEY].newValue !== false;
    if (changes[MONITOR_KEY]) renderMonitorState(root()?.querySelector('[data-monitor-toggle]'), changes[MONITOR_KEY].newValue !== false);
  });

  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.addEventListener('voiceschanged', refreshVoice); } catch (_) {}
    refreshVoice();
  }

  document.addEventListener('click', trackActions, true);
  document.addEventListener('keydown', trackKeyboard, true);
  bindCustomEvents();

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (root()) {
      install();
      if (installToastObserver() && root()?.querySelector('[data-monitor-toggle]')) clearInterval(timer);
    }
    if (attempts >= 120) clearInterval(timer);
  }, 250);

  window.LovableDecrypterVoice = Object.freeze({
    messages: MESSAGES,
    speak,
    setMonitor,
    refreshVoice,
    get selectedVoiceName() { return selectedVoice?.name || ''; },
    get enabled() { return voiceEnabled; }
  });
})();
