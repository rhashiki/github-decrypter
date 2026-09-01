(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_DOM_GUARDIAN__) return;
  window.__LOVABLE_DECRYPTER_DOM_GUARDIAN__ = true;

  let lastHref = location.href;
  let scheduled = false;

  function notify(reason) {
    try {
      window.dispatchEvent(new CustomEvent('ld2:dom-reconcile', {
        detail: { url: location.href, reason }
      }));
    } catch (_) {}
  }

  function reconcile(reason = 'dom-change') {
    scheduled = false;
    const href = location.href;
    if (href !== lastHref) {
      lastHref = href;
      notify('url-change');
      return;
    }
    notify(reason);
  }

  function schedule(reason = 'dom-change') {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => reconcile(reason), 180);
  }

  document.addEventListener('ld2:navigation', () => schedule('ld2-navigation'), true);
  window.addEventListener('ld2:project', () => schedule('project-change'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule('visibility');
  });

  new MutationObserver(() => schedule('dom-change')).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  setInterval(() => {
    if (location.href !== lastHref) schedule('url-change');
  }, 2500);

  schedule('boot');
})();