(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_QUEUE_ATOMIC_SKIP__) return;
  window.__LOVABLE_DECRYPTER_QUEUE_ATOMIC_SKIP__ = true;

  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);

  function toast(text, error = false) {
    const wrap = document.querySelector('#ld2-root .ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  async function context() {
    const cfg = await runtime({ type: 'LD2_SETTINGS_GET' });
    const projectId = String(window.LovableDecrypterV2?.getProjectId?.() || '');
    const base = String(cfg?.auth?.backendBase || '').replace(/\/+$/, '');
    const key = String(cfg?.auth?.licenseKey || '');
    const device = String(cfg?.auth?.deviceId || '');
    if (!projectId) throw new Error('Projeto Lovable não identificado.');
    if (!base || !key || !device) throw new Error('Licença/dispositivo ainda não estão prontos.');
    return { cfg, projectId, base, key, device };
  }

  async function atomicSkip(itemId) {
    const id = String(itemId || '').trim();
    if (!id) throw new Error('ITEM_REQUIRED');
    const ctx = await context();
    const res = await fetch(`${ctx.base}/ld-queue-skip`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': ctx.key,
        'x-device-id': ctx.device
      },
      body: JSON.stringify({ item_id: id, project_id: ctx.projectId })
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
    window.dispatchEvent(new CustomEvent('ld2:queue-changed', {
      detail: { projectId: ctx.projectId, skippedItem: id, resumed: Number(out?.resumed || 0) }
    }));
    window.LovableDecrypterQueueExecutor?.start?.();
    return out;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#ld2-root [data-batch-skip]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.disabled) return;
    button.disabled = true;
    atomicSkip(button.dataset.batchSkip)
      .then(() => toast('Item ignorado de forma atômica. A fila continuará no próximo comando.'))
      .catch(error => {
        toast(error?.message || String(error), true);
        button.disabled = false;
      });
  }, true);

  if (window.LovableDecrypterBatchMode && typeof window.LovableDecrypterBatchMode === 'object') {
    window.LovableDecrypterBatchMode.skip = atomicSkip;
  }

  window.LovableDecrypterQueueAtomicSkip = Object.freeze({ skip: atomicSkip });
})();