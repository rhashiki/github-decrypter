(() => {
  'use strict';

  if (window.__LD281_DIAGNOSTIC_UI_SHELL__) return;
  window.__LD281_DIAGNOSTIC_UI_SHELL__ = true;

  const HOST_ID = 'ld281-diagnostic-ui-host';
  const VERSION = '2.6.81';

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  function mount() {
    const root = document.documentElement;
    if (!root || document.getElementById(HOST_ID)) return;

    root.setAttribute('data-lovable-decrypter-diagnostic', `${VERSION}-ui-shell-loaded`);

    const host = el('div');
    host.id = HOST_ID;
    host.setAttribute('data-lovable-decrypter-build', '81');
    Object.assign(host.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'none'
    });

    const shadow = host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = `
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }
      .fab { pointer-events:auto; position:fixed; right:20px; bottom:20px; width:64px; height:64px; padding:0; border:1px solid rgba(57,255,132,.55); border-radius:50%; background:#07100b; box-shadow:0 0 0 1px rgba(57,255,132,.12),0 10px 36px rgba(0,0,0,.45),0 0 28px rgba(57,255,132,.2); cursor:pointer; transition:transform .65s cubic-bezier(.2,.8,.2,1),box-shadow .2s; overflow:visible; }
      .fab:hover { box-shadow:0 0 0 1px rgba(57,255,132,.2),0 14px 42px rgba(0,0,0,.55),0 0 36px rgba(57,255,132,.35); }
      .fab.open { transform:rotate(180deg); }
      .fab img { width:100%; height:100%; display:block; border-radius:50%; pointer-events:none; user-select:none; }
      .dot { position:absolute; right:0; bottom:4px; width:14px; height:14px; border-radius:50%; background:#39ff84; border:2px solid #07100b; box-shadow:0 0 9px rgba(57,255,132,.8); }
      .panel { pointer-events:auto; position:fixed; right:20px; bottom:94px; width:min(440px,calc(100vw - 20px)); height:min(720px,calc(100vh - 112px)); display:flex; flex-direction:column; background:linear-gradient(180deg,rgba(5,18,12,.96),rgba(2,8,6,.95)); color:#eef8f1; border:1px solid rgba(81,255,142,.24); border-radius:22px; box-shadow:0 22px 70px rgba(0,0,0,.48),0 0 40px rgba(57,255,132,.08); overflow:hidden; opacity:0; transform:translateY(8px) scale(.985); visibility:hidden; transition:.2s ease; font:14px/1.35 Arial,sans-serif; }
      .panel.open { opacity:1; transform:none; visibility:visible; }
      .head { min-height:69px; padding:12px 14px; display:flex; align-items:center; gap:11px; border-bottom:1px solid rgba(81,255,142,.24); background:rgba(6,16,11,.68); }
      .logo { width:43px; height:43px; border-radius:12px; overflow:hidden; flex:0 0 auto; }
      .logo img { width:100%; height:100%; object-fit:cover; }
      .brand { min-width:0; flex:1; }
      .brand b { display:block; color:#39ff84; font-size:14px; letter-spacing:.9px; }
      .brand small { display:block; color:#93a99b; font-size:11px; margin-top:3px; }
      .close { width:34px; height:34px; border:1px solid rgba(81,255,142,.24); border-radius:10px; background:rgba(255,255,255,.03); color:#eef8f1; cursor:pointer; font-size:20px; }
      .status { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:9px 12px; border-bottom:1px solid rgba(81,255,142,.24); }
      .stat { min-width:0; padding:8px 10px; border:1px solid rgba(57,255,132,.13); border-radius:11px; background:rgba(255,255,255,.025); }
      .stat small { display:block; color:#93a99b; font-size:10px; text-transform:uppercase; letter-spacing:.7px; }
      .stat b { display:block; margin-top:2px; font-size:12px; color:#eafff0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .body { min-height:0; flex:1; display:grid; grid-template-columns:106px 1fr; }
      .nav { border-right:1px solid rgba(81,255,142,.24); padding:8px 7px; overflow:auto; background:rgba(0,0,0,.16); }
      .nav button { width:100%; border:0; border-radius:10px; background:transparent; color:#93a99b; padding:9px 5px; margin:1px 0; cursor:pointer; font:11px Arial,sans-serif; }
      .nav button span { display:block; font-size:18px; color:#39ff84; line-height:20px; margin-bottom:3px; }
      .nav button:hover,.nav button.active { background:rgba(57,255,132,.08); color:#eef8f1; }
      .content { min-width:0; display:flex; flex-direction:column; }
      .messages { flex:1; min-height:0; overflow:auto; padding:12px; }
      .msg { max-width:94%; margin:0 0 10px; padding:10px 11px; border-radius:13px; border:1px solid rgba(255,255,255,.06); background:rgba(255,255,255,.04); white-space:pre-wrap; word-break:break-word; }
      .msg strong { color:#39ff84; display:block; margin-bottom:4px; }
      .msg small { color:#93a99b; display:block; margin-top:6px; font-size:10px; }
      .compose { padding:10px; border-top:1px solid rgba(81,255,142,.24); background:rgba(0,0,0,.14); }
      .compose-row { display:flex; gap:7px; align-items:center; }
      .input { flex:1; min-width:0; height:42px; border:1px solid rgba(57,255,132,.2); border-radius:12px; background:rgba(0,0,0,.28); color:#93a99b; padding:0 11px; font:13px Arial,sans-serif; }
      .send { height:42px; min-width:52px; border:1px solid rgba(57,255,132,.3); border-radius:11px; background:rgba(57,255,132,.08); color:#39ff84; font-weight:700; opacity:.55; }
      .hint { display:block; margin-top:6px; color:#93a99b; font-size:10px; }
      @media(max-width:640px){ .panel{right:7px;bottom:90px;width:calc(100vw - 14px);height:calc(100vh - 104px);border-radius:18px}.body{grid-template-columns:78px 1fr}.nav button{font-size:9px;padding:8px 2px}.nav button span{font-size:16px} }
    `;

    const iconUrl = chrome.runtime.getURL('assets/fab.png');

    const fab = el('button', 'fab');
    fab.type = 'button';
    fab.title = `Lovable Decrypter ${VERSION}`;
    fab.setAttribute('aria-label', 'Abrir Lovable Decrypter');
    fab.setAttribute('aria-expanded', 'false');
    const fabImg = el('img');
    fabImg.src = iconUrl;
    fabImg.alt = '';
    fab.append(fabImg, el('span', 'dot'));

    const panel = el('section', 'panel');
    panel.setAttribute('aria-label', 'Lovable Decrypter diagnostic UI shell');

    const head = el('header', 'head');
    const logo = el('span', 'logo');
    const logoImg = el('img');
    logoImg.src = iconUrl;
    logoImg.alt = '';
    logo.append(logoImg);
    const brand = el('span', 'brand');
    brand.append(el('b', '', 'LOVABLE DECRYPTER'), el('small', '', `DIAGNOSTIC UI SHELL · v${VERSION}`));
    const close = el('button', 'close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Fechar painel');
    head.append(logo, brand, close);

    const status = el('div', 'status');
    const stats = [
      ['Runtime', 'UI Shell'],
      ['Memória', 'Sem polling'],
      ['Composer', 'Desativado'],
      ['Backend', 'Desativado']
    ];
    for (const [label, value] of stats) {
      const card = el('div', 'stat');
      card.append(el('small', '', label), el('b', '', value));
      status.append(card);
    }

    const body = el('div', 'body');
    const nav = el('nav', 'nav');
    const content = el('main', 'content');
    const messages = el('div', 'messages');
    const message = el('div', 'msg');
    const messageTitle = el('strong', '', 'UI real reativada com segurança');
    const messageText = el('span', '', 'Este painel é local e diagnóstico. Nenhum módulo de IA, GitHub, Supabase, Composer ou atualização está ativo nesta build.');
    const messageMeta = el('small', '', 'Objetivo: validar FAB + painel + navegação sem crescimento de memória.');
    message.append(messageTitle, messageText, messageMeta);
    messages.append(message);

    const sections = [
      ['⌘','Chat IA'],['◎','Treinar'],['GH','GitHub'],['⇄','Migrations'],['⇩','ZIP'],['↺','Histórico'],['✳','Skills'],['▤','Notas'],['Ø','Marca'],['◇','Diagnóstico'],['◉','Licença'],['↻','Atualizar']
    ];
    const buttons = [];
    for (const [icon, label] of sections) {
      const button = el('button');
      button.type = 'button';
      button.dataset.label = label;
      button.append(el('span', '', icon), document.createTextNode(label));
      button.addEventListener('click', () => {
        for (const item of buttons) item.classList.remove('active');
        button.classList.add('active');
        messageTitle.textContent = label;
        messageText.textContent = `${label} ainda está isolado nesta versão diagnóstica. A navegação visual está funcionando sem ativar o runtime antigo.`;
      });
      buttons.push(button);
      nav.append(button);
    }

    const compose = el('div', 'compose');
    const composeRow = el('div', 'compose-row');
    const input = el('input', 'input');
    input.type = 'text';
    input.disabled = true;
    input.placeholder = 'Execução temporariamente isolada';
    const send = el('button', 'send', '➤');
    send.type = 'button';
    send.disabled = true;
    composeRow.append(input, send);
    compose.append(composeRow, el('small', 'hint', 'Build 81: somente UI local. Sem observers, timers, storage, rede ou service worker.'));

    content.append(messages, compose);
    body.append(nav, content);
    panel.append(head, status, body);
    shadow.append(style, fab, panel);

    const setOpen = open => {
      panel.classList.toggle('open', open);
      fab.classList.toggle('open', open);
      fab.setAttribute('aria-expanded', String(open));
    };
    fab.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
    close.addEventListener('click', () => setOpen(false));

    shadow.addEventListener('keydown', event => {
      if (event.key === 'Escape') setOpen(false);
    });

    root.appendChild(host);
  }

  if (document.documentElement) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
