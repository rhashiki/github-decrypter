(() => {
  'use strict';

  const BRIDGE_SCHEMA = 'gd-extension-bridge/1';
  const ALLOWED_ORIGIN = 'https://github.com';
  const PAGE_CONTEXT_TYPE = 'gd.extension.page-context';
  const REPOSITORY_CONTEXT_TYPE = 'gd.extension.repository-context';
  const OPEN_REPOSITORY_TYPE = 'gd.extension.open-repository';
  const FAB_ID = 'gd-repository-launcher-fab';
  const REPOSITORY_PART = /^[A-Za-z0-9_.-]{1,100}$/;
  const RESERVED_TOP_LEVEL = new Set([
    'about', 'apps', 'collections', 'contact', 'copilot', 'codespaces', 'enterprise',
    'events', 'explore', 'features', 'issues', 'login', 'logout', 'marketplace',
    'new', 'notifications', 'organizations', 'orgs', 'pricing', 'pulls', 'search',
    'security', 'settings', 'site', 'sponsors', 'signup', 'topics', 'trending', 'users',
  ]);
  let lastPathname = null;
  let lastRepository = null;

  function currentPageContext() {
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

  function detectRepository() {
    if (location.origin !== ALLOWED_ORIGIN) return null;
    const canonical = document.querySelector('meta[name="octolytics-dimension-repository_nwo"]')?.getAttribute('content')?.trim();
    if (!canonical) return null;
    const nwo = canonical.split('/');
    const segments = location.pathname.split('/').filter(Boolean);
    if (nwo.length !== 2 || segments.length < 2 || nwo[0] !== segments[0] || nwo[1] !== segments[1]) return null;
    const owner = nwo[0];
    const name = nwo[1];
    if (!REPOSITORY_PART.test(owner) || !REPOSITORY_PART.test(name) || RESERVED_TOP_LEVEL.has(owner.toLowerCase())) return null;
    return Object.freeze({
      owner,
      name,
      fullName: `${owner}/${name}`,
      url: `${ALLOWED_ORIGIN}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    });
  }

  function send(message, callback) {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        callback?.(response);
      });
    } catch {
      // Extension teardown/navigation races are intentionally ignored.
    }
  }

  function removeFab() {
    document.getElementById(FAB_ID)?.remove();
  }

  function renderFab(repository, page) {
    let button = document.getElementById(FAB_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = FAB_ID;
      button.type = 'button';
      button.textContent = 'GD';
      button.setAttribute('aria-label', 'Open in GitHub Decrypter');
      button.title = 'Open in GitHub Decrypter';
      Object.assign(button.style, {
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: '2147483646',
        width: '52px',
        height: '52px',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,.18)',
        background: '#0d1117',
        color: '#ffffff',
        font: '700 14px/1 system-ui, sans-serif',
        boxShadow: '0 8px 28px rgba(0,0,0,.28)',
        cursor: 'pointer',
      });
      document.documentElement.appendChild(button);
    }
    button.dataset.repository = repository.fullName;
    button.onclick = () => {
      const current = detectRepository();
      if (!current || current.fullName !== button.dataset.repository) return;
      send({
        schema: BRIDGE_SCHEMA,
        type: OPEN_REPOSITORY_TYPE,
        origin: ALLOWED_ORIGIN,
        pathname: location.pathname || '/',
        repository: current,
      });
    };
    button.hidden = false;
    button.title = `Open ${repository.fullName} in GitHub Decrypter`;
    button.setAttribute('aria-label', button.title);
  }

  function publishContext() {
    const page = currentPageContext();
    if (!page) {
      removeFab();
      return;
    }
    const repository = detectRepository();
    const repositoryKey = repository?.fullName ?? null;
    if (page.pathname === lastPathname && repositoryKey === lastRepository) return;
    lastPathname = page.pathname;
    lastRepository = repositoryKey;

    send(page);
    if (!repository) {
      removeFab();
      return;
    }
    const repositoryContext = Object.freeze({
      ...page,
      type: REPOSITORY_CONTEXT_TYPE,
      repository,
    });
    send(repositoryContext);
    renderFab(repository, page);
  }

  publishContext();
  addEventListener('popstate', publishContext, { passive: true });
  addEventListener('hashchange', publishContext, { passive: true });
  document.addEventListener('turbo:load', publishContext, { passive: true });
})();
