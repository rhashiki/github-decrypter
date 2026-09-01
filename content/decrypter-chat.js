(() => {
  'use strict';
  if (window.__LD2_DECRYPTER_CHAT__) return;
  window.__LD2_DECRYPTER_CHAT__ = true;

  const ROUTING_KEY = 'ld2_native_routing_enabled';
  const PORT_NAME = 'ld2-decrypter-chat';
  const HOST_ID = 'ld2-decrypter-chat-host';
  const MAX_ATTACHMENTS = 8;
  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
  const WATCH_MS = 900;
  const ACCEPT = 'image/*,audio/*,video/*,.pdf,.txt,.md,.json,.csv,.tsv,.rtf,.doc,.docx,.xls,.xlsx,.ods,.ppt,.pptx,.html,.css,.js,.jsx,.ts,.tsx,.xml,.sql';

  const state = {
    routingEnabled: true,
    phase: 'DEGRADED',
    reason: 'booting',
    projectId: '',
    nativeInput: null,
    nativeShell: null,
    host: null,
    shadow: null,
    mode: 'chat',
    busy: false,
    history: [],
    attachments: [],
    requestId: '',
    lastProgress: '',
    graph: null,
    rulesCount: null,
    skills: [],
    intelligence: null,
    shellState: null,
    watch: 0
  };

  const api = () => window.LovableDecrypterV2;
  const runtime = message => api()?.runtime?.(message);
  const projectId = () => String(api()?.getProjectId?.() || '');
  const core = () => window.LovableDecrypterChatCore;
  const escapeHtml = value => core()?.escapeHtml?.(value) || String(value ?? '');

  const STYLE = `
    :host{all:initial;font-family:Arial,sans-serif;color:#edfdf4;position:fixed;z-index:2147482500;display:block;box-sizing:border-box;color-scheme:dark}
    *{box-sizing:border-box;font-family:Arial,sans-serif}.ldc{height:100%;width:100%;min-width:280px;background:linear-gradient(180deg,rgba(4,12,9,.985),rgba(3,8,7,.99));border:1px solid rgba(69,255,159,.28);box-shadow:0 24px 80px rgba(0,0,0,.58);display:flex;flex-direction:column;overflow:hidden;color:#e8fff2}
    .ldc-head{display:flex;align-items:center;gap:9px;padding:10px 12px;border-bottom:1px solid rgba(77,255,166,.16);background:rgba(6,18,13,.96);min-height:52px}.ldc-brand{display:flex;align-items:center;gap:8px;min-width:0;flex:1}.ldc-logo{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;border:1px solid #35ef8a;color:#43ff9a;font-weight:900;font-size:11px;box-shadow:0 0 18px rgba(53,239,138,.18)}.ldc-brand b{font-size:13px;display:block;white-space:nowrap}.ldc-brand small{font-size:9px;color:#79ab8d;display:block;margin-top:2px;letter-spacing:.08em}.ldc-state{font-size:9px;font-weight:800;padding:5px 7px;border:1px solid rgba(68,255,153,.3);border-radius:999px;color:#75ffa9;white-space:nowrap}.ldc-state.busy{color:#ffd772;border-color:rgba(255,215,114,.35)}.ldc-state.locked{color:#ff8080;border-color:rgba(255,128,128,.35)}.ldc-state.degraded{color:#ffb66e;border-color:rgba(255,182,110,.35)}.ldc-native,.ldc-clear{border:1px solid rgba(124,160,139,.28);background:rgba(255,255,255,.035);color:#b8d8c3;border-radius:8px;padding:6px 8px;font-size:10px;cursor:pointer}.ldc-native:hover,.ldc-clear:hover{border-color:#3ddd87;color:#eafff2}
    .ldc-meta{display:flex;align-items:center;gap:5px;padding:6px 10px;border-bottom:1px solid rgba(80,255,165,.09);overflow:auto;scrollbar-width:thin}.ldc-pill{flex:0 0 auto;font-size:9px;color:#8db29a;border:1px solid rgba(116,159,131,.18);border-radius:999px;padding:4px 6px;background:rgba(255,255,255,.02)}.ldc-pill.ok{color:#70f9a2;border-color:rgba(80,232,137,.25)}.ldc-pill.warn{color:#ffca77;border-color:rgba(255,196,100,.28)}
    .ldc-messages{flex:1;overflow:auto;padding:14px 11px 22px;scrollbar-width:thin;scrollbar-color:rgba(64,255,145,.35) transparent}.ldc-empty{height:100%;display:grid;place-items:center;text-align:center;color:#6f9d7f;padding:30px}.ldc-empty b{display:block;color:#b8f7cc;margin-bottom:6px;font-size:14px}.ldc-msg{max-width:94%;margin:0 0 13px;animation:ldcin .12s ease-out}.ldc-msg.user{margin-left:auto}.ldc-bubble{border:1px solid rgba(118,159,133,.16);background:rgba(255,255,255,.035);border-radius:12px;padding:10px 11px;line-height:1.46;font-size:12.5px;overflow-wrap:anywhere}.ldc-msg.user .ldc-bubble{background:rgba(31,119,70,.19);border-color:rgba(72,255,148,.22)}.ldc-msg.system .ldc-bubble{border-style:dashed;color:#afcaba}.ldc-msg-meta{font-size:9px;color:#658874;margin:4px 5px 0;display:flex;gap:7px;justify-content:flex-start}.ldc-msg.user .ldc-msg-meta{justify-content:flex-end}.ldc-bubble p{margin:0 0 7px}.ldc-bubble p:last-child{margin-bottom:0}.ldc-bubble h1,.ldc-bubble h2,.ldc-bubble h3{font-size:13px;margin:10px 0 6px;color:#caffd9}.ldc-bubble ul,.ldc-bubble ol{padding-left:19px;margin:6px 0}.ldc-bubble li{margin:3px 0}.ldc-gap{height:6px}.ldc-inline-code{background:rgba(0,0,0,.35);border:1px solid rgba(92,255,155,.15);padding:1px 4px;border-radius:4px;color:#a8ffc5}.ldc-code{margin:8px 0;background:#020604;border:1px solid rgba(75,255,149,.18);border-radius:8px;overflow:auto;white-space:pre;font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;color:#bdffd1}.ldc-code code{font:inherit}.ldc-code-head{position:sticky;left:0;padding:4px 7px;border-bottom:1px solid rgba(75,255,149,.12);font:9px Arial,sans-serif;color:#6da47d;background:#07110c}.ldc-files,.ldc-steps,.ldc-warnings{margin-top:8px;border-top:1px solid rgba(117,159,132,.12);padding-top:7px}.ldc-file{padding:5px 0;font-size:10px;color:#97bca3}.ldc-file b{color:#c9f7d8}.ldc-file pre{font:9px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;max-height:150px;overflow:auto;background:rgba(0,0,0,.25);padding:5px;border-radius:6px;color:#94bda2}.ldc-progress{display:flex;gap:7px;align-items:center;color:#8dbb9b;font-size:10px;padding:8px 10px;margin:0 0 10px;border:1px dashed rgba(79,255,147,.2);border-radius:8px}.ldc-spin{width:11px;height:11px;border-radius:50%;border:2px solid rgba(80,255,145,.2);border-top-color:#50ff91;animation:ldcspin .7s linear infinite}
    .ldc-compose{border-top:1px solid rgba(74,255,152,.15);background:rgba(5,15,10,.98);padding:8px}.ldc-modes{display:flex;gap:4px;margin-bottom:6px}.ldc-mode{border:1px solid rgba(115,153,129,.2);background:transparent;color:#759986;border-radius:7px;padding:5px 8px;font-size:10px;cursor:pointer}.ldc-mode.active{color:#60ff9d;border-color:rgba(72,255,148,.42);background:rgba(48,179,92,.09)}.ldc-input-wrap{display:flex;align-items:flex-end;gap:6px;border:1px solid rgba(75,255,149,.22);border-radius:11px;background:rgba(0,0,0,.18);padding:6px}.ldc-text{flex:1;min-height:36px;max-height:150px;resize:none;border:0;outline:0;background:transparent;color:#effff4;font-size:12.5px;line-height:1.4;padding:4px}.ldc-text::placeholder{color:#587865}.ldc-icon,.ldc-send{width:31px;height:31px;border-radius:8px;border:1px solid rgba(92,255,155,.22);background:rgba(57,202,107,.07);color:#6fff9f;cursor:pointer;font-size:13px}.ldc-send{background:rgba(44,209,102,.16);font-weight:900}.ldc-icon:disabled,.ldc-send:disabled,.ldc-mode:disabled{opacity:.42;cursor:not-allowed}.ldc-attachments{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px}.ldc-att{display:flex;gap:4px;align-items:center;border:1px solid rgba(112,153,126,.18);border-radius:999px;padding:3px 6px;color:#97b9a2;font-size:9px}.ldc-att button{border:0;background:transparent;color:#ff8f8f;cursor:pointer;padding:0}.ldc-foot{display:flex;gap:6px;align-items:center;margin-top:5px;color:#62806c;font-size:9px}.ldc-foot span:last-child{margin-left:auto}.ldc-drop{outline:2px dashed rgba(69,255,153,.55);outline-offset:-5px}.ldc-lock{padding:14px;color:#ffc1c1;font-size:11px;text-align:center;border-top:1px solid rgba(255,90,90,.15)}
    @keyframes ldcspin{to{transform:rotate(360deg)}}@keyframes ldcin{from{opacity:.2;transform:translateY(3px)}to{opacity:1;transform:none}}
    @media(max-width:700px){.ldc{border-radius:0}.ldc-head{padding:8px}.ldc-brand small{display:none}.ldc-meta{padding:5px 7px}.ldc-messages{padding:10px 8px 18px}.ldc-msg{max-width:98%}.ldc-native{font-size:9px}.ldc-clear{display:none}}
  `;

  function visible(el) {
    if (!el || !el.isConnected || el.closest?.('#ld2-root') || el.id === HOST_ID) return false;
    const rect = el.getBoundingClientRect?.();
    if (!rect || rect.width < 180 || rect.height < 24 || rect.bottom <= 0 || rect.right <= 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }

  function scoreInput(el) {
    if (!visible(el) || el.disabled || el.readOnly) return -1;
    const rect = el.getBoundingClientRect();
    const label = String(el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').toLowerCase();
    let score = 0;
    if (el.tagName === 'TEXTAREA') score += 5;
    if (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox') score += 3;
    if (rect.width >= 280) score += 3;
    if (rect.bottom >= innerHeight * .5) score += 3;
    if (/message|mensagem|ask|prompt|describe|chat|lovable|what do you want|type/i.test(label)) score += 5;
    if (el.closest('form')) score += 2;
    return score;
  }

  function findNativeInput() {
    return [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
      .filter(el => !el.closest(`#${HOST_ID}`))
      .map(el => ({ el, score: scoreInput(el) }))
      .filter(item => item.score >= 6)
      .sort((a, b) => b.score - a.score || b.el.getBoundingClientRect().bottom - a.el.getBoundingClientRect().bottom)[0]?.el || null;
  }

  function findNativeShell(input) {
    if (!input) return null;
    const candidates = [];
    let node = input.parentElement;
    for (let depth = 0; node && depth < 12; depth++, node = node.parentElement) {
      if (node === document.body || node === document.documentElement || node.id === 'ld2-root') break;
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 250 || rect.height < 260) continue;
      if (rect.width > innerWidth * .99 && rect.height > innerHeight * .95) continue;
      let score = 0;
      if (rect.height >= innerHeight * .55) score += 8;
      if (rect.bottom >= innerHeight * .85) score += 3;
      if (innerWidth > 800 && rect.left >= innerWidth * .38) score += 7;
      if (innerWidth > 800 && rect.width <= Math.min(900, innerWidth * .62)) score += 6;
      if (innerWidth <= 800 && rect.width >= innerWidth * .75) score += 5;
      if (node.querySelector?.('.ld2-native-bridge')) score += 2;
      candidates.push({ node, score, area: rect.width * rect.height });
    }
    return candidates.sort((a, b) => b.score - a.score || a.area - b.area)[0]?.node || input.closest('form')?.parentElement || null;
  }

  function nativeDraft(input) {
    if (!input) return '';
    return 'value' in input ? String(input.value || '') : String(input.innerText || input.textContent || '');
  }

  function clearNativeDraft(input) {
    if (!input) return;
    if ('value' in input) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (setter) setter.call(input, ''); else input.value = '';
    } else input.textContent = '';
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
  }

  function lockNativeShell(shell) {
    if (!shell || state.nativeShell === shell && state.shellState) return;
    unlockNativeShell();
    state.nativeShell = shell;
    state.shellState = {
      inert: shell.inert === true,
      ariaHidden: shell.getAttribute('aria-hidden')
    };
    shell.inert = true;
    shell.setAttribute('aria-hidden', 'true');
  }

  function unlockNativeShell() {
    const shell = state.nativeShell;
    const previous = state.shellState;
    if (shell?.isConnected && previous) {
      shell.inert = previous.inert;
      if (previous.ariaHidden == null) shell.removeAttribute('aria-hidden');
      else shell.setAttribute('aria-hidden', previous.ariaHidden);
    }
    state.nativeShell = null;
    state.shellState = null;
  }

  function syncGeometry() {
    if (!state.host?.isConnected || !state.nativeShell?.isConnected) return false;
    const rect = state.nativeShell.getBoundingClientRect();
    if (rect.width < 250 || rect.height < 260 || rect.bottom <= 0 || rect.right <= 0) return false;
    const host = state.host;
    host.style.left = `${Math.max(0, rect.left)}px`;
    host.style.top = `${Math.max(0, rect.top)}px`;
    host.style.width = `${Math.min(innerWidth - Math.max(0, rect.left), rect.width)}px`;
    host.style.height = `${Math.min(innerHeight - Math.max(0, rect.top), rect.height)}px`;
    return true;
  }

  function phase(next, reason = '') {
    state.phase = next;
    state.reason = reason;
    renderHeaderState();
    window.dispatchEvent(new CustomEvent('ld2:decrypter-chat-state', { detail: snapshot() }));
  }

  function snapshot() {
    return Object.freeze({
      schema: 'ld-decrypter-chat-state/1',
      build: 29,
      phase: state.phase,
      reason: state.reason,
      enabled: state.routingEnabled === true,
      projectId: state.projectId,
      mounted: !!state.host?.isConnected,
      busy: state.busy,
      mode: state.mode,
      historyCount: state.history.length,
      attachments: state.attachments.length
    });
  }

  function renderHeaderState() {
    const root = state.shadow;
    if (!root) return;
    const badge = root.querySelector('[data-ldc-state]');
    if (badge) {
      badge.textContent = state.phase;
      badge.className = `ldc-state ${state.phase.toLowerCase()}`;
      badge.title = state.reason || state.phase;
    }
    const lock = root.querySelector('[data-ldc-lock]');
    if (lock) {
      const locked = state.phase === 'LOCKED' || state.phase === 'DEGRADED';
      lock.hidden = !locked;
      lock.textContent = locked ? (state.reason || 'O Decrypter está bloqueado por segurança. O prompt não será enviado ao Lovable.') : '';
    }
  }

  function shadowTemplate() {
    return `<style>${STYLE}</style><section class="ldc" data-ldc-root>
      <header class="ldc-head">
        <div class="ldc-brand"><span class="ldc-logo">LD</span><span><b>Lovable Decrypter</b><small>DECRYPTER CHAT · ZERO LOVABLE SEND</small></span></div>
        <span class="ldc-state degraded" data-ldc-state>DEGRADED</span>
        <button class="ldc-clear" type="button" data-ldc-clear title="Limpar histórico deste projeto">Limpar</button>
        <button class="ldc-native" type="button" data-ldc-native>Chat nativo</button>
      </header>
      <div class="ldc-meta" data-ldc-meta></div>
      <main class="ldc-messages" data-ldc-messages></main>
      <div class="ldc-lock" data-ldc-lock hidden></div>
      <footer class="ldc-compose" data-ldc-compose>
        <div class="ldc-modes"><button class="ldc-mode active" data-ldc-mode="chat" type="button">Chat</button><button class="ldc-mode" data-ldc-mode="plan" type="button">Planejar</button><button class="ldc-mode" data-ldc-mode="build" type="button">Build</button></div>
        <div class="ldc-attachments" data-ldc-attachments></div>
        <div class="ldc-input-wrap"><button class="ldc-icon" type="button" data-ldc-attach title="Anexar">＋</button><textarea class="ldc-text" data-ldc-input rows="1" placeholder="Pergunte, planeje ou prepare uma Build…"></textarea><button class="ldc-send" type="button" data-ldc-send title="Enviar ao Decrypter">↑</button></div>
        <input type="file" data-ldc-file multiple hidden accept="${ACCEPT}">
        <div class="ldc-foot"><span data-ldc-status>Decrypter Chat</span><span>Enter envia · Shift+Enter quebra linha</span></div>
      </footer>
    </section>`;
  }

  function setStatus(message) {
    const el = state.shadow?.querySelector('[data-ldc-status]');
    if (el) el.textContent = String(message || '');
  }

  function setBusy(value) {
    state.busy = !!value;
    state.shadow?.querySelectorAll('button,textarea').forEach(el => {
      if (el.matches('[data-ldc-native]')) return;
      el.disabled = state.busy;
    });
    phase(state.busy ? 'BUSY' : 'READY', state.busy ? (state.lastProgress || 'Processando no Decrypter…') : 'Transação isolada do Lovable.');
  }

  function renderMeta() {
    const el = state.shadow?.querySelector('[data-ldc-meta]');
    if (!el) return;
    const graph = state.graph;
    const graphStatus = String(graph?.status || 'partial');
    const brain = state.intelligence?.last ? 'ON' : '—';
    const knowledge = String(state.intelligence?.knowledge?.status || '—');
    const gateway = state.intelligence?.model_gateway_active ? 'ON' : '—';
    const skills = state.skills.length ? `${state.skills.length}` : '—';
    const live = window.LovableDecrypterLiveOperations ? 'ON' : '—';
    const items = [
      ['Graph', graphStatus, graphStatus === 'consistent' ? 'ok' : 'warn'],
      ['Brain', brain, brain === 'ON' ? 'ok' : ''],
      ['Rules', state.rulesCount == null ? '—' : String(state.rulesCount), state.rulesCount > 0 ? 'ok' : ''],
      ['Skills', skills, state.skills.length ? 'ok' : ''],
      ['RAG', knowledge, knowledge === 'ready' ? 'ok' : knowledge === 'degraded' ? 'warn' : ''],
      ['Gateway', gateway, gateway === 'ON' ? 'ok' : 'warn'],
      ['Live Ops', live, live === 'ON' ? 'ok' : '']
    ];
    el.innerHTML = items.map(([label, value, kind]) => `<span class="ldc-pill ${kind}">${escapeHtml(label)} · ${escapeHtml(value)}</span>`).join('');
  }

  function renderAttachments() {
    const el = state.shadow?.querySelector('[data-ldc-attachments]');
    if (!el) return;
    el.innerHTML = state.attachments.map((item, index) => `<span class="ldc-att">${escapeHtml(item.name)} <small>${Math.ceil(item.size / 1024)} KB</small><button type="button" data-ldc-remove="${index}">×</button></span>`).join('');
    el.querySelectorAll('[data-ldc-remove]').forEach(button => button.onclick = () => {
      state.attachments.splice(Number(button.dataset.ldcRemove), 1);
      renderAttachments();
    });
  }

  function messageExtras(message) {
    const files = Array.isArray(message?.files) ? message.files : [];
    const steps = Array.isArray(message?.steps) ? message.steps : [];
    const warnings = Array.isArray(message?.warnings) ? message.warnings : [];
    return `${files.length ? `<div class="ldc-files"><b>Arquivos</b>${files.map(file => `<div class="ldc-file"><b>${escapeHtml(String(file.action || '').toUpperCase())} ${escapeHtml(file.path)}</b>${file.reason ? `<div>${escapeHtml(file.reason)}</div>` : ''}${file.preview ? `<pre>${escapeHtml(file.preview)}</pre>` : ''}</div>`).join('')}</div>` : ''}${steps.length ? `<div class="ldc-steps"><b>Próximos passos</b><ol>${steps.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol></div>` : ''}${warnings.length ? `<div class="ldc-warnings"><b>Avisos</b><ul>${warnings.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}`;
  }

  function messageHtml(message) {
    const role = ['user', 'assistant', 'system'].includes(message?.role) ? message.role : 'assistant';
    const rendered = role === 'assistant' ? core().renderMarkdown(message.content || '') : `<p>${escapeHtml(message.content || '')}</p>`;
    const when = message?.at ? new Date(message.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    const mode = String(message?.mode || 'chat').toUpperCase();
    return `<article class="ldc-msg ${role}" data-message-id="${escapeHtml(message.id)}"><div class="ldc-bubble" data-ldc-bubble>${rendered}${messageExtras(message)}</div><div class="ldc-msg-meta"><span>${escapeHtml(mode)}</span><span>${escapeHtml(when)}</span></div></article>`;
  }

  function renderHistory() {
    const box = state.shadow?.querySelector('[data-ldc-messages]');
    if (!box) return;
    if (!state.history.length) {
      box.innerHTML = '<div class="ldc-empty"><div><b>Decrypter Chat</b>Contexto do projeto, GitHub e Supabase ficam disponíveis aqui sem enviar seu prompt ao chat nativo do Lovable.</div></div>';
      return;
    }
    box.innerHTML = state.history.map(messageHtml).join('');
    box.scrollTop = box.scrollHeight;
  }

  async function persistHistory() {
    const c = core();
    if (!c || !state.projectId) return;
    state.history = c.sanitizeHistory(state.history);
    await chrome.storage.local.set({ [c.historyKey(state.projectId)]: state.history });
  }

  async function loadHistory(pid) {
    const c = core();
    if (!c || !pid) { state.history = []; return; }
    const key = c.historyKey(pid);
    const stored = await chrome.storage.local.get(key);
    state.history = c.sanitizeHistory(stored[key] || []);
    renderHistory();
  }

  async function clearHistory() {
    if (!state.projectId) return;
    const key = core().historyKey(state.projectId);
    await chrome.storage.local.remove(key);
    state.history = [];
    renderHistory();
    setStatus('Histórico deste projeto limpo.');
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
      if (!file?.size || file.size > MAX_FILE_BYTES) throw new Error(`${file?.name || 'Arquivo'} excede 15 MB.`);
      total += file.size;
      if (total > MAX_TOTAL_BYTES) throw new Error('Os anexos excedem 40 MB no total.');
      next.push({ name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, data: await fileToBase64(file) });
    }
    state.attachments = next;
    renderAttachments();
  }

  function chatPort(payload, onProgress) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const id = crypto.randomUUID();
      let settled = false;
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => done(reject, new Error('O Decrypter Chat excedeu o tempo limite.')), 240000);
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.event === 'progress') { onProgress?.(message); return; }
        if (message.ok) done(resolve, message.data);
        else {
          const error = new Error(message.error || 'Falha no Decrypter Chat.');
          error.code = message.code || '';
          done(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled && chrome.runtime.lastError) done(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action: 'chat', payload });
    });
  }

  function runtimeWithProgress(message, requestId, onProgress) {
    return new Promise((resolve, reject) => {
      const listener = progress => {
        if (progress?.type === 'LD2_PROGRESS' && progress.requestId === requestId) onProgress?.(progress);
      };
      chrome.runtime.onMessage.addListener(listener);
      Promise.resolve(runtime({ ...message, requestId })).then(resolve, reject).finally(() => chrome.runtime.onMessage.removeListener(listener));
    });
  }

  async function routedSkills(command) {
    const router = window.LovableDecrypterSkillRouter;
    if (!router?.route) return { slugs: [], context: '' };
    try {
      const selected = await router.route(command);
      const slugs = Array.isArray(selected?.slugs) ? selected.slugs.slice(0, 8) : [];
      state.skills = slugs;
      const catalog = await router.list?.().catch?.(() => null);
      const all = Array.isArray(catalog?.all) ? catalog.all : [];
      let used = 0;
      const parts = [];
      for (const slug of slugs) {
        const skill = all.find(item => String(item?.slug) === String(slug));
        const body = String(skill?.content_md || '').trim();
        if (!body) continue;
        const room = 70000 - used;
        if (room <= 0) break;
        const chunk = body.slice(0, room);
        parts.push(`SKILL ${slug}\n${chunk}`);
        used += chunk.length;
      }
      renderMeta();
      return { slugs, context: parts.join('\n\n---\n\n') };
    } catch (_) {
      state.skills = [];
      renderMeta();
      return { slugs: [], context: '' };
    }
  }

  async function refreshContext(command = '') {
    try {
      const rules = await window.LovableDecrypterProjectRulesCache?.refresh?.();
      state.rulesCount = Number.isFinite(Number(rules?.count)) ? Number(rules.count) : state.rulesCount;
    } catch (_) {}
    try {
      state.graph = await window.LovableDecrypterProjectStateGraph?.getGraph?.({ deepCompare: false });
    } catch (_) { state.graph = null; }
    try {
      state.intelligence = await runtime({ type: 'LD2_INTELLIGENCE_STATUS' });
    } catch (_) { state.intelligence = null; }
    const skills = command ? await routedSkills(command) : { slugs: state.skills, context: '' };
    renderMeta();
    return skills;
  }

  function progressCard(label, detail = '') {
    const box = state.shadow?.querySelector('[data-ldc-messages]');
    if (!box) return null;
    box.querySelector('[data-ldc-progress]')?.remove();
    const el = document.createElement('div');
    el.className = 'ldc-progress';
    el.dataset.ldcProgress = '1';
    el.innerHTML = `<span class="ldc-spin"></span><span><b>${escapeHtml(label || 'Processando')}</b>${detail ? ` · ${escapeHtml(detail)}` : ''}</span>`;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }

  async function progressiveAssistant(message) {
    const sanitized = core().sanitizeMessage(message);
    const content = sanitized.content;
    sanitized.content = '';
    state.history.push(sanitized);
    renderHistory();
    const chunks = core().chunkText(content, 110);
    for (const chunk of chunks) {
      sanitized.content += chunk;
      const row = state.shadow?.querySelector(`[data-message-id="${CSS.escape(sanitized.id)}"] [data-ldc-bubble]`);
      if (row) row.innerHTML = core().renderMarkdown(sanitized.content) + messageExtras(sanitized);
      const list = state.shadow?.querySelector('[data-ldc-messages]');
      if (list) list.scrollTop = list.scrollHeight;
      await new Promise(resolve => setTimeout(resolve, 12));
    }
    await persistHistory();
  }

  function normalizedPlan(out) {
    const plan = out?.plan || {};
    return {
      content: String(plan.summary || 'Plano pronto.'),
      steps: Array.isArray(plan.plan) ? plan.plan.map(String) : [],
      files: (Array.isArray(plan.files) ? plan.files : []).map(file => ({ path: String(file?.path || ''), reason: String(file?.reason || '') })),
      warnings: Array.isArray(plan.warnings) ? plan.warnings.map(String) : [],
      metadata: { provider: String(plan?.gateway?.provider || ''), model: String(plan?.gateway?.model || ''), readOnly: true, commitCreated: false }
    };
  }

  function normalizedShadow(bundle) {
    const plan = bundle?.plan || {};
    const files = (Array.isArray(plan.files) ? plan.files : []).map(file => ({
      path: String(file?.path || ''),
      action: String(file?.action || 'update'),
      reason: String(file?.explanation || ''),
      preview: core().diffPreview(file?.before || '', file?.content || '', String(file?.action || 'update'))
    }));
    return {
      content: `${String(plan.summary || 'Shadow Build pronto.')}\n\n**Nenhum commit foi criado.** A Build 30 adicionará o fluxo Aprovar/Pular + Auto Repair.`,
      steps: Array.isArray(plan.plan) ? plan.plan.map(String) : [],
      files,
      warnings: [...(Array.isArray(plan.warnings) ? plan.warnings.map(String) : []), 'Shadow Build apenas: ZERO APPLY nesta Build.'],
      metadata: { provider: String(plan?.gateway?.provider || ''), model: String(plan?.gateway?.model || ''), readOnly: true, commitCreated: false }
    };
  }

  async function send() {
    if (state.busy || state.phase === 'LOCKED' || state.phase === 'DEGRADED') return;
    const input = state.shadow?.querySelector('[data-ldc-input]');
    const command = String(input?.value || '').trim();
    if (!command) return;
    const license = await runtime({ type: 'LD2_LICENSE_STATUS' }).catch(() => null);
    if (!license?.valid) { phase('LOCKED', 'KEY/licença inválida. O prompt não será enviado ao Lovable.'); return; }

    const attachments = state.attachments.map(item => ({ ...item }));
    const metadataAttachments = core().sanitizeAttachments(attachments);
    const userMessage = core().sanitizeMessage({ role: 'user', mode: state.mode, content: command, attachments: metadataAttachments, at: new Date().toISOString() });
    state.history.push(userMessage);
    await persistHistory();
    renderHistory();
    input.value = '';
    state.attachments = [];
    renderAttachments();
    state.requestId = crypto.randomUUID();
    state.lastProgress = 'Preparando contexto…';
    setBusy(true);
    progressCard('Preparando contexto');

    try {
      const skills = await refreshContext(command);
      let output;
      const onProgress = message => {
        state.lastProgress = `${message.label || message.stage || 'Processando'}${message.detail ? ` · ${message.detail}` : ''}`;
        setStatus(state.lastProgress);
        progressCard(message.label || message.stage, message.detail || '');
        phase('BUSY', state.lastProgress);
      };

      if (state.mode === 'chat') {
        const result = await chatPort({
          projectId: state.projectId,
          message: command,
          history: core().sanitizeHistory(state.history.slice(0, -1)).slice(-12),
          projectState: core().safeProjectState(state.graph || {}),
          skillSlugs: skills.slugs,
          skillContext: skills.context,
          attachments
        }, onProgress);
        output = {
          content: result.answer,
          steps: result.nextSteps || [],
          files: (result.analyzedFiles || []).map(path => ({ path, action: 'read', reason: 'Analisado como contexto' })),
          warnings: result.warnings || [],
          metadata: { provider: String(result.gateway?.provider || ''), model: String(result.gateway?.model || ''), readOnly: true, commitCreated: false }
        };
      } else if (state.mode === 'plan') {
        const result = await runtimeWithProgress({ type: 'LD2_PLAN_ONLY', command, attachments, projectId: state.projectId, source: 'decrypter-chat-plan' }, state.requestId, onProgress);
        output = normalizedPlan(result);
      } else {
        const result = await runtimeWithProgress({ type: 'LD2_PLAN_PREPARE', command, attachments, projectId: state.projectId, source: 'decrypter-chat-shadow' }, state.requestId, onProgress);
        output = normalizedShadow(result);
      }

      state.shadow?.querySelector('[data-ldc-progress]')?.remove();
      await progressiveAssistant({ role: 'assistant', mode: state.mode, at: new Date().toISOString(), ...output });
      setStatus(state.mode === 'build' ? 'Shadow Build pronto · ZERO COMMIT' : 'Concluído · Lovable não recebeu o prompt.');
    } catch (error) {
      state.shadow?.querySelector('[data-ldc-progress]')?.remove();
      await progressiveAssistant({ role: 'system', mode: 'system', content: `Execução bloqueada: ${error?.message || String(error)}`, warnings: ['Fail-closed: nenhum fallback para o chat nativo do Lovable foi executado.'], metadata: { readOnly: true, commitCreated: false } });
      setStatus('Bloqueado por segurança.');
    } finally {
      setBusy(false);
      await refreshContext('').catch(() => {});
    }
  }

  function switchToNative() {
    if (state.busy) return setStatus('Finalize a operação atual antes de trocar para o chat nativo.');
    const toggle = document.querySelector('.ld2-native-bridge [data-ld2-routing]');
    if (toggle) {
      try { toggle.click(); } catch (_) {}
    }
    state.routingEnabled = false;
    chrome.storage.local.set({ [ROUTING_KEY]: false }).catch(() => {});
    unmount();
  }

  function bindShadow() {
    const root = state.shadow;
    if (!root) return;
    root.querySelector('[data-ldc-native]').onclick = switchToNative;
    root.querySelector('[data-ldc-clear]').onclick = () => clearHistory().catch(() => {});
    root.querySelectorAll('[data-ldc-mode]').forEach(button => button.onclick = () => {
      if (state.busy) return;
      state.mode = ['chat', 'plan', 'build'].includes(button.dataset.ldcMode) ? button.dataset.ldcMode : 'chat';
      root.querySelectorAll('[data-ldc-mode]').forEach(item => item.classList.toggle('active', item.dataset.ldcMode === state.mode));
      setStatus(state.mode === 'chat' ? 'Chat read-only · resposta contextual' : state.mode === 'plan' ? 'Planejar · ZERO WRITE' : 'Build · Shadow Build sem commit');
    });
    const input = root.querySelector('[data-ldc-input]');
    input.addEventListener('keydown', event => {
      if (event.isComposing || event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      send().catch(() => {});
    });
    input.addEventListener('input', () => {
      input.style.height = '36px';
      input.style.height = `${Math.min(150, Math.max(36, input.scrollHeight))}px`;
    });
    root.querySelector('[data-ldc-send]').onclick = () => send().catch(() => {});
    root.querySelector('[data-ldc-attach]').onclick = () => root.querySelector('[data-ldc-file]').click();
    root.querySelector('[data-ldc-file]').onchange = async event => {
      try { await addFiles([...(event.target.files || [])]); setStatus('Anexos adicionados ao próximo envio.'); }
      catch (error) { setStatus(error?.message || String(error)); }
      event.target.value = '';
    };
    const panel = root.querySelector('[data-ldc-root]');
    panel.addEventListener('dragover', event => { event.preventDefault(); panel.classList.add('ldc-drop'); });
    panel.addEventListener('dragleave', () => panel.classList.remove('ldc-drop'));
    panel.addEventListener('drop', event => {
      event.preventDefault(); panel.classList.remove('ldc-drop');
      addFiles([...(event.dataTransfer?.files || [])]).catch(error => setStatus(error?.message || String(error)));
    });
    input.addEventListener('paste', event => {
      const files = [...(event.clipboardData?.files || [])];
      if (!files.length) return;
      event.preventDefault();
      addFiles(files).catch(error => setStatus(error?.message || String(error)));
    });
  }

  async function mount(input, shell) {
    if (!state.routingEnabled || !input || !shell) return;
    const pid = projectId();
    if (!pid) { phase('DEGRADED', 'Projeto Lovable não identificado. O envio permanece bloqueado.'); return; }
    const changedProject = state.projectId && state.projectId !== pid;
    state.projectId = pid;
    state.nativeInput = input;
    const draft = nativeDraft(input).trim();
    if (draft) clearNativeDraft(input);
    lockNativeShell(shell);

    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.dataset.ld2DecrypterChat = '1';
      host.setAttribute('aria-label', 'Lovable Decrypter Chat');
      document.documentElement.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = shadowTemplate();
      state.host = host;
      state.shadow = shadow;
      bindShadow();
    } else {
      state.host = host;
      state.shadow = host.shadowRoot;
    }
    syncGeometry();
    if (changedProject || !state.history.length) await loadHistory(pid);
    if (draft) {
      const own = state.shadow?.querySelector('[data-ldc-input]');
      if (own && !own.value) own.value = draft;
    }

    const license = await runtime({ type: 'LD2_LICENSE_STATUS' }).catch(() => null);
    if (!license?.valid) phase('LOCKED', 'KEY/licença inválida. O Lovable permanece bloqueado.');
    else phase('READY', 'Transação isolada: input → Decrypter. Nenhum envio ao Lovable.');
    await refreshContext('').catch(() => {});
  }

  function unmount() {
    state.host?.remove();
    state.host = null;
    state.shadow = null;
    state.nativeInput = null;
    unlockNativeShell();
    state.phase = state.routingEnabled ? 'DEGRADED' : 'READY';
  }

  function eventFromOwnChat(event) {
    return !!state.host && event.composedPath?.().includes(state.host);
  }

  function nativeProtectedTarget(event) {
    if (!state.routingEnabled || eventFromOwnChat(event)) return false;
    const target = event.target;
    return !!(state.nativeShell?.isConnected && target && (target === state.nativeShell || state.nativeShell.contains(target)));
  }

  function failClosedKey(event) {
    if (!nativeProtectedTarget(event) || event.isComposing || event.key !== 'Enter' || event.shiftKey || event.altKey) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
  }
  function failClosedClick(event) {
    if (!nativeProtectedTarget(event)) return;
    const button = event.target?.closest?.('button');
    if (!button) return;
    const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.getAttribute('data-testid'), button.textContent].filter(Boolean).join(' ').toLowerCase();
    const input = state.nativeInput;
    const form = input?.closest('form');
    const looksSend = String(button.type || '').toLowerCase() === 'submit' || /send|submit|enviar|mandar|arrow.?up|paper.?plane|prompt/.test(label);
    if (!looksSend || /attach|upload|image|voice|mic|emoji|settings|config/.test(label)) return;
    if (form && !form.contains(button) && !label) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
  }
  function failClosedSubmit(event) {
    if (!nativeProtectedTarget(event)) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
  }

  async function reconcile() {
    if (!state.routingEnabled) { if (state.host) unmount(); return; }
    const pid = projectId();
    if (state.projectId && pid && state.projectId !== pid) {
      state.history = [];
      state.graph = null;
      state.skills = [];
      unmount();
    }
    const input = findNativeInput();
    const shell = findNativeShell(input);
    if (!input || !shell) {
      if (state.host) unmount();
      phase('DEGRADED', 'A área nativa de chat mudou ou não foi encontrada. Fail-closed ativo; nenhum prompt será enviado ao Lovable.');
      return;
    }
    if (!state.host?.isConnected || state.nativeShell !== shell) await mount(input, shell);
    else if (!syncGeometry()) {
      unmount();
      phase('DEGRADED', 'Geometria do chat nativo ficou inválida. Fail-closed ativo.');
    }
  }

  async function boot() {
    const stored = await chrome.storage.local.get(ROUTING_KEY);
    state.routingEnabled = stored[ROUTING_KEY] !== false;
    window.addEventListener('keydown', failClosedKey, true);
    window.addEventListener('click', failClosedClick, true);
    window.addEventListener('submit', failClosedSubmit, true);
    window.addEventListener('resize', () => { if (state.host) syncGeometry(); });
    window.addEventListener('scroll', () => { if (state.host) syncGeometry(); }, true);
    window.addEventListener('popstate', () => setTimeout(() => reconcile().catch(() => {}), 80));
    window.addEventListener('hashchange', () => setTimeout(() => reconcile().catch(() => {}), 80));
    window.addEventListener('ld2:project', () => setTimeout(() => reconcile().catch(() => {}), 100));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reconcile().catch(() => {}); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[ROUTING_KEY]) return;
      state.routingEnabled = changes[ROUTING_KEY].newValue !== false;
      if (!state.routingEnabled) {
        unmount();
        const toggle = document.querySelector('.ld2-native-bridge [data-ld2-routing]');
        if (toggle && /Decrypter\s+ON/i.test(String(toggle.textContent || ''))) {
          try { toggle.click(); } catch (_) {}
        }
      } else reconcile().catch(() => {});
    });
    state.watch = setInterval(() => reconcile().catch(() => {}), WATCH_MS);
    await reconcile();
  }

  window.LovableDecrypterChat = Object.freeze({
    build: 29,
    schema: 'ld-decrypter-chat/1',
    snapshot,
    mount: () => reconcile(),
    native: switchToNative,
    clearHistory,
    capabilities: Object.freeze({ ownComposer: true, shadowDom: true, attachments: true, dragDrop: true, pasteFiles: true, markdown: true, codeBlocks: true, perProjectHistory: true, stageStreaming: true, failClosed: true, nativeFallback: false, automaticApply: false })
  });

  addEventListener('beforeunload', () => { clearInterval(state.watch); unlockNativeShell(); }, { once: true });
  if (document.documentElement) boot().catch(error => phase('DEGRADED', `boot_error:${error?.message || String(error)}`));
  else addEventListener('DOMContentLoaded', () => boot().catch(error => phase('DEGRADED', `boot_error:${error?.message || String(error)}`)), { once: true });
})();
