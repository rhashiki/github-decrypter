(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_UI_SHELL_BOOTSTRAP__) return;
  window.__LOVABLE_DECRYPTER_UI_SHELL_BOOTSTRAP__ = true;

  const FALLBACK_ID = 'ld2-bootstrap-shell';
  const FULL_ROOT_ID = 'ld2-root';
  const MAX_BODY_ATTEMPTS = 120;
  const BODY_RETRY_MS = 25;
  const MAX_PROMOTION_CHECKS = 80;
  const PROMOTION_CHECK_MS = 100;
  let bodyAttempts = 0;
  let promotionChecks = 0;
  let shell = null;

  function fullFabReady() {
    const fab = document.querySelector(`#${FULL_ROOT_ID} .ld2-fab`);
    if (!fab || !fab.isConnected) return false;
    const rect = fab.getBoundingClientRect();
    const style = getComputedStyle(fab);
    return rect.width > 20 && rect.height > 20 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function removeFallbackIfReady() {
    if (!fullFabReady()) return false;
    try { shell?.remove(); } catch (_) {}
    shell = null;
    return true;
  }

  function statusText() {
    const core = !!window.LovableDecrypterV2?.runtime;
    const full = !!document.getElementById(FULL_ROOT_ID);
    return [
      `Versão ${chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version}`,
      `Core: ${core ? 'carregado' : 'inicializando'}`,
      `Launcher: ${full ? 'montado' : 'inicializando'}`
    ].join(' · ');
  }

  function createFallback() {
    if (!document.body || document.getElementById(FALLBACK_ID) || removeFallbackIfReady()) return;

    shell = document.createElement('div');
    shell.id = FALLBACK_ID;
    shell.setAttribute('data-ld2-bootstrap', '1');
    shell.innerHTML = `
      <button type="button" data-ld2-bootstrap-fab aria-label="Lovable Decrypter">LD<span></span></button>
      <aside data-ld2-bootstrap-panel hidden>
        <header><b>LOVABLE DECRYPTER</b><button type="button" data-ld2-bootstrap-close>×</button></header>
        <p>Inicializando launcher…</p>
        <small data-ld2-bootstrap-status></small>
      </aside>`;

    shell.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:Arial,sans-serif';
    const fab = shell.querySelector('[data-ld2-bootstrap-fab]');
    fab.style.cssText = 'pointer-events:auto;position:fixed;right:20px;bottom:20px;width:64px;height:64px;border-radius:50%;border:1px solid rgba(57,255,132,.75);background:#07100b;color:#39ff84;font:900 18px Arial,sans-serif;letter-spacing:.08em;box-shadow:0 10px 36px rgba(0,0,0,.5),0 0 28px rgba(57,255,132,.28);cursor:pointer';
    fab.querySelector('span').style.cssText = 'position:absolute;right:4px;bottom:5px;width:12px;height:12px;border-radius:50%;background:#ffd166;border:2px solid #07100b';

    const panel = shell.querySelector('[data-ld2-bootstrap-panel]');
    panel.style.cssText = 'pointer-events:auto;position:fixed;right:20px;bottom:94px;width:min(330px,calc(100vw - 24px));padding:14px;border:1px solid rgba(57,255,132,.35);border-radius:16px;background:rgba(5,13,9,.97);color:#eef8f1;box-shadow:0 22px 70px rgba(0,0,0,.5);backdrop-filter:blur(20px)';
    const header = panel.querySelector('header');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;color:#39ff84';
    const close = panel.querySelector('[data-ld2-bootstrap-close]');
    close.style.cssText = 'border:0;background:transparent;color:#eef8f1;font-size:22px;cursor:pointer';
    const p = panel.querySelector('p');
    p.style.cssText = 'margin:12px 0 7px;font-size:13px';
    const status = panel.querySelector('[data-ld2-bootstrap-status]');
    status.style.cssText = 'display:block;color:#93a99b;font-size:10px;line-height:1.45';
    status.textContent = statusText();

    fab.addEventListener('click', () => {
      if (removeFallbackIfReady()) {
        document.querySelector(`#${FULL_ROOT_ID} .ld2-fab`)?.click();
        return;
      }
      panel.hidden = !panel.hidden;
      status.textContent = statusText();
    });
    close.addEventListener('click', () => { panel.hidden = true; });

    document.body.appendChild(shell);
  }

  function boot() {
    if (!document.body) {
      if (++bodyAttempts <= MAX_BODY_ATTEMPTS) return setTimeout(boot, BODY_RETRY_MS);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
      return;
    }
    createFallback();
    const promote = () => {
      if (removeFallbackIfReady()) return;
      if (++promotionChecks < MAX_PROMOTION_CHECKS) setTimeout(promote, PROMOTION_CHECK_MS);
    };
    promote();
  }

  window.addEventListener('ld2:ui-mounted', removeFallbackIfReady);
  window.addEventListener('pageshow', () => {
    if (!removeFallbackIfReady()) createFallback();
  });

  boot();
})();
