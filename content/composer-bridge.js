(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_COMPOSER_BRIDGE__) return;
  window.__LOVABLE_DECRYPTER_COMPOSER_BRIDGE__ = true;

  const MODE_KEY = 'ld2_native_composer_mode';
  const ROUTING_KEY = 'ld2_native_routing_enabled';
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
    nativeSend: null,
    mode: 'build',
    routingEnabled: true,
    busy: false,
    requestId: '',
    attachments: [],
    planBundle: null,
    settings: null,
    licensed: false,
    lastLicenseCheck: 0,
    licenseCheckPromise: null
  };

  const boundInputs = new WeakSet();
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

  function findNativeSendButton(input = state.input, host = state.host) {
    if (!input || !host) return null;
    const form = input.closest('form');
    const scope = form || host;
    const ir = input.getBoundingClientRect();
    const blocked = /attach|upload|arquivo|file|image|imagem|voice|voz|microphone|microfone|mic|emoji|plus|adicionar|model|settings|config/i;
    const sendWords = /send|submit|enviar|mandar|arrow.?up|paper.?plane|prompt/i;
    const candidates = [...scope.querySelectorAll('button')]
      .filter(buttonVisible)
      .map(btn => {
        const label = [
          btn.getAttribute('aria-label'),
          btn.getAttribute('title'),
          btn.getAttribute('data-testid'),
          btn.getAttribute('name'),
          btn.textContent
        ].filter(Boolean).join(' ').toLowerCase();
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
      .filter(x => x.score >= 7)
      .sort((a, b) => b.score - a.score);
    return candidates[0]?.btn || null;
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
  }

  function activeGithub() {
    const settings = state.settings || {};
    const mapping = projectId() && settings.projectMappings?.[projectId()] ? settings.projectMappings[projectId()] : {};
    return { ...(settings.github || {}), ...(mapping || {}) };
  }

  async function ensureExecutionReady() {
    await loadSettings();
    const github = activeGithub();
    if (!github.owner || !github.repo) {
      throw new Error('GitHub não conectado. Abra o launcher e conecte um repositório antes de enviar.');
    }
    if (!github.token) {
      throw new Error('GitHub sem autorização de escrita. O comando foi bloqueado e não foi enviado ao Lovable.');
    }
    return github;
  }

  function validCommitSha(value) {
    return /^[0-9a-f]{7,64}$/i.test(String(value || '').trim());
  }

  function renderPlan(bundle) {
    state.planBundle = bundle;
    state.bar?.querySelector('.ld2-bridge-plan')?.remove();
    const plan = bundle?.plan || {};
    const box = document.createElement('div');
    box.className = 'ld2-bridge-plan';
    const items = Array.isArray(plan.plan) ? plan.plan.slice(0, 7) : [];
    box.innerHTML = `
      <div class="ld2-bridge-plan-head"><b>Plano pronto</b><span>${Array.isArray(plan.files) ? plan.files.length : 0} arquivo(s)</span></div>
      <p>${escapeHtml(plan.summary || 'Plano gerado para revisão.')}</p>
      ${items.length ? `<ol>${items.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ol>` : ''}
      <div class="ld2-bridge-plan-actions"><button type="button" data-ld2-plan-close>Fechar</button><button type="button" class="primary" data-ld2-plan-approve>Aprovar e construir</button></div>`;
    state.bar.appendChild(box);
    box.querySelector('[data-ld2-plan-close]').onclick = () => box.remove();
    box.querySelector('[data-ld2-plan-approve]').onclick = () => approvePlan(box);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  async function execute(source = 'decrypter') {
    if (state.busy || !state.input) {
      if (state.busy) setStatus('Já existe uma execução em andamento.', 'active');
      return;
    }
    if (!(await authorized(true))) return setStatus('Ative o Lovable Decrypter com uma KEY válida.', 'error');
    const command = readInput(state.input).trim();
    if (!command) return setStatus('Digite um comando no composer do Lovable.', 'error');

    try {
      await ensureExecutionReady();
    } catch (error) {
      setStatus(error?.message || String(error), 'error');
      return;
    }

    state.requestId = crypto.randomUUID();
    const attachments = state.attachments.map(x => ({ ...x }));
    setBusy(true);
    setStatus(state.mode === 'plan' ? 'Planejando sem enviar ao Lovable…' : 'Construindo no GitHub…', 'active');
    try {
      if (state.mode === 'plan') {
        const bundle = await runtime({ type: 'LD2_PLAN_ONLY', command, attachments, projectId: projectId(), requestId: state.requestId, source });
        if (!bundle?.plan) throw new Error('O backend não retornou um plano válido.');
        renderPlan(bundle);
        writeInput(state.input, '');
        setStatus('Plano pronto. Nenhum arquivo foi alterado.', 'success');
      } else {
        const out = await runtime({ type: 'LD2_BUILD_EXECUTE', command, attachments, projectId: projectId(), requestId: state.requestId, source });
        const commitSha = String(out?.result?.commitSha || '').trim();
        if (!validCommitSha(commitSha)) {
          throw new Error('Construção não confirmada: nenhum commit GitHub foi retornado. O comando não foi marcado como concluído.');
        }
        writeInput(state.input, '');
        state.attachments = [];
        setStatus(`GitHub atualizado · commit ${commitSha.slice(0, 8)}`, 'success');
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
    try {
      await ensureExecutionReady();
    } catch (error) {
      setStatus(error?.message || String(error), 'error');
      return;
    }

    const bundle = state.planBundle;
    state.requestId = crypto.randomUUID();
    setBusy(true);
    setStatus('Construindo o plano aprovado no GitHub…', 'active');
    try {
      const out = await runtime({
        type: 'LD2_PLAN_APPROVE',
        command: bundle.command,
        approvedPlan: bundle.plan,
        attachments: state.attachments.map(x => ({ ...x })),
        projectId: projectId(),
        requestId: state.requestId,
        source: 'plan-approval'
      });
      const commitSha = String(out?.result?.commitSha || '').trim();
      if (!validCommitSha(commitSha)) {
        throw new Error('Plano não confirmado: nenhum commit GitHub foi retornado.');
      }
      state.attachments = [];
      state.planBundle = null;
      box?.remove();
      setStatus(`Plano aplicado · commit ${commitSha.slice(0, 8)}`, 'success');
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

  async function setRoutingEnabled(enabled) {
    state.routingEnabled = enabled !== false;
    await chrome.storage.local.set({ [ROUTING_KEY]: state.routingEnabled });
    refreshBar();
    setStatus(
      state.routingEnabled
        ? 'Decrypter ON · Enter/Enviar executam pela extensão. Lovable não recebe o prompt.'
        : 'Decrypter OFF · Enter/Enviar usam o Lovable e podem consumir créditos.',
      state.routingEnabled ? 'success' : 'error'
    );
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
      routing.title = state.routingEnabled
        ? 'O envio nativo do Lovable está bloqueado e roteado pelo Decrypter.'
        : 'O envio nativo do Lovable está liberado e pode consumir créditos.';
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
    bar.className = 'ld2-native-bridge';
    bar.innerHTML = `
      <div class="ld2-bridge-row ld2-bridge-top">
        <span class="ld2-bridge-brand"><i></i><span><b>Lovable Decrypter</b><small>GITHUB COMMAND ROUTER</small></span></span>
        <div class="ld2-bridge-mode" aria-label="Modo do Decrypter"><button type="button" data-ld2-mode="plan">Planejar</button><button type="button" data-ld2-mode="build">Construir</button></div>
        <button type="button" class="ld2-bridge-chip routing" data-ld2-routing>Decrypter ON</button>
        <button type="button" class="ld2-bridge-chip model" data-ld2-model>Gemini</button>
      </div>
      <div class="ld2-bridge-row ld2-bridge-bottom">
        <button type="button" class="ld2-bridge-chip attach" data-ld2-attach title="Anexar ao comando do Decrypter"><span>📎</span><span data-ld2-attach-count>Anexar</span></button>
        <span class="ld2-bridge-status" data-ld2-bridge-status>Decrypter ON · Enter/Enviar executam pela extensão. Lovable não recebe o prompt.</span>
      </div>
      <input type="file" data-ld2-file-input multiple hidden accept="${ACCEPT}">`;

    host.parentElement?.insertBefore(bar, host);
    host.classList.add('ld2-composer-highlight');
    state.input = input;
    state.host = host;
    state.bar = bar;
    state.nativeSend = findNativeSendButton(input, host);

    const stored = await chrome.storage.local.get([MODE_KEY, ROUTING_KEY]);
    state.mode = stored[MODE_KEY] === 'plan' ? 'plan' : 'build';
    state.routingEnabled = stored[ROUTING_KEY] !== false;
    await loadSettings();
    refreshBar();
    bindInputRouting(input);

    bar.querySelectorAll('[data-ld2-mode]').forEach(btn => btn.onclick = async () => {
      state.mode = btn.dataset.ld2Mode === 'plan' ? 'plan' : 'build';
      await chrome.storage.local.set({ [MODE_KEY]: state.mode });
      refreshBar();
      setStatus(
        state.mode === 'plan'
          ? 'Planejar: gera revisão e não altera arquivos até você aprovar.'
          : 'Construir: só conclui após confirmar um commit real no GitHub.',
        'success'
      );
    });
    bar.querySelector('[data-ld2-routing]').onclick = () => setRoutingEnabled(!state.routingEnabled);
    bar.querySelector('[data-ld2-model]').onclick = openSettings;
    bar.querySelector('[data-ld2-attach]').onclick = () => bar.querySelector('[data-ld2-file-input]').click();
    bar.querySelector('[data-ld2-file-input]').onchange = async event => {
      try {
        await addFiles([...(event.target.files || [])]);
        setStatus('Anexos adicionados ao próximo comando.', 'success');
      } catch (error) {
        setStatus(error?.message || String(error), 'error');
      }
      event.target.value = '';
    };
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
    if (input === state.input && state.bar?.isConnected && state.host?.isConnected) {
      if (!state.nativeSend?.isConnected) state.nativeSend = findNativeSendButton();
      return;
    }
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

  document.addEventListener('click', interceptNativeClick, true);
  document.addEventListener('submit', interceptNativeSubmit, true);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('popstate', schedule);
  addEventListener('hashchange', schedule);
  setInterval(schedule, 1800);
  schedule();
})();