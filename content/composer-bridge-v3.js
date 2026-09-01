(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_EDITOR_DIRECT_V3__) return;
  window.__LOVABLE_DECRYPTER_EDITOR_DIRECT_V3__ = true;

  const MODE_KEY = 'ld2_native_composer_mode';
  const ROUTING_KEY = 'ld2_native_routing_enabled';
  const MAX_ATTACHMENTS = 8;
  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
  const LICENSE_CACHE_MS = 2500;
  const LICENSE_TIMEOUT_MS = 6500;
  const AUTOSYNC_TIMEOUT_MS = 35000;
  const ACCEPT = 'image/*,audio/*,video/*,.pdf,.txt,.md,.json,.csv,.tsv,.rtf,.doc,.docx,.xls,.xlsx,.ods,.ppt,.pptx,.html,.css,.js,.jsx,.ts,.tsx,.xml,.sql';

  const state = {
    input: null,
    host: null,
    bar: null,
    nativeSend: null,
    mode: 'build',
    routingEnabled: true,
    busy: false,
    requestId: '',
    attachments: [],
    planBundle: null,
    shadowBundle: null,
    settings: null,
    licensed: false,
    lastLicenseCheck: 0,
    licenseCheckPromise: null,
    lastProjectId: ''
  };

  const boundInputs = new WeakSet();
  const api = () => window.LovableDecrypterV2;
  const runtime = message => api()?.runtime?.(message);
  const projectId = () => api()?.getProjectId?.() || '';
  const projectContext = () => window.LovableDecrypterProjectRuntime?.getContext?.() || null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function withTimeout(promise, ms, message = 'Tempo limite excedido.') {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
    ]);
  }

  async function authorized(force = false) {
    const now = Date.now();
    if (!force && now - state.lastLicenseCheck < LICENSE_CACHE_MS) return state.licensed;
    if (state.licenseCheckPromise) return state.licenseCheckPromise;
    state.licenseCheckPromise = (async () => {
      try {
        const status = await withTimeout(runtime({ type: 'LD2_LICENSE_STATUS' }), LICENSE_TIMEOUT_MS, 'A validação da KEY demorou demais.');
        state.licensed = !!status?.valid;
      } catch (_) {
        state.licensed = false;
      } finally {
        state.lastLicenseCheck = Date.now();
        state.licenseCheckPromise = null;
      }
      return state.licensed;
    })();
    return state.licenseCheckPromise;
  }

  function visible(el) {
    if (!el || !el.isConnected || el.closest('#ld2-root')) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width >= 180 && r.height >= 24 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && s.visibility !== 'hidden' && s.display !== 'none';
  }

  function buttonVisible(el) {
    if (!el || !el.isConnected || el.closest('#ld2-root')) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width >= 20 && r.height >= 20 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && s.visibility !== 'hidden' && s.display !== 'none';
  }

  function scoreInput(el) {
    if (!visible(el) || el.disabled || el.readOnly) return -1;
    const r = el.getBoundingClientRect();
    const placeholder = String(el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').toLowerCase();
    let score = 0;
    if (el.tagName === 'TEXTAREA') score += 4;
    if (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox') score += 2;
    if (r.width >= 300) score += 3;
    if (r.bottom >= innerHeight * 0.58) score += 3;
    if (/message|mensagem|ask|prompt|describe|descreva|chat|lovable|what do you want|type/i.test(placeholder)) score += 4;
    if (el.closest('form')) score += 1;
    return score;
  }

  function findComposerInput() {
    return [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
      .map(el => ({ el, score: scoreInput(el) }))
      .filter(item => item.score >= 5)
      .sort((a, b) => b.score - a.score || b.el.getBoundingClientRect().bottom - a.el.getBoundingClientRect().bottom)[0]?.el || null;
  }

  function findHost(input) {
    let node = input;
    for (let i = 0; node && i < 6; i++, node = node.parentElement) {
      const r = node.getBoundingClientRect?.();
      if (!r) continue;
      if (node.querySelector?.('button') && r.width >= 260 && r.height >= 45 && r.height <= 340) return node;
    }
    return input?.parentElement || null;
  }

  function findNativeSendButton(input = state.input, host = state.host) {
    if (!input || !host) return null;
    const scope = input.closest('form') || host;
    const ir = input.getBoundingClientRect();
    const blocked = /attach|upload|arquivo|file|image|imagem|voice|voz|microphone|microfone|mic|emoji|plus|adicionar|model|settings|config/i;
    const sendWords = /send|submit|enviar|mandar|arrow.?up|paper.?plane|prompt/i;
    return [...scope.querySelectorAll('button')]
      .filter(buttonVisible)
      .map(btn => {
        const label = [btn.getAttribute('aria-label'), btn.getAttribute('title'), btn.getAttribute('data-testid'), btn.getAttribute('name'), btn.textContent].filter(Boolean).join(' ').toLowerCase();
        if (blocked.test(label)) return { btn, score: -100 };
        const br = btn.getBoundingClientRect();
        let score = 0;
        if (String(btn.type || '').toLowerCase() === 'submit') score += 12;
        if (sendWords.test(label)) score += 18;
        if (br.left >= ir.left + ir.width * 0.62) score += 5;
        if (br.top <= ir.bottom + 28 && br.bottom >= ir.top - 28) score += 4;
        if (br.width <= 80 && br.height <= 80) score += 2;
        return { btn, score };
      })
      .filter(item => item.score >= 7)
      .sort((a, b) => b.score - a.score)[0]?.btn || null;
  }

  function readInput(input) {
    if (!input) return '';
    if ('value' in input) return String(input.value || '');
    return String(input.innerText || input.textContent || '');
  }

  function writeInput(input, value) {
    if (!input) return;
    if ('value' in input) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (setter) setter.call(input, value); else input.value = value;
    } else {
      input.textContent = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(files) {
    const next = [...state.attachments];
    let total = next.reduce((sum, item) => sum + Number(item.size || 0), 0);
    for (const file of files) {
      if (next.length >= MAX_ATTACHMENTS) throw new Error(`Use no máximo ${MAX_ATTACHMENTS} anexos.`);
      if (file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error(`${file.name} excede 15 MB.`);
      total += file.size;
      if (total > MAX_TOTAL_BYTES) throw new Error('Os anexos excedem 40 MB no total.');
      next.push({ name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, data: await fileToBase64(file) });
    }
    state.attachments = next;
    refreshBar();
  }

  function setStatus(text, kind = '') {
    const el = state.bar?.querySelector('[data-ld2-bridge-status]');
    if (!el) return;
    el.textContent = text;
    el.dataset.kind = kind;
  }

  function setBusy(busy) {
    state.busy = !!busy;
    state.bar?.classList.toggle('busy', state.busy);
    state.host?.classList.toggle('ld2-composer-busy', state.busy);
    state.bar?.querySelectorAll('button').forEach(btn => {
      if (btn.matches('[data-ld2-review-close],[data-ld2-shadow-cancel]')) return;
      btn.disabled = state.busy;
    });
  }

  function routingActive() {
    return !!(state.routingEnabled && state.bar?.isConnected && state.input?.isConnected && state.host?.isConnected);
  }

  function blockNativeEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function cleanupBridge() {
    state.host?.classList.remove('ld2-composer-highlight', 'ld2-composer-busy', 'ld2-composer-routing-off');
    state.bar?.remove();
    state.input = null;
    state.host = null;
    state.bar = null;
    state.nativeSend = null;
    state.planBundle = null;
    state.shadowBundle = null;
  }

  async function loadSettings() {
    state.settings = await runtime({ type: 'LD2_SETTINGS_GET' });
    return state.settings;
  }

  function activeGithub(settings = state.settings || {}) {
    const pid = projectId();
    const mapping = pid && settings.projectMappings?.[pid] ? settings.projectMappings[pid] : {};
    return { ...(settings.github || {}), ...(mapping || {}) };
  }

  function autoSyncCall(action, payload = {}) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const port = chrome.runtime.connect({ name: 'ld2-github-autosync' });
      const id = crypto.randomUUID();
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => done(reject, new Error('GitHub AutoSync não respondeu.')), AUTOSYNC_TIMEOUT_MS);
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) done(resolve, message.data);
        else done(reject, new Error(message.error || 'Falha no GitHub AutoSync.'));
      });
      port.onDisconnect.addListener(() => {
        if (!settled && chrome.runtime.lastError) done(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action, payload });
    });
  }

  async function ensureExecutionReady() {
    const pid = projectId();
    if (!pid) throw new Error('Abra um projeto Lovable antes de usar o Editor Direto.');
    let ctx = projectContext();
    if (!ctx || ctx.projectId !== pid) ctx = await window.LovableDecrypterProjectRuntime?.refresh?.(true);
    if (!ctx?.detected || ctx.projectId !== pid) throw new Error('O Project Runtime ainda não identificou o projeto atual.');
    const settings = await loadSettings();
    let github = activeGithub(settings);
    let autoStatus = null;
    if (ctx.gitSync?.connected) {
      try {
        autoStatus = await autoSyncCall('reconcile', { context: ctx });
        await loadSettings();
        github = activeGithub(state.settings);
      } catch (error) {
        throw new Error(`GitHub AutoSync falhou: ${error?.message || String(error)} O comando foi bloqueado.`);
      }
      if (!autoStatus?.linked) {
        const reasons = {
          app_not_configured: 'GitHub App ainda não configurado.',
          authorization_required: 'Autorize o GitHub App para continuar.',
          repository_not_authorized: `${ctx.gitSync.fullName || 'O repositório'} não está autorizado no GitHub App.`,
          github_status_error: 'Não foi possível validar a autorização do GitHub.'
        };
        throw new Error(`${reasons[autoStatus?.state] || 'GitHub AutoSync não confirmou o repositório.'} O comando não foi enviado ao Lovable.`);
      }
      const mapped = `${github.owner || ''}/${github.repo || ''}`.toLowerCase();
      if (mapped !== String(ctx.gitSync.fullName || '').toLowerCase()) throw new Error('O repositório mapeado não corresponde ao GitSync do projeto. A execução foi bloqueada.');
    }
    if (!github.owner || !github.repo) throw new Error('Nenhum repositório GitHub está vinculado ao projeto atual.');
    if (github.source === 'lovable_gitsync_blocked') throw new Error('O GitSync detectado está bloqueado até o repositório ser autorizado no GitHub App.');
    if (github.authMode === 'legacy_token') {
      if (!github.token) throw new Error('Token legado ausente. Reconecte usando GitHub App.');
    } else if (!Number(github.installationId)) {
      throw new Error('GitHub App sem instalação ativa para este projeto.');
    }
    const test = await runtime({ type: 'LD2_GITHUB_TEST', projectId: pid });
    const expected = `${github.owner}/${github.repo}`.toLowerCase();
    if (!test?.name || String(test.name).toLowerCase() !== expected) throw new Error(`O GitHub respondeu com ${test?.name || 'um repositório desconhecido'}, mas o projeto espera ${github.owner}/${github.repo}.`);
    return { projectId: pid, context: ctx, github, autoStatus };
  }

  function validCommitSha(value) {
    return /^[0-9a-f]{7,64}$/i.test(String(value || '').trim());
  }

  function validateShadow(bundle) {
    const errors = [];
    const checks = [];
    const files = Array.isArray(bundle?.plan?.files) ? bundle.plan.files : [];
    if (!bundle?.id) errors.push('Identificador do shadow build ausente.'); else checks.push('Shadow build identificado');
    if (!validCommitSha(bundle?.baseHeadSha)) errors.push('HEAD base do GitHub ausente ou inválido.'); else checks.push('HEAD base travado');
    if (!files.length) errors.push('Nenhum arquivo foi proposto.');
    if (files.length > 30) errors.push('Mais de 30 arquivos propostos.');
    const seen = new Set();
    for (const file of files) {
      const path = String(file?.path || '').trim();
      const action = String(file?.action || '').toLowerCase();
      if (!path) errors.push('Arquivo sem caminho.');
      if (seen.has(path)) errors.push(`Arquivo duplicado: ${path}`);
      seen.add(path);
      if (!['create', 'update', 'delete'].includes(action)) errors.push(`Ação inválida em ${path || 'arquivo desconhecido'}.`);
      if (action === 'update' && String(file?.before ?? '') === String(file?.content ?? '')) errors.push(`Update sem alteração real em ${path}.`);
      if (action === 'create' && !String(file?.content ?? '')) errors.push(`Arquivo novo vazio: ${path}.`);
      if (action !== 'delete' && /\.json$/i.test(path)) {
        try { JSON.parse(String(file?.content ?? '')); } catch { errors.push(`JSON inválido após alteração: ${path}.`); }
      }
    }
    if (!errors.length) {
      checks.push(`${files.length} arquivo(s) com ação válida`, 'Caminhos sem duplicação', 'JSON alterado parseável', 'Scope lock aplicado no backend', 'HEAD será revalidado antes do commit');
    }
    return { ok: !errors.length, errors, checks, files };
  }

  function changedWindow(before, after, action) {
    const oldLines = String(before ?? '').split('\n');
    const newLines = String(after ?? '').split('\n');
    if (action === 'create') return { removed: [], added: newLines.slice(0, 14), prefix: [], suffix: [], truncated: newLines.length > 14 };
    if (action === 'delete') return { removed: oldLines.slice(0, 14), added: [], prefix: [], suffix: [], truncated: oldLines.length > 14 };
    let start = 0;
    while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
    let oldEnd = oldLines.length - 1;
    let newEnd = newLines.length - 1;
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) { oldEnd--; newEnd--; }
    const contextStart = Math.max(0, start - 2);
    const contextEndNew = Math.min(newLines.length, newEnd + 3);
    return {
      prefix: oldLines.slice(contextStart, start),
      removed: oldLines.slice(start, Math.min(oldEnd + 1, start + 12)),
      added: newLines.slice(start, Math.min(newEnd + 1, start + 12)),
      suffix: newLines.slice(Math.max(start, newEnd + 1), contextEndNew),
      truncated: (oldEnd - start + 1) > 12 || (newEnd - start + 1) > 12
    };
  }

  function diffHtml(file) {
    const action = String(file?.action || 'update').toLowerCase();
    const diff = changedWindow(file?.before || '', file?.content || '', action);
    const lines = [];
    diff.prefix.forEach(line => lines.push(`<span class="ctx">  ${escapeHtml(line)}</span>`));
    diff.removed.forEach(line => lines.push(`<span class="del">- ${escapeHtml(line)}</span>`));
    diff.added.forEach(line => lines.push(`<span class="add">+ ${escapeHtml(line)}</span>`));
    diff.suffix.forEach(line => lines.push(`<span class="ctx">  ${escapeHtml(line)}</span>`));
    if (diff.truncated) lines.push('<span class="ctx">  … diff resumido …</span>');
    return lines.join('') || '<span class="ctx">  Sem trecho textual para mostrar.</span>';
  }

  function removeReview() {
    state.bar?.querySelector('[data-ld2-review]')?.remove();
  }

  function renderPlan(bundle) {
    state.planBundle = bundle;
    state.shadowBundle = null;
    removeReview();
    const plan = bundle?.plan || {};
    const items = Array.isArray(plan.plan) ? plan.plan.slice(0, 10) : [];
    const box = document.createElement('div');
    box.className = 'ld2-bridge-plan ld2-editor-review';
    box.dataset.ld2Review = 'plan';
    box.innerHTML = `<div class="ld2-bridge-plan-head"><b>Plano pronto · somente leitura</b><span>ZERO WRITE</span></div><p>${escapeHtml(plan.summary || 'Plano gerado para revisão.')}</p>${items.length ? `<ol>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>` : ''}<div class="ld2-editor-meta">${escapeHtml(bundle?.github?.owner || '')}/${escapeHtml(bundle?.github?.repo || '')} · ${escapeHtml(bundle?.github?.branch || 'main')}</div><div class="ld2-bridge-plan-actions"><button type="button" data-ld2-review-close>Fechar</button><button type="button" class="primary" data-ld2-plan-to-build>Preparar Build</button></div>`;
    state.bar.appendChild(box);
    box.querySelector('[data-ld2-review-close]').onclick = () => { state.planBundle = null; box.remove(); };
    box.querySelector('[data-ld2-plan-to-build]').onclick = () => prepareShadow(bundle.command, 'plan-approved');
  }

  function renderShadow(bundle, validation) {
    state.shadowBundle = bundle;
    state.planBundle = null;
    removeReview();
    const files = validation.files;
    const box = document.createElement('div');
    box.className = 'ld2-bridge-plan ld2-editor-review ld2-shadow-review';
    box.dataset.ld2Review = 'shadow';
    box.innerHTML = `<div class="ld2-bridge-plan-head"><b>Shadow Build pronto para revisão</b><span>${files.length} arquivo(s)</span></div><p>${escapeHtml(bundle?.plan?.summary || 'Alterações preparadas em memória. Nenhum commit foi criado.')}</p><div class="ld2-editor-meta"><span>${escapeHtml(bundle.github?.owner || '')}/${escapeHtml(bundle.github?.repo || '')} · ${escapeHtml(bundle.github?.branch || 'main')}</span><span>Base ${escapeHtml(String(bundle.baseHeadSha || '').slice(0, 8))}</span></div><div class="ld2-editor-validation"><b>Validação ✓</b><span>${validation.checks.length} verificações · HEAD revalidado no Apply</span></div><div class="ld2-editor-files">${files.map((file, index) => `<details ${index === 0 ? 'open' : ''}><summary><span class="action ${escapeHtml(file.action || 'update')}">${escapeHtml(String(file.action || 'update').toUpperCase())}</span><b>${escapeHtml(file.path)}</b></summary><pre>${diffHtml(file)}</pre></details>`).join('')}</div><div class="ld2-editor-warning">O GitHub só será alterado quando você clicar em <b>Aplicar no GitHub</b>. Se a branch mudar antes disso, o commit será recusado.</div><div class="ld2-bridge-plan-actions"><button type="button" data-ld2-shadow-cancel>Cancelar</button><button type="button" class="primary" data-ld2-shadow-apply>Aplicar no GitHub</button></div>`;
    state.bar.appendChild(box);
    box.querySelector('[data-ld2-shadow-cancel]').onclick = () => { state.shadowBundle = null; box.remove(); setStatus('Shadow Build cancelado. Nenhum arquivo foi alterado.', 'success'); };
    box.querySelector('[data-ld2-shadow-apply]').onclick = () => applyShadow(box);
  }

  async function prepareShadow(command, source = 'build') {
    const cleanCommand = String(command || readInput(state.input)).trim();
    if (!cleanCommand) return setStatus('Digite um comando no composer do Lovable.', 'error');
    await ensureExecutionReady();
    state.requestId = crypto.randomUUID();
    setBusy(true);
    setStatus('Shadow Build · lendo projeto, gerando patches e validando…', 'active');
    try {
      const bundle = await runtime({ type: 'LD2_PLAN_PREPARE', command: cleanCommand, attachments: state.attachments.map(item => ({ ...item })), projectId: projectId(), requestId: state.requestId, source });
      const validation = validateShadow(bundle);
      if (!validation.ok) throw new Error(`Shadow Build recusado: ${validation.errors.join(' ')}`);
      renderShadow(bundle, validation);
      setStatus(`Shadow Build pronto · ${validation.files.length} arquivo(s) · nenhum commit criado.`, 'success');
    } finally {
      setBusy(false);
      refreshBar();
    }
  }

  async function verifyLovableSync(commitSha) {
    const verifier = window.LovableDecrypterSyncVerifier;
    if (!verifier?.verify) return { verified: false, observable: false, reason: 'verifier_unavailable' };
    setStatus(`Commit ${commitSha.slice(0, 8)} confirmado no GitHub · verificando GitSync do Lovable…`, 'active');
    try { return await verifier.verify({ projectId: projectId(), commitSha }); }
    catch (error) { return { verified: false, observable: false, reason: 'verification_error', error: error?.message || String(error) }; }
  }

  async function applyShadow(box) {
    if (state.busy || !state.shadowBundle) return;
    if (!(await authorized(true))) return setStatus('Sua KEY precisa ser validada novamente.', 'error');
    const bundle = state.shadowBundle;
    await ensureExecutionReady();
    setBusy(true);
    setStatus('Aplicando Shadow Build no GitHub…', 'active');
    try {
      const result = await runtime({ type: 'LD2_PLAN_APPLY', id: bundle.id });
      const commitSha = String(result?.commitSha || '').trim();
      if (!validCommitSha(commitSha)) throw new Error('O GitHub não retornou um commit válido. A execução não foi marcada como concluída.');
      const sync = await verifyLovableSync(commitSha);
      state.attachments = [];
      state.shadowBundle = null;
      writeInput(state.input, '');
      if (box?.isConnected) {
        box.innerHTML = `<div class="ld2-bridge-plan-head"><b>GitHub atualizado</b><span>${escapeHtml(commitSha.slice(0, 8))}</span></div><p>${sync.verified ? 'O commit foi confirmado no GitHub e o mesmo SHA foi observado no GitSync do Lovable.' : sync.observable ? 'O commit foi confirmado no GitHub, mas o GitSync do Lovable ainda não confirmou esse SHA.' : 'O commit foi confirmado no GitHub. O endpoint GitSync do Lovable não expôs um SHA verificável nesta sessão.'}</p><div class="ld2-editor-result ${sync.verified ? 'verified' : 'pending'}">${sync.verified ? '✓ GitHub + Lovable sincronizados' : '⚠ GitHub confirmado · Lovable não confirmado'}</div><div class="ld2-bridge-plan-actions">${result?.commitUrl ? '<button type="button" data-ld2-open-commit>Abrir commit</button>' : ''}<button type="button" class="primary" data-ld2-review-close>Fechar</button></div>`;
        box.querySelector('[data-ld2-review-close]').onclick = () => box.remove();
        box.querySelector('[data-ld2-open-commit]')?.addEventListener('click', () => window.open(result.commitUrl, '_blank', 'noopener,noreferrer'));
      }
      setStatus(sync.verified ? `Concluído · commit ${commitSha.slice(0, 8)} · GitSync Lovable confirmado.` : `GitHub concluído · commit ${commitSha.slice(0, 8)} · sincronização Lovable não confirmada.`, sync.verified ? 'success' : 'active');
    } catch (error) {
      setStatus(error?.message || String(error), 'error');
    } finally {
      setBusy(false);
      refreshBar();
    }
  }

  async function execute(source = 'decrypter') {
    if (state.busy || !state.input) { if (state.busy) setStatus('Já existe uma operação do Editor Direto em andamento.', 'active'); return; }
    if (!(await authorized(true))) return setStatus('Ative o Lovable Decrypter com uma KEY válida.', 'error');
    const command = readInput(state.input).trim();
    if (!command) return setStatus('Digite um comando no composer do Lovable.', 'error');
    try {
      await ensureExecutionReady();
      if (state.mode === 'plan') {
        state.requestId = crypto.randomUUID();
        setBusy(true);
        setStatus('Planejando · somente leitura · o Lovable não recebe o prompt…', 'active');
        try {
          const bundle = await runtime({ type: 'LD2_PLAN_ONLY', command, attachments: state.attachments.map(item => ({ ...item })), projectId: projectId(), requestId: state.requestId, source });
          if (!bundle?.plan || !Array.isArray(bundle.plan.plan)) throw new Error('O backend não retornou um plano válido.');
          renderPlan(bundle);
          setStatus('Plano pronto · ZERO WRITE · nenhum arquivo foi alterado.', 'success');
        } finally { setBusy(false); refreshBar(); }
      } else {
        await prepareShadow(command, source);
      }
    } catch (error) {
      setBusy(false);
      refreshBar();
      setStatus(error?.message || String(error), 'error');
    }
  }

  function openSettings() { document.querySelector('#ld2-root [data-settings]')?.click(); }

  async function setRoutingEnabled(enabled) {
    state.routingEnabled = enabled !== false;
    await chrome.storage.local.set({ [ROUTING_KEY]: state.routingEnabled });
    refreshBar();
    setStatus(state.routingEnabled ? 'Decrypter ON · Enter/Enviar ficam no Editor Direto. Lovable não recebe o prompt.' : 'Decrypter OFF · Enter/Enviar usam o Lovable e podem consumir créditos.', state.routingEnabled ? 'success' : 'error');
  }

  function refreshBar() {
    if (!state.bar) return;
    state.bar.querySelectorAll('[data-ld2-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.ld2Mode === state.mode));
    const attachCount = state.bar.querySelector('[data-ld2-attach-count]');
    if (attachCount) attachCount.textContent = state.attachments.length ? `${state.attachments.length} anexo(s)` : 'Anexar';
    const model = state.bar.querySelector('[data-ld2-model]');
    if (model) {
      const name = String(state.settings?.gemini?.model || 'Gemini').replace(/^models\//, '');
      model.textContent = name.length > 24 ? `${name.slice(0, 22)}…` : name;
      model.title = `Modelo: ${name}. Clique para configurar.`;
    }
    const routing = state.bar.querySelector('[data-ld2-routing]');
    if (routing) {
      routing.textContent = state.routingEnabled ? 'Decrypter ON' : 'Decrypter OFF';
      routing.dataset.off = state.routingEnabled ? '0' : '1';
      routing.title = state.routingEnabled ? 'O envio nativo do Lovable está bloqueado e roteado pelo Editor Direto.' : 'O envio nativo do Lovable está liberado e pode consumir créditos.';
    }
    state.bar.classList.toggle('routing-off', !state.routingEnabled);
    state.host?.classList.toggle('ld2-composer-routing-off', !state.routingEnabled);
  }

  function bindInputRouting(input) {
    if (!input || boundInputs.has(input)) return;
    boundInputs.add(input);
    input.addEventListener('keydown', event => {
      if (!routingActive()) return;
      if (event.isComposing || event.key !== 'Enter' || event.shiftKey || event.altKey) return;
      blockNativeEvent(event);
      execute('lovable-enter');
    }, true);
  }

  function isNativeSendTarget(button) {
    if (!button || !routingActive()) return false;
    if (!state.nativeSend?.isConnected) state.nativeSend = findNativeSendButton();
    if (state.nativeSend === button) return true;
    const fresh = findNativeSendButton();
    if (fresh) state.nativeSend = fresh;
    return state.nativeSend === button;
  }

  function interceptNativeClick(event) {
    if (!routingActive()) return;
    const button = event.target?.closest?.('button');
    if (!isNativeSendTarget(button)) return;
    blockNativeEvent(event);
    execute('lovable-send-button');
  }

  function interceptNativeSubmit(event) {
    if (!routingActive() || !state.input) return;
    const form = state.input.closest('form');
    if (!form || event.target !== form) return;
    blockNativeEvent(event);
    execute('lovable-form-submit');
  }

  async function createBar(input, host) {
    state.host?.classList.remove('ld2-composer-highlight', 'ld2-composer-busy', 'ld2-composer-routing-off');
    state.bar?.remove();
    const bar = document.createElement('div');
    bar.className = 'ld2-native-bridge ld2-editor-direct-v3';
    bar.innerHTML = `<div class="ld2-bridge-row ld2-bridge-top"><span class="ld2-bridge-brand"><i></i><span><b>Lovable Decrypter</b><small>EDITOR DIRETO · GITHUB</small></span></span><div class="ld2-bridge-mode" aria-label="Modo do Decrypter"><button type="button" data-ld2-mode="plan">Planejar</button><button type="button" data-ld2-mode="build">Construir</button></div><button type="button" class="ld2-bridge-chip routing" data-ld2-routing>Decrypter ON</button><button type="button" class="ld2-bridge-chip model" data-ld2-model>Gemini</button></div><div class="ld2-bridge-row ld2-bridge-bottom"><button type="button" class="ld2-bridge-chip attach" data-ld2-attach title="Anexar ao comando do Decrypter"><span>📎</span><span data-ld2-attach-count>Anexar</span></button><span class="ld2-bridge-status" data-ld2-bridge-status>Decrypter ON · Enter/Enviar ficam no Editor Direto. Lovable não recebe o prompt.</span></div><input type="file" data-ld2-file-input multiple hidden accept="${ACCEPT}">`;
    host.parentElement?.insertBefore(bar, host);
    host.classList.add('ld2-composer-highlight');
    state.input = input; state.host = host; state.bar = bar; state.nativeSend = findNativeSendButton(input, host); state.lastProjectId = projectId();
    const stored = await chrome.storage.local.get([MODE_KEY, ROUTING_KEY]);
    state.mode = stored[MODE_KEY] === 'plan' ? 'plan' : 'build';
    state.routingEnabled = stored[ROUTING_KEY] !== false;
    try { await loadSettings(); } catch (_) {}
    refreshBar(); bindInputRouting(input);
    bar.querySelectorAll('[data-ld2-mode]').forEach(btn => {
      btn.onclick = async () => {
        state.mode = btn.dataset.ld2Mode === 'plan' ? 'plan' : 'build';
        state.planBundle = null; state.shadowBundle = null; removeReview();
        await chrome.storage.local.set({ [MODE_KEY]: state.mode });
        refreshBar();
        setStatus(state.mode === 'plan' ? 'Planejar · somente leitura · ZERO WRITE.' : 'Construir · gera Shadow Build e exige Apply explícito antes do commit.', 'success');
      };
    });
    bar.querySelector('[data-ld2-routing]').onclick = () => setRoutingEnabled(!state.routingEnabled);
    bar.querySelector('[data-ld2-model]').onclick = openSettings;
    bar.querySelector('[data-ld2-attach]').onclick = () => bar.querySelector('[data-ld2-file-input]').click();
    bar.querySelector('[data-ld2-file-input]').onchange = async event => {
      try { await addFiles([...(event.target.files || [])]); setStatus('Anexos adicionados ao próximo comando.', 'success'); }
      catch (error) { setStatus(error?.message || String(error), 'error'); }
      event.target.value = '';
    };
  }

  let reconcileRunning = false;
  async function reconcile() {
    if (reconcileRunning) return;
    reconcileRunning = true;
    try {
      if (!(await authorized())) { cleanupBridge(); return; }
      const pid = projectId();
      if (state.lastProjectId && pid && state.lastProjectId !== pid) cleanupBridge();
      const input = findComposerInput();
      if (!input) { if (state.input && !state.input.isConnected) cleanupBridge(); return; }
      if (input === state.input && state.bar?.isConnected && state.host?.isConnected) { if (!state.nativeSend?.isConnected) state.nativeSend = findNativeSendButton(); return; }
      const host = findHost(input);
      if (!host?.parentElement) return;
      await createBar(input, host);
    } finally { reconcileRunning = false; }
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'LD2_PROGRESS' || !state.requestId || message.requestId !== state.requestId) return;
    const label = message.label || message.stage || 'Processando';
    const detail = message.detail ? ` · ${message.detail}` : '';
    setStatus(`${label}${detail}`, message.status === 'done' ? 'success' : 'active');
  });

  document.addEventListener('click', interceptNativeClick, true);
  document.addEventListener('submit', interceptNativeSubmit, true);
  addEventListener('popstate', () => setTimeout(() => reconcile().catch(() => {}), 100));
  addEventListener('hashchange', () => setTimeout(() => reconcile().catch(() => {}), 100));
  addEventListener('ld2:project', () => setTimeout(() => reconcile().catch(() => {}), 100));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reconcile().catch(() => {}); });
  setInterval(() => reconcile().catch(() => {}), 1200);
  reconcile().catch(() => {});
})();
