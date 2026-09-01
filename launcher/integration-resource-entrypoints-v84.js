(() => {
  'use strict';
  if (window.__LD84_INTEGRATION_RESOURCE_ENTRYPOINTS__) return;
  window.__LD84_INTEGRATION_RESOURCE_ENTRYPOINTS__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';

  function textNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }

  function makeFlyEntry(integration, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fly-item ld84-resource-entry';
    button.dataset.ldResourceManage = integration;
    button.dataset.ldResourceEntrypoint = integration;

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '19');
    icon.setAttribute('height', '19');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', integration === 'github' ? 'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5' : 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.75');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    icon.appendChild(path);

    button.append(icon, textNode('b', '', label), textNode('span', 'chev', '‹'));
    return button;
  }

  function ensureFlyoutEntries(shadow) {
    const flyout = shadow.getElementById('flyout');
    if (!flyout?.classList.contains('show')) return;
    const title = String(flyout.querySelector('.fly-title span')?.textContent || '').trim();
    if (title !== 'Integrações') return;
    const list = flyout.querySelector('.fly-list');
    if (!list) return;

    if (!list.querySelector('[data-ld-resource-entrypoint="github"]')) {
      list.appendChild(makeFlyEntry('github', 'GitHub · Gerenciar repositórios'));
    }
    if (!list.querySelector('[data-ld-resource-entrypoint="supabase"]')) {
      list.appendChild(makeFlyEntry('supabase', 'Supabase · Gerenciar projetos'));
    }
  }

  function ensureDetailEntry(shadow) {
    const detail = shadow.getElementById('detail');
    if (!detail?.classList.contains('show')) return;
    const integration = String(detail.dataset.module || '');
    if (!['github', 'supabase'].includes(integration)) return;
    const actions = detail.querySelector('.actions');
    if (!actions || actions.querySelector('[data-ld-resource-entrypoint-detail]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action';
    button.dataset.ldResourceManage = integration;
    button.dataset.ldResourceEntrypointDetail = integration;
    const label = document.createElement('span');
    label.textContent = integration === 'github' ? 'Gerenciar repositórios' : 'Gerenciar projetos';
    const arrow = document.createElement('strong');
    arrow.textContent = '›';
    button.append(label, arrow);
    actions.appendChild(button);
  }

  function scheduleEnsure(shadow) {
    queueMicrotask(() => {
      ensureFlyoutEntries(shadow);
      ensureDetailEntry(shadow);
    });
  }

  function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84IntegrationResourceEntrypointsBound) return true;
    Object.defineProperty(shadow, '__ld84IntegrationResourceEntrypointsBound', { value: true, configurable: false });

    const style = document.createElement('style');
    style.id = 'ld84-resource-entrypoints-style';
    style.textContent = `
      #flyout .ld84-resource-entry{border-top:1px solid rgba(255,255,255,.055)!important;margin-top:2px!important;color:#b9d9ff!important}
      #flyout .ld84-resource-entry b{font-weight:600!important}
      #detail [data-ld-resource-entrypoint-detail]{color:#cce9ff!important}
    `;
    shadow.appendChild(style);

    shadow.addEventListener('mouseover', () => scheduleEnsure(shadow));
    shadow.addEventListener('click', () => scheduleEnsure(shadow));
    scheduleEnsure(shadow);
    return true;
  }

  const bound = bind();
  if (!bound && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); }, { once: true });
  }
})();
