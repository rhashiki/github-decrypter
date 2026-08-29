(() => {
  'use strict';
  if (window.__LD45_CHAT_ACTIVATION_PREMIUM__) return;
  window.__LD45_CHAT_ACTIVATION_PREMIUM__ = true;

  const CHAT_HOST_ID = 'ld2-decrypter-chat-host';
  const ROOT_ID = 'ld2-root';
  let resizeObserver = null;
  let observedHost = null;

  const LOGO_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
    <path d="M15 12h18c14 0 24 8.4 24 20S47 52 33 52H15V39h6v7h12c10 0 17-5.4 17-14S43 18 33 18H21v8h-6V12Z" fill="url(#ld45g)"/>
    <path d="M25 35.5 29 32l-4-3.5M39 28.5 35 32l4 3.5M33.8 27l-3.6 10" stroke="#DDF8FF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="51" y="24" width="4" height="4" rx=".8" fill="#3BD2FF"/><rect x="55" y="31" width="2.8" height="2.8" rx=".6" fill="#7B8DFF"/><rect x="49" y="36" width="3.2" height="3.2" rx=".7" fill="#4AC8FF"/>
    <defs><linearGradient id="ld45g" x1="14" y1="12" x2="54" y2="53" gradientUnits="userSpaceOnUse"><stop stop-color="#63EAFF"/><stop offset=".52" stop-color="#3BD2FF"/><stop offset="1" stop-color="#7B8DFF"/></linearGradient></defs>
  </svg>`;

  const SHADOW_STYLE = `
    :host{color-scheme:dark}
    .ldc[data-ld45-premium="1"]{
      --ld45-bg:#07101d;--ld45-panel:#0c1727;--ld45-panel2:#111c2e;--ld45-text:#f3f7ff;--ld45-muted:#9aa7bf;--ld45-cyan:#3bd2ff;--ld45-violet:#9b7cff;
      border:1px solid rgba(107,219,255,.28)!important;
      border-radius:24px!important;
      color:var(--ld45-text)!important;
      background:radial-gradient(circle at 10% -8%,rgba(59,210,255,.13),transparent 34%),radial-gradient(circle at 92% 6%,rgba(155,124,255,.11),transparent 31%),linear-gradient(180deg,rgba(10,20,35,.985),rgba(6,13,24,.992))!important;
      box-shadow:0 32px 90px rgba(2,6,18,.58),inset 0 1px 0 rgba(255,255,255,.045),0 0 42px rgba(59,210,255,.07)!important;
      backdrop-filter:blur(26px) saturate(135%);-webkit-backdrop-filter:blur(26px) saturate(135%);
    }
    .ldc[data-ld45-premium="1"] *{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important}
    .ldc[data-ld45-premium="1"] .ldc-head{min-height:68px!important;padding:13px 15px!important;gap:11px!important;background:linear-gradient(180deg,rgba(17,29,47,.91),rgba(10,20,34,.86))!important;border-bottom:1px solid rgba(255,255,255,.075)!important;backdrop-filter:blur(18px)!important}
    .ldc[data-ld45-premium="1"] .ldc-brand{gap:11px!important}.ldc[data-ld45-premium="1"] .ldc-logo{width:40px!important;height:40px!important;border-radius:14px!important;border:1px solid rgba(59,210,255,.24)!important;background:linear-gradient(145deg,rgba(59,210,255,.12),rgba(123,141,255,.08))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 10px 24px rgba(0,0,0,.22)!important;padding:6px!important;color:transparent!important;font-size:0!important}.ldc[data-ld45-premium="1"] .ldc-logo svg{display:block;width:100%;height:100%}
    .ldc[data-ld45-premium="1"] .ldc-brand b{font-size:15px!important;line-height:1.2!important;color:#f7fbff!important;font-weight:780!important;letter-spacing:-.01em!important}.ldc[data-ld45-premium="1"] .ldc-brand small{font-size:10.5px!important;line-height:1.3!important;color:#8194ad!important;letter-spacing:.07em!important;margin-top:3px!important}
    .ldc[data-ld45-premium="1"] .ldc-state{font-size:10px!important;padding:6px 9px!important;border-radius:999px!important;background:rgba(59,210,255,.065)!important;border-color:rgba(59,210,255,.27)!important;color:#82e7ff!important}.ldc[data-ld45-premium="1"] .ldc-native,.ldc[data-ld45-premium="1"] .ldc-clear{font-size:11.5px!important;min-height:34px!important;padding:7px 10px!important;border-radius:11px!important;color:#b9c6d8!important;border-color:rgba(255,255,255,.11)!important;background:rgba(255,255,255,.035)!important}
    .ldc[data-ld45-premium="1"] .ldc-meta{gap:7px!important;padding:9px 13px!important;background:rgba(7,15,27,.58)!important;border-bottom:1px solid rgba(255,255,255,.055)!important}.ldc[data-ld45-premium="1"] .ldc-pill{font-size:10.5px!important;line-height:1.2!important;padding:5px 8px!important;border-radius:999px!important;color:#93a4bb!important;border-color:rgba(255,255,255,.09)!important;background:rgba(255,255,255,.026)!important}.ldc[data-ld45-premium="1"] .ldc-pill.ok{color:#7ee7bc!important;border-color:rgba(67,216,142,.23)!important}.ldc[data-ld45-premium="1"] .ldc-pill.warn{color:#ffc978!important;border-color:rgba(255,158,61,.25)!important}
    .ldc[data-ld45-premium="1"] .ldc-messages{padding:22px 17px 30px!important;background:radial-gradient(circle at 82% 8%,rgba(155,124,255,.052),transparent 28%),linear-gradient(180deg,rgba(7,15,27,.68),rgba(5,11,21,.84))!important;scrollbar-color:rgba(59,210,255,.3) transparent!important}.ldc[data-ld45-premium="1"] .ldc-empty{font-size:14px!important;color:#8294ab!important}.ldc[data-ld45-premium="1"] .ldc-empty b{font-size:17px!important;color:#e5f8ff!important;margin-bottom:8px!important}
    .ldc[data-ld45-premium="1"] .ldc-msg{max-width:89%!important;margin-bottom:18px!important}.ldc[data-ld45-premium="1"] .ldc-bubble{font-size:15px!important;line-height:1.58!important;padding:13px 14px!important;border-radius:18px!important;color:#e6eef8!important;border:1px solid rgba(255,255,255,.095)!important;background:linear-gradient(145deg,rgba(20,34,52,.86),rgba(11,23,39,.9))!important;box-shadow:0 12px 32px rgba(0,0,0,.13)!important}.ldc[data-ld45-premium="1"] .ldc-msg.user .ldc-bubble{background:linear-gradient(145deg,rgba(27,89,116,.5),rgba(29,55,92,.53))!important;border-color:rgba(59,210,255,.25)!important}.ldc[data-ld45-premium="1"] .ldc-msg.system .ldc-bubble{color:#c6d1df!important;background:rgba(255,255,255,.025)!important;border-style:solid!important}.ldc[data-ld45-premium="1"] .ldc-msg-meta{font-size:10.5px!important;color:#70829a!important;margin:6px 6px 0!important}.ldc[data-ld45-premium="1"] .ldc-bubble h1,.ldc[data-ld45-premium="1"] .ldc-bubble h2,.ldc[data-ld45-premium="1"] .ldc-bubble h3{font-size:16px!important;color:#e9f9ff!important;margin:12px 0 7px!important}.ldc[data-ld45-premium="1"] .ldc-bubble li{margin:5px 0!important}
    .ldc[data-ld45-premium="1"] .ldc-inline-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace!important;font-size:.92em!important;background:rgba(59,210,255,.07)!important;border-color:rgba(59,210,255,.14)!important;color:#bfefff!important}.ldc[data-ld45-premium="1"] .ldc-code{font:12.5px/1.58 ui-monospace,SFMono-Regular,Consolas,monospace!important;background:#030914!important;border:1px solid rgba(59,210,255,.14)!important;border-radius:13px!important;color:#d3edff!important}.ldc[data-ld45-premium="1"] .ldc-code-head{font-size:10.5px!important;padding:6px 9px!important;background:#091422!important;color:#8197ad!important;border-bottom-color:rgba(255,255,255,.07)!important}.ldc[data-ld45-premium="1"] .ldc-file{font-size:11.5px!important;color:#a2b2c5!important}.ldc[data-ld45-premium="1"] .ldc-file b{color:#e0f5ff!important}.ldc[data-ld45-premium="1"] .ldc-file pre{font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace!important;background:#050d18!important;color:#b2cce0!important;border-radius:10px!important;padding:8px!important}
    .ldc[data-ld45-premium="1"] .ldc-progress{font-size:12px!important;line-height:1.45!important;padding:12px 13px 12px 42px!important;color:#a9bbcf!important;border:1px solid rgba(59,210,255,.17)!important;border-radius:14px!important;background:linear-gradient(145deg,rgba(59,210,255,.065),rgba(155,124,255,.035))!important}.ldc[data-ld45-premium="1"] .ldc-spin{border-color:rgba(59,210,255,.18)!important;border-top-color:#3bd2ff!important}
    .ldc[data-ld45-premium="1"] .ldc-compose{padding:12px 13px 11px!important;background:linear-gradient(180deg,rgba(12,22,37,.92),rgba(7,15,27,.97))!important;border-top:1px solid rgba(255,255,255,.07)!important;backdrop-filter:blur(18px)!important}.ldc[data-ld45-premium="1"] .ldc-modes{gap:4px!important;margin-bottom:9px!important}.ldc[data-ld45-premium="1"] .ldc-mode{font-size:11.5px!important;padding:7px 11px!important;border-radius:9px!important;color:#8e9db2!important;border-color:rgba(255,255,255,.09)!important}.ldc[data-ld45-premium="1"] .ldc-mode.active{color:#e8faff!important;background:linear-gradient(180deg,rgba(59,210,255,.14),rgba(59,210,255,.06))!important;border-color:rgba(59,210,255,.28)!important}.ldc[data-ld45-premium="1"] .ldc-input-wrap{gap:8px!important;padding:8px!important;border-radius:16px!important;background:rgba(2,8,17,.5)!important;border:1px solid rgba(255,255,255,.11)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important}.ldc[data-ld45-premium="1"] .ldc-input-wrap:focus-within{border-color:rgba(59,210,255,.48)!important;box-shadow:0 0 0 3px rgba(59,210,255,.07),inset 0 1px 0 rgba(255,255,255,.025)!important}.ldc[data-ld45-premium="1"] .ldc-text{min-height:42px!important;font-size:15px!important;line-height:1.5!important;color:#f3f7ff!important;padding:6px 5px!important}.ldc[data-ld45-premium="1"] .ldc-text::placeholder{color:#63748c!important}.ldc[data-ld45-premium="1"] .ldc-icon,.ldc[data-ld45-premium="1"] .ldc-send{width:36px!important;height:36px!important;border-radius:11px!important;font-size:14px!important;color:#82e7ff!important;border:1px solid rgba(59,210,255,.18)!important;background:rgba(59,210,255,.055)!important}.ldc[data-ld45-premium="1"] .ldc-send{background:linear-gradient(145deg,rgba(59,210,255,.23),rgba(123,141,255,.17))!important;border-color:rgba(59,210,255,.33)!important;box-shadow:0 8px 20px rgba(27,146,255,.08)!important}.ldc[data-ld45-premium="1"] .ldc-att{font-size:10.5px!important;padding:4px 7px!important;color:#a7b7c9!important;border-color:rgba(255,255,255,.09)!important}.ldc[data-ld45-premium="1"] .ldc-foot{font-size:10px!important;color:#718198!important;margin-top:7px!important}.ldc[data-ld45-premium="1"] .ldc-lock{font-size:12.5px!important;padding:13px 15px!important;background:rgba(255,113,136,.045)!important;color:#ff9eae!important;border-top-color:rgba(255,113,136,.15)!important}
    @media(max-width:700px){.ldc[data-ld45-premium="1"]{border-radius:0!important}.ldc[data-ld45-premium="1"] .ldc-head{min-height:62px!important;padding:10px!important}.ldc[data-ld45-premium="1"] .ldc-brand b{font-size:14px!important}.ldc[data-ld45-premium="1"] .ldc-messages{padding:16px 10px 24px!important}.ldc[data-ld45-premium="1"] .ldc-msg{max-width:97%!important}.ldc[data-ld45-premium="1"] .ldc-bubble{font-size:14.5px!important}.ldc[data-ld45-premium="1"] .ldc-text{font-size:14.5px!important}}
  `;

  function syncBridgeVisibility() {
    const host = document.getElementById(CHAT_HOST_ID);
    let active = false;
    if (host?.isConnected) {
      const rect = host.getBoundingClientRect();
      const style = getComputedStyle(host);
      active = rect.width > 100 && rect.height > 100 && style.display !== 'none' && style.visibility !== 'hidden';
    }
    document.documentElement.dataset.ld45ChatActive = active ? '1' : '0';
  }

  function observeHost(host) {
    if (!host || observedHost === host) return;
    resizeObserver?.disconnect();
    observedHost = host;
    resizeObserver = new ResizeObserver(syncBridgeVisibility);
    resizeObserver.observe(host);
  }

  function enhanceChat() {
    const host = document.getElementById(CHAT_HOST_ID);
    const shadow = host?.shadowRoot;
    const shell = shadow?.querySelector('.ldc');
    if (!host || !shadow || !shell) {
      syncBridgeVisibility();
      return false;
    }

    observeHost(host);
    shell.dataset.ld45Premium = '1';
    let style = shadow.querySelector('#ld45-chat-premium-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ld45-chat-premium-style';
      style.textContent = SHADOW_STYLE;
      shadow.appendChild(style);
    }
    const logo = shadow.querySelector('.ldc-logo');
    if (logo && logo.dataset.ld45Logo !== '1') {
      logo.dataset.ld45Logo = '1';
      logo.innerHTML = LOGO_SVG;
    }
    syncBridgeVisibility();
    return true;
  }

  function enhanceLicense() {
    const root = document.getElementById(ROOT_ID);
    const box = root?.querySelector('.ld2-license-box');
    if (!box) return false;
    box.dataset.ld45Activation = '1';
    const oldImage = box.querySelector(':scope > img');
    if (oldImage) oldImage.hidden = true;
    if (!box.querySelector('.ld45-license-mark')) {
      const mark = document.createElement('div');
      mark.className = 'ld45-license-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.innerHTML = LOGO_SVG;
      box.insertBefore(mark, box.firstChild);
    }
    return true;
  }

  function install() {
    const chatReady = enhanceChat();
    const licenseReady = enhanceLicense();
    return chatReady && licenseReady;
  }

  for (const eventName of ['ld2:decrypter-chat-state', 'ld2:dom-reconcile', 'ld3:design-system-ready', 'ld2:project']) {
    window.addEventListener(eventName, () => {
      enhanceChat();
      enhanceLicense();
    });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { enhanceChat(); enhanceLicense(); } });

  const scheduler = window.LovableDecrypterDeliveryScheduler;
  if (scheduler?.register) {
    scheduler.register('build45-chat-activation-premium', () => install(), { interval:120, maxAttempts:160, startDelay:0 });
  } else {
    let attempts = 0;
    const retry = () => {
      attempts += 1;
      if (install() || attempts >= 160) return;
      setTimeout(retry, 120);
    };
    retry();
  }

  window.LovableDecrypterChatActivationPremium = Object.freeze({ build:45, refresh(){ enhanceChat(); enhanceLicense(); } });
})();
