(() => {
  'use strict';
  if (window.__LD2_HARDENING_SENTINEL__) return;
  window.__LD2_HARDENING_SENTINEL__ = true;

  const ROUTING_KEY = 'ld2_native_routing_enabled';
  const WATCH_MS = 2200;
  const ownIds = new Set(['ld2-decrypter-chat-host', 'ld2-root']);
  const composerWords = /message|mensagem|ask|prompt|describe|descreva|chat|lovable|what do you want|type|build|planejar|construir/i;
  const sendWords = /send|submit|enviar|mandar|arrow.?up|paper.?plane|prompt/i;
  const blockedWords = /attach|upload|arquivo|file|image|imagem|voice|voz|microphone|microfone|mic|emoji|plus|adicionar|model|settings|config/i;
  const state = {
    routingEnabled: true,
    online: navigator.onLine !== false,
    phase: 'DEGRADED',
    reason: 'booting',
    blockedNativeIntents: 0,
    updatedAt: 0,
    registry: null,
    timer: 0,
    mountInFlight: null,
    refreshing: null
  };

  const core = () => window.LovableDecrypterHardeningCore;
  const registry = () => window.LovableDecrypterCapabilities;

  function ownSurface(event) {
    const path = event?.composedPath?.() || [];
    return path.some(node => node?.id && ownIds.has(node.id));
  }

  function visible(el) {
    if (!el?.isConnected) return false;
    const rect = el.getBoundingClientRect?.();
    if (!rect || rect.width < 120 || rect.height < 20 || rect.bottom <= 0 || rect.right <= 0) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function inputFromTarget(target) {
    if (!target) return null;
    const input = target.closest?.('textarea,[contenteditable="true"],[role="textbox"]');
    if (!input || input.closest?.('#ld2-root') || input.closest?.('#ld2-decrypter-chat-host') || !visible(input) || input.disabled || input.readOnly) return null;
    const rect = input.getBoundingClientRect();
    if (rect.width < 180 || rect.bottom < innerHeight * 0.48) return null;
    const label = [input.getAttribute('placeholder'), input.getAttribute('aria-label'), input.getAttribute('data-testid')].filter(Boolean).join(' ');
    const form = input.closest('form');
    if (composerWords.test(label)) return input;
    if (form && [...form.querySelectorAll('button')].some(button => sendLike(button))) return input;
    return null;
  }

  function sendLike(button) {
    if (!button || !visible(button)) return false;
    const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.getAttribute('data-testid'), button.textContent].filter(Boolean).join(' ');
    if (blockedWords.test(label)) return false;
    return String(button.type || '').toLowerCase() === 'submit' || sendWords.test(label);
  }

  function formComposer(form) {
    if (!form || form.closest?.('#ld2-root') || form.closest?.('#ld2-decrypter-chat-host')) return null;
    return [...form.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].map(inputFromTarget).find(Boolean) || null;
  }

  function stop(event, reason) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    state.blockedNativeIntents += 1;
    publish(state.phase, reason || 'native_send_blocked');
    window.dispatchEvent(new CustomEvent('ld2:hardening-native-send-blocked', { detail: snapshot() }));
  }

  function shouldBlock(event, intent) {
    return core()?.shouldBlockNativeIntent?.({
      routingEnabled: state.routingEnabled,
      ownSurface: ownSurface(event),
      ...intent
    }) === true;
  }

  function onKeydown(event) {
    const input = inputFromTarget(event.target);
    if (shouldBlock(event, { kind: 'keydown', composer: !!input, key: event.key, shiftKey: event.shiftKey, altKey: event.altKey, isComposing: event.isComposing })) {
      stop(event, 'native_enter_blocked');
    }
  }

  function onClick(event) {
    if (ownSurface(event)) return;
    const button = event.target?.closest?.('button');
    if (!button || !sendLike(button)) return;
    const form = button.closest('form');
    const composer = formComposer(form) || inputFromTarget(document.activeElement);
    if (shouldBlock(event, { kind: 'click', composer: !!composer, sendLike: true })) stop(event, 'native_send_click_blocked');
  }

  function onSubmit(event) {
    const composer = formComposer(event.target);
    if (shouldBlock(event, { kind: 'submit', composer: !!composer })) stop(event, 'native_form_submit_blocked');
  }

  function snapshot() {
    return Object.freeze({
      schema: 'ld-hardening-state/1',
      build: 31,
      phase: state.phase,
      reason: state.reason,
      routingEnabled: state.routingEnabled,
      online: state.online,
      blockedNativeIntents: state.blockedNativeIntents,
      capabilityStatus: state.registry?.summary?.status || 'unknown',
      updatedAt: state.updatedAt || null
    });
  }

  function publish(phase, reason) {
    const changed = state.phase !== phase || state.reason !== reason;
    state.phase = phase;
    state.reason = String(reason || '').slice(0, 240);
    state.updatedAt = Date.now();
    document.documentElement.dataset.ld2Hardening = state.phase.toLowerCase();
    document.documentElement.dataset.ld2HardeningReason = state.reason;
    if (changed) window.dispatchEvent(new CustomEvent('ld2:hardening-state', { detail: snapshot() }));
  }

  async function readRouting() {
    try {
      const stored = await chrome.storage.local.get(ROUTING_KEY);
      state.routingEnabled = stored[ROUTING_KEY] !== false;
    } catch (_) {
      state.routingEnabled = true;
    }
  }

  async function safeRemount() {
    if (!state.routingEnabled || !state.online || state.mountInFlight || typeof window.LovableDecrypterChat?.mount !== 'function') return;
    const chat = window.LovableDecrypterChat?.snapshot?.();
    if (chat?.mounted && ['READY', 'BUSY'].includes(String(chat?.phase || '').toUpperCase())) return;
    state.mountInFlight = Promise.resolve(window.LovableDecrypterChat.mount())
      .catch(() => null)
      .finally(() => { state.mountInFlight = null; });
    await state.mountInFlight;
  }

  async function refresh(reason = 'watchdog') {
    if (state.refreshing) return state.refreshing;
    state.refreshing = (async () => {
      await readRouting();
      state.online = navigator.onLine !== false;
      try { state.registry = await registry()?.refresh?.(reason) || await registry()?.getLast?.() || null; }
      catch (_) { state.registry = await registry()?.getLast?.().catch?.(() => null) || null; }
      let chat = null;
      try { chat = window.LovableDecrypterChat?.snapshot?.() || null; } catch (_) {}
      const evaluated = core()?.evaluateHardening?.({
        online: state.online,
        routingEnabled: state.routingEnabled,
        chat,
        capabilitySummary: state.registry?.summary || null
      }) || { phase: 'DEGRADED', reason: 'hardening_core_unavailable' };
      publish(evaluated.phase, `${reason}:${evaluated.reason}`);
      if (state.routingEnabled && state.online && (evaluated.phase === 'DEGRADED' || !chat?.mounted)) {
        await safeRemount();
        try { state.registry = await registry()?.refresh?.('post-remount') || state.registry; } catch (_) {}
        try { chat = window.LovableDecrypterChat?.snapshot?.() || chat; } catch (_) {}
        const after = core()?.evaluateHardening?.({ online: state.online, routingEnabled: state.routingEnabled, chat, capabilitySummary: state.registry?.summary || null });
        if (after) publish(after.phase, `post-remount:${after.reason}`);
      }
      return snapshot();
    })().finally(() => { state.refreshing = null; });
    return state.refreshing;
  }

  function schedule(reason) {
    setTimeout(() => refresh(reason).catch(() => {}), 80);
  }

  window.addEventListener('keydown', onKeydown, true);
  window.addEventListener('click', onClick, true);
  window.addEventListener('submit', onSubmit, true);
  window.addEventListener('online', () => { state.online = true; schedule('online'); });
  window.addEventListener('offline', () => { state.online = false; publish(state.routingEnabled ? 'LOCKED' : 'READY', state.routingEnabled ? 'offline' : 'native_mode'); });
  window.addEventListener('popstate', () => schedule('popstate'));
  window.addEventListener('hashchange', () => schedule('hashchange'));
  window.addEventListener('ld2:project', () => schedule('project-change'));
  window.addEventListener('ld2:decrypter-chat-state', () => schedule('chat-state'));
  window.addEventListener('ld2:composer-guardian-state', () => schedule('composer-state'));
  window.addEventListener('ld2:project-state-graph', () => schedule('project-state'));
  window.addEventListener('ld2:dom-reconcile', () => schedule('dom-reconcile'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule('visible'); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[ROUTING_KEY]) schedule('routing-change');
  });

  state.timer = setInterval(() => refresh('watchdog').catch(() => {}), WATCH_MS);
  addEventListener('beforeunload', () => clearInterval(state.timer), { once: true });

  window.LovableDecrypterHardening = Object.freeze({
    build: 31,
    schema: 'ld-hardening-state/1',
    snapshot,
    refresh,
    capabilities: () => state.registry
  });

  refresh('boot').catch(() => publish('DEGRADED', 'boot_failed'));
})();