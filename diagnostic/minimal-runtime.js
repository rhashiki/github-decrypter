(() => {
  'use strict';

  if (window.__LD280_DIAGNOSTIC_MINIMAL__) return;
  window.__LD280_DIAGNOSTIC_MINIMAL__ = true;

  const HOST_ID = 'ld280-diagnostic-host';

  function setStyle(node, styles) {
    for (const [name, value] of Object.entries(styles)) {
      node.style.setProperty(name, value, 'important');
    }
  }

  function mount() {
    const root = document.documentElement;
    if (!root || document.getElementById(HOST_ID)) return;

    root.setAttribute('data-lovable-decrypter-diagnostic', '2.6.80-loaded');

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-lovable-decrypter-build', '80');
    setStyle(host, {
      position: 'fixed',
      right: '24px',
      bottom: '24px',
      width: '58px',
      height: '58px',
      margin: '0',
      padding: '0',
      border: '0',
      'z-index': '2147483647',
      overflow: 'visible',
      'pointer-events': 'auto',
      display: 'block',
      visibility: 'visible',
      opacity: '1'
    });

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; }
      #fab {
        all: initial;
        position: absolute;
        right: 0;
        bottom: 0;
        width: 58px;
        height: 58px;
        border: 1px solid rgba(255,255,255,.28);
        border-radius: 999px;
        background: rgba(20,16,36,.94);
        color: #fff;
        font: 700 17px Arial, sans-serif;
        letter-spacing: -.4px;
        box-shadow: 0 14px 40px rgba(0,0,0,.38);
        cursor: pointer;
        pointer-events: auto;
        display: grid;
        place-items: center;
        z-index: 2;
      }
      #panel {
        all: initial;
        position: absolute;
        right: 0;
        bottom: 72px;
        width: 320px;
        padding: 18px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 18px;
        background: rgba(20,16,36,.97);
        color: #fff;
        box-shadow: 0 20px 60px rgba(0,0,0,.4);
        pointer-events: auto;
        font-family: Arial, sans-serif;
        z-index: 1;
      }
      #panel[hidden] { display: none !important; }
      h2 { margin: 0 0 6px; color: #fff; font: 700 18px/1.2 Arial, sans-serif; }
      p { margin: 0; color: rgba(255,255,255,.76); font: 400 13px/1.5 Arial, sans-serif; }
      .ok { display: inline-flex; margin-top: 14px; gap: 7px; align-items: center; color: #c8ffd7; font: 400 12px Arial, sans-serif; }
      .dot { width: 8px; height: 8px; border-radius: 50%; background: #55e77b; }
      .meta { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.12); color: rgba(255,255,255,.58); font: 400 11px/1.55 Arial, sans-serif; }
    `;

    const button = document.createElement('button');
    button.id = 'fab';
    button.type = 'button';
    button.textContent = 'LD';
    button.title = 'Lovable Decrypter 2.6.80';
    button.setAttribute('aria-label', 'Abrir Lovable Decrypter diagnóstico');
    button.setAttribute('aria-expanded', 'false');

    const panel = document.createElement('section');
    panel.id = 'panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Lovable Decrypter Diagnostic FAB Injection');

    const heading = document.createElement('h2');
    heading.textContent = 'Lovable Decrypter';

    const description = document.createElement('p');
    description.textContent = 'Diagnostic FAB Injection 2.6.80. Somente a injeção visual mínima está ativa.';

    const ok = document.createElement('div');
    ok.className = 'ok';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const okText = document.createElement('span');
    okText.textContent = 'Content script carregado no Lovable';
    ok.append(dot, okText);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = 'Sem service worker · sem rede · sem storage · sem polling · sem MutationObserver · sem Composer · sem módulos funcionais.';

    panel.append(heading, description, ok, meta);
    shadow.append(style, button, panel);

    button.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
    });

    root.appendChild(host);
  }

  if (document.documentElement) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  }
})();
