(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_DOM_GUARDIAN__) return;
  window.__LOVABLE_DECRYPTER_DOM_GUARDIAN__ = true;

  let lastHref = location.href;
  let lastBridgeSeenAt = 0;
  let scheduled = false;

  function signalNavigation() {
    const href = location.href;
    if (href !== lastHref) lastHref = href;
    try { window.dispatchEvent(new PopStateEvent('popstate')); }
    catch (_) { window.dispatchEvent(new Event('popstate')); }
    window.dispatchEvent(new CustomEvent('ld2:dom-reconcile', { detail: { url: href } }));
  }

  function reconcile() {
    scheduled = false;
    const bridge = document.querySelector('.ld2-native-bridge');
    if (bridge?.isConnected) lastBridgeSeenAt = Date.now();
    const composer = [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].find(el => {
      if (el.closest?.('#ld2-root')) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 180 && r.height >= 24 && r.bottom > innerHeight * .45 && r.top < innerHeight;
    });
    if (composer && !bridge && Date.now() - lastBridgeSeenAt > 500) signalNavigation();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(reconcile, 140);
  }

  document.addEventListener('ld2:navigation', () => {
    signalNavigation();
    schedule();
  }, true);
  window.addEventListener('ld2:project', schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { signalNavigation(); schedule(); }
  });
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => {
    if (location.href !== lastHref) signalNavigation();
    schedule();
  }, 2500);
  schedule();
})();