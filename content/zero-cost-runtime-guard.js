(() => {
  'use strict';
  if (window.__LD57_ZERO_COST_RUNTIME_GUARD__) return;
  window.__LD57_ZERO_COST_RUNTIME_GUARD__ = true;

  const api = window.LovableDecrypterV2;
  if (!api?.runtime) return;
  const baseRuntime = api.runtime.bind(api);
  const GEMINI_TYPES = new Set(['LD2_GEMINI_TEST', 'LD2_GEMINI_MODELS']);
  const SETTINGS_TYPES = new Set(['LD2_SETTINGS_SAVE', 'LD2_SETTINGS_PATCH']);

  function freeGemini(value = {}) {
    return { ...(value || {}), billingMode: 'free', zeroCost: true };
  }

  function sanitize(message = {}) {
    const type = String(message?.type || '');
    if (GEMINI_TYPES.has(type)) return { ...message, config: freeGemini(message.config) };
    if (SETTINGS_TYPES.has(type)) {
      const key = type === 'LD2_SETTINGS_SAVE' ? 'settings' : 'patch';
      const payload = { ...(message[key] || {}) };
      if (payload.gemini) payload.gemini = freeGemini(payload.gemini);
      return { ...message, [key]: payload };
    }
    return message;
  }

  api.runtime = message => baseRuntime(sanitize(message));

  function enforceUi() {
    const root = document.getElementById('ld2-root');
    if (!root) return false;
    root.querySelectorAll('[data-gem-billing]').forEach(select => {
      [...select.options].forEach(option => {
        if (option.value !== 'free') option.remove();
      });
      select.value = 'free';
      select.disabled = true;
      select.title = 'ZERO COST obrigatório: somente Free Tier verificado.';
    });
    root.querySelectorAll('[data-model-info], .ld2-zero-cost span').forEach(node => {
      const text = String(node.textContent || '');
      if (/modo pago|pago|cobran/i.test(text)) node.textContent = 'ZERO COST obrigatório: somente modelos com Free Tier verificado são liberados; não existe fallback pago.';
    });
    return true;
  }

  let attempts = 0;
  const reconcile = () => {
    attempts += 1;
    enforceUi();
    if (attempts < 80) setTimeout(reconcile, Math.min(500, 60 + attempts * 8));
  };
  for (const eventName of ['ld2:ui-mounted', 'ld2:control-center-ready', 'ld2:settings-open']) {
    window.addEventListener(eventName, enforceUi);
  }
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-settings],[data-cc-settings]')) setTimeout(enforceUi, 30);
  }, true);
  reconcile();

  window.LovableDecrypterZeroCostGuard = Object.freeze({
    build: 57,
    sanitize,
    enforceUi,
    paidModeAllowed: false
  });
})();
