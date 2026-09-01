(() => {
  'use strict';

  if (window.__LD_CANONICAL_RUNTIME_CLIENT_V83__) return;
  window.__LD_CANONICAL_RUNTIME_CLIENT_V83__ = true;

  const VERSION = '2.6.83';
  const HOST_ID = 'lovable-decrypter-launcher';
  const SUPPORTED = Object.freeze(new Set([
    'local-agent',
    'tool-runtime',
    'mcp-runtime',
    'context-pack',
    'scope-intelligence',
    'smart-undo',
    'continuity',
    'account',
    'agent-sandbox'
  ]));
  const GROUPED = Object.freeze(new Set(['local-agent', 'mcp-runtime', 'account']));
  const ASSOCIATED = Object.freeze({
    'local-agent': Object.freeze(['local-model','tool-runtime','context-pack','scope-intelligence','continuity','local-agent','agent-runtime-registry','portable-skills','agent-sandbox','native-agent-sessions']),
    'mcp-runtime': Object.freeze(['mcp-runtime','mcp-marketplace']),
    'account': Object.freeze(['account','integration-callback']),
    'agent-sandbox': Object.freeze(['agent-sandbox','native-agent-sessions'])
  });

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
      if (!portName) return reject(new Error('RUNTIME_PORT_UNAVAILABLE'));
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

  async function catalog() {
    return runtimeMessage('ld83.runtime.catalog');
  }

  async function activate(moduleId, { group = false } = {}) {
    const id = String(moduleId || '').trim();
    if (!id) throw new Error('RUNTIME_MODULE_REQUIRED');
    if (group || GROUPED.has(id)) return runtimeMessage('ld83.runtime.activate_group', { groupId: id });
    return runtimeMessage('ld83.runtime.activate', { moduleId: id });
  }

  async function status(moduleId, payload = {}) {
    const id = String(moduleId || '').trim();
    const activated = await activate(id, { group: GROUPED.has(id) });
    const modules = Array.isArray(activated?.modules) ? activated.modules : [activated];
    const definition = modules.find(item => item?.id === id) || modules[0];
    if (!definition?.port || !definition?.statusAction) return { definition, status: null };
    return {
      definition,
      status: await portRequest(definition.port, definition.statusAction, payload)
    };
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
    if (moduleId === 'scope-intelligence') return 'ATIVO · fail-closed antes de escrita · USER_EDIT > AI_EDIT';
    if (moduleId === 'mcp-runtime') return 'ATIVO · MCP Trust Gateway + marketplace curado · escrita exige política/aprovação';
    if (moduleId === 'smart-undo') return 'ATIVO · undo/redo reversível · preview antes da aplicação';
    if (moduleId === 'continuity') return 'ATIVO · continuidade e recuperação habilitadas sob demanda';
    if (moduleId === 'local-agent') return 'ATIVO · agente local + runtime registry + skills + sandbox + sessões nativas';
    if (moduleId === 'account') return 'ATIVO · readiness gate + callback confiável';
    if (moduleId === 'agent-sandbox') return 'ATIVO · alterações isoladas até aprovação';
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
      setDetailState(shadow, 'runtime moderno disponível · ativação explícita · sem UI/observers legados', 'ON-DEMAND');
    } else {
      const strong = detail.querySelector('.foot strong');
      if (strong) strong.textContent = `Build ${VERSION}`;
    }
  }

  async function activateModule(shadow, moduleId, inspect = false) {
    setDetailState(shadow, 'ativando somente a capacidade solicitada…', 'ATIVANDO');
    const activated = await activate(moduleId, { group: GROUPED.has(moduleId) });
    const modules = Array.isArray(activated?.modules) ? activated.modules : [activated];
    const definition = modules.find(item => item?.id === moduleId) || modules[0];
    const count = modules.filter(Boolean).length;
    if (!inspect) {
      setDetailState(shadow, `${definition?.title || moduleId} ativado${count > 1 ? ` · ${count} runtimes do grupo` : ''} · sem ativação automática no boot`, 'ATIVO');
      return activated;
    }
    if (!definition?.port || !definition?.statusAction) {
      setDetailState(shadow, `${definition?.title || moduleId} ativo · sem porta de status dedicada`, 'ATIVO');
      return { definition, status: null };
    }
    const data = await portRequest(definition.port, definition.statusAction, {});
    setDetailState(shadow, compactStatus(moduleId, data), 'ATIVO');
    return { definition, status: data };
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
        catalog().then(data => {
          const ids = ASSOCIATED[moduleId] || [moduleId];
          const entries = (data?.modules || []).filter(item => ids.includes(item.id));
          const activeCount = entries.filter(item => item.active).length;
          const builds = [...new Set(entries.map(item => item.sourceBuild).filter(Boolean))].sort((a, b) => a - b);
          const state = activeCount ? 'ATIVO' : 'ON-DEMAND';
          setDetailState(shadow, `${entries.length || 1} runtime(s) · Build(s) ${builds.join(', ') || '?'} · ${activeCount} ativo(s) · installers somente por ação explícita`, state);
        }).catch(error => {
          setDetailState(shadow, `${error?.code || 'ERRO'} · ${error?.message || 'falha ao consultar catálogo'}`, 'ERRO');
        });
      }
    });
  }

  window.LovableDecrypterRuntimeV83 = Object.freeze({
    version: VERSION,
    catalog,
    activate: moduleId => activate(moduleId, { group: false }),
    activateGroup: groupId => activate(groupId, { group: true }),
    status,
    request: async (moduleId, action, payload = {}) => {
      const activated = await activate(moduleId, { group: false });
      if (!activated?.port) throw new Error('RUNTIME_PORT_UNAVAILABLE');
      return portRequest(activated.port, action, payload);
    }
  });

  if (document.getElementById(HOST_ID)?.shadowRoot) install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
})();
