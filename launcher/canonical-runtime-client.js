(() => {
  'use strict';

  if (window.__LD_CANONICAL_RUNTIME_CLIENT_V83__) return;
  window.__LD_CANONICAL_RUNTIME_CLIENT_V83__ = true;

  const VERSION = '2.6.83';
  const HOST_ID = 'lovable-decrypter-launcher';
  const SUPPORTED = Object.freeze(new Set(['tool-runtime', 'context-pack', 'scope-intelligence']));

  function runtimeMessage(type, payload = {}) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type, ...payload }, response => {
          const lastError = chrome.runtime.lastError;
          if (lastError) return reject(new Error(lastError.message || 'RUNTIME_MESSAGE_FAILED'));
          if (!response?.ok) {
            const error = new Error(response?.error || response?.code || 'RUNTIME_REQUEST_FAILED');
            error.code = response?.code || 'RUNTIME_REQUEST_FAILED';
            return reject(error);
          }
          resolve(response.data);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function portRequest(portName, action, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = `ld83-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let settled = false;
      let port;
      try {
        port = chrome.runtime.connect({ name: portName });
      } catch (error) {
        reject(error);
        return;
      }

      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };

      port.onMessage.addListener(message => {
        if (message?.id !== id || message?.event) return;
        if (message?.ok) finish(resolve, message.data);
        else {
          const error = new Error(message?.error || message?.code || 'RUNTIME_PORT_REQUEST_FAILED');
          error.code = message?.code || 'RUNTIME_PORT_REQUEST_FAILED';
          finish(reject, error);
        }
      });

      port.onDisconnect.addListener(() => {
        if (settled) return;
        const error = chrome.runtime.lastError;
        finish(reject, new Error(error?.message || 'RUNTIME_PORT_DISCONNECTED'));
      });

      port.postMessage({ id, action, payload });
    });
  }

  function compactStatus(moduleId, data = {}) {
    if (moduleId === 'tool-runtime') {
      const tools = Array.isArray(data?.tools) ? data.tools : [];
      const reads = tools.filter(tool => tool?.mode !== 'write').length;
      const writes = tools.filter(tool => tool?.mode === 'write').length;
      const repo = data?.repo ? ` · ${data.repo}` : '';
      return `ATIVO · ${reads} ferramentas de leitura · ${writes} de escrita fail-closed${repo}`;
    }
    if (moduleId === 'context-pack') {
      const sources = Array.isArray(data?.sources) ? data.sources.length : 0;
      return `ATIVO · Context Engine v2 · ${sources} fontes · sem persistência de prompt bruto`;
    }
    if (moduleId === 'scope-intelligence') {
      return `ATIVO · fail-closed antes de escrita · USER_EDIT > AI_EDIT`;
    }
    return 'ATIVO';
  }

  function currentDetail(shadow) {
    return shadow.querySelector('#detail.show');
  }

  function setDetailState(shadow, text, state = 'ON-DEMAND') {
    const detail = currentDetail(shadow);
    if (!detail) return;
    const badge = detail.querySelector('.state');
    if (badge) badge.textContent = state;
    const strong = detail.querySelector('.foot strong');
    if (strong) strong.textContent = `Build ${VERSION}`;
    const foot = detail.querySelector('.foot');
    if (foot) {
      while (foot.childNodes.length > 1) foot.lastChild.remove();
      if (!strong) foot.textContent = `Build ${VERSION} · ${text}`;
      else foot.append(document.createTextNode(` · ${text}`));
    }
  }

  function decorate(shadow) {
    const detail = currentDetail(shadow);
    if (!detail) return;
    const moduleId = String(detail.dataset.module || '');
    if (SUPPORTED.has(moduleId)) {
      setDetailState(shadow, 'runtime disponível sob demanda · sem polling · sem observers', 'ON-DEMAND');
    } else {
      const strong = detail.querySelector('.foot strong');
      if (strong) strong.textContent = `Build ${VERSION}`;
    }
  }

  async function activateModule(shadow, moduleId, inspect = false) {
    setDetailState(shadow, 'ativando somente por ação explícita do usuário…', 'ATIVANDO');
    const definition = await runtimeMessage('ld83.runtime.activate', { moduleId });
    if (!inspect) {
      setDetailState(shadow, `${definition.title} ativado sob demanda · nenhuma ativação automática`, 'ATIVO');
      return definition;
    }
    const status = await portRequest(definition.port, definition.statusAction || 'status', {});
    setDetailState(shadow, compactStatus(moduleId, status), 'ATIVO');
    return { definition, status };
  }

  function install() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow || shadow.__ld83RuntimeClientInstalled) return;
    shadow.__ld83RuntimeClientInstalled = true;

    const decorateAfter = event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('.fly-item,.rail-btn')) return;
      queueMicrotask(() => decorate(shadow));
    };

    shadow.addEventListener('click', decorateAfter, true);
    shadow.addEventListener('mouseenter', decorateAfter, true);

    shadow.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('button.action');
      if (!button) return;
      const detail = currentDetail(shadow);
      const moduleId = String(detail?.dataset.module || '');
      if (!SUPPORTED.has(moduleId)) return;

      const label = String(button.textContent || '').trim();
      if (label.includes('Abrir módulo')) {
        activateModule(shadow, moduleId, false).catch(error => {
          setDetailState(shadow, `${error?.code || 'ERRO'} · ${error?.message || 'falha ao ativar runtime'}`, 'ERRO');
        });
        return;
      }
      if (label.includes('Ver estado')) {
        activateModule(shadow, moduleId, true).catch(error => {
          setDetailState(shadow, `${error?.code || 'ERRO'} · ${error?.message || 'falha ao consultar runtime'}`, 'ERRO');
        });
        return;
      }
      if (label.includes('Detalhes')) {
        runtimeMessage('ld83.runtime.catalog').then(catalog => {
          const entry = (catalog?.modules || []).find(item => item.id === moduleId);
          const mode = entry?.active ? 'ATIVO' : 'ON-DEMAND';
          setDetailState(shadow, `${entry?.title || moduleId} · origem Build ${entry?.sourceBuild || '?'} · política ${entry?.writePolicy || 'read-only'} · ativação explícita`, mode);
        }).catch(error => {
          setDetailState(shadow, `${error?.code || 'ERRO'} · ${error?.message || 'falha ao consultar catálogo'}`, 'ERRO');
        });
      }
    });
  }

  if (document.getElementById(HOST_ID)?.shadowRoot) install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
})();
