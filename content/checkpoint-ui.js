(() => {
  'use strict';
  if (window.__LD2_CHECKPOINT_UI__) return;
  window.__LD2_CHECKPOINT_UI__ = true;

  const PORT_NAME = 'ld2-checkpoints';
  const ROOT_ID = 'ld2-root';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function api() { return window.LovableDecrypterV2; }
  function projectId() { return api()?.getProjectId?.() || ''; }

  function checkpointRequest(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const requestId = crypto.randomUUID();
      let settled = false;
      const timer = setTimeout(() => finish(new Error('Tempo limite excedido ao acessar checkpoints.')), 30000);

      function finish(error, data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        if (error) reject(error);
        else resolve(data);
      }

      port.onMessage.addListener(message => {
        if (message?.requestId !== requestId) return;
        if (!message.ok) finish(new Error(message.error || 'Falha no runtime de checkpoints.'));
        else finish(null, message.data);
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        const message = chrome.runtime.lastError?.message || 'Canal de checkpoints encerrado antes da resposta.';
        finish(new Error(message));
      });
      port.postMessage({ requestId, action, ...payload });
    });
  }

  function statusLabel(status) {
    return ({
      prepared: 'Preparado',
      published: 'Publicado',
      aborted: 'Abortado',
      'rolled-back-auto': 'Revertido automaticamente',
      'rolled-back-manual': 'Revertido manualmente'
    })[status] || status || 'Desconhecido';
  }

  function toast(root, message, error = false) {
    const wrap = $('.ld2-toast-wrap', root);
    if (!wrap) return alert(message);
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  async function safeRollback(checkpoint) {
    if (!checkpoint?.id) throw new Error('Checkpoint inválido.');
    return checkpointRequest('rollback', {
      projectId: projectId(),
      checkpointId: checkpoint.id
    });
  }

  function openCheckpointModal(root, github, list) {
    const modal = $('.ld2-modal', root), card = $('.ld2-card', root);
    if (!modal || !card) return;
    const rows = list.length ? list.slice(0, 40).map(item => {
      const canRollback = item.status === 'published' && item.appliedCommitSha && item.baseTreeSha;
      return `<div class="ld2-list-item" data-checkpoint="${esc(item.id)}"><b>${esc(statusLabel(item.status))}</b> <small>${esc(new Date(item.createdAt || item.updatedAt || Date.now()).toLocaleString('pt-BR'))}</small><div>${esc(item.summary || item.command || 'Alteração')}</div><small>${esc(item.branch || '')} · base ${esc(String(item.baseHeadSha || '').slice(0, 8))}${item.appliedCommitSha ? ` → ${esc(String(item.appliedCommitSha).slice(0, 8))}` : ''}${item.rollbackCommitSha ? ` → rollback ${esc(String(item.rollbackCommitSha).slice(0, 8))}` : ''}</small>${item.note ? `<div class="ld2-help">${esc(item.note)}</div>` : ''}${canRollback ? `<div class="ld2-actions"><button class="ld2-btn danger" type="button" data-rollback="${esc(item.id)}">Rollback seguro</button></div>` : ''}</div>`;
    }).join('') : '<p class="ld2-help">Nenhum checkpoint registrado para este projeto/branch.</p>';

    card.className = 'ld2-card';
    card.innerHTML = `<header class="ld2-modal-head"><span>↶</span><div><b>Checkpoints & Rollback</b><small>${esc(github.owner)}/${esc(github.repo)} · ${esc(github.branch)}</small></div><button class="ld2-close" data-modal-close>×</button></header><div class="ld2-modal-body"><p class="ld2-help">Cada publicação protegida guarda o HEAD anterior. O rollback é executado pelo background autorizado, cria um novo commit com a árvore antiga, nunca usa force e é recusado se a branch tiver avançado depois.</p><div class="ld2-list">${rows}</div></div>`;
    modal.classList.add('open');
    $('[data-modal-close]', card).onclick = () => modal.classList.remove('open');
    $$('[data-rollback]', card).forEach(button => {
      button.onclick = async () => {
        const checkpoint = list.find(item => item.id === button.dataset.rollback);
        if (!checkpoint) return;
        if (!confirm(`Restaurar a branch ${github.branch} ao estado anterior ao commit ${String(checkpoint.appliedCommitSha).slice(0, 8)}?\n\nSerá criado um novo commit de rollback; nenhum histórico Git será apagado.`)) return;
        button.disabled = true;
        button.textContent = 'Revertendo…';
        try {
          const result = await safeRollback(checkpoint);
          toast(root, `Rollback concluído · commit ${String(result.rollbackCommitSha || '').slice(0, 8)}`);
          const refreshed = await checkpointRequest('list', { projectId: projectId() });
          openCheckpointModal(root, refreshed.github, refreshed.checkpoints || []);
        } catch (error) {
          toast(root, error?.message || String(error), true);
          button.disabled = false;
          button.textContent = 'Rollback seguro';
        }
      };
    });
  }

  async function open(root) {
    try {
      const result = await checkpointRequest('list', { projectId: projectId() });
      openCheckpointModal(root, result.github, result.checkpoints || []);
    } catch (error) {
      toast(root, error?.message || String(error), true);
    }
  }

  function inject(root) {
    const workspace = $('.ld2-control-center', root);
    if (!workspace || workspace.querySelector('[data-cc-checkpoints]')) return;
    const sections = $$('.ld2-cc-section', workspace);
    const projectSection = sections.find(section => /ferramentas/i.test($('h3', section)?.textContent || '')) || sections[0];
    const grid = projectSection ? $('.ld2-cc-grid', projectSection) : null;
    if (!grid) return;
    const button = document.createElement('button');
    button.className = 'ld2-cc-card';
    button.type = 'button';
    button.setAttribute('data-cc-checkpoints', '1');
    button.innerHTML = '<span>↶</span><div><b>Checkpoints</b><small>Histórico e rollback seguro</small></div>';
    button.onclick = () => open(root);
    grid.appendChild(button);
  }

  window.LovableDecrypterCheckpointUI = Object.freeze({ open, build: 9 });

  function watch() {
    const run = () => {
      const root = document.getElementById(ROOT_ID);
      if (root) inject(root);
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.documentElement) watch();
  else addEventListener('DOMContentLoaded', watch, { once: true });
})();
