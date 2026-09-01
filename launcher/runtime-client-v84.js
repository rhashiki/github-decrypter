(() => {
  'use strict';
  if (window.__LD84_RUNTIME_CLIENT__) return;
  window.__LD84_RUNTIME_CLIENT__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const ACTIONS = Object.freeze({
    'Abrir módulo': 'open',
    'Ver estado': 'status',
    'Detalhes': 'details'
  });

  function send(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, code: 'EMPTY_RUNTIME_RESPONSE' });
        });
      } catch (error) {
        resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: error?.message || String(error) });
      }
    });
  }

  function setFoot(shadow, moduleId, text) {
    const detail = shadow?.getElementById?.('detail');
    if (!detail || detail.dataset.module !== moduleId) return;
    const foot = detail.querySelector('.foot');
    if (foot) foot.textContent = text;
  }

  function projectSnapshot() {
    let parsed;
    try { parsed = new URL(location.href); } catch { return null; }
    const segments = parsed.pathname.split('/').filter(Boolean);
    let projectId = '';
    let workspaceId = '';

    for (const marker of ['projects', 'project']) {
      const index = segments.indexOf(marker);
      if (index >= 0 && segments[index + 1]) {
        projectId = segments[index + 1];
        break;
      }
    }
    for (const marker of ['workspaces', 'workspace']) {
      const index = segments.indexOf(marker);
      if (index >= 0 && segments[index + 1]) {
        workspaceId = segments[index + 1];
        break;
      }
    }

    if (!projectId) {
      const projectLink = document.querySelector('a[href*="/projects/"],a[href*="/project/"]');
      if (projectLink?.href) {
        try {
          const link = new URL(projectLink.href, location.href);
          const parts = link.pathname.split('/').filter(Boolean);
          const index = Math.max(parts.indexOf('projects'), parts.indexOf('project'));
          if (index >= 0 && parts[index + 1]) projectId = parts[index + 1];
        } catch (_) {}
      }
    }

    return {
      detected: parsed.hostname === 'lovable.dev' || parsed.hostname.endsWith('.lovable.dev'),
      projectId: String(projectId || '').slice(0, 120),
      workspaceId: String(workspaceId || '').slice(0, 120),
      url: parsed.href,
      title: String(document.title || '').slice(0, 300),
      pathname: parsed.pathname,
      collectedAt: new Date().toISOString()
    };
  }

  function callbackHint() {
    try {
      const url = new URL(location.href);
      const integration = url.searchParams.get('ld2_integration_callback') || '';
      const status = url.searchParams.get('status') || '';
      if (!integration || !status) return null;
      return { integration, status, code: url.searchParams.get('code') || '' };
    } catch {
      return null;
    }
  }

  async function handleAction(shadow, button) {
    const detail = shadow.getElementById('detail');
    const moduleId = String(detail?.dataset?.module || '');
    const label = String(button.querySelector('span')?.textContent || '').trim();
    const action = ACTIONS[label];
    if (!moduleId || !action) return;

    window.dispatchEvent(new CustomEvent('ld84:module-action', { detail: { module: moduleId, action, label } }));
    setFoot(shadow, moduleId, `Build 84 · ${label} · consultando Runtime Bus…`);

    const message = { type: 'ld84.runtime.command', module: moduleId, action };
    if (moduleId === 'lovable' || moduleId === 'project-state') message.context = projectSnapshot();

    const result = await send(message);
    if (!result?.ok) {
      setFoot(shadow, moduleId, `Build 84 · ${label} · ${result?.code || 'RUNTIME_ERROR'}${result?.message ? ` · ${result.message}` : ''}`);
      return;
    }

    if (result.openUrl) {
      try { window.open(String(result.openUrl), '_blank', 'noopener,noreferrer'); } catch (_) {}
    }

    if (result.summary) {
      setFoot(shadow, moduleId, `Build 84 · ${result.capability || moduleId} · FUNCIONAL · ${result.summary}`);
      return;
    }

    const state = result.functionalInvocation === true ? 'FUNCIONAL' : 'PRESERVADO / AGUARDANDO REATTACHMENT';
    setFoot(shadow, moduleId, `Build 84 · ${result.capability} · ${state} · fase ${result.targetPhase}`);
  }

  async function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84RuntimeBound) return true;
    Object.defineProperty(shadow, '__ld84RuntimeBound', { value: true, configurable: false });

    shadow.addEventListener('click', event => {
      const button = event.target?.closest?.('button.action');
      if (!button) return;
      handleAction(shadow, button).catch(() => {});
    });

    const health = await send({ type: 'ld84.runtime.health' });
    if (health?.ok) {
      host.dataset.ldRuntime = '84';
      host.dataset.ldRuntimeMode = health.mode || 'event-driven';
      host.dataset.ldClientProtocol = health.clientProtocol || '';
    }

    const callback = callbackHint();
    if (callback) {
      host.dataset.ldIntegrationCallback = callback.integration;
      host.dataset.ldIntegrationStatus = callback.status;
    }
    return true;
  }

  bind().then(bound => {
    if (bound || document.readyState !== 'loading') return;
    document.addEventListener('DOMContentLoaded', () => { bind().catch(() => {}); }, { once: true });
  }).catch(() => {});
})();
