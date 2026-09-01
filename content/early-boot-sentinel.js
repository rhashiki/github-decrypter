(() => {
  'use strict';
  if (window.__LD2_EARLY_BOOT_SENTINEL__) return;
  window.__LD2_EARLY_BOOT_SENTINEL__ = true;

  const BUILD = 34;
  const ROUTING_KEY = 'ld2_native_routing_enabled';
  const isTopFrame = window === window.top;
  const composerWords = /message|mensagem|ask|prompt|describe|descreva|chat|lovable|what do you want|type|build|planejar|construir/i;
  const sendWords = /send|submit|enviar|mandar|arrow.?up|paper.?plane|prompt/i;
  const blockedWords = /attach|upload|arquivo|file|image|imagem|voice|voz|microphone|microfone|mic|emoji|plus|adicionar|model|settings|config/i;
  const state = {
    scope: isTopFrame ? 'top' : 'subframe',
    routingEnabled: true,
    routingResolved: false,
    armed: true,
    handedOff: false,
    armedAt: Date.now(),
    handoffAt: 0,
    blockedNativeIntents: 0,
    lastReason: 'booting'
  };

  function ownSurface(node) {
    return !!node?.closest?.('#ld2-root,#ld2-decrypter-chat-host');
  }

  function labelOf(node) {
    return [
      node?.getAttribute?.('aria-label'),
      node?.getAttribute?.('title'),
      node?.getAttribute?.('placeholder'),
      node?.getAttribute?.('data-testid'),
      node?.getAttribute?.('name'),
      node?.textContent
    ].filter(Boolean).join(' ');
  }

  function sendLike(button) {
    if (!button || ownSurface(button) || button.disabled) return false;
    const label = labelOf(button);
    if (blockedWords.test(label)) return false;
    return String(button.type || '').toLowerCase() === 'submit' || sendWords.test(label);
  }

  function likelyComposer(input) {
    if (!input || ownSurface(input) || input.disabled || input.readOnly) return false;
    if (!input.matches?.('textarea,[contenteditable="true"],[role="textbox"]')) return false;
    if (composerWords.test(labelOf(input))) return true;
    const form = input.closest?.('form');
    return !!form && [...form.querySelectorAll('button')].some(sendLike);
  }

  function composerFromForm(form) {
    if (!form || ownSurface(form)) return null;
    return [...form.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].find(likelyComposer) || null;
  }

  function snapshot() {
    return Object.freeze({
      schema: 'ld-early-boot/1',
      build: BUILD,
      scope: state.scope,
      routingEnabled: state.routingEnabled,
      routingResolved: state.routingResolved,
      armed: state.armed,
      handedOff: state.handedOff,
      armedAt: state.armedAt,
      handoffAt: state.handoffAt || null,
      blockedNativeIntents: state.blockedNativeIntents,
      lastReason: state.lastReason
    });
  }

  function publish(reason) {
    state.lastReason = String(reason || '').slice(0, 160);
    window.dispatchEvent(new CustomEvent('ld2:early-boot-state', { detail: snapshot() }));
  }

  function shouldProtect(event) {
    return state.armed && state.routingEnabled && event?.isTrusted === true && !ownSurface(event.target);
  }

  function block(event, reason) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    state.blockedNativeIntents += 1;
    publish(reason);
    window.dispatchEvent(new CustomEvent('ld2:early-boot-blocked', { detail: snapshot() }));
  }

  function onKeydown(event) {
    if (!shouldProtect(event) || event.key !== 'Enter' || event.shiftKey || event.altKey || event.isComposing) return;
    const input = event.target?.closest?.('textarea,[contenteditable="true"],[role="textbox"]');
    if (likelyComposer(input)) block(event, 'early_native_enter_blocked');
  }

  function onClick(event) {
    if (!shouldProtect(event)) return;
    const button = event.target?.closest?.('button');
    if (!sendLike(button)) return;
    const form = button.closest?.('form');
    const composer = composerFromForm(form) || (likelyComposer(document.activeElement) ? document.activeElement : null);
    if (composer) block(event, 'early_native_send_click_blocked');
  }

  function onSubmit(event) {
    if (!shouldProtect(event)) return;
    if (composerFromForm(event.target)) block(event, 'early_native_form_submit_blocked');
  }

  function arm() {
    if (!state.armed) state.armed = true;
    window.addEventListener('keydown', onKeydown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    publish(isTopFrame ? 'top_frame_armed' : 'subframe_armed');
  }

  function disarm(reason = 'disarmed') {
    if (!state.armed) return;
    window.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('submit', onSubmit, true);
    state.armed = false;
    publish(reason);
  }

  function handoff() {
    if (!isTopFrame || state.handedOff) return;
    state.handedOff = true;
    state.handoffAt = Date.now();
    disarm('hardening_handoff');
  }

  async function readRouting() {
    try {
      const stored = await chrome.storage.local.get(ROUTING_KEY);
      state.routingEnabled = stored[ROUTING_KEY] !== false;
      state.routingResolved = true;
      publish(state.routingEnabled ? 'routing_enabled' : 'routing_disabled');
    } catch (_) {
      state.routingEnabled = true;
      state.routingResolved = true;
      publish('routing_read_failed_fail_closed');
    }
  }

  function onStorageChanged(changes, area) {
    if (area !== 'local' || !changes[ROUTING_KEY]) return;
    state.routingEnabled = changes[ROUTING_KEY].newValue !== false;
    state.routingResolved = true;
    publish(state.routingEnabled ? 'routing_enabled' : 'routing_disabled');
  }

  function onHardeningState() {
    if (isTopFrame && window.LovableDecrypterHardening) handoff();
  }

  chrome.storage.onChanged.addListener(onStorageChanged);
  window.addEventListener('ld2:hardening-state', onHardeningState);
  window.addEventListener('pagehide', () => disarm('pagehide'), { once: true });

  window.LovableDecrypterEarlyBoot = Object.freeze({
    build: BUILD,
    schema: 'ld-early-boot/1',
    snapshot,
    handoff
  });

  arm();
  readRouting();
})();
