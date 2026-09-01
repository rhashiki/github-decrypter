(() => {
  'use strict';

  if (window.__LD_CANONICAL_LAUNCHER_V82__) return;
  window.__LD_CANONICAL_LAUNCHER_V82__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const NS = 'http://www.w3.org/2000/svg';
  const VERSION = '2.6.82';

  const ICONS = Object.freeze({
    bolt: ['M13 3 6 13h5l-1 8 7-10h-5l1-8Z'],
    grid: ['M4 4h7v7H4z','M13 4h7v7h-7z','M4 13h7v7H4z','M13 13h7v7h-7z'],
    folder: ['M4 19V7.8c0-.9.7-1.6 1.6-1.6h4l1.8 2h7c.9 0 1.6.7 1.6 1.6V19c0 .9-.7 1.6-1.6 1.6H5.6C4.7 20.6 4 19.9 4 19Z'],
    sparkle: ['M12 3 14.7 8.3 20 11l-5.3 2.7L12 19l-2.7-5.3L4 11l5.3-2.7L12 3Z'],
    wrench: ['M20 7.5a4.5 4.5 0 0 1-6.2 4.2L8.3 18.2A2 2 0 0 1 5.5 15.4l6.5-6.5A4.5 4.5 0 1 1 20 7.5Z'],
    activity: ['M4 12h3l2-5 4 10 2-5h5','M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z'],
    shield: ['M12 3 19 6v5c0 4.3-2.7 7.7-7 10-4.3-2.3-7-5.7-7-10V6l7-3Z'],
    refresh: ['M20 11a8 8 0 1 0-2.3 5.7','M20 5v6h-6'],
    account: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z','M4 21a8 8 0 0 1 16 0'],
    community: ['M4 5h16v11H9l-5 4V5Z','M8 9h8','M8 12h5'],
    settings: ['M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z','M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4.8l-.3 3a8 8 0 0 0-1.8 1L5.1 6 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5.1 18l2.4-1a8 8 0 0 0 1.8 1l.3 3h4.8l.3-3a8 8 0 0 0 1.8-1l2.4 1 2.1-3.5-2.1-1.5c.1-.3.1-.7.1-1Z'],
    github: ['M9 18.4c-4 .9-4-2-5.6-2.4M14.6 20v-2.3c0-.7.1-1.1-.3-1.5 2.5-.3 5.1-1.2 5.1-5.5 0-1.2-.4-2.2-1.1-3 .1-.3.5-1.5-.1-3.1 0 0-.9-.3-3.1 1.1a10.6 10.6 0 0 0-6.2 0C6.7 4.3 5.8 4.6 5.8 4.6c-.6 1.6-.2 2.8-.1 3.1-.7.8-1.1 1.8-1.1 3 0 4.2 2.5 5.2 5 5.5-.3.3-.5.8-.5 1.5V20'],
    database: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z','M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6','M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'],
    lovable: ['M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z','M8 9h8','M8 13h8','M8 17h5'],
    gemini: ['M12 3 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z'],
    repo: ['M5 4h14v16H5z','M8 8h8','M8 12h8','M8 16h5'],
    branch: ['M7 5v9a4 4 0 0 0 4 4h6','M7 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z','M17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z','M17 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z','M17 8v4a3 3 0 0 1-3 3h-3'],
    code: ['m8 9-3 3 3 3','m16 9 3 3-3 3','m14 5-4 14'],
    search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z','m16 16 5 5'],
    history: ['M4 12a8 8 0 1 0 2.3-5.7L4 8','M4 4v4h4','M12 8v5l3 2'],
    lock: ['M7 10V7a5 5 0 0 1 10 0v3','M5 10h14v11H5z'],
    info: ['M12 8h.01','M11 12h1v5h1','M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z']
  });

  const CATEGORIES = Object.freeze({
    integrations: { title: 'Integrações', icon: 'grid', items: [
      ['github','GitHub','github'], ['supabase','Supabase','database'], ['lovable','Lovable','lovable'], ['gemini','Gemini','gemini']
    ]},
    project: { title: 'Projeto', icon: 'folder', items: [
      ['project-state','Estado do projeto','repo'], ['git-history','Git history','branch'], ['context-pack','Context Pack','search']
    ]},
    intelligence: { title: 'Inteligência', icon: 'sparkle', items: [
      ['local-agent','Agente local','sparkle'], ['scope-intelligence','Scope Intelligence','shield'], ['continuity','Continuity Engine','history']
    ]},
    engineering: { title: 'Engenharia', icon: 'bolt', items: [
      ['tool-runtime','Tool Runtime','code'], ['mcp-runtime','MCP Runtime','grid'], ['agent-sandbox','Agent Sandbox','shield']
    ]},
    recovery: { title: 'Recovery', icon: 'wrench', items: [
      ['smart-undo','Smart Undo / Redo','history'], ['checkpoint','Checkpoints','refresh']
    ]},
    activity: { title: 'Atividade', icon: 'activity', items: [
      ['runtime-events','Eventos do runtime','activity'], ['operations','Operações','history']
    ]}
  });

  const DIRECT = Object.freeze({
    security: ['Segurança','shield'],
    updates: ['Update Center','refresh'],
    account: ['Conta & Licença','account'],
    community: ['Comunidade Decrypter','community'],
    settings: ['Configurações','settings']
  });

  const RAIL = Object.freeze([
    ['category','integrations','grid','Integrações'],
    ['category','project','folder','Projeto'],
    ['category','intelligence','sparkle','Inteligência'],
    ['category','engineering','bolt','Engenharia'],
    ['category','recovery','wrench','Recovery'],
    ['category','activity','activity','Atividade'],
    ['separator'],
    ['direct','security','shield','Segurança'],
    ['direct','updates','refresh','Update Center'],
    ['direct','account','account','Conta & Licença'],
    ['direct','community','community','Comunidade Decrypter'],
    ['direct','settings','settings','Configurações']
  ]);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function icon(name, size = 21) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ICONS[name] || ICONS.info) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.75');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    }
    return svg;
  }

  function boltMark(size = 42) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M39 8 18 32h12l-5 24 21-24H34l5-24Z');
    p.setAttribute('stroke', '#43D0FF');
    p.setAttribute('stroke-width', '4');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    return svg;
  }

  const CSS = `
    :host{all:initial;--cyan:#3bd2ff;--green:#43d88e;--text:#f3f7ff;--muted:#9aa7bf;font-family:Arial,sans-serif}
    *,*::before,*::after{box-sizing:border-box}
    button{font-family:Arial,sans-serif}
    #stage{position:fixed;inset:0;z-index:2147483647;pointer-events:none;color:var(--text);font-family:Arial,sans-serif}
    #fab{pointer-events:auto;position:fixed;right:24px;bottom:24px;width:76px;height:76px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:radial-gradient(circle at 30% 25%,rgba(72,112,180,.42),transparent 40%),linear-gradient(160deg,#1b2850,#111a30 70%);box-shadow:0 25px 60px rgba(7,8,20,.45),inset 0 1px 0 rgba(255,255,255,.06),0 0 40px rgba(59,210,255,.08);display:grid;place-items:center;cursor:pointer;transition:transform .62s cubic-bezier(.2,.9,.18,1),box-shadow .25s ease;color:#43d0ff}
    #fab:hover{box-shadow:0 28px 65px rgba(7,8,20,.5),inset 0 1px 0 rgba(255,255,255,.08),0 0 48px rgba(59,210,255,.13)}
    #fab.open{transform:rotate(190deg) scale(.97)}
    .badge{position:absolute;right:7px;bottom:8px;width:13px;height:13px;border-radius:50%;background:var(--green);border:3px solid #171d30;box-shadow:0 0 15px rgba(67,216,142,.8)}
    #railMask{pointer-events:none;position:fixed;right:28px;bottom:116px;width:68px;height:min(72vh,720px);min-height:470px;overflow:hidden;filter:drop-shadow(0 26px 38px rgba(6,9,20,.34))}
    #railMask.open{pointer-events:auto}
    #rail{position:absolute;inset:0;padding:15px 9px 12px;display:flex;flex-direction:column;align-items:center;border:1px solid rgba(255,255,255,.07);border-radius:26px;background:linear-gradient(180deg,rgba(13,23,41,.985),rgba(8,15,29,.99));box-shadow:inset 0 1px 0 rgba(255,255,255,.035);transform:translateY(calc(100% + 60px));transition:transform .82s cubic-bezier(.18,.98,.18,1)}
    #rail.open{transform:translateY(0)}
    .rail-logo{width:44px;height:44px;flex:0 0 44px;border-radius:18px;display:grid;place-items:center;border:1px solid rgba(59,210,255,.2);background:radial-gradient(circle at 30% 30%,rgba(59,210,255,.08),transparent 55%),#111b2f;color:#43d0ff}
    #railButtons{width:100%;flex:1;margin-top:14px;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;min-height:0}
    .rail-btn{position:relative;width:44px;height:44px;flex:0 0 44px;border:0;border-radius:17px;background:transparent;color:#9baccc;display:grid;place-items:center;cursor:pointer;transition:transform .23s cubic-bezier(.2,.95,.2,1),background .18s ease,color .18s ease,box-shadow .18s ease}
    .rail-btn:hover,.rail-btn.active{background:linear-gradient(180deg,rgba(59,210,255,.18),rgba(59,210,255,.07));color:#fff;box-shadow:inset 0 0 0 1px rgba(59,210,255,.25),0 0 22px rgba(59,210,255,.18)}
    .rail-btn:hover{transform:scale(1.16)}
    .rail-btn.active::after{content:'';position:absolute;left:-10px;width:6px;height:6px;border-radius:50%;background:var(--cyan);box-shadow:0 0 12px rgba(59,210,255,.8)}
    .separator{width:28px;height:1px;flex:0 0 auto;background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent)}
    .tip{position:absolute;right:100%;top:50%;transform:translate(-14px,-50%);padding:9px 11px;border-radius:11px;background:#45516c;box-shadow:0 14px 30px rgba(9,13,25,.24);color:#fff;font-size:11px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .14s ease,transform .14s ease}
    .rail-btn:hover .tip{opacity:1;transform:translate(-16px,-50%)}
    #flyout,#detail{pointer-events:none;position:fixed;visibility:hidden;overflow-y:auto;overscroll-behavior:contain;border:1px solid rgba(255,255,255,.08);border-radius:22px;box-shadow:0 26px 70px rgba(6,9,20,.42);opacity:0;transform:translateX(8px) scale(.985);transition:opacity .16s ease,transform .18s cubic-bezier(.2,.9,.2,1);scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.14) transparent}
    #flyout.show,#detail.show{pointer-events:auto;visibility:visible;opacity:1;transform:none}
    #flyout{width:294px;padding:14px 12px;background:linear-gradient(180deg,rgba(15,26,44,.985),rgba(11,19,34,.99))}
    #detail{width:332px;padding:16px;background:linear-gradient(180deg,rgba(24,29,42,.99),rgba(21,24,36,.99));box-shadow:0 35px 90px rgba(6,9,20,.55)}
    .fly-title{display:flex;align-items:center;gap:10px;padding:5px 8px 10px;color:var(--cyan);font-size:14px;font-weight:800}
    .fly-list{display:grid;gap:3px}
    .fly-item{width:100%;min-height:42px;border:0;border-radius:14px;background:transparent;color:#f1f5ff;display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:8px 10px;text-align:left;cursor:pointer;transition:background .15s ease,transform .15s ease}
    .fly-item:hover,.fly-item.active{background:linear-gradient(180deg,rgba(59,210,255,.19),rgba(59,210,255,.08));box-shadow:inset 0 0 0 1px rgba(59,210,255,.25)}
    .fly-item:hover{transform:translateX(-2px)}
    .fly-item b{font-size:12px}.chev{color:#c8d3ea;font-size:16px}
    .detail-head{display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.06)}
    .detail-head b{font-size:15px}.state{margin-left:auto;padding:6px 9px;border-radius:999px;background:rgba(59,210,255,.09);color:#82ddff;font-size:10px;font-weight:800}
    .label{margin:15px 0 7px;color:#9297a4;font-size:10px}.row{min-height:44px;border:1px solid rgba(255,255,255,.06);border-radius:14px;display:grid;grid-template-columns:24px 1fr auto;gap:10px;align-items:center;padding:8px 10px;background:rgba(255,255,255,.015)}
    .row b{font-size:12px}.row small{color:var(--cyan);font-size:9px;font-weight:800}.actions{display:grid;gap:3px;margin-top:12px}.action{min-height:38px;border:0;border-radius:10px;background:transparent;color:#d9deea;display:flex;align-items:center;gap:10px;padding:7px 8px;cursor:pointer;text-align:left}.action:hover{background:rgba(255,255,255,.04)}.action span{font-size:11px}
    .foot{margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06);color:#78869f;font-size:10px;line-height:1.45}.foot strong{color:#99dcf3;font-weight:700}
    @media(max-width:820px){#detail{display:none}#flyout{width:min(286px,calc(100vw - 128px))}#fab{right:18px;bottom:18px}#railMask{right:22px;bottom:108px}}
  `;

  function mount() {
    if (!document.documentElement || document.getElementById(HOST_ID)) return;

    const host = el('div');
    host.id = HOST_ID;
    host.setAttribute('data-ld-ui-authority', 'canonical-v11');
    host.setAttribute('data-ld-version', VERSION);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = CSS;
    const stage = el('div'); stage.id = 'stage';

    const fab = el('button'); fab.id = 'fab'; fab.type = 'button'; fab.title = `Lovable Decrypter ${VERSION}`; fab.setAttribute('aria-label','Abrir Lovable Decrypter'); fab.setAttribute('aria-expanded','false');
    fab.appendChild(boltMark()); fab.appendChild(el('i','badge'));

    const railMask = el('div'); railMask.id = 'railMask';
    const rail = el('aside'); rail.id = 'rail'; rail.setAttribute('aria-label','Lovable Decrypter Launcher');
    const logo = el('div','rail-logo'); logo.appendChild(boltMark(27));
    const railButtons = el('div'); railButtons.id = 'railButtons';
    rail.append(logo, railButtons); railMask.appendChild(rail);

    const flyout = el('section'); flyout.id = 'flyout'; flyout.setAttribute('aria-label','Categoria');
    const detail = el('section'); detail.id = 'detail'; detail.setAttribute('aria-label','Detalhes');

    stage.append(fab, railMask, flyout, detail);
    shadow.append(style, stage);
    document.documentElement.appendChild(host);

    let activeRail = null;
    let activeFly = null;

    function clearActive() {
      if (activeRail) activeRail.classList.remove('active');
      if (activeFly) activeFly.classList.remove('active');
      activeRail = null; activeFly = null;
    }

    function hidePanels() {
      flyout.classList.remove('show');
      detail.classList.remove('show');
      clearActive();
    }

    function placeLeft(panel, anchor, offset = 14) {
      panel.style.height = 'auto';
      panel.style.maxHeight = 'none';
      panel.style.overflowY = 'hidden';
      panel.style.visibility = 'hidden';
      panel.style.display = 'block';
      const anchorRect = anchor.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const maxH = Math.max(240, Math.floor(railRect.height));
      const natural = panel.scrollHeight || maxH;
      const h = Math.min(natural, maxH);
      const left = Math.max(8, Math.round(anchorRect.left - panel.offsetWidth - offset));
      let top = Math.round(anchorRect.top);
      if (top + h > innerHeight - 8) top = Math.max(8, innerHeight - h - 8);
      top = Math.max(8, top);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.height = `${h}px`;
      panel.style.maxHeight = `${h}px`;
      panel.style.overflowY = natural > h ? 'auto' : 'hidden';
      panel.style.display = '';
      panel.style.visibility = '';
      panel.classList.add('show');
    }

    function renderDetail(id, title, iconName, anchor, fromRail = false) {
      while (detail.firstChild) detail.firstChild.remove();
      const head = el('div','detail-head'); head.append(icon(iconName,23), el('b','',title), el('span','state','UI CANÔNICA'));
      detail.appendChild(head);

      const makeRow = (label, value, rowIcon, tail) => {
        detail.appendChild(el('div','label',label));
        const row = el('div','row'); row.append(icon(rowIcon,17), el('b','',value), el('small','',tail)); detail.appendChild(row);
      };
      makeRow('Estado', 'Shell visual isolado', 'shield', 'SAFE');
      makeRow('Autoridade', 'launcher/launcher-runtime.js', 'code', 'ÚNICA');
      makeRow('Execução', 'Módulos funcionais desativados nesta build', 'lock', 'OFF');

      const actions = el('div','actions');
      for (const [label, actionIcon] of [['Abrir módulo','bolt'],['Ver estado','activity'],['Detalhes','info']]) {
        const button = el('button','action'); button.type='button'; button.append(icon(actionIcon,18), el('span','',label));
        button.addEventListener('click', () => {
          const foot = detail.querySelector('.foot');
          if (foot) foot.textContent = `${title} · ${label}: integração funcional permanece desativada no Build 82.`;
        });
        actions.appendChild(button);
      }
      detail.appendChild(actions);
      const foot = el('div','foot');
      const strong = el('strong','',`Build ${VERSION}`);
      foot.append(strong, document.createTextNode(' · UI v11 canônica · sem UI legada · sem backend, storage, polling ou observers.'));
      detail.appendChild(foot);

      if (fromRail) placeLeft(detail, anchor, 16);
      else {
        detail.classList.add('show');
        detail.style.height = 'auto'; detail.style.maxHeight='none'; detail.style.overflowY='hidden';
        const flyRect = flyout.getBoundingClientRect();
        const railRect = rail.getBoundingClientRect();
        const h = Math.min(detail.scrollHeight, Math.max(240, railRect.height));
        detail.style.left = `${Math.max(8, Math.round(flyRect.left - detail.offsetWidth - 16))}px`;
        detail.style.top = `${Math.max(8, Math.min(Math.round(anchor.getBoundingClientRect().top), innerHeight - h - 8))}px`;
        detail.style.height = `${h}px`; detail.style.maxHeight=`${h}px`; detail.style.overflowY = detail.scrollHeight > h ? 'auto' : 'hidden';
      }
      detail.dataset.module = id;
    }

    function renderCategory(id, anchor) {
      const data = CATEGORIES[id];
      if (!data) return;
      while (flyout.firstChild) flyout.firstChild.remove();
      const title = el('div','fly-title'); title.append(icon(data.icon,18), el('span','',data.title));
      const list = el('div','fly-list');
      flyout.append(title,list);
      for (const [itemId,label,iconName] of data.items) {
        const item = el('button','fly-item'); item.type='button'; item.dataset.item=itemId;
        item.append(icon(iconName,19), el('b','',label), el('span','chev','‹'));
        const activate = () => {
          if (activeFly) activeFly.classList.remove('active');
          activeFly = item; item.classList.add('active');
          renderDetail(itemId,label,iconName,item,false);
        };
        item.addEventListener('mouseenter', activate);
        item.addEventListener('click', activate);
        list.appendChild(item);
      }
      detail.classList.remove('show');
      placeLeft(flyout, anchor, 16);
    }

    for (const entry of RAIL) {
      if (entry[0] === 'separator') { railButtons.appendChild(el('div','separator')); continue; }
      const [kind,id,iconName,label] = entry;
      const button = el('button','rail-btn'); button.type='button'; button.dataset.kind=kind; button.dataset.id=id;
      button.append(icon(iconName,21), el('span','tip',label));
      const activate = () => {
        if (activeRail) activeRail.classList.remove('active');
        activeRail = button; button.classList.add('active');
        if (kind === 'category') renderCategory(id,button);
        else {
          flyout.classList.remove('show');
          const [directTitle,directIcon] = DIRECT[id] || [label,iconName];
          renderDetail(id,directTitle,directIcon,button,true);
        }
      };
      button.addEventListener('mouseenter', activate);
      button.addEventListener('click', activate);
      railButtons.appendChild(button);
    }

    fab.addEventListener('click', () => {
      const opening = !rail.classList.contains('open');
      railMask.classList.toggle('open', opening);
      rail.classList.toggle('open', opening);
      fab.classList.toggle('open', opening);
      fab.setAttribute('aria-expanded', String(opening));
      if (!opening) hidePanels();
    });
  }

  if (document.documentElement) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
