(() => {
  'use strict';

  const BRIDGE_SCHEMA = 'gd-extension-bridge/1';
  const ALLOWED_ORIGIN = 'https://github.com';
  const PAGE_CONTEXT_TYPE = 'gd.extension.page-context';
  let lastPathname = null;

  function currentContext() {
    if (location.origin !== ALLOWED_ORIGIN) return null;
    const pathname = location.pathname || '/';
    if (pathname.length > 2048 || /[\u0000-\u001f\u007f]/.test(pathname)) return null;
    return Object.freeze({
      schema: BRIDGE_SCHEMA,
      type: PAGE_CONTEXT_TYPE,
      origin: ALLOWED_ORIGIN,
      pathname,
      observedAt: new Date().toISOString(),
    });
  }

  function publishContext() {
    const context = currentContext();
    if (!context || context.pathname === lastPathname) return;
    lastPathname = context.pathname;
    try {
      chrome.runtime.sendMessage(context, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      // Extension teardown/navigation races are intentionally ignored.
    }
  }

  publishContext();
  addEventListener('popstate', publishContext, { passive: true });
  addEventListener('hashchange', publishContext, { passive: true });
  document.addEventListener('turbo:load', publishContext, { passive: true });
})();
