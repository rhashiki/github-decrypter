(() => {
  'use strict';
  if (window.__LD84_RUNTIME_CLIENT__) return;
  window.__LD84_RUNTIME_CLIENT__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const ACTIONS = Object.freeze({
    'Abrir módulo': 'open',
    'Ver estado': 'status',
    'Detalhes': 'details'
  });

  function send(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, code: 'EMPTY_RUNTIME_RESPONSE' });
        });
      } catch (error) {
        resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: error?.message || String(error) });
      }
    });
  }

  function setFoot(shadow, moduleId, text) {
    const detail = shadow?.getElementById?.('detail');
    if (!detail || detail.dataset.module !== moduleId) return;
    const foot = detail.querySelector('.foot');
    if (foot) foot.textContent = text;
  }

  async function handleAction(shadow, button) {
    const detail = shadow.getElementById('detail');
    const moduleId = String(detail?.dataset?.module || '');
    const label = String(button.querySelector('span')?.textContent || '').trim();
    const action = ACTIONS[label];
    if (!moduleId || !action) return;

    setFoot(shadow, moduleId, `Build 84 · ${label} · consultando Runtime Bus…`);
    const result = await send({ type: 'ld84.runtime.command', module: moduleId, action });
    if (!result?.ok) {
      setFoot(shadow, moduleId, `Build 84 · ${label} · ${result?.code || 'RUNTIME_ERROR'}${result?.message ? ` · ${result.message}` : ''}`);
      return;
    }
    const state = result.functionalInvocation === true ? 'FUNCIONAL' : 'PRESERVADO / AGUARDANDO REATTACHMENT';
    setFoot(shadow, moduleId, `Build 84 · ${result.capability} · ${state} · fase ${result.targetPhase}`);
  }

  async function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow || shadow.__ld84RuntimeBound) return Boolean(shadow);
    Object.defineProperty(shadow, '__ld84RuntimeBound', { value: true, configurable: false });

    shadow.addEventListener('click', event => {
      const button = event.target?.closest?.('button.action');
      if (!button) return;
      handleAction(shadow, button).catch(() => {});
    });

    const health = await send({ type: 'ld84.runtime.health' });
    if (health?.ok) {
      host.dataset.ldRuntime = '84';
      host.dataset.ldRuntimeMode = health.mode || 'event-driven';
    }
    return true;
  }

  if (!bind() && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind().catch(() => {}); }, { once: true });
  }
})();
