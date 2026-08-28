(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_UI_MOUNT_GUARDIAN__) return;
  window.__LOVABLE_DECRYPTER_UI_MOUNT_GUARDIAN__ = true;

  const ROOT_ID = 'ld2-root';
  const MAX_BODY_ATTEMPTS = 100;
  const BODY_RETRY_MS = 20;
  let capturedRoot = null;
  let htmlObserver = null;
  let bodyObserver = null;
  let attempts = 0;

  function signal(remounted = false) {
    try {
      window.dispatchEvent(new CustomEvent('ld2:ui-mounted', {
        detail: { rootId: ROOT_ID, remounted }
      }));
      window.dispatchEvent(new CustomEvent('ld2:dom-reconcile', {
        detail: { source: 'ui-mount-guardian', remounted }
      }));
    } catch (_) {}
  }

  function attachToBody(root, remounted = false) {
    if (!root || !document.body) return false;
    capturedRoot = root;
    if (root.parentNode !== document.body) {
      try { document.body.appendChild(root); } catch (_) { return false; }
    }
    root.setAttribute('data-ld2-mounted-on-body', '1');
    signal(remounted);
    startBodyWatchdog();
    return true;
  }

  function startBodyWatchdog() {
    if (bodyObserver || !document.body || !capturedRoot) return;
    bodyObserver = new MutationObserver(() => {
      if (!capturedRoot?.isConnected || capturedRoot.parentNode !== document.body) {
        attachToBody(capturedRoot, true);
      }
    });
    try {
      bodyObserver.observe(document.body, { childList: true });
    } catch (_) {
      bodyObserver = null;
    }
  }

  function captureExisting() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return false;
    if (htmlObserver) {
      try { htmlObserver.disconnect(); } catch (_) {}
      htmlObserver = null;
    }
    return attachToBody(root, root.parentNode !== document.body);
  }

  function startHtmlCapture() {
    if (captureExisting()) return;
    if (!document.documentElement || htmlObserver) return;
    htmlObserver = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes || []) {
          if (node?.nodeType === 1 && node.id === ROOT_ID) {
            try { htmlObserver.disconnect(); } catch (_) {}
            htmlObserver = null;
            attachToBody(node, true);
            return;
          }
        }
      }
    });
    try {
      htmlObserver.observe(document.documentElement, { childList: true });
    } catch (_) {
      htmlObserver = null;
    }
  }

  function boot() {
    if (!document.body) {
      if (++attempts <= MAX_BODY_ATTEMPTS) {
        setTimeout(boot, BODY_RETRY_MS);
        return;
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
      }
      return;
    }
    if (!captureExisting()) startHtmlCapture();
  }

  window.addEventListener('pageshow', captureExisting);
  window.addEventListener('popstate', captureExisting);
  window.addEventListener('hashchange', captureExisting);
  window.addEventListener('ld2:project', captureExisting);

  boot();
})();
