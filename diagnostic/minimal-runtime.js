(() => {
  'use strict';

  if (window.__LD279_DIAGNOSTIC_MINIMAL__) return;
  window.__LD279_DIAGNOSTIC_MINIMAL__ = true;

  const HOST_ID = 'ld279-diagnostic-host';

  function mount() {
    if (document.getElementById(HOST_ID)) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-lovable-decrypter-build', '79');
    host.style.position = 'fixed';
    host.style.right = '24px';
    host.style.bottom = '24px';
    host.style.zIndex = '2147483647';
    host.style.width = '0';
    host.style.height = '0';
    host.style.pointerEvents = 'none';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        *, *::before, *::after { box-sizing: border-box; }
        #fab {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 58px;
          height: 58px;
          border: 1px solid rgba(255,255,255,.24);
          border-radius: 50%;
          background: rgba(20,16,36,.88);
          color: #fff;
          font: 700 17px Arial, sans-serif;
          letter-spacing: -.4px;
          box-shadow: 0 14px 40px rgba(0,0,0,.32);
          backdrop-filter: blur(14px);
          cursor: pointer;
          pointer-events: auto;
          display: grid;
          place-items: center;
          transition: transform .18s ease, box-shadow .18s ease;
        }
        #fab:hover { transform: scale(1.04); box-shadow: 0 16px 44px rgba(0,0,0,.38); }
        #fab:active { transform: scale(.98); }
        #panel {
          position: absolute;
          right: 0;
          bottom: 72px;
          width: 320px;
          padding: 18px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 18px;
          background: rgba(20,16,36,.94);
          color: #fff;
          box-shadow: 0 20px 60px rgba(0,0,0,.38);
          backdrop-filter: blur(18px);
          pointer-events: auto;
          font-family: Arial, sans-serif;
        }
        #panel[hidden] { display: none; }
        h2 { margin: 0 0 6px; font-size: 18px; line-height: 1.2; }
        p { margin: 0; color: rgba(255,255,255,.74); font-size: 13px; line-height: 1.5; }
        .ok { display: inline-flex; margin-top: 14px; gap: 7px; align-items: center; font-size: 12px; color: #c8ffd7; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #55e77b; box-shadow: 0 0 12px rgba(85,231,123,.7); }
        .meta { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.12); font-size: 11px; color: rgba(255,255,255,.55); line-height: 1.55; }
      </style>
      <button id="fab" type="button" aria-label="Abrir Lovable Decrypter diagnóstico" title="Lovable Decrypter 2.6.79">LD</button>
      <section id="panel" hidden aria-label="Lovable Decrypter Diagnostic Minimal Runtime">
        <h2>Lovable Decrypter</h2>
        <p>Diagnostic Minimal Runtime 2.6.79. Apenas FAB e painel local estão ativos.</p>
        <div class="ok"><span class="dot"></span><span>Runtime mínimo carregado</span></div>
        <div class="meta">Sem service worker · sem rede · sem storage · sem polling · sem MutationObserver · sem Composer · sem módulos 70–76.</div>
      </section>
    `;

    const button = shadow.getElementById('fab');
    const panel = shadow.getElementById('panel');
    button.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
    });

    document.documentElement.appendChild(host);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
