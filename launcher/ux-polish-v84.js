(() => {
  'use strict';
  if (window.__LD84_UX_POLISH__) return;
  window.__LD84_UX_POLISH__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';

  function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84UxPolishBound) return true;
    Object.defineProperty(shadow, '__ld84UxPolishBound', { value: true, configurable: false });

    const style = document.createElement('style');
    style.textContent = '#ld84-module-modal .ld84-note{display:none!important}';
    shadow.appendChild(style);

    shadow.addEventListener('click', event => {
      const button = event.target?.closest?.('.rail-btn');
      if (!button) return;

      const rail = shadow.getElementById('rail');
      const flyout = shadow.getElementById('flyout');
      const detail = shadow.getElementById('detail');
      const panelVisible = flyout?.classList.contains('show') || detail?.classList.contains('show');

      if (!rail?.classList.contains('open') || !button.classList.contains('active') || !panelVisible) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      flyout?.classList.remove('show');
      detail?.classList.remove('show');
      for (const node of shadow.querySelectorAll('.rail-btn.active,.fly-item.active')) node.classList.remove('active');
    }, true);

    return true;
  }

  const bound = bind();
  if (!bound && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); }, { once: true });
  }
})();
