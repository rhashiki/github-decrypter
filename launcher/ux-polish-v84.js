(() => {
  'use strict';
  if (window.__LD84_UX_POLISH__) return;
  window.__LD84_UX_POLISH__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';

  function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84UxPolishBound) return true;
    Object.defineProperty(shadow, '__ld84UxPolishBound', { value: true, configurable: false });

    const style = document.createElement('style');
    style.id = 'ld84-ux-polish-style';
    style.textContent = `
      /* User-facing surfaces: remove implementation/build diagnostics. */
      #detail .foot,
      #detail .state,
      #detail > .label,
      #detail > .row,
      #ld84-module-modal .ld84-note{display:none!important}

      /* Compact launcher geometry. */
      #fab{
        right:22px!important;
        bottom:22px!important;
        width:58px!important;
        height:58px!important;
        box-shadow:0 18px 44px rgba(7,8,20,.40),inset 0 1px 0 rgba(255,255,255,.06),0 0 28px rgba(59,210,255,.07)!important;
      }
      #fab:hover{box-shadow:0 20px 48px rgba(7,8,20,.44),inset 0 1px 0 rgba(255,255,255,.08),0 0 32px rgba(59,210,255,.11)!important}
      #fab > svg{width:30px!important;height:30px!important}
      #fab .badge{right:5px!important;bottom:5px!important;width:10px!important;height:10px!important;border-width:2px!important}

      #railMask{
        right:25px!important;
        bottom:94px!important;
        width:52px!important;
        height:min(66vh,548px)!important;
        min-height:0!important;
      }
      #rail{
        padding:10px 7px!important;
        border-radius:20px!important;
      }
      .rail-logo{
        width:36px!important;
        height:36px!important;
        flex:0 0 36px!important;
        border-radius:14px!important;
      }
      .rail-logo > svg{width:22px!important;height:22px!important}
      #railButtons{
        margin-top:9px!important;
        justify-content:center!important;
        gap:4px!important;
      }
      .rail-btn{
        width:34px!important;
        height:34px!important;
        flex:0 0 34px!important;
        border-radius:13px!important;
      }
      .rail-btn > svg{width:18px!important;height:18px!important}
      .rail-btn:hover{transform:scale(1.08)!important}
      .rail-btn.active::after{left:-7px!important;width:5px!important;height:5px!important}
      .separator{width:22px!important;margin:1px 0!important}
      .tip{transform:translate(-10px,-50%)!important;padding:7px 9px!important;border-radius:9px!important}
      .rail-btn:hover .tip{transform:translate(-12px,-50%)!important}

      /* Detail panel is now an action surface, not a diagnostics card. */
      #detail{width:286px!important;padding:14px!important}
      #detail .detail-head{padding-bottom:10px!important}
      #detail .actions{margin-top:10px!important;gap:2px!important}

      @media(max-width:820px){
        #fab{right:16px!important;bottom:16px!important;width:54px!important;height:54px!important}
        #railMask{right:17px!important;bottom:82px!important;width:52px!important;height:min(70vh,520px)!important}
      }
    `;
    shadow.appendChild(style);

    shadow.addEventListener('click', event => {
      const button = event.target?.closest?.('.rail-btn');
      if (!button) return;

      const rail = shadow.getElementById('rail');
      const flyout = shadow.getElementById('flyout');
      const detail = shadow.getElementById('detail');
      const panelVisible = flyout?.classList.contains('show') || detail?.classList.contains('show');

      if (!rail?.classList.contains('open') || !button.classList.contains('active') || !panelVisible) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      flyout?.classList.remove('show');
      detail?.classList.remove('show');
      for (const node of shadow.querySelectorAll('.rail-btn.active,.fly-item.active')) node.classList.remove('active');
    }, true);

    return true;
  }

  const bound = bind();
  if (!bound && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); }, { once: true });
  }
})();