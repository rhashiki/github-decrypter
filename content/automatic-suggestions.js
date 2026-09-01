(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_AUTOMATIC_SUGGESTIONS__) return;
  window.__LOVABLE_DECRYPTER_AUTOMATIC_SUGGESTIONS__ = true;

  const PORT_NAME = 'ld2-suggestions';
  const ROOT_ID = 'ld2-root';
  const HISTORY_KEY = 'ld2_history';
  const CHECKPOINT_KEY = 'ld2_checkpoints_v1';
  const DISMISSED_KEY = 'ld2_suggestions_dismissed_v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  const rank = { critical: 4, high: 3, medium: 2, low: 1 };
  let cache = null;
  let cacheAt = 0;
  let inflight = null;
  let reconcileTimer = 0;

  function projectId() { return String(window.LovableDecrypterV2?.getProjectId?.() || ''); }

  async function context() {
    const settings = await runtime({ type: 'LD2_SETTINGS_GET' });
    const pid = projectId();
    if (!pid) throw new Error('Projeto Lovable não identificado.');
    const mapping = settings?.projectMappings?.[pid] || {};
    const github = { ...(settings?.github || {}), ...mapping };
    if (!github.owner || !github.repo) throw new Error('Configure o GitHub deste projeto antes de usar sugestões.');
    const backendBase = String(settings?.auth?.backendBase || '').replace(/\/+$/, '');
    const licenseKey = String(settings?.auth?.licenseKey || '');
    const deviceId = String(settings?.auth?.deviceId || '');
    if (!backendBase || !licenseKey || !deviceId) throw new Error('Licença/dispositivo ainda não estão prontos.');
    return {
      settings,
      projectId: pid,
      github: { owner: String(github.owner), repo: String(github.repo), branch: String(github.branch || 'main') },
      backendBase,
      licenseKey,
      deviceId
    };
  }

  function scopeKey(ctx) {
    return `${ctx.projectId}|${ctx.github.owner}/${ctx.github.repo}|${ctx.github.branch}`;
  }

  function suggestionRequest(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const requestId = crypto.randomUUID();
      let settled = false;
      const timer = setTimeout(() => finish(new Error('Tempo limite excedido ao analisar o projeto.')), 30000);
      function finish(error, data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        if (error) reject(error); else resolve(data);
      }
      port.onMessage.addListener(message => {
        if (message?.requestId !== requestId) return;
        if (!message.ok) finish(new Error(message.error || 'Falha ao analisar o projeto.'));
        else finish(null, message.data);
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        finish(new Error(chrome.runtime.lastError?.message || 'Canal de sugestões encerrado antes da resposta.'));
      });
      port.postMessage({ requestId, action, ...payload });
    });
  }

  async function cloud(ctx, slug, body = {}) {
    const res = await fetch(`${ctx.backendBase}/${slug}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': ctx.licenseKey,
        'x-device-id': ctx.deviceId
      },
      body: JSON.stringify({
        ...body,
        project_id: ctx.projectId,
        github_owner: ctx.github.owner,
        github_repo: ctx.github.repo,
        github_branch: ctx.github.branch
      })
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
    return out;
  }

  async function localSignals(ctx) {
    const keys = [HISTORY_KEY, CHECKPOINT_KEY, DISMISSED_KEY, `ld2_agent_profile_${ctx.github.owner}_${ctx.github.repo}`];
    const data = await chrome.storage.local.get(keys);
    const history = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
    const checkpoints = Array.isArray(data[CHECKPOINT_KEY]) ? data[CHECKPOINT_KEY] : [];
    const dismissed = data[DISMISSED_KEY] && typeof data[DISMISSED_KEY] === 'object' ? data[DISMISSED_KEY] : {};
    const profile = data[`ld2_agent_profile_${ctx.github.owner}_${ctx.github.repo}`] || null;
    return { history, checkpoints, dismissed, profile };
  }

  function make(id, severity, title, reason, command = '', source = 'project', fingerprint = '', kind = 'command') {
    return { id, severity, title, reason, command, source, fingerprint: fingerprint || id, kind };
  }

  function buildSuggestions(ctx, scan, brain, rules, queue, local) {
    const items = [];
    const signals = scan?.signals || {};
    const head = String(scan?.headSha || '');
    const sourceCount = Number(signals.sourceCount || 0);

    if (!brain) {
      items.push(make('brain-missing', 'high', 'Treinar o Project Brain', 'O projeto ainda não possui uma memória técnica persistente. Sem o Brain, contexto arquitetural e checklist ficam menos precisos.', '', 'Project Intelligence', head || 'brain-missing', 'brain'));
    } else if (brain.source_commit_sha && head && String(brain.source_commit_sha) !== head) {
      items.push(make('brain-stale', 'medium', 'Atualizar o Project Brain', 'O Brain foi treinado em outro commit e pode estar desatualizado em relação ao HEAD atual.', '', 'Project Intelligence', `${brain.source_commit_sha}:${head}`, 'brain'));
    }

    if (!scan?.truncated && Array.isArray(signals.envTracked) && signals.envTracked.length) {
      const names = signals.envTracked.join(', ');
      items.push(make('tracked-env', 'critical', 'Revisar arquivos .env versionados', `Foram encontrados arquivos de ambiente no Git: ${names}. Isso pode expor segredos mesmo em repositórios privados.`, `Revise a segurança dos arquivos de ambiente versionados (${names}). Remova segredos do Git, adicione os arquivos sensíveis ao .gitignore, mantenha apenas um .env.example sem credenciais e preserve o comportamento atual do projeto. Não altere outras áreas.`, 'Repositório', `${head}:${names}`));
    }

    if (!scan?.truncated && sourceCount > 0 && !signals.hasGitignore) {
      items.push(make('gitignore-missing', 'high', 'Adicionar proteção de arquivos locais', 'O repositório possui código-fonte, mas não foi encontrado .gitignore.', 'Crie um .gitignore adequado à stack atual deste projeto, cobrindo apenas artefatos locais, caches, builds e arquivos de segredo que não devem ser versionados. Preserve arquivos que já fazem parte intencionalmente do projeto.', 'Repositório', head));
    }

    if (!scan?.truncated && sourceCount > 4 && !signals.hasTests) {
      items.push(make('tests-missing', 'medium', 'Cobertura automatizada ausente', 'Há código-fonte relevante, mas nenhum teste ou script de teste foi detectado.', 'Analise a stack atual e implemente uma base mínima de testes automatizados para os fluxos mais críticos, reutilizando ferramentas já presentes quando possível. Não faça refatorações fora do necessário e valide mobile e desktop quando houver interface.', 'Qualidade', head));
    }

    if (!scan?.truncated && sourceCount > 0 && !signals.hasCi) {
      items.push(make('ci-missing', 'medium', 'CI não detectado', 'Nenhum workflow em .github/workflows foi encontrado para validar alterações automaticamente.', 'Crie um workflow de CI mínimo para este projeto usando a stack e os scripts que já existem. Execute apenas validações disponíveis como lint, typecheck, testes e build, sem adicionar deploy automático ou recursos pagos.', 'Qualidade', head));
    }

    if (!scan?.truncated && signals.hasTypeScript && !signals.hasTypecheck) {
      items.push(make('typecheck-missing', 'medium', 'TypeScript sem typecheck explícito', 'TypeScript foi detectado, mas não há um script claro de verificação de tipos.', 'Adicione uma validação de typecheck apropriada à configuração TypeScript existente e integre-a aos scripts atuais sem trocar a stack nem ampliar o escopo do projeto.', 'Qualidade', head));
    }

    const queueItems = Array.isArray(queue?.items) ? queue.items : [];
    const failed = queueItems.find(item => ['failed', 'blocked'].includes(String(item?.status || '')));
    if (failed) {
      const error = String(failed.error_code || 'erro não informado');
      const command = String(failed.command_text || '').slice(0, 1200);
      items.push(make('batch-failure', 'high', 'Investigar falha no Batch', `Um item da fila deste projeto está ${failed.status}: ${error}. Os próximos itens permanecem pausados até correção ou retry.`, `Investigue a causa da falha deste item do Batch sem ampliar o escopo original. Comando que falhou: "${command}". Erro: "${error}". Corrija somente o necessário, respeite Project Rules e valide antes de publicar.`, 'Batch', `${failed.id}:${failed.status}:${error}`));
    }

    const relevantCheckpoints = local.checkpoints.filter(item => item?.owner === ctx.github.owner && item?.repository === ctx.github.repo && String(item?.branch || 'main') === ctx.github.branch);
    const rolledBack = relevantCheckpoints.find(item => ['rolled-back-auto', 'rolled-back-manual'].includes(String(item?.status || '')));
    if (rolledBack) {
      const summary = String(rolledBack.summary || rolledBack.command || 'alteração anterior').slice(0, 1000);
      items.push(make('recent-rollback', 'high', 'Analisar causa do rollback', 'Há um checkpoint revertido neste projeto. Antes de repetir a alteração, vale identificar a causa raiz.', `Analise a causa raiz do rollback relacionado a "${summary}". Considere o estado atual da branch, os checkpoints e as validações já existentes. Proponha a menor correção segura e não repita automaticamente a alteração revertida.`, 'Checkpoint', `${rolledBack.id}:${rolledBack.rollbackCommitSha || rolledBack.updatedAt || ''}`));
    }

    if (brain && (!Array.isArray(rules) || !rules.some(rule => rule?.enabled !== false))) {
      items.push(make('rules-empty', 'low', 'Project Rules vazias', 'O Brain existe, mas não há regras manuais ativas para impor restrições permanentes entre comandos.', 'Revise o projeto e proponha uma lista curta de Project Rules permanentes que protejam arquitetura, segurança, compatibilidade e escopo. Apenas proponha as regras; não altere código.', 'Project Intelligence', `${head}:rules-empty`));
    }

    if (!scan?.truncated && sourceCount > 0 && !signals.hasReadme) {
      items.push(make('readme-missing', 'low', 'Documentação inicial ausente', 'Não foi encontrado README na raiz do repositório.', 'Crie um README objetivo com propósito do projeto, stack, configuração local e comandos já existentes. Não exponha chaves, tokens ou segredos.', 'Documentação', head));
    }

    const scopedDismissed = local.dismissed[scopeKey(ctx)] || {};
    return items
      .filter(item => scopedDismissed[item.id] !== item.fingerprint)
      .sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0))
      .slice(0, 8);
  }

  async function collect(force = false) {
    if (!force && cache && Date.now() - cacheAt < 60000) return cache;
    if (inflight) return inflight;
    inflight = (async () => {
      const ctx = await context();
      const [scan, local, brainOut, rulesOut, queueOut] = await Promise.all([
        suggestionRequest('scan', { projectId: ctx.projectId }),
        localSignals(ctx),
        cloud(ctx, 'ld-project-intelligence', { action: 'get_brain' }).catch(() => ({ brain: null })),
        cloud(ctx, 'ld-project-intelligence', { action: 'list_rules' }).catch(() => ({ rules: [] })),
        cloud(ctx, 'ld-queue', { action: 'list', limit: 100 }).catch(() => ({ items: [] }))
      ]);
      const brain = brainOut?.brain || local.profile || null;
      const rules = Array.isArray(rulesOut?.rules) ? rulesOut.rules : [];
      const suggestions = buildSuggestions(ctx, scan, brain, rules, queueOut, local);
      cache = { ctx, scan, brain, suggestions, generatedAt: new Date().toISOString() };
      cacheAt = Date.now();
      updateCard(cache);
      return cache;
    })();
    try { return await inflight; }
    finally { inflight = null; }
  }

  async function dismissSuggestion(result, item) {
    const data = await chrome.storage.local.get(DISMISSED_KEY);
    const all = data[DISMISSED_KEY] && typeof data[DISMISSED_KEY] === 'object' ? data[DISMISSED_KEY] : {};
    const key = scopeKey(result.ctx);
    all[key] = { ...(all[key] || {}), [item.id]: item.fingerprint };
    await chrome.storage.local.set({ [DISMISSED_KEY]: all });
    cache = null;
    cacheAt = 0;
  }

  function bridgeInput() {
    const bars = $$('.ld2-native-bridge').filter(bar => {
      const rect = bar.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const bar = bars[0];
    const host = bar?.nextElementSibling;
    const input = host?.matches?.('textarea,[contenteditable="true"],[role="textbox"]') ? host : host?.querySelector?.('textarea,[contenteditable="true"],[role="textbox"]');
    return { bar, input };
  }

  function placeInComposer(command) {
    const { input } = bridgeInput();
    if (!input) throw new Error('Composer nativo do Lovable não encontrado.');
    if ('value' in input) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (setter) setter.call(input, command); else input.value = command;
    } else {
      input.textContent = command;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  }

  function toast(message, error = false) {
    const root = document.getElementById(ROOT_ID);
    const wrap = root?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  function severityLabel(level) {
    return ({ critical: 'CRÍTICA', high: 'ALTA', medium: 'MÉDIA', low: 'BAIXA' })[level] || String(level || '').toUpperCase();
  }

  async function openSuggestions() {
    const root = document.getElementById(ROOT_ID);
    const modal = root?.querySelector('.ld2-modal');
    const card = modal?.querySelector('.ld2-card');
    if (!modal || !card) throw new Error('Control Center ainda não está pronto.');
    card.className = 'ld2-card ld2-cloud-card suggestions';
    card.innerHTML = '<div class="ld2-cloud-loading">Analisando sinais do projeto…</div>';
    modal.classList.add('open');
    try { renderModal(card, await collect(true)); }
    catch (error) {
      card.innerHTML = `<div class="ld2-cloud-head"><div><small>SUGESTÕES AUTOMÁTICAS</small><h2>Indisponível</h2><p>${esc(error?.message || String(error))}</p></div><button type="button" data-suggestion-close>×</button></div>`;
      card.querySelector('[data-suggestion-close]').onclick = () => modal.classList.remove('open');
    }
  }

  function renderModal(card, result) {
    const list = result.suggestions || [];
    card.innerHTML = `
      <div class="ld2-cloud-head"><div><small>SUGESTÕES AUTOMÁTICAS · ${esc(result.ctx.github.branch)}</small><h2>${list.length} recomendação(ões)</h2><p>Geradas por sinais reais do projeto, sem chamada automática ao Gemini e sem execução autônoma.</p></div><button type="button" data-suggestion-close>×</button></div>
      <div class="ld2-queue-controls"><button type="button" data-suggestion-refresh>Atualizar análise</button></div>
      <div class="ld2-history-list">${list.length ? list.map(item => `
        <article class="ld2-history-row status-${esc(item.severity)}" data-suggestion-id="${esc(item.id)}">
          <div class="ld2-history-meta"><b>${esc(severityLabel(item.severity))}</b><span>${esc(item.source)}</span></div>
          <p><b>${esc(item.title)}</b></p>
          <small>${esc(item.reason)}</small>
          <div class="ld2-queue-actions">
            ${item.kind === 'brain' ? '<button type="button" data-suggestion-brain>Abrir Project Brain</button>' : `<button type="button" data-suggestion-use="${esc(item.id)}">Usar comando</button>`}
            <button type="button" data-suggestion-dismiss="${esc(item.id)}">Ignorar</button>
          </div>
        </article>`).join('') : '<div class="ld2-cloud-empty">Nenhum sinal relevante exige ação neste momento.</div>'}</div>
      <div class="ld2-help">“Usar comando” apenas preenche o composer. Nada é enviado, planejado ou construído automaticamente.</div>`;

    card.querySelector('[data-suggestion-close]').onclick = () => card.closest('.ld2-modal')?.classList.remove('open');
    card.querySelector('[data-suggestion-refresh]').onclick = async buttonEvent => {
      const button = buttonEvent.currentTarget;
      button.disabled = true;
      try { renderModal(card, await collect(true)); }
      catch (error) { toast(error?.message || String(error), true); button.disabled = false; }
    };
    $$('[data-suggestion-use]', card).forEach(button => button.onclick = () => {
      const item = list.find(row => row.id === button.dataset.suggestionUse);
      if (!item?.command) return;
      try {
        placeInComposer(item.command);
        card.closest('.ld2-modal')?.classList.remove('open');
        toast('Comando colocado no composer. Revise e execute quando quiser.');
      } catch (error) { toast(error?.message || String(error), true); }
    });
    $$('[data-suggestion-brain]', card).forEach(button => button.onclick = () => {
      card.closest('.ld2-modal')?.classList.remove('open');
      const trigger = document.querySelector('#ld2-root [data-cc-action="train"]');
      if (trigger) trigger.click(); else toast('Abra Project Brain no Control Center.', true);
    });
    $$('[data-suggestion-dismiss]', card).forEach(button => button.onclick = async () => {
      const item = list.find(row => row.id === button.dataset.suggestionDismiss);
      if (!item) return;
      await dismissSuggestion(result, item);
      renderModal(card, await collect(true));
    });
  }

  function updateCard(result) {
    const root = document.getElementById(ROOT_ID);
    const button = root?.querySelector('[data-cc-suggestions]');
    if (!button) return;
    const count = Number(result?.suggestions?.length || 0);
    const small = button.querySelector('small');
    if (small) small.textContent = count ? `${count} recomendação(ões) para revisar` : 'Nenhuma ação sugerida';
    button.classList.toggle('accent', count > 0);
  }

  function injectCard() {
    const root = document.getElementById(ROOT_ID);
    const workspace = root?.querySelector('.ld2-control-center');
    if (!workspace || workspace.querySelector('[data-cc-suggestions]')) return;
    const sections = $$('.ld2-cc-section', workspace);
    const engineering = sections.find(section => $('h3', section)?.textContent?.trim() === 'Engenharia') || sections[0];
    const grid = engineering?.querySelector('.ld2-cc-grid');
    if (!grid) return;
    const button = document.createElement('button');
    button.className = 'ld2-cc-card';
    button.type = 'button';
    button.dataset.ccSuggestions = '1';
    button.innerHTML = '<span>✦</span><div><b>Sugestões</b><small>Analisando projeto…</small></div>';
    button.onclick = () => openSuggestions().catch(error => toast(error?.message || String(error), true));
    grid.appendChild(button);
    collect().catch(() => {});
  }

  function scheduleRefresh(delay = 500) {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(() => {
      cache = null;
      cacheAt = 0;
      injectCard();
      collect(true).catch(() => {});
    }, delay);
  }

  function reconcile() {
    injectCard();
    if (cache) updateCard(cache);
  }

  new MutationObserver(reconcile).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('ld2:project', () => scheduleRefresh(400));
  window.addEventListener('ld2:queue-changed', () => scheduleRefresh(700));
  window.addEventListener('ld2:impact-recorded', () => scheduleRefresh(900));
  window.addEventListener('ld2:project-rules-synced', () => scheduleRefresh(900));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - cacheAt > 120000) scheduleRefresh(250); });
  setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - cacheAt > 180000) scheduleRefresh(50); }, 60000);
  setTimeout(() => { reconcile(); collect().catch(() => {}); }, 1200);

  window.LovableDecrypterAutomaticSuggestions = { open: openSuggestions, refresh: () => collect(true) };
})();
