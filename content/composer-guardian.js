(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_COMPOSER_GUARDIAN__) return;
  window.__LOVABLE_DECRYPTER_COMPOSER_GUARDIAN__ = true;

  const ROUTING_KEY = 'ld2_native_routing_enabled';
  const FINGERPRINT_KEY = 'ld2_composer_fingerprint_v1';
  const SCAN_DEBOUNCE_MS = 140;
  const WATCHDOG_MS = 5000;
  const RELEVANT_SELECTOR = 'textarea,[contenteditable="true"],[role="textbox"],form,button,.ld2-native-bridge';

  const state = {
    routingEnabled: null,
    health: 'INACTIVE',
    reason: 'booting',
    fingerprint: '',
    previousFingerprint: '',
    stableFingerprint: '',
    stableCount: 0,
    dispatchVerifiedAt: 0,
    input: null,
    bar: null,
    sendButton: null,
    form: null,
    scanTimer: 0,
    scanning: false,
    observer: null,
    lastUpdatedAt: 0
  };

  const blockedWords = /attach|upload|arquivo|file|image|imagem|voice|voz|microphone|microfone|mic|emoji|plus|adicionar|model|settings|config/i;
  const sendWords = /send|submit|enviar|mandar|arrow.?up|paper.?plane|prompt/i;
  const composerWords = /message|mensagem|ask|prompt|describe|descreva|chat|lovable|what do you want|type|build|planejar|construir/i;

  function visible(el, minWidth = 20, minHeight = 20) {
    if (!el || !el.isConnected || el.closest?.('#ld2-root')) return false;
    const rect = el.getBoundingClientRect?.();
    if (!rect || rect.width < minWidth || rect.height < minHeight) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight;
  }

  function scoreInput(el) {
    if (!visible(el, 180, 24) || el.disabled || el.readOnly) return -1;
    const rect = el.getBoundingClientRect();
    const label = String(el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').toLowerCase();
    let score = 0;
    if (el.tagName === 'TEXTAREA') score += 5;
    if (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox') score += 3;
    if (rect.width >= 300) score += 3;
    if (rect.bottom >= innerHeight * 0.55) score += 3;
    if (composerWords.test(label)) score += 5;
    if (el.closest('form')) score += 2;
    return score;
  }

  function findInput() {
    return [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
      .map(el => ({ el, score: scoreInput(el) }))
      .filter(item => item.score >= 6)
      .sort((a, b) => b.score - a.score || b.el.getBoundingClientRect().bottom - a.el.getBoundingClientRect().bottom)[0]?.el || null;
  }

  function buttonLabel(btn) {
    return [btn?.getAttribute?.('aria-label'), btn?.getAttribute?.('title'), btn?.getAttribute?.('data-testid'), btn?.getAttribute?.('name'), btn?.textContent]
      .filter(Boolean).join(' ').trim().toLowerCase();
  }

  function hasSendSurface(form) {
    if (!form) return false;
    return [...form.querySelectorAll('button')].some(btn => {
      if (!visible(btn)) return false;
      const label = buttonLabel(btn);
      if (blockedWords.test(label)) return false;
      return String(btn.type || '').toLowerCase() === 'submit' || sendWords.test(label);
    });
  }

  function looseComposerInput(target = null) {
    const candidates = target?.closest?.('textarea,[contenteditable="true"],[role="textbox"]')
      ? [target.closest('textarea,[contenteditable="true"],[role="textbox"]')]
      : [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')];
    return candidates
      .filter(el => visible(el, 180, 24) && !el.disabled && !el.readOnly)
      .filter(el => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < innerHeight * 0.52) return false;
        const label = String(el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('data-testid') || '').toLowerCase();
        return composerWords.test(label) || hasSendSurface(el.closest('form'));
      })
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0] || null;
  }

  function findSendButton(input) {
    if (!input) return null;
    const form = input.closest('form');
    const scope = form || input.parentElement?.parentElement || document;
    const ir = input.getBoundingClientRect();
    return [...scope.querySelectorAll('button')]
      .filter(btn => visible(btn))
      .map(btn => {
        const label = buttonLabel(btn);
        if (blockedWords.test(label)) return { btn, score: -100 };
        const rect = btn.getBoundingClientRect();
        let score = 0;
        if (String(btn.type || '').toLowerCase() === 'submit') score += 12;
        if (sendWords.test(label)) score += 18;
        if (rect.left >= ir.left + ir.width * 0.55) score += 4;
        if (rect.top <= ir.bottom + 36 && rect.bottom >= ir.top - 36) score += 4;
        if (rect.width <= 90 && rect.height <= 90) score += 2;
        return { btn, score };
      })
      .filter(item => item.score >= 8)
      .sort((a, b) => b.score - a.score)[0]?.btn || null;
  }

  function findBridge(input) {
    if (!input) return null;
    const bars = [...document.querySelectorAll('.ld2-native-bridge')].filter(bar => visible(bar, 100, 12));
    if (!bars.length) return null;
    const inputRect = input.getBoundingClientRect();
    return bars
      .map(bar => {
        const rect = bar.getBoundingClientRect();
        const siblingOwnsInput = !!bar.nextElementSibling?.contains?.(input);
        const distance = Math.abs(inputRect.top - rect.bottom);
        return { bar, score: (siblingOwnsInput ? 1000 : 0) - distance };
      })
      .sort((a, b) => b.score - a.score)[0]?.bar || null;
  }

  function routeShape() {
    return `${location.pathname}${location.hash}`
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/ig, ':uuid')
      .replace(/\/projects?\/[^/?#]+/ig, '/project/:id')
      .slice(0, 240);
  }

  function signature(input, bar, sendButton, form) {
    const inputBits = input ? [
      input.tagName,
      input.getAttribute('role') || '',
      input.getAttribute('contenteditable') || '',
      input.getAttribute('placeholder') || '',
      input.getAttribute('aria-label') || '',
      input.getAttribute('data-testid') || ''
    ] : ['NO_INPUT'];
    const sendBits = sendButton ? [sendButton.tagName, sendButton.type || '', buttonLabel(sendButton), sendButton.getAttribute('data-testid') || ''] : ['NO_SEND'];
    const barBits = bar ? ['BRIDGE', bar.classList.contains('routing-off') ? 'OFF' : 'ON'] : ['NO_BRIDGE'];
    const formBits = form ? ['FORM', form.getAttribute('data-testid') || '', form.getAttribute('aria-label') || ''] : ['NO_FORM'];
    return JSON.stringify({ route: routeShape(), input: inputBits, send: sendBits, bar: barBits, form: formBits });
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(String(value || ''));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function toast(message, error = false) {
    const wrap = document.querySelector('#ld2-root .ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  function ensureBadge() {
    const bar = state.bar;
    if (!bar?.isConnected) return null;
    let badge = bar.querySelector('[data-ld2-composer-guardian]');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'ld2-composer-guardian-badge';
      badge.dataset.ld2ComposerGuardian = '1';
      badge.setAttribute('aria-live', 'polite');
      const row = bar.querySelector('.ld2-bridge-bottom') || bar;
      row.appendChild(badge);
    }
    return badge;
  }

  function renderState() {
    const root = document.getElementById('ld2-root');
    if (root) {
      root.dataset.ld2ComposerGuardian = state.health.toLowerCase();
      root.dataset.ld2ComposerGuardianReason = state.reason;
    }
    const badge = ensureBadge();
    if (badge) {
      badge.dataset.state = state.health.toLowerCase();
      badge.textContent = `GUARD ${state.health}`;
      const dispatch = state.dispatchVerifiedAt ? ` · dispatch verificado ${new Date(state.dispatchVerifiedAt).toLocaleTimeString('pt-BR')}` : ' · dispatch será verificado no próximo envio';
      badge.title = `${state.reason}${state.fingerprint ? ` · fingerprint ${state.fingerprint.slice(0, 12)}` : ''}${dispatch}`;
    }
  }

  function publish(health, reason, extra = {}) {
    const changed = state.health !== health || state.reason !== reason;
    state.health = health;
    state.reason = reason;
    state.lastUpdatedAt = Date.now();
    renderState();
    if (changed || extra.force) {
      window.dispatchEvent(new CustomEvent('ld2:composer-guardian-state', { detail: snapshot() }));
    }
  }

  function snapshot() {
    return Object.freeze({
      health: state.health,
      reason: state.reason,
      routingEnabled: state.routingEnabled === true,
      fingerprint: state.fingerprint,
      fingerprintShort: state.fingerprint.slice(0, 12),
      dispatchVerified: state.dispatchVerifiedAt > 0,
      dispatchVerifiedAt: state.dispatchVerifiedAt || null,
      inputFound: !!state.input?.isConnected,
      bridgeFound: !!state.bar?.isConnected,
      sendFound: !!state.sendButton?.isConnected,
      formFound: !!state.form?.isConnected,
      updatedAt: state.lastUpdatedAt
    });
  }

  async function persistFingerprint(fingerprint) {
    state.previousFingerprint = fingerprint;
    await chrome.storage.local.set({ [FINGERPRINT_KEY]: { fingerprint, at: Date.now(), route: routeShape() } });
  }

  async function scan(force = false) {
    if (state.scanning) return;
    state.scanning = true;
    try {
      const input = findInput();
      const bar = findBridge(input);
      const form = input?.closest('form') || null;
      const sendButton = findSendButton(input);
      state.input = input;
      state.bar = bar;
      state.form = form;
      state.sendButton = sendButton;

      if (state.routingEnabled !== true) {
        state.fingerprint = '';
        state.stableFingerprint = '';
        state.stableCount = 0;
        publish('INACTIVE', state.routingEnabled === false ? 'routing_off' : 'routing_state_loading', { force });
        return;
      }
      if (!input) {
        state.fingerprint = '';
        state.stableFingerprint = '';
        state.stableCount = 0;
        publish('INACTIVE', 'composer_not_found', { force });
        return;
      }
      if (!bar) {
        publish('DEGRADED', 'bridge_not_attached', { force });
        return;
      }

      const fingerprint = await sha256(signature(input, bar, sendButton, form));
      state.fingerprint = fingerprint;
      if (state.stableFingerprint === fingerprint) state.stableCount += 1;
      else {
        state.stableFingerprint = fingerprint;
        state.stableCount = 1;
      }

      if (!state.previousFingerprint) {
        if (state.stableCount >= 2) await persistFingerprint(fingerprint);
      } else if (state.previousFingerprint !== fingerprint) {
        if (state.stableCount < 2) {
          publish('DEGRADED', 'compatibility_fingerprint_changed', { force });
          return;
        }
        await persistFingerprint(fingerprint);
      }

      const relationOk = !!(bar.nextElementSibling?.contains?.(input) || Math.abs(input.getBoundingClientRect().top - bar.getBoundingClientRect().bottom) < 420);
      if (!relationOk) {
        publish('DEGRADED', 'bridge_input_relation_uncertain', { force });
        return;
      }
      if (!form && !sendButton) {
        publish('DEGRADED', 'native_dispatch_surface_uncertain', { force });
        return;
      }
      publish('OK', state.dispatchVerifiedAt ? 'protected_and_dispatch_verified' : 'protected_dispatch_pending', { force });
    } catch (error) {
      publish('INACTIVE', `guardian_scan_error:${String(error?.message || error).slice(0, 120)}`, { force: true });
    } finally {
      state.scanning = false;
    }
  }

  function scheduleScan(delay = SCAN_DEBOUNCE_MS, force = false) {
    clearTimeout(state.scanTimer);
    state.scanTimer = setTimeout(() => scan(force), delay);
  }

  function relevantMutation(mutation) {
    if (state.input && !state.input.isConnected) return true;
    if (state.bar && !state.bar.isConnected) return true;
    const nodes = [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])];
    return nodes.some(node => node?.nodeType === 1 && (node.matches?.(RELEVANT_SELECTOR) || node.querySelector?.(RELEVANT_SELECTOR)));
  }

  function stopNative(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function targetInsideInput(target, input) {
    return !!(target && input && (target === input || input.contains?.(target)));
  }

  function clickLooksLikeSend(button, input) {
    if (!button || !input || !visible(button)) return false;
    const label = buttonLabel(button);
    if (blockedWords.test(label)) return false;
    const form = input.closest('form');
    if (form?.contains(button) && String(button.type || '').toLowerCase() === 'submit') return true;
    if (!sendWords.test(label)) return false;
    const ir = input.getBoundingClientRect();
    const br = button.getBoundingClientRect();
    return br.top <= ir.bottom + 48 && br.bottom >= ir.top - 48;
  }

  function restoreBridgeStatus(message, kind = 'error') {
    const el = state.bar?.querySelector('[data-ld2-bridge-status]');
    if (!el) return;
    el.textContent = message;
    el.dataset.kind = kind;
  }

  function dispatchThroughBridge(input, source) {
    if (!input?.isConnected) {
      publish('INACTIVE', 'dispatch_input_missing', { force: true });
      toast('Composer Guardian bloqueou o envio: o composer mudou antes do roteamento.', true);
      return false;
    }
    const synthetic = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(synthetic);
    if (!synthetic.defaultPrevented) {
      state.dispatchVerifiedAt = 0;
      publish('INACTIVE', 'dispatch_not_intercepted', { force: true });
      restoreBridgeStatus('GUARD INACTIVE · envio bloqueado porque o Composer Bridge não confirmou a interceptação.', 'error');
      toast('Envio bloqueado por segurança: o Composer Bridge não confirmou a interceptação. Recarregue a página.', true);
      scheduleScan(0, true);
      return false;
    }
    state.dispatchVerifiedAt = Date.now();
    publish('OK', 'protected_and_dispatch_verified', { force: true });
    window.dispatchEvent(new CustomEvent('ld2:composer-dispatch-verified', { detail: { source, at: state.dispatchVerifiedAt, fingerprint: state.fingerprint } }));
    return true;
  }

  function guardKeydown(event) {
    if (state.routingEnabled !== true || !event.isTrusted) return;
    if (event.isComposing || event.key !== 'Enter' || event.shiftKey || event.altKey) return;
    const primary = state.input?.isConnected ? state.input : findInput();
    const input = targetInsideInput(event.target, primary) ? primary : looseComposerInput(event.target);
    if (!input || !targetInsideInput(event.target, input)) return;
    stopNative(event);
    dispatchThroughBridge(input, 'guardian-enter');
  }

  function guardClick(event) {
    if (state.routingEnabled !== true || !event.isTrusted) return;
    const button = event.target?.closest?.('button');
    if (!button || !visible(button)) return;
    const primary = state.input?.isConnected ? state.input : findInput();
    const input = primary || looseComposerInput();
    let looksLikeSend = clickLooksLikeSend(button, input);
    if (!looksLikeSend && window.LovableDecrypterV2?.getProjectId?.()) {
      const label = buttonLabel(button);
      const rect = button.getBoundingClientRect();
      looksLikeSend = !blockedWords.test(label)
        && (sendWords.test(label) || String(button.type || '').toLowerCase() === 'submit')
        && rect.top > innerHeight * 0.40;
    }
    if (!looksLikeSend) return;
    stopNative(event);
    if (!input) {
      publish('INACTIVE', 'unknown_composer_send_blocked', { force: true });
      toast('Composer Guardian bloqueou um envio não reconhecido. O Lovable não recebeu o prompt.', true);
      scheduleScan(0, true);
      return;
    }
    dispatchThroughBridge(input, 'guardian-send-button');
  }

  function guardSubmit(event) {
    if (state.routingEnabled !== true || !event.isTrusted) return;
    const form = event.target?.matches?.('form') ? event.target : null;
    if (!form) return;
    const primary = state.input?.isConnected ? state.input : findInput();
    const input = form.contains(primary) ? primary : looseComposerInput(form.querySelector('textarea,[contenteditable="true"],[role="textbox"]'));
    if (!input || !form.contains(input)) return;
    stopNative(event);
    dispatchThroughBridge(input, 'guardian-form-submit');
  }

  async function boot() {
    const stored = await chrome.storage.local.get([ROUTING_KEY, FINGERPRINT_KEY]);
    state.routingEnabled = stored[ROUTING_KEY] !== false;
    state.previousFingerprint = String(stored[FINGERPRINT_KEY]?.fingerprint || '');
    await scan(true);
    scheduleScan(350, true);
    scheduleScan(1000, true);

    if (document.body) {
      state.observer = new MutationObserver(mutations => {
        if (mutations.some(relevantMutation)) scheduleScan();
      });
      state.observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  window.addEventListener('keydown', guardKeydown, true);
  window.addEventListener('click', guardClick, true);
  window.addEventListener('submit', guardSubmit, true);
  window.addEventListener('popstate', () => scheduleScan(80, true));
  window.addEventListener('hashchange', () => scheduleScan(80, true));
  window.addEventListener('ld2:project', () => scheduleScan(120, true));
  window.addEventListener('ld2:ui-mounted', () => scheduleScan(120, true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleScan(80, true); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[ROUTING_KEY]) return;
    state.routingEnabled = changes[ROUTING_KEY].newValue !== false;
    scheduleScan(0, true);
  });
  const watchdog = setInterval(() => scan(false), WATCHDOG_MS);
  addEventListener('beforeunload', () => {
    clearInterval(watchdog);
    clearTimeout(state.scanTimer);
    state.observer?.disconnect();
  }, { once: true });

  window.LovableDecrypterComposerGuardian = Object.freeze({ snapshot, rescan: () => scan(true), build: 11 });

  if (document.body) boot().catch(error => publish('INACTIVE', `boot_error:${String(error?.message || error).slice(0, 120)}`, { force: true }));
  else addEventListener('DOMContentLoaded', () => boot().catch(error => publish('INACTIVE', `boot_error:${String(error?.message || error).slice(0, 120)}`, { force: true })), { once: true });
})();
