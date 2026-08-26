(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_MONITOR__) return;
  window.__LOVABLE_DECRYPTER_MONITOR__ = true;

  const KEY = 'ld2_monitor_enabled';
  let enabled = true;

  async function load() {
    const data = await chrome.storage.local.get(KEY);
    enabled = data[KEY] !== false;
    apply();
  }
  async function set(value) {
    enabled = Boolean(value);
    await chrome.storage.local.set({ [KEY]: enabled });
    apply();
    window.dispatchEvent(new CustomEvent('ld2:monitor-changed', { detail: { enabled } }));
  }
  function apply() {
    const root = document.querySelector('#ld2-root');
    if (root) root.dataset.monitor = enabled ? 'on' : 'off';
    document.documentElement.dataset.ld2Monitor = enabled ? 'on' : 'off';
    const executor = window.LovableDecrypterQueueExecutor;
    if (enabled) executor?.start?.(); else executor?.stop?.();
    reconcile();
  }
  function reconcile() {
    const root = document.querySelector('#ld2-root');
    const health = root?.querySelector('.ld2-cc-health');
    if (health && !health.querySelector('[data-monitor-card]')) {
      const card = document.createElement('div');
      card.dataset.monitorCard = '1';
      card.className = 'ld2-monitor-card';
      card.innerHTML = '<span class="ld2-cc-dot ready"></span><small>Monitor</small><b data-monitor-label>ON</b><button type="button" data-monitor-toggle>Desligar</button>';
      health.prepend(card);
      card.querySelector('[data-monitor-toggle]').onclick = () => set(!enabled);
    }
    root?.querySelectorAll('[data-monitor-label]').forEach(el => { el.textContent = enabled ? 'ON' : 'OFF'; });
    root?.querySelectorAll('[data-monitor-toggle]').forEach(el => { el.textContent = enabled ? 'Desligar' : 'Ligar'; });
    root?.querySelectorAll('[data-monitor-card] .ld2-cc-dot').forEach(dot => dot.classList.toggle('ready', enabled));
  }

  window.LovableDecrypterMonitor = { get enabled() { return enabled; }, setEnabled: set };
  new MutationObserver(reconcile).observe(document.documentElement, { childList: true, subtree: true });
  load();
})();