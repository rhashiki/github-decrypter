(() => {
  'use strict';
  if (window.__LD47_NEXUS_PARITY__) return;
  window.__LD47_NEXUS_PARITY__ = true;

  const ROOT_ID = 'ld2-root';
  const VERSION = chrome.runtime.getManifest().version;
  const MONITOR_KEY = 'ld2_monitor_enabled';
  const COMMUNITY_URL = 'https://chat.whatsapp.com/BRBQfHORPYeFb7KJHicKYh?s=cl&p=a&mlu=4';
  const $ = (s, r = document) => r?.querySelector?.(s) || null;
  const $$ = (s, r = document) => [...(r?.querySelectorAll?.(s) || [])];

  const ICONS = Object.freeze({
    integrations:'<svg viewBox="0 0 24 24"><path d="M4 7h16M7 4v6m10-6v6M5 12h14v8H5z"/></svg>',
    project:'<svg viewBox="0 0 24 24"><path d="M3.5 6.5h6l1.7 2H20.5v10H3.5Z"/></svg>',
    intelligence:'<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0-3.8 10.6c.9.7 1.8 1.5 1.8 2.4h4c0-.9.9-1.7 1.8-2.4A6 6 0 0 0 12 3Z"/><path d="M9 19h6M10 22h4"/></svg>',
    engineering:'<svg viewBox="0 0 24 24"><path d="m14.8 4.3 4.9 4.9M13.5 5.6 4.2 14.9 3 21l6.1-1.2 9.3-9.3"/></svg>',
    recovery:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6"/></svg>',
    activity:'<svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
    account:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6"/></svg>',
    monitor:'<svg viewBox="0 0 24 24"><path d="M12 3v8M7.2 5.6a8 8 0 1 0 9.6 0"/></svg>',
    security:'<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.5 2.7 7.6 7 10 4.3-2.4 7-5.5 7-10V6l-7-3Z"/><path d="m9.5 12 1.6 1.6 3.5-3.5"/></svg>',
    update:'<svg viewBox="0 0 24 24"><path d="M20 6v5h-5M4 18v-5h5M18 9a7 7 0 0 0-12-2M6 15a7 7 0 0 0 12 2"/></svg>',
    settings:'<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M4 12h5M13 12h7"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/><circle cx="11" cy="12" r="2"/></svg>',
    community:'<svg viewBox="0 0 24 24"><path d="M8 18H5l-2 3v-6a8 8 0 1 1 3 6"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>',
    github:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-3 17.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2M15 20v-2.3c0-.8-.3-1.5-.8-1.9 2.4-.3 4.8-1.2 4.8-5.2a4 4 0 0 0-1.1-2.8 3.7 3.7 0 0 0-.1-2.8s-.8-.3-2.8 1.1a9.6 9.6 0 0 0-6 0C7 4.7 6.2 5 6.2 5a3.7 3.7 0 0 0-.1 2.8A4 4 0 0 0 5 10.6c0 4 2.4 4.9 4.8 5.2"/></svg>',
    supabase:'<svg viewBox="0 0 24 24"><path d="m13 2-8 12h7l-1 8 8-12h-7z"/></svg>',
    lovable:'<svg viewBox="0 0 24 24"><path d="M12 20.5S4 15.6 4 9.4A4.4 4.4 0 0 1 12 6.8a4.4 4.4 0 0 1 8 2.6c0 6.2-8 11.1-8 11.1Z"/></svg>',
    gemini:'<svg viewBox="0 0 24 24"><path d="M12 2c.7 5.7 4.3 9.3 10 10-5.7.7-9.3 4.3-10 10-.7-5.7-4.3-9.3-10-10 5.7-.7 9.3-4.3 10-10Z"/></svg>',
    zip:'<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 20h16"/></svg>',
    cloud:'<svg viewBox="0 0 24 24"><path d="M4 7h12m0 0-3-3m3 3-3 3M20 17H8m0 0 3-3m-3 3 3 3"/></svg>',
    brain:'<svg viewBox="0 0 24 24"><path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 2.8A3.2 3.2 0 0 0 7 14v1a3 3 0 0 0 3 3h2V6a2 2 0 0 0-3-2ZM15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 2.8A3.2 3.2 0 0 1 17 14v1a3 3 0 0 1-3 3h-2"/></svg>',
    rules:'<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12m-17-12 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/></svg>',
    skills:'<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13"/></svg>',
    explain:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 4.6 1.4c-.8 1.1-2.3 1.4-2.3 3.1M12 17h.01"/></svg>',
    impact:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/></svg>',
    chat:'<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4Z"/><path d="M8 9h8M8 12h5"/></svg>',
    editor:'<svg viewBox="0 0 24 24"><path d="m13 2-2 8h6l-8 12 2-8H5z"/></svg>',
    queue:'<svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h9m3-2 3 2-3 2"/></svg>',
    diagnostics:'<svg viewBox="0 0 24 24"><path d="M4 19h16M6 16V9M10 16V5M14 16v-4M18 16V7"/></svg>',
    history:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6M12 8v4l3 2"/></svg>',
    notes:'<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>'
  });

  const ACTION_SELECTORS = Object.freeze({
    github:['[data-cc-github]','[data-action="github"]'], supabase:['[data-cc-supabase]','[data-sbm-open]'], project:['[data-cc-new-project]'],
    zip:['[data-cc-action="zip"]','[data-action="zip"]'], cloud:['[data-cc-action="cloud-migrate"]'], brain:['[data-cc-action="train"]','[data-action="train"]'],
    rules:['[data-cc-intel="rules"]'], skills:['[data-cc-action="skills"]','[data-action="skills"]'], explain:['[data-cc-intel="explain"]'], impact:['[data-cc-intel="impact"]'],
    chat:['[data-action="chat"]'], queue:['[data-cc-batch]'], diagnosis:['[data-cc-action="diag"]','[data-action="diag"]'], history:['[data-cc-action="history"]','[data-action="history"]'],
    notes:['[data-action="notes"]'], update:['[data-cc-action="update"]','[data-action="update"]'], license:['[data-action="license"]'], settings:['[data-cc-settings]','[data-settings]']
  });

  const GROUPS = Object.freeze([
    {id:'project', icon:'project', title:'Projeto', sub:'Workspace, ZIP e sincronização', items:[
      ['workspace','project','Workspace','Contexto e visão do projeto'],['zip','zip','Baixar ZIP','Exportar projeto'],['github','github','GitHub Sync','Repositório e sincronização'],['cloud','cloud','Migrar Cloud','Cloud → Supabase'],['new-project','project','Novo projeto','Criar projeto vazio']
    ]},
    {id:'intelligence', icon:'intelligence', title:'Inteligência', sub:'Brain, regras, impacto e skills', items:[
      ['brain','brain','Project Brain','Treinar contexto do projeto'],['rules','rules','Project Rules','Regras permanentes'],['skills','skills','Skills','Capacidades personalizadas'],['explain','explain','Explain Project','Explicar arquitetura'],['impact','impact','Impact Maps','Dependências e alcance']
    ]},
    {id:'engineering', icon:'engineering', title:'Engenharia', sub:'Chat, editor, queue e diagnóstico', items:[
      ['chat','chat','Decrypter Chat','Planejar e construir'],['editor','editor','Editor direto','Focar composer protegido'],['queue','queue','Queue','Execução sequencial'],['diagnosis','diagnostics','Diagnóstico','Saúde e integrações']
    ]},
    {id:'integrations', icon:'integrations', title:'Integrações', sub:'GitHub, Supabase, Lovable e Gemini', items:[
      ['github','github','GitHub','Repositório e branch'],['supabase','supabase','Supabase','Projeto e infraestrutura'],['project','lovable','Lovable','Workspace e projeto'],['settings','gemini','Gemini','Modelo e configuração']
    ]},
    {id:'recovery', icon:'recovery', title:'Recovery', sub:'Erro, recuperação e atualização', items:[
      ['diagnosis','diagnostics','Error Intelligence','Erros, causas e recuperação'],['diagnosis','recovery','Project Recovery','Reconciliação do projeto'],['update','update','Update & Recovery','Atualização e rollback']
    ]},
    {id:'activity', icon:'activity', title:'Atividade', sub:'Histórico, notas e operações', items:[
      ['history','history','Histórico','Execuções e alterações'],['notes','notes','Anotação','Notas do projeto'],['diagnosis','activity','Operações','Estado técnico atual']
    ]}
  ]);

  let shell, panel, cascade1, cascade2, panelObserver, closeTimer = 0;
  let activeGroup = '';

  function root(){ return document.getElementById(ROOT_ID); }
  function fab(){ return $('.ld2-fab', root()); }
  function legacyPanel(){ return $('.ld2-panel', root()); }
  function gate(){ return $('[data-license-gate]', root()); }
  function licensed(){ return !!gate() && gate().hidden === true; }

  function mark(){
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="ld47g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ef3da3"/><stop offset=".52" stop-color="#8358ff"/><stop offset="1" stop-color="#4f7cff"/></linearGradient></defs><path d="M13 10h12c9 0 16 6 16 14s-7 14-16 14H13V29h5v4h7c6 0 10-3.6 10-9s-4-9-10-9h-7v4h-5z" fill="url(#ld47g)"/><path d="m21 26-3-2 3-2m7 0 3 2-3 2m-2-6-3 8" fill="none" stroke="url(#ld47g)" stroke-width="2" stroke-linecap="round"/><rect x="8" y="20" width="3" height="3" rx=".6" fill="#ef3da3"/><rect x="6" y="25" width="2.5" height="2.5" rx=".5" fill="#8358ff"/></svg>`;
  }

  function icon(name){ return ICONS[name] || ICONS.project; }

  function menuRow(group){
    return `<button class="ld47-menu-btn" type="button" data-group="${group.id}"><span class="ld47-icon">${icon(group.icon)}</span><span class="ld47-copy"><b>${group.title}</b><small>${group.sub}</small></span><span class="ld47-arrow">›</span></button>`;
  }

  function build(){
    const r = root();
    if (!r || shell) return !!shell;
    const wrap = document.createElement('div');
    wrap.className = 'ld47-shell';
    wrap.innerHTML = `
      <aside class="ld47-panel" aria-label="Lovable Decrypter">
        <header class="ld47-head"><span class="ld47-brand-logo">${mark()}</span><span class="ld47-brand"><b>Lovable Decrypter</b><span>Extensão ativa · v${VERSION}</span></span></header>
        <div class="ld47-scroll">
          <button class="ld47-monitor" type="button" data-monitor><span class="ld47-dot"></span><span class="ld47-monitor-copy"><b>Monitor</b><span>ON · Proteção ativa</span></span><span class="ld47-switch"></span></button>
          <div class="ld47-credits"><div class="ld47-credit"><small><span>Build</span><b>47</b></small><div class="ld47-bar"><i style="width:94%"></i></div></div><div class="ld47-credit"><small><span>Runtime</span><b>2.5.47</b></small><div class="ld47-bar"><i style="width:100%"></i></div></div></div>
          <div class="ld47-label">Principal</div><nav class="ld47-menu">${GROUPS.slice(0,3).map(menuRow).join('')}</nav>
          <div class="ld47-label">Sistema</div><nav class="ld47-menu">${GROUPS.slice(3).map(menuRow).join('')}</nav>
          <div class="ld47-label">Conta e suporte</div><nav class="ld47-menu">
            <button class="ld47-menu-btn" type="button" data-direct="license"><span class="ld47-icon">${icon('account')}</span><span class="ld47-copy"><b>Minha conta</b><small>Licença, plano e sessão</small></span></button>
            <button class="ld47-menu-btn" type="button" data-direct="diagnosis"><span class="ld47-icon">${icon('security')}</span><span class="ld47-copy"><b>Segurança</b><small>Diagnóstico e integridade</small></span></button>
            <button class="ld47-menu-btn" type="button" data-external="community"><span class="ld47-icon">${icon('community')}</span><span class="ld47-copy"><b>Comunidade</b><small>Canal oficial</small></span></button>
            <button class="ld47-menu-btn" type="button" data-direct="update"><span class="ld47-icon">${icon('update')}</span><span class="ld47-copy"><b>Atualizar</b><small>Update Center e recovery</small></span></button>
            <button class="ld47-menu-btn" type="button" data-direct="settings"><span class="ld47-icon">${icon('settings')}</span><span class="ld47-copy"><b>Configurações</b><small>Preferências do Decrypter</small></span></button>
          </nav>
        </div>
        <footer class="ld47-footer"><button type="button" data-minimize>Minimizar</button><button type="button" data-top>Voltar ao topo</button></footer>
      </aside>
      <section class="ld47-cascade ld47-cascade-1" data-show="0"></section>
      <section class="ld47-cascade ld47-cascade-2" data-show="0"></section>`;
    r.appendChild(wrap);
    shell = wrap; panel = $('.ld47-panel', shell); cascade1 = $('.ld47-cascade-1', shell); cascade2 = $('.ld47-cascade-2', shell);
    wire(); sync();
    return true;
  }

  function findTarget(action){
    const r = root();
    for (const selector of ACTION_SELECTORS[action] || []) { const el = $(selector, r); if (el) return el; }
    return null;
  }

  function toast(message){
    const wrap = $('.ld2-toast-wrap', root());
    if (!wrap) return;
    const el=document.createElement('div'); el.className='ld2-toast'; el.textContent=message; wrap.appendChild(el); setTimeout(()=>el.remove(),3200);
  }

  function focusEditor(){
    const targets=$$('textarea,[contenteditable="true"],[role="textbox"]',document).filter(el=>!el.closest('#ld2-root')&&!el.disabled&&!el.readOnly).filter(el=>{const r=el.getBoundingClientRect();return r.width>180&&r.height>24&&r.bottom>0&&r.top<innerHeight});
    const t=targets.sort((a,b)=>b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom)[0];
    if(t){ closeAll(); t.focus(); return true; } return false;
  }

  function trigger(action){
    if(action==='editor'){ if(!focusEditor()) toast('Composer do Lovable ainda não localizado.'); return; }
    if(action==='workspace' && window.LovableDecrypterWorkspace?.open){ closeAll(); window.LovableDecrypterWorkspace.open(); return; }
    const t=findTarget(action); if(!t){toast(`Módulo ${action} ainda inicializando.`);return;} closeAll(); t.click();
  }

  function scheduleClose(){ clearTimeout(closeTimer); closeTimer=setTimeout(()=>{ hideCascades(); },220); }
  function cancelClose(){ clearTimeout(closeTimer); }
  function hideCascades(){ activeGroup=''; cascade1.dataset.show='0'; cascade2.dataset.show='0'; cascade1.innerHTML=''; cascade2.innerHTML=''; $$('.ld47-menu-btn.active',panel).forEach(x=>x.classList.remove('active')); }
  function closeAll(){ hideCascades(); const p=legacyPanel(); if(p?.classList.contains('open')) fab()?.click(); }

  function placeCascade(el, anchor, previous){
    el.dataset.show='1';
    el.style.left='0px';el.style.top='0px';
    const ar=anchor.getBoundingClientRect(); const er=el.getBoundingClientRect(); const gap=10; const margin=10;
    let left=(previous ? previous.getBoundingClientRect().right : panel.getBoundingClientRect().right)+gap;
    if(left+er.width>innerWidth-margin) left=(previous ? previous.getBoundingClientRect().left : panel.getBoundingClientRect().left)-er.width-gap;
    let top=Math.max(margin,Math.min(innerHeight-er.height-margin,ar.top));
    Object.assign(el.style,{left:`${Math.round(left)}px`,top:`${Math.round(top)}px`});
  }

  function openGroup(group, anchor){
    cancelClose(); activeGroup=group.id; $$('.ld47-menu-btn.active',panel).forEach(x=>x.classList.remove('active')); anchor.classList.add('active');
    cascade2.dataset.show='0'; cascade2.innerHTML='';
    cascade1.innerHTML=`<div class="ld47-cascade-head"><b>${group.title}</b><span>${group.sub}</span></div><div class="ld47-cascade-list">${group.items.map(([action,ic,title,sub],i)=>`<button type="button" class="ld47-cascade-item" data-index="${i}"><span class="ld47-icon">${icon(ic)}</span><span class="ld47-copy"><b>${title}</b><small>${sub}</small></span><span class="ld47-arrow">›</span></button>`).join('')}</div>`;
    $$('.ld47-cascade-item',cascade1).forEach(btn=>{
      const item=group.items[Number(btn.dataset.index)]; const open=()=>openDetail(item,btn);
      btn.addEventListener('mouseenter',open); btn.addEventListener('focus',open); btn.addEventListener('click',e=>{e.preventDefault();open();});
    });
    placeCascade(cascade1,anchor,null);
  }

  async function meta(action){
    const rows=[];
    try{
      const s=await window.LovableDecrypterV2?.runtime?.({type:'LD2_SETTINGS_GET'});
      if(action==='github'){const g=s?.github||{};rows.push(['Estado',g.owner&&g.repo?'Configurado':'Não configurado']);if(g.owner&&g.repo)rows.push(['Repo',`${g.owner}/${g.repo}`]);}
      if(action==='supabase'||action==='cloud'){const x=s?.supabase||{};rows.push(['Estado',x.projectRef?'Configurado':'Não configurado']);if(x.projectRef)rows.push(['Projeto',x.projectRef]);}
      if(action==='settings'){rows.push(['Versão',`v${VERSION}`],['Política','Free-only']);}
    }catch(_){ }
    if(!rows.length) rows.push(['Versão',`v${VERSION}`],['Status','Disponível']);
    return rows;
  }

  async function openDetail(item,anchor){
    cancelClose(); const [action,ic,title,sub]=item; const token=`${activeGroup}:${title}`; cascade2.dataset.token=token;
    const rows=await meta(action); if(cascade2.dataset.token!==token)return;
    cascade2.innerHTML=`<div class="ld47-detail-icon">${icon(ic)}</div><div class="ld47-detail-title"><b>${title}</b><span>${sub}</span></div><div class="ld47-detail-meta">${rows.map(([k,v])=>`<div><small>${k}</small><b>${v}</b></div>`).join('')}</div><button class="ld47-primary" type="button" data-open>Abrir</button>`;
    $('[data-open]',cascade2).addEventListener('click',()=>trigger(action)); placeCascade(cascade2,anchor,cascade1);
  }

  async function monitorState(){ try{const v=await chrome.storage.local.get(MONITOR_KEY);return v[MONITOR_KEY]!==false;}catch(_){return true;} }
  function renderMonitor(on){const m=$('[data-monitor]',panel);if(!m)return;m.classList.toggle('off',!on);$('.ld47-monitor-copy span',m).textContent=on?'ON · Proteção ativa':'OFF · Proteção desativada';}
  async function toggleMonitor(){const on=!$('[data-monitor]',panel)?.classList.contains('off');try{if(window.LovableDecrypterVoice?.setMonitor)await window.LovableDecrypterVoice.setMonitor(!on,true);else{await chrome.storage.local.set({[MONITOR_KEY]:!on});window.dispatchEvent(new CustomEvent('ld2:monitor-changed',{detail:{enabled:!on}}));}renderMonitor(!on);}catch(_){toast('Não foi possível alterar o Monitor.');}}

  function position(){
    if(!panel||panel.dataset.open!=='1'||!fab())return;
    const fr=fab().getBoundingClientRect(); const pr=panel.getBoundingClientRect(); const M=10,G=10,vw=innerWidth,vh=innerHeight,pw=pr.width||292,ph=Math.min(pr.height||720,vh-M*2); const cx=fr.left+fr.width/2,cy=fr.top+fr.height/2;
    const ls=fr.left-M,rs=vw-fr.right-M,ts=fr.top-M,bs=vh-fr.bottom-M; let left,top;
    if(rs>=pw+G){left=fr.right+G;top=cy-ph/2}else if(ls>=pw+G){left=fr.left-pw-G;top=cy-ph/2}else{left=cx-pw/2;if(bs>=ph+G)top=fr.bottom+G;else if(ts>=ph+G)top=fr.top-ph-G;else top=cy-ph/2;}
    left=Math.max(M,Math.min(vw-pw-M,left));top=Math.max(M,Math.min(vh-ph-M,top));Object.assign(panel.style,{left:`${Math.round(left)}px`,top:`${Math.round(top)}px`});
  }

  function sync(){
    if(!shell||!fab())return false; const open=licensed()&&legacyPanel()?.classList.contains('open'); panel.dataset.open=open?'1':'0'; fab().dataset.ld47='1'; fab().dataset.open=open?'1':'0'; if(!open)hideCascades(); else requestAnimationFrame(position); return true;
  }

  function wire(){
    $$('.ld47-menu-btn[data-group]',panel).forEach(btn=>{const group=GROUPS.find(g=>g.id===btn.dataset.group);const open=()=>openGroup(group,btn);btn.addEventListener('mouseenter',open);btn.addEventListener('focus',open);btn.addEventListener('click',e=>{e.preventDefault();open();});});
    $$('.ld47-menu-btn[data-direct]',panel).forEach(btn=>btn.addEventListener('click',()=>trigger(btn.dataset.direct)));
    $('[data-external="community"]',panel).addEventListener('click',()=>window.open(COMMUNITY_URL,'_blank','noopener,noreferrer'));
    $('[data-monitor]',panel).addEventListener('click',toggleMonitor); $('[data-minimize]',panel).addEventListener('click',closeAll); $('[data-top]',panel).addEventListener('click',()=>$('.ld47-scroll',panel).scrollTo({top:0,behavior:'smooth'}));
    for(const el of [panel,cascade1,cascade2]){el.addEventListener('mouseenter',cancelClose);el.addEventListener('mouseleave',scheduleClose);}
    addEventListener('resize',()=>{position();hideCascades();},{passive:true}); fab()?.addEventListener('pointermove',()=>position(),{passive:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(cascade1.dataset.show==='1')hideCascades();else closeAll();}});
    monitorState().then(renderMonitor);
    const p=legacyPanel(); if(p){panelObserver=new MutationObserver(sync);panelObserver.observe(p,{attributes:true,attributeFilter:['class']});}
  }

  function install(){ if(!build())return false; sync(); return true; }
  for(const ev of ['ld3:design-system-ready','ld2:dom-reconcile','ld2:project']) window.addEventListener(ev,install);
  const scheduler=window.LovableDecrypterDeliveryScheduler;
  if(scheduler?.register)scheduler.register('build47-nexus-parity',install,{interval:120,maxAttempts:160,startDelay:0});else{let n=0;const go=()=>{n++;if(install()||n>=160)return;setTimeout(go,120)};go();}
  window.LovableDecrypterNexusParity=Object.freeze({build:47,version:VERSION,refresh:install,close:closeAll});
})();