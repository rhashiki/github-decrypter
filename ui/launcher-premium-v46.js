(() => {
  'use strict';
  if (window.__LD46_LAUNCHER_PREMIUM__) return;
  window.__LD46_LAUNCHER_PREMIUM__ = true;

  const ROOT_ID = 'ld2-root';
  const MARK = `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
    <path d="M18 10h17c13.3 0 23 9 23 22s-9.7 22-23 22H18V39h6v9h11c9.7 0 16.5-6.3 16.5-16S44.7 16 35 16H24v9h-6V10Z" fill="url(#ld46g)"/>
    <path d="M27 35.8 31.2 32 27 28.2M40.2 28.2 36 32l4.2 3.8M34.8 27.3 31.9 36.7" stroke="#E7FBFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="12" y="25" width="4.2" height="4.2" rx=".8" fill="#63EAFF"/><rect x="8" y="31" width="3.4" height="3.4" rx=".7" fill="#45D8FF"/><rect x="13" y="37" width="2.8" height="2.8" rx=".6" fill="#648DFF"/>
    <defs><linearGradient id="ld46g" x1="13" y1="10" x2="57" y2="55" gradientUnits="userSpaceOnUse"><stop stop-color="#63EAFF"/><stop offset=".53" stop-color="#3BD2FF"/><stop offset="1" stop-color="#7083FF"/></linearGradient></defs>
  </svg>`;

  function root() { return document.getElementById(ROOT_ID); }

  function enhanceFab() {
    const fab = root()?.querySelector('.ld2-fab');
    if (!fab) return false;
    fab.dataset.ld46Premium = '1';
    const img = fab.querySelector(':scope > img');
    if (img) img.hidden = true;
    let mark = fab.querySelector('.ld46-fab-mark');
    if (!mark) {
      mark = document.createElement('span');
      mark.className = 'ld46-fab-mark';
      mark.innerHTML = MARK;
      fab.insertBefore(mark, fab.firstChild);
    }
    return true;
  }

  function enhanceRail() {
    const r = root();
    const shell = r?.querySelector('.ld3-launcher-shell');
    const rail = shell?.querySelector('.ld3-rail');
    const list = rail?.querySelector('.ld3-rail-list');
    const flyout = shell?.querySelector('.ld3-flyout');
    const detail = shell?.querySelector('.ld3-detail');
    if (!shell || !rail || !list || !flyout || !detail) return false;

    shell.dataset.ld46Premium = '1';
    rail.dataset.ld46Premium = '1';
    if (!rail.querySelector('.ld46-rail-logo')) {
      const logo = document.createElement('div');
      logo.className = 'ld46-rail-logo';
      logo.setAttribute('aria-hidden', 'true');
      logo.innerHTML = MARK;
      rail.insertBefore(logo, list);
    }

    // The original launcher already owns category/action routing. Build 46 only
    // reinforces accessibility and hit targets so its cascade can receive input.
    flyout.setAttribute('aria-live', 'polite');
    detail.setAttribute('aria-live', 'polite');
    shell.querySelectorAll('.ld3-rail-btn').forEach(btn => {
      if (!btn.hasAttribute('aria-haspopup')) btn.setAttribute('aria-haspopup', 'menu');
    });
    shell.querySelectorAll('.ld3-menu-item').forEach(item => item.setAttribute('aria-haspopup', 'menu'));
    return true;
  }

  function refresh() {
    const a = enhanceFab();
    const b = enhanceRail();
    return a && b;
  }

  for (const eventName of ['ld3:design-system-ready','ld2:dom-reconcile','ld2:project','ld41:branding-changed']) {
    window.addEventListener(eventName, () => refresh());
  }

  const scheduler = window.LovableDecrypterDeliveryScheduler;
  if (scheduler?.register) scheduler.register('build46-launcher-premium', () => refresh(), { interval:120, maxAttempts:160, startDelay:0 });
  else {
    let attempts = 0;
    const retry = () => {
      attempts += 1;
      if (refresh() || attempts >= 160) return;
      setTimeout(retry, 120);
    };
    retry();
  }

  window.LovableDecrypterLauncherPremium = Object.freeze({ build:46, refresh });
})();
