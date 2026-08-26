(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_COMPOSER_BRIDGE__) return;
  window.__LOVABLE_DECRYPTER_COMPOSER_BRIDGE__ = true;

  const MODE_KEY = 'ld2_native_composer_mode';
  const MAX_ATTACHMENTS = 8;
  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
  const LICENSE_CACHE_MS = 2200;
  const LICENSE_TIMEOUT_MS = 6000;
  const ACCEPT = 'image/*,audio/*,video/*,.pdf,.txt,.md,.json,.csv,.tsv,.rtf,.doc,.docx,.xls,.xlsx,.ods,.ppt,.pptx,.html,.css,.js,.jsx,.ts,.tsx,.xml,.sql';

  const state = {
    input: null,
    host: null,
    bar: null,
    mode: 'build',
    busy: false,
    requestId: '',
    attachments: [],
    planBundle: null,
    settings: null,
    licensed: false,
    lastLicenseCheck: 0,
    licenseCheckPromise: null
  };

  const api = () => window.LovableDecrypterV2;
  const runtime = message => api()?.runtime?.(message);
  const projectId = () => api()?.getProjectId?.() || '';

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  }

  async function authorized(force = false) {
    const now = Date.now();
    if (!force && now - state.lastLicenseCheck < LICENSE_CACHE_MS) return state.licensed;
    if (state.licenseCheckPromise) return state.licenseCheckPromise;
    state.licenseCheckPromise = (async () => {
      try {
        const status = await withTimeout(runtime({ type: 'LD2_LICENSE_STATUS' }), LICENSE_TIMEOUT_MS);
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
    const candidates = [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
      .map(el => ({ el, score: scoreInput(el) }))
      .filter(x => x.score >= 5)
      .sort((a, b) => b.score - a.score || b.el.getBoundingClientRect().bottom - a.el.getBoundingClientRect().bottom);
    return candidates[0]?.el || null;
  }

  function findHost(input) {
    let node = input;
    for (let i = 0; node && i < 6; i++, node = node.parentElement) {
      const r = node.getBoundingClientRect?.();
      if (!r) continue;
      const hasButton = !!node.querySelector?.('button');
      if (hasButton && r.width >= 260 && r.height >= 45 && r.height <= 320) return node;
    }
    return input.parentElement;
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
    let total = next.reduce((n, f) => n + Number(f.size || 0), 0);
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
    state.busy = busy;
    state.bar?.classList.toggle('busy', busy);
    state.host?.classList.toggle('ld2-composer-busy', busy);
    state.bar?.querySelectorAll('button').forEach(btn => {
      if (!btn.matches('[data-ld2-plan-approve],[data-ld2-plan-close]')) btn.disabled = busy;
    });
  }

  function cleanupBridge() {
    state.host?.classList.remove('ld2-composer-highlight', 'ld2-composer-busy');
    state.bar?.remove();
    state.input = null;
    state.host = null;
    state.bar = null;
  }

  function renderPlan(bundle) {
    state.planBundle = bundle;
    state.bar?.querySelector('.ld2-bridge-plan')?.remove();
    const plan = bundle?.plan || {};
    const box = document.createElement('div');
    box.className = 'ld2-bridge-plan';
    const items = Array.isArray(plan.plan) ? plan.plan.slice(0, 5) : [];
    box.innerHTML = `
      <div class="ld2-bridge-plan-head"><b>Plano pronto</b><span>${Array.isArray(plan.files) ? plan.files.length : 0} arquivo(s)</span></div>
      <p>${escapeHtml(plan.summary || 'Plano gerado para revisão.')}</p>
      ${items.length ? `<ol>${items.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ol>` : ''}
      <div class="ld2-bridge-plan-actions"><button type="button" data-ld2-plan-close>Fechar</button><button type="button" class="primary" data-ld2-plan-approve>Aprovar e executar</button></div>`;
    state.bar.appendChild(box);
    box.querySelector('[data-ld2-plan-close]').onclick = () => box.remove();
    box.querySelector('[data-ld2-plan-approve]').onclick = () => approvePlan(box);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  async function execute() {
    if (state.busy || !state.input) return;
    if (!(await authorized(true))) return setStatus('Ative o Lovable Decrypter com uma KEY válida.', 'error');
    const command = readInput(state.input).trim();
    if (!command) return setStatus('Digite um comando no composer do Lovable.', 'error');

    state.requestId = crypto.randomUUID();
    const attachments = state.attachments.map(x => ({ ...x }));
    setBusy(true);
    setStatus(state.mode === 'plan' ? 'Planejando o projeto…' : 'Preparando a construção…', 'active');
    try {
      if (state.mode === 'plan') {
        const bundle = await runtime({ type: 'LD2_PLAN_ONLY', command, attachments, projectId: projectId(), requestId: state.requestId });
        renderPlan(bundle);
        writeInput(state.input, '');
        setStatus('Plano pronto para revisão.', 'success');
      } else {
        const out = await runtime({ type: 'LD2_BUILD_EXECUTE', command, attachments, projectId: projectId(), requestId: state.requestId });
        writeInput(state.input, '');
        state.attachments = [];
        const commit = String(out?.result?.commitSha || '').slice(0, 8);
        setStatus(commit ? `Concluído · commit ${commit}` : 'Construção concluída.', 'success');
      }
    } catch (error) {
      setStatus(error?.message || String(error), 'error');
    } finally {
      setBusy(false);
      refreshBar();
    }
  }

  async function approvePlan(box) {
    if (state.busy || !state.planBundle) return;
    if (!(await authorized(true))) return setStatus('Sua KEY precisa ser validada novamente.', 'error');
    const bundle = state.planBundle;
    state.requestId = crypto.randomUUID();
    setBusy(true);
    setStatus('Executando plano aprovado…', 'active');
    try {
      const out = await runtime({
        type: 'LD2_PLAN_APPROVE',
        command: bundle.command,
        approvedPlan: bundle.plan,
        attachments: state.attachments.map(x => ({ ...x })),
        projectId: projectId(),
        requestId: state.requestId
      });
      state.attachments = [];
      state.planBundle = null;
      box?.remove();
      const commit = String(out?.result?.commitSha || '').slice(0, 8);
      setStatus(commit ? `Plano aplicado · commit ${commit}` : 'Plano aplicado.', 'success');
    } catch (error) {
      setStatus(error?.message || String(error), 'error');
    } finally {
      setBusy(false);
      refreshBar();
    }
  }

  function openSettings() {
    document.querySelector('#ld2-root [data-settings]')?.click();
  }

  async function loadSettings() {
    try { state.settings = await runtime({ type: 'LD2_SETTINGS_GET' }); } catch (_) {}
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
  }

  async function createBar(input, host) {
    state.host?.classList.remove('ld2-composer-highlight', 'ld2-composer-busy');
    state.bar?.remove();

    const bar = document.createElement('div');
    bar.className = 'ld2-native-bridge';
    bar.innerHTML = `
      <div class="ld2-bridge-row ld2-bridge-top">
        <span class="ld2-bridge-brand"><i></i><span><b>Lovable Decrypter</b><small>COMPOSER CONTROL</small></span></span>
        <div class="ld2-bridge-mode" aria-label="Modo do Decrypter"><button type="button" data-ld2-mode="plan">Planejar</button><button type="button" data-ld2-mode="build">Construir</button></div>
        <button type="button" class="ld2-bridge-chip model" data-ld2-model>Gemini</button>
      </div>
      <div class="ld2-bridge-row ld2-bridge-bottom">
        <button type="button" class="ld2-bridge-chip attach" data-ld2-attach title="Anexar ao comando do Decrypter"><span>📎</span><span data-ld2-attach-count>Anexar</span></button>
        <span class="ld2-bridge-status" data-ld2-bridge-status>Pronto para executar</span>
        <button type="button" class="ld2-bridge-run" data-ld2-run><span>▶</span>Executar</button>
      </div>
      <input type="file" data-ld2-file-input multiple hidden accept="${ACCEPT}">`;

    host.parentElement?.insertBefore(bar, host);
    host.classList.add('ld2-composer-highlight');
    state.input = input;
    state.host = host;
    state.bar = bar;

    const stored = await chrome.storage.local.get(MODE_KEY);
    state.mode = stored[MODE_KEY] === 'plan' ? 'plan' : 'build';
    await loadSettings();
    refreshBar();

    bar.querySelectorAll('[data-ld2-mode]').forEach(btn => btn.onclick = async () => {
      state.mode = btn.dataset.ld2Mode === 'plan' ? 'plan' : 'build';
      await chrome.storage.local.set({ [MODE_KEY]: state.mode });
      refreshBar();
    });
    bar.querySelector('[data-ld2-run]').onclick = execute;
    bar.querySelector('[data-ld2-model]').onclick = openSettings;
    bar.querySelector('[data-ld2-attach]').onclick = () => bar.querySelector('[data-ld2-file-input]').click();
    bar.querySelector('[data-ld2-file-input]').onchange = async e => {
      try { await addFiles([...(e.target.files || [])]); setStatus('Anexos adicionados ao comando.', 'success'); }
      catch (error) { setStatus(error?.message || String(error), 'error'); }
      e.target.value = '';
    };

    input.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        execute();
      }
    }, true);
  }

  let scheduled = false;
  async function reconcile() {
    scheduled = false;
    if (!(await authorized())) {
      cleanupBridge();
      return;
    }
    const input = findComposerInput();
    if (!input) {
      if (state.input && !state.input.isConnected) cleanupBridge();
      return;
    }
    if (input === state.input && state.bar?.isConnected && state.host?.isConnected) return;
    const host = findHost(input);
    if (!host?.parentElement) return;
    await createBar(input, host);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => reconcile().catch(() => { scheduled = false; }), 120);
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'LD2_PROGRESS' || !state.requestId || message.requestId !== state.requestId) return;
    const label = message.label || message.stage || 'Processando';
    const detail = message.detail ? ` · ${message.detail}` : '';
    setStatus(`${label}${detail}`, message.status === 'done' ? 'success' : 'active');
  });

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('popstate', schedule);
  addEventListener('hashchange', schedule);
  setInterval(schedule, 1800);
  schedule();
})();
