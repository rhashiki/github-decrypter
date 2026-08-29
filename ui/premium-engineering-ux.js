(() => {
  'use strict';
  if (window.__LD38_PREMIUM_ENGINEERING_UX__) return;
  window.__LD38_PREMIUM_ENGINEERING_UX__ = true;

  const BUILD = 38;
  const ROOT_ID = 'ld2-root';
  const CHAT_HOST_ID = 'ld2-decrypter-chat-host';
  let mainObserver = null;
  let shadowObserver = null;
  let shadowTarget = null;
  let attempts = 0;

  const SHADOW_STYLE = `
    :host{color-scheme:dark}
    .ldc[data-ld38-premium="1"]{--e-bg:#07111d;--e-panel:#0b1725;--e-panel2:#0e1d2d;--e-line:rgba(117,220,255,.18);--e-line-strong:rgba(117,220,255,.38);--e-text:#edf8ff;--e-muted:#8fa9ba;--e-accent:#75dcff;--e-accent2:#9d8cff;--e-good:#58e7aa;--e-warn:#ffd27a;--e-bad:#ff7188;border-radius:22px!important;border-color:var(--e-line-strong)!important;background:radial-gradient(circle at 12% -8%,rgba(117,220,255,.12),transparent 34%),linear-gradient(180deg,rgba(8,19,32,.99),rgba(5,12,22,.995))!important;box-shadow:0 30px 90px rgba(0,0,0,.64),0 0 0 1px rgba(117,220,255,.05),0 0 42px rgba(117,220,255,.08)!important;overflow:hidden}
    .ldc[data-ld38-premium="1"] .ldc-head{min-height:62px!important;padding:11px 13px!important;background:linear-gradient(180deg,rgba(13,29,45,.98),rgba(8,19,31,.94))!important;border-bottom-color:var(--e-line)!important}
    .ldc[data-ld38-premium="1"] .ldc-logo{width:36px!important;height:36px!important;border-radius:12px!important;border-color:rgba(117,220,255,.48)!important;color:var(--e-accent)!important;background:linear-gradient(145deg,rgba(117,220,255,.12),rgba(157,140,255,.08))!important;box-shadow:0 0 24px rgba(117,220,255,.12)!important}
    .ldc[data-ld38-premium="1"] .ldc-brand b{color:var(--e-text)!important;font-size:13px!important;letter-spacing:.01em}.ldc[data-ld38-premium="1"] .ldc-brand small{color:#7597aa!important;letter-spacing:.1em!important}
    .ldc[data-ld38-premium="1"] .ldc-state{border-color:var(--e-line-strong)!important;background:rgba(117,220,255,.06)!important;color:var(--e-accent)!important;letter-spacing:.08em!important}.ldc[data-ld38-premium="1"] .ldc-state.busy{color:var(--e-warn)!important;border-color:rgba(255,210,122,.34)!important;background:rgba(255,210,122,.05)!important}.ldc[data-ld38-premium="1"] .ldc-state.locked{color:var(--e-bad)!important;border-color:rgba(255,113,136,.36)!important;background:rgba(255,113,136,.05)!important}.ldc[data-ld38-premium="1"] .ldc-state.degraded{color:#ffb77a!important;border-color:rgba(255,183,122,.35)!important}
    .ldc[data-ld38-premium="1"] .ldc-native,.ldc[data-ld38-premium="1"] .ldc-clear{border-color:rgba(143,169,186,.2)!important;background:rgba(255,255,255,.025)!important;color:#9eb8c8!important;border-radius:10px!important}.ldc[data-ld38-premium="1"] .ldc-native:hover,.ldc[data-ld38-premium="1"] .ldc-clear:hover{border-color:var(--e-line-strong)!important;color:var(--e-text)!important;background:rgba(117,220,255,.06)!important}
    .ldc[data-ld38-premium="1"] .ldc-meta{padding:8px 11px!important;gap:6px!important;background:rgba(4,12,21,.62)!important;border-bottom-color:rgba(117,220,255,.08)!important}.ldc[data-ld38-premium="1"] .ldc-pill{padding:5px 7px!important;border-radius:8px!important;background:rgba(255,255,255,.025)!important;border-color:rgba(143,169,186,.13)!important;color:#829eb0!important}.ldc[data-ld38-premium="1"] .ldc-pill.ok{color:var(--e-good)!important;border-color:rgba(88,231,170,.22)!important}.ldc[data-ld38-premium="1"] .ldc-pill.warn{color:var(--e-warn)!important;border-color:rgba(255,210,122,.24)!important}
    .ldc[data-ld38-premium="1"] .ldc-messages{padding:18px 14px 26px!important;background:radial-gradient(circle at 78% 12%,rgba(157,140,255,.045),transparent 28%),linear-gradient(180deg,rgba(5,13,23,.7),rgba(4,10,18,.82))!important;scrollbar-color:rgba(117,220,255,.3) transparent!important}
    .ldc[data-ld38-premium="1"] .ldc-empty b{color:#cfefff!important}.ldc[data-ld38-premium="1"] .ldc-empty{color:#708fa2!important}
    .ldc[data-ld38-premium="1"] .ldc-msg{max-width:91%!important;margin-bottom:16px!important}.ldc[data-ld38-premium="1"] .ldc-bubble{border-radius:16px!important;border-color:rgba(143,169,186,.13)!important;background:linear-gradient(145deg,rgba(16,31,46,.92),rgba(9,21,34,.92))!important;color:#dcecf5!important;padding:11px 12px!important;box-shadow:0 10px 26px rgba(0,0,0,.14)!important}.ldc[data-ld38-premium="1"] .ldc-msg.user .ldc-bubble{background:linear-gradient(145deg,rgba(27,72,94,.48),rgba(15,45,70,.55))!important;border-color:rgba(117,220,255,.24)!important}.ldc[data-ld38-premium="1"] .ldc-msg.system .ldc-bubble{border-style:solid!important;border-color:rgba(255,210,122,.17)!important;background:rgba(255,210,122,.035)!important;color:#b9c9d2!important}.ldc[data-ld38-premium="1"] .ldc-msg-meta{color:#617f91!important;margin-top:5px!important;letter-spacing:.04em!important}
    .ldc[data-ld38-premium="1"] .ldc-bubble h1,.ldc[data-ld38-premium="1"] .ldc-bubble h2,.ldc[data-ld38-premium="1"] .ldc-bubble h3{color:#d7f3ff!important}.ldc[data-ld38-premium="1"] .ldc-inline-code{background:rgba(117,220,255,.07)!important;border-color:rgba(117,220,255,.14)!important;color:#bdefff!important}.ldc[data-ld38-premium="1"] .ldc-code{background:#030914!important;border-color:rgba(117,220,255,.16)!important;color:#c9eaff!important;border-radius:12px!important}.ldc[data-ld38-premium="1"] .ldc-code-head{background:#08131f!important;border-bottom-color:rgba(117,220,255,.1)!important;color:#7897aa!important}
    .ldc[data-ld38-premium="1"] .ldc-files,.ldc[data-ld38-premium="1"] .ldc-steps,.ldc[data-ld38-premium="1"] .ldc-warnings{border-top-color:rgba(117,220,255,.1)!important}.ldc[data-ld38-premium="1"] .ldc-file{color:#91aebe!important}.ldc[data-ld38-premium="1"] .ldc-file b{color:#d5f1ff!important}.ldc[data-ld38-premium="1"] .ldc-file pre{background:#050d17!important;color:#a8c7d8!important;border:1px solid rgba(117,220,255,.08)!important;border-radius:9px!important}
    .ldc[data-ld38-premium="1"] .ldc-progress{position:relative!important;padding:12px 13px 12px 42px!important;border-style:solid!important;border-color:rgba(117,220,255,.2)!important;border-radius:14px!important;background:linear-gradient(145deg,rgba(117,220,255,.07),rgba(157,140,255,.035))!important;color:#a9c7d8!important;box-shadow:0 12px 28px rgba(0,0,0,.13)!important}.ldc[data-ld38-premium="1"] .ldc-progress:before{content:'PIPELINE';position:absolute;right:10px;top:8px;font:800 8px Arial,sans-serif;letter-spacing:.13em;color:rgba(117,220,255,.52)}.ldc[data-ld38-premium="1"] .ldc-spin{position:absolute!important;left:15px!important;width:14px!important;height:14px!important;border-color:rgba(117,220,255,.16)!important;border-top-color:var(--e-accent)!important}
    .ldc[data-ld38-premium="1"] .ldc-lock{padding:11px 14px!important;background:rgba(255,113,136,.05)!important;border-top-color:rgba(255,113,136,.18)!important;color:#ff9eae!important}
    .ldc[data-ld38-premium="1"] .ldc-compose{padding:10px 11px!important;background:linear-gradient(180deg,rgba(8,18,30,.97),rgba(6,14,24,.99))!important;border-top-color:rgba(117,220,255,.14)!important}.ldc[data-ld38-premium="1"] .ldc-modes{display:inline-flex!important;padding:3px!important;border:1px solid rgba(117,220,255,.13)!important;border-radius:11px!important;background:rgba(2,8,15,.45)!important}.ldc[data-ld38-premium="1"] .ldc-mode{border:0!important;border-radius:8px!important;color:#7894a5!important;background:transparent!important;padding:6px 10px!important}.ldc[data-ld38-premium="1"] .ldc-mode.active{color:#d8f5ff!important;background:linear-gradient(145deg,rgba(117,220,255,.13),rgba(157,140,255,.1))!important;box-shadow:inset 0 0 0 1px rgba(117,220,255,.16)!important}.ldc[data-ld38-premium="1"] .ldc-input-wrap{border-color:rgba(117,220,255,.18)!important;border-radius:14px!important;background:rgba(2,8,15,.55)!important;padding:7px!important;box-shadow:inset 0 1px rgba(255,255,255,.02)!important}.ldc[data-ld38-premium="1"] .ldc-input-wrap:focus-within{border-color:rgba(117,220,255,.46)!important;box-shadow:0 0 0 3px rgba(117,220,255,.06)!important}.ldc[data-ld38-premium="1"] .ldc-text{color:var(--e-text)!important}.ldc[data-ld38-premium="1"] .ldc-text::placeholder{color:#506d7f!important}.ldc[data-ld38-premium="1"] .ldc-icon,.ldc[data-ld38-premium="1"] .ldc-send{border-color:rgba(117,220,255,.18)!important;background:rgba(117,220,255,.055)!important;color:var(--e-accent)!important;border-radius:10px!important}.ldc[data-ld38-premium="1"] .ldc-send{background:linear-gradient(145deg,rgba(117,220,255,.2),rgba(157,140,255,.14))!important;border-color:rgba(117,220,255,.32)!important}.ldc[data-ld38-premium="1"] .ldc-foot{color:#5d7889!important}.ldc[data-ld38-premium="1"] button:focus-visible,.ldc[data-ld38-premium="1"] textarea:focus-visible{outline:2px solid rgba(117,220,255,.68)!important;outline-offset:2px!important}
    @media(max-width:700px){.ldc[data-ld38-premium="1"]{border-radius:0!important}.ldc[data-ld38-premium="1"] .ldc-head{min-height:56px!important}.ldc[data-ld38-premium="1"] .ldc-msg{max-width:97%!important}.ldc[data-ld38-premium="1"] .ldc-state{font-size:8px!important}}
  `;

  function root() { return document.getElementById(ROOT_ID); }
  function chatHost() { return document.getElementById(CHAT_HOST_ID); }

  function ensureEngineeringBar() {
    const r = root();
    const chat = r?.querySelector('.ld2-chat');
    const messages = chat?.querySelector('[data-messages]');
    if (!r || !chat || !messages) return false;
    r.dataset.ld38Engineering = '1';
    let bar = chat.querySelector('[data-ld38-engineering-bar]');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'ld38-engineering-bar';
      bar.dataset.ld38EngineeringBar = '1';
      bar.innerHTML = `
        <div class="ld38-engineering-state"><i></i><span><small>ENGINEERING PIPELINE</small><b data-ld38-pipeline-state>Pronto</b></span></div>
        <div class="ld38-engineering-chips" aria-label="Garantias da execução">
          <span data-ld38-mode>BUILD</span><span>APPROVAL GATE</span><span>FAIL-CLOSED</span>
        </div>`;
      chat.insertBefore(bar, messages);
    }
    updateMainState();
    return true;
  }

  function currentMode() {
    const active = root()?.querySelector('.ld2-mode-switch [data-mode].active');
    return String(active?.dataset?.mode || 'build').toUpperCase();
  }

  function updateMainState() {
    const r = root();
    const bar = r?.querySelector('[data-ld38-engineering-bar]');
    if (!bar) return;
    const mode = bar.querySelector('[data-ld38-mode]');
    if (mode) mode.textContent = currentMode();
    const progress = [...(r.querySelectorAll('.ld2-task-progress') || [])].at(-1);
    const sendBusy = !!r.querySelector('[data-send].loading');
    let phase = 'ready';
    let label = 'Pronto';
    if (progress?.classList.contains('error')) {
      phase = 'error';
      label = 'Execução interrompida';
    } else if (sendBusy || (progress && !progress.querySelector('.ld2-task-step:last-child.done'))) {
      phase = 'busy';
      label = progress?.querySelector('[data-progress-title]')?.textContent || 'Executando';
    } else if (progress?.querySelector('.ld2-task-step:last-child.done')) {
      phase = 'done';
      label = 'Concluído';
    }
    bar.dataset.phase = phase;
    const state = bar.querySelector('[data-ld38-pipeline-state]');
    if (state) state.textContent = label;
  }

  function decorateMainNode(scope) {
    if (!(scope instanceof Element) && scope !== document) return;
    const nodes = [];
    if (scope instanceof Element && scope.matches('.ld2-task-progress,.ld2-plan-result,.ld2-build-result,.ld2-msg.error')) nodes.push(scope);
    if (scope.querySelectorAll) nodes.push(...scope.querySelectorAll('.ld2-task-progress,.ld2-plan-result,.ld2-build-result,.ld2-msg.error'));
    for (const node of nodes) {
      if (node.matches('.ld2-task-progress')) {
        node.dataset.ld38Kind = 'progress';
        node.setAttribute('role', 'status');
        node.setAttribute('aria-live', 'polite');
      } else if (node.matches('.ld2-plan-result')) {
        node.dataset.ld38Kind = 'plan';
        if (!node.querySelector('.ld38-plan-kicker')) {
          const kicker = document.createElement('div');
          kicker.className = 'ld38-plan-kicker';
          kicker.textContent = 'REVIEW GATE';
          node.prepend(kicker);
        }
      } else if (node.matches('.ld2-build-result')) {
        node.dataset.ld38Kind = 'result';
        node.setAttribute('role', 'status');
      } else if (node.matches('.ld2-msg.error')) {
        node.setAttribute('role', 'alert');
      }
    }
    updateMainState();
  }

  function installMainObserver() {
    if (mainObserver) return true;
    const r = root();
    const messages = r?.querySelector('[data-messages]');
    if (!r || !messages) return false;
    ensureEngineeringBar();
    decorateMainNode(messages);
    mainObserver = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof Element) decorateMainNode(node);
        if (record.type === 'attributes' && record.target instanceof Element) decorateMainNode(record.target);
      }
      updateMainState();
    });
    mainObserver.observe(messages, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    r.addEventListener('click', event => {
      if (event.target?.closest?.('[data-mode]')) setTimeout(updateMainState, 0);
      if (event.target?.closest?.('[data-send],[data-approve-plan]')) setTimeout(updateMainState, 0);
    }, true);
    return true;
  }

  function decorateShadow() {
    const host = chatHost();
    const shadow = host?.shadowRoot;
    const shell = shadow?.querySelector('.ldc');
    if (!shadow || !shell) return false;
    shell.dataset.ld38Premium = '1';
    let style = shadow.getElementById?.('ld38-premium-engineering-style') || shadow.querySelector('#ld38-premium-engineering-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ld38-premium-engineering-style';
      style.textContent = SHADOW_STYLE;
      shadow.appendChild(style);
    }
    const messages = shadow.querySelector('[data-ldc-messages]');
    messages?.querySelectorAll('.ldc-progress').forEach(node => {
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
    });
    if (messages && shadowTarget !== messages) {
      shadowObserver?.disconnect();
      shadowTarget = messages;
      shadowObserver = new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches('.ldc-progress')) {
            node.setAttribute('role', 'status');
            node.setAttribute('aria-live', 'polite');
          }
        }
      });
      shadowObserver.observe(messages, { childList: true, subtree: true });
    }
    return true;
  }

  function onChatState(event) {
    const shell = chatHost()?.shadowRoot?.querySelector('.ldc');
    if (!shell) return;
    shell.dataset.ld38Phase = String(event?.detail?.phase || 'UNKNOWN').toLowerCase();
  }

  function install() {
    const mainReady = installMainObserver();
    const shadowReady = decorateShadow();
    return mainReady || shadowReady;
  }

  window.addEventListener('ld2:decrypter-chat-state', onChatState);
  window.addEventListener('ld3:design-system-ready', () => setTimeout(install, 0));
  window.addEventListener('ld2:project', () => setTimeout(() => { ensureEngineeringBar(); decorateShadow(); }, 80));

  const timer = setInterval(() => {
    attempts += 1;
    install();
    if (attempts >= 160) clearInterval(timer);
  }, 250);

  window.LovableDecrypterPremiumEngineering = Object.freeze({
    build: BUILD,
    refresh() { ensureEngineeringBar(); decorateShadow(); updateMainState(); },
    get mainReady() { return !!mainObserver; },
    get shadowReady() { return !!shadowTarget; }
  });
})();
