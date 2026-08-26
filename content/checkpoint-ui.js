(() => {
  'use strict';
  if (window.__LD2_CHECKPOINT_UI__) return;
  window.__LD2_CHECKPOINT_UI__ = true;

  const CHECKPOINT_KEY = 'ld2_checkpoints_v1';
  const HISTORY_KEY = 'ld2_history';
  const ROOT_ID = 'ld2-root';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function api() { return window.LovableDecrypterV2; }
  function projectId() { return api()?.getProjectId?.() || ''; }
  function runtime(message) { return api().runtime(message).then(result => result); }

  async function activeGithub() {
    const settings = await runtime({ type: 'LD2_SETTINGS_GET' });
    const pid = projectId();
    const mapped = pid && settings.projectMappings?.[pid] ? settings.projectMappings[pid] : {};
    return { settings, github: { ...(settings.github || {}), ...mapped } };
  }

  async function loadCheckpoints(github) {
    const data = await chrome.storage.local.get(CHECKPOINT_KEY);
    const list = Array.isArray(data[CHECKPOINT_KEY]) ? data[CHECKPOINT_KEY] : [];
    return list.filter(item => item?.owner === github.owner && item?.repository === github.repo && item?.branch === github.branch);
  }

  async function writeCheckpoint(id, patch) {
    const data = await chrome.storage.local.get(CHECKPOINT_KEY);
    const list = Array.isArray(data[CHECKPOINT_KEY]) ? data[CHECKPOINT_KEY] : [];
    const index = list.findIndex(item => item?.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...patch, updatedAt: new Date().toISOString() };
      await chrome.storage.local.set({ [CHECKPOINT_KEY]: list.slice(0, 80) });
    }
  }

  async function pushHistory(entry) {
    const data = await chrome.storage.local.get(HISTORY_KEY);
    const list = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
    list.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), ...entry });
    await chrome.storage.local.set({ [HISTORY_KEY]: list.slice(0, 100) });
  }

  function ghApi(github, path, options = {}) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      ...(options.headers || {})
    };
    if (github.token) headers.Authorization = `Bearer ${github.token}`;
    return fetch(`https://api.github.com${path}`, { ...options, headers }).then(async res => {
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `GitHub HTTP ${res.status}`);
      return body;
    });
  }

  async function safeRollback(checkpoint, github) {
    if (!checkpoint?.appliedCommitSha) throw new Error('Este checkpoint não possui commit publicado para reverter.');
    const repoBase = `/repos/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}`;
    const ref = await ghApi(github, `${repoBase}/git/ref/heads/${encodeURIComponent(github.branch)}`);
    const currentHead = String(ref?.object?.sha || '');
    if (currentHead !== String(checkpoint.appliedCommitSha)) {
      throw new Error(`Rollback recusado: a branch avançou para ${currentHead.slice(0, 8)} depois deste checkpoint.`);
    }

    const rollbackCommit = await ghApi(github, `${repoBase}/git/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `revert: Lovable Decrypter checkpoint ${String(checkpoint.id).slice(0, 8)}`,
        tree: checkpoint.baseTreeSha,
        parents: [currentHead]
      })
    });

    await ghApi(github, `${repoBase}/git/refs/heads/${encodeURIComponent(github.branch)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: rollbackCommit.sha, force: false })
    });

    await writeCheckpoint(checkpoint.id, {
      status: 'rolled-back-manual',
      rolledBackAt: new Date().toISOString(),
      rollbackMode: 'manual',
      rollbackCommitSha: rollbackCommit.sha,
      note: 'Rollback solicitado pelo usuário no Control Center.'
    });
    await pushHistory({
      type: 'apply',
      command: `Rollback seguro · ${checkpoint.summary || checkpoint.command || 'checkpoint'}`,
      repo: `${github.owner}/${github.repo}`,
      summary: `Checkpoint ${String(checkpoint.id).slice(0, 8)} restaurado em ${github.branch} · commit ${rollbackCommit.sha.slice(0, 8)}`,
      result: { branch: github.branch, commitSha: rollbackCommit.sha, checkpointId: checkpoint.id, rollback: true }
    });
    return rollbackCommit.sha;
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

  function openCheckpointModal(root, github, list) {
    const modal = $('.ld2-modal', root), card = $('.ld2-card', root);
    if (!modal || !card) return;
    const rows = list.length ? list.slice(0, 40).map(item => {
      const canRollback = item.status === 'published' && item.appliedCommitSha && item.baseTreeSha;
      return `<div class="ld2-list-item" data-checkpoint="${esc(item.id)}"><b>${esc(statusLabel(item.status))}</b> <small>${esc(new Date(item.createdAt || item.updatedAt || Date.now()).toLocaleString('pt-BR'))}</small><div>${esc(item.summary || item.command || 'Alteração')}</div><small>${esc(item.branch || '')} · base ${esc(String(item.baseHeadSha || '').slice(0, 8))}${item.appliedCommitSha ? ` → ${esc(String(item.appliedCommitSha).slice(0, 8))}` : ''}</small>${item.note ? `<div class="ld2-help">${esc(item.note)}</div>` : ''}${canRollback ? `<div class="ld2-actions"><button class="ld2-btn danger" type="button" data-rollback="${esc(item.id)}">Rollback seguro</button></div>` : ''}</div>`;
    }).join('') : '<p class="ld2-help">Nenhum checkpoint registrado para este projeto/branch.</p>';

    card.className = 'ld2-card';
    card.innerHTML = `<header class="ld2-modal-head"><span>↶</span><div><b>Checkpoints & Rollback</b><small>${esc(github.owner)}/${esc(github.repo)} · ${esc(github.branch)}</small></div><button class="ld2-close" data-modal-close>×</button></header><div class="ld2-modal-body"><p class="ld2-help">Cada publicação protegida guarda o HEAD anterior. O rollback cria um novo commit com a árvore antiga; nunca usa force e é recusado se a branch tiver avançado depois.</p><div class="ld2-list">${rows}</div></div>`;
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
          const sha = await safeRollback(checkpoint, github);
          alert(`Rollback concluído com segurança.\nNovo commit: ${sha.slice(0, 8)}`);
          modal.classList.remove('open');
        } catch (error) {
          alert(error?.message || String(error));
          button.disabled = false;
          button.textContent = 'Rollback seguro';
        }
      };
    });
  }

  async function open(root) {
    try {
      const { github } = await activeGithub();
      if (!github.owner || !github.repo) throw new Error('Configure o GitHub antes de usar checkpoints.');
      const list = await loadCheckpoints(github);
      openCheckpointModal(root, github, list);
    } catch (error) {
      alert(error?.message || String(error));
    }
  }

  function inject(root) {
    const workspace = $('.ld2-control-center', root);
    if (!workspace || workspace.querySelector('[data-cc-checkpoints]')) return;
    const sections = $$('.ld2-cc-section', workspace);
    const projectSection = sections.find(section => $('h3', section)?.textContent?.trim() === 'Ferramentas') || sections[0];
    const grid = projectSection ? $('.ld2-cc-grid', projectSection) : null;
    if (!grid) return;
    const button = document.createElement('button');
    button.className = 'ld2-cc-card';
    button.type = 'button';
    button.setAttribute('data-cc-checkpoints', '1');
    button.innerHTML = '<span>↶</span><div><b>Checkpoints</b><small>Rollback seguro da branch</small></div>';
    button.onclick = () => open(root);
    grid.appendChild(button);
  }

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
