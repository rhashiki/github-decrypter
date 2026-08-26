(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_CREDENTIAL_UI_GUARD__) return;
  window.__LOVABLE_DECRYPTER_CREDENTIAL_UI_GUARD__ = true;

  const SENTINEL = '__LD2_SAVED_CREDENTIAL__';
  const PASSWORD_VALUE_RE = /(<input\b(?=[^>]*\btype=(?:"password"|'password'))[^>]*?\bvalue=)(["'])([^"']+)(\2)/gi;

  function sanitizeHtml(value) {
    if (typeof value !== 'string' || !/type=(?:"password"|'password')/i.test(value)) return value;
    return value.replace(PASSWORD_VALUE_RE, (match, prefix, quote, current) => {
      if (!current || current === SENTINEL) return match;
      return `${prefix}${quote}${SENTINEL}${quote}`;
    });
  }

  const inner = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (inner?.get && inner?.set) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: inner.configurable,
      enumerable: inner.enumerable,
      get() { return inner.get.call(this); },
      set(value) { return inner.set.call(this, sanitizeHtml(value)); }
    });
  }

  const nativeInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
  if (typeof nativeInsertAdjacentHTML === 'function') {
    Element.prototype.insertAdjacentHTML = function(position, text) {
      return nativeInsertAdjacentHTML.call(this, position, sanitizeHtml(text));
    };
  }

  function getCurrentSettings() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'LD2_SETTINGS_GET' }, response => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.ok) return reject(new Error(response?.error || 'Não foi possível preservar as credenciais salvas.'));
        resolve(response.data || {});
      });
    });
  }

  function hasSentinel(value) {
    if (value === SENTINEL) return true;
    if (Array.isArray(value)) return value.some(hasSentinel);
    if (value && typeof value === 'object') return Object.values(value).some(hasSentinel);
    return false;
  }

  function resolveSentinels(value, settings) {
    if (Array.isArray(value)) return value.map(item => resolveSentinels(item, settings));
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === SENTINEL) {
        if (key === 'apiKey') out[key] = String(settings?.gemini?.apiKey || '');
        else if (key === 'token') out[key] = String(settings?.github?.token || '');
        else if (key === 'anonKey') out[key] = String(settings?.supabase?.anonKey || '');
        else if (key === 'managementToken') out[key] = String(settings?.supabase?.managementToken || '');
        else throw new Error(`Sentinela de credencial inesperada em ${key}.`);
      } else {
        out[key] = resolveSentinels(item, settings);
      }
    }
    return out;
  }

  async function prepareMessage(message) {
    if (!hasSentinel(message)) return message;
    const settings = await getCurrentSettings();
    return resolveSentinels(message, settings);
  }

  window.LovableDecrypterCredentialGuard = Object.freeze({
    sentinel: SENTINEL,
    prepareMessage
  });
})();
