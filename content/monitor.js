(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_MONITOR__) return;
  window.__LOVABLE_DECRYPTER_MONITOR__ = true;

  const KEY = 'ld2_monitor_enabled';
  const BLOCKED_TYPES = new Set(['LD2_PLAN_ONLY', 'LD2_BUILD_EXECUTE', 'LD2_PLAN_APPROVE', 'LD2_PLAN_PREPARE', 'LD2_PLAN_APPLY']);
  const api = window.LovableDecrypterV2;
  const previousRuntime = api?.runtime?.bind(api);
  let enabled = true;
  let loaded = false;

  if (api && previousRuntime) {
    api.runtime = async message => {
      if (loaded && !enabled && BLOCKED_TYPES.has(String(message?.type || ''))) {
        throw new Error('MONITOR_OFF');
      }
      return previousRuntime(message);
    };
  }

  async function load() {
    const data = await chrome.storage.local.get(KEY);
    enabled = data[KEY] !== false;
    loaded = true;
    apply();
  }
  async function set(value) {
    enabled = Boolean(value);
    loaded = true;
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
    const status = document.querySelector('.ld2-native-bridge [data-ld2-bridge-status]');
    if (status && !enabled) { status.textContent = 'Monitor OFF'; status.dataset.kind = 'error'; }
    if (status && enabled && status.textContent === 'Monitor OFF') { status.textContent = 'Pronto'; status.dataset.kind = ''; }
    reconcile();
  }
  function reconcile() {
    const root = document.querySelector('#ld2-root');
    if (root) root.dataset.monitor = enabled ? 'on' : 'off';
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

  window.LovableDecrypterMonitor = { get enabled() { return enabled; }, get loaded() { return loaded; }, setEnabled: set };
  new MutationObserver(reconcile).observe(document.documentElement, { childList: true, subtree: true });
  load();
})();