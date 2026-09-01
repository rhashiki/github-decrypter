(() => {
  'use strict';
  if (window.__LD55_BACKEND_MESSAGING__) return;
  window.__LD55_BACKEND_MESSAGING__ = true;

  const ROOT_ID = 'ld2-root';
  const VOICE_KEY = 'ld2_voice_enabled';
  const seen = new Map();
  let voiceEnabled = true;
  let observer = null;
  let selectedVoice = null;

  const root = () => document.getElementById(ROOT_ID);
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  const canSpeak = () => voiceEnabled && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  function pickNaturalVoice(profile = {}) {
    const voices = (() => { try { return window.speechSynthesis.getVoices() || []; } catch (_) { return []; } })();
    if (!voices.length) return null;
    const lang = String(profile.lang || 'pt-BR').replace('_', '-').toLowerCase();
    const exact = voices.filter(v => String(v.lang || '').replace('_', '-').toLowerCase() === lang);
    const family = voices.filter(v => String(v.lang || '').toLowerCase().startsWith(lang.split('-')[0]));
    const pool = exact.length ? exact : family.length ? family : voices;
    const natural = pool.find(v => /natural|neural|online/i.test(String(v.name || '')));
    const local = pool.find(v => v.localService === true);
    return natural || local || pool[0] || null;
  }

  function dedupe(key, ms) {
    const now = Date.now();
    const previous = Number(seen.get(key) || 0);
    if (now - previous < ms) return true;
    seen.set(key, now);
    return false;
  }

  function speak(message) {
    const voice = message?.voice || {};
    if (!message?.text || voice.speak === false || !canSpeak()) return false;
    const key = `${message.key || 'dynamic'}:${message.text}`;
    if (dedupe(key, Number(voice.dedupeMs || 3500))) return false;
    try {
      const utterance = new SpeechSynthesisUtterance(String(message.text));
      utterance.lang = String(voice.lang || 'pt-BR');
      utterance.rate = Number(voice.rate || 0.96);
      utterance.pitch = Number(voice.pitch || 0.94);
      utterance.volume = Number(voice.volume || 1);
      selectedVoice = selectedVoice || pickNaturalVoice(voice);
      if (selectedVoice) utterance.voice = selectedVoice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (_) { return false; }
  }

  function render(message, options = {}) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap || !message?.text || options.visual === false) {
      if (options.speak !== false) speak(message);
      return null;
    }
    const node = document.createElement('div');
    node.className = `ld2-toast${message.tone === 'error' ? ' error' : ''}`;
    node.dataset.ld55Canonical = '1';
    node.textContent = String(message.text);
    wrap.appendChild(node);
    setTimeout(() => node.remove(), Number(options.durationMs || 3600));
    if (options.speak !== false) speak(message);
    return node;
  }

  async function resolve(key, params = {}, options = {}) {
    const message = await runtime({ type:'LD2_MESSAGE_RESOLVE', key, params });
    render(message, options);
    return message;
  }

  async function normalize(text, tone = 'info', options = {}) {
    const source = String(text || '').trim();
    if (!source) return null;
    try {
      const message = await runtime({ type:'LD2_MESSAGE_NORMALIZE', text: source, tone, error: tone === 'error' });
      render(message, options);
      return message;
    } catch (_) {
      const fallback = { key:'client-fallback', text:source, tone, voice:{ speak:false }, authority:'fallback' };
      render(fallback, { ...options, speak:false });
      return fallback;
    }
  }

  function interceptToast(node) {
    if (!(node instanceof Element) || !node.classList.contains('ld2-toast') || node.dataset.ld55Canonical === '1') return;
    const text = String(node.textContent || '').trim();
    if (!text) return;
    const tone = node.classList.contains('error') ? 'error' : 'info';
    node.remove();
    normalize(text, tone).catch(() => {});
  }

  function installObserver() {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap || observer) return false;
    for (const node of [...wrap.children]) interceptToast(node);
    observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) interceptToast(node);
    });
    observer.observe(wrap, { childList:true });
    return true;
  }

  function bindEvents() {
    window.addEventListener('ld2:message', event => {
      const key = String(event?.detail?.key || '').trim();
      if (!key) return;
      resolve(key, event?.detail?.params || {}, event?.detail?.options || {}).catch(() => {});
    });
    window.addEventListener('ld2:github-connected', () => resolve('github-success').catch(() => {}));
    window.addEventListener('ld2:lovable-github-migration-success', () => resolve('lovable-github-success').catch(() => {}));
    window.addEventListener('ld2:lovable-github-migration-failure', () => resolve('lovable-github-failure').catch(() => {}));
    window.addEventListener('ld2:cloud-supabase-migration-success', () => resolve('cloud-supabase-success').catch(() => {}));
    window.addEventListener('ld2:cloud-supabase-migration-failure', () => resolve('cloud-supabase-failure').catch(() => {}));
    window.addEventListener('ld2:monitor-changed', event => resolve(event?.detail?.enabled === false ? 'monitor-off' : 'monitor-on').catch(() => {}));
  }

  async function maybeWelcome() {
    try {
      const status = await runtime({ type:'LD2_LICENSE_STATUS' });
      if (status?.valid) await resolve('welcome', {}, { visual:false });
    } catch (_) {}
  }

  chrome.storage.local.get(VOICE_KEY).then(data => { voiceEnabled = data[VOICE_KEY] !== false; }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[VOICE_KEY]) voiceEnabled = changes[VOICE_KEY].newValue !== false;
  });
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.addEventListener('voiceschanged', () => { selectedVoice = pickNaturalVoice(); }); } catch (_) {}
    selectedVoice = pickNaturalVoice();
  }

  bindEvents();
  const boot = () => {
    if (!root()) return false;
    installObserver();
    maybeWelcome();
    return true;
  };
  if (!boot()) document.addEventListener('DOMContentLoaded', boot, { once:true });
  queueMicrotask(boot);

  window.LovableDecrypterMessaging = Object.freeze({
    build:55,
    schema:'ld-backend-messaging/2',
    backendAuthority:true,
    localCatalog:false,
    resolve,
    normalize,
    speak,
    refreshVoice:() => (selectedVoice = pickNaturalVoice()),
    get selectedVoiceName(){ return selectedVoice?.name || ''; },
    get enabled(){ return voiceEnabled; }
  });
})();
