(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_V2_UI__) return;
  window.__LOVABLE_DECRYPTER_V2_UI__ = true;

  const VERSION = '2.1.1';
  const POS_KEY = 'ld2_fab_pos';
  const MODE_KEY = 'ld2_chat_mode';
  const STORE_URL = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1/ld-store';
  const iconUrl = chrome.runtime.getURL('assets/fab.png');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const api = () => window.LovableDecrypterV2;
  const state = { busy: false, settings: null, projectId: '', repoStatus: null, lastPlan: null, root: null, progress: new Map(), cacheStatus: null, mode: 'build', attachments: [], license: null };

  function runtime(message) { return api().runtime(message); }
  function time() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function projectId() { return api()?.getProjectId?.() || state.projectId || ''; }

  function mountWhenReady() {
    if (!document.documentElement) return setTimeout(mountWhenReady, 20);
    mount();
  }

  async function mount() {
    const root = document.createElement('div');
    root.id = 'ld2-root';
    root.innerHTML = `
      <button class="ld2-fab" type="button" aria-label="Lovable Decrypter"><img src="${iconUrl}" alt=""><span class="ld2-fab-status"></span></button>
      <section class="ld2-panel" aria-label="Lovable Decrypter panel">
        <div class="ld2-license-gate" data-license-gate hidden><div class="ld2-license-box"><img src="${iconUrl}" alt=""><h2>Lovable Decrypter</h2><p>Entre com uma KEY emitida pelo proprietário.</p><input class="ld2-input" type="password" data-license-input placeholder="LD2.…" autocomplete="off"><button class="ld2-btn primary" type="button" data-license-login>Entrar</button><small data-license-status>A KEY é validada por assinatura digital.</small></div></div>
        <header class="ld2-head"><span class="ld2-logo"><img src="${iconUrl}" alt=""></span><span class="ld2-brand"><b>LOVABLE DECRYPTER</b><small>GITHUB AGENT · v${VERSION}</small></span><button class="ld2-icon-btn" data-settings title="Configurações">⚙</button><button class="ld2-close" data-close>×</button></header>
        <div class="ld2-status"><div class="ld2-stat"><small>Repositório</small><b data-repo>Não configurado</b></div><div class="ld2-stat"><small>Branch</small><b data-branch>—</b></div><div class="ld2-stat"><small>Gemini</small><b data-ai>Não configurado</b></div><div class="ld2-stat"><small>Projeto Lovable</small><b data-project>Detectando…</b></div><div class="ld2-stat"><small>Licença</small><b data-entitlement>—</b></div></div>
        <div class="ld2-body">
          <nav class="ld2-nav">
            <button data-action="chat"><span>⌘</span>Chat IA</button>
            <button data-action="train"><span>◎</span>Treinar</button>
            <button data-action="github"><span>GH</span>GitHub</button>
            <button data-action="migrate"><span>⇄</span>Migrations</button>
            <button data-action="zip"><span>⇩</span>ZIP</button>
            <button data-action="history"><span>↺</span>Histórico</button>
            <button data-action="skills"><span>✳</span>Skills</button>
            <button data-action="notes"><span>▤</span>Notas</button>
            <button data-action="watermark"><span>Ø</span>Marca</button>
            <button data-action="diag"><span>◇</span>Diagnóstico</button>
            <button data-action="license"><span>◉</span>Licença</button>
            <button data-action="update" class="ld2-update-nav"><span>↻</span>Atualizar</button>
          </nav>
          <main class="ld2-chat">
            <div class="ld2-messages" data-messages></div>
            <div class="ld2-compose ld2-wa-compose">
              <div class="ld2-wa-mode-row">
                <div class="ld2-mode-switch" aria-label="Modo do agente"><button type="button" data-mode="plan">Planejar</button><button type="button" class="active" data-mode="build">Construir</button></div>
              </div>
              <div class="ld2-attachments" data-attachments></div>
              <div class="ld2-wa-composer">
                <button class="ld2-wa-attach" type="button" data-attach title="Anexar" aria-label="Anexar arquivos">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 6.5 9.4 13.6a3 3 0 1 0 4.2 4.2l7.1-7.1a5 5 0 0 0-7.1-7.1L6.1 11.1a7 7 0 0 0 9.9 9.9l5.3-5.3"/></svg>
                </button>
                <textarea class="ld2-textarea ld2-wa-input" data-command rows="1" placeholder="Mensagem"></textarea>
                <button class="ld2-send ld2-wa-send" data-send type="button" aria-label="Enviar" title="Enviar">
                  <span class="ld2-send-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l1.8 6.5L15 12l-9.8 1.9-1.8 6.5Z"/></svg></span><span class="ld2-send-spinner"></span>
                </button>
              </div>
              <input type="file" data-file-input multiple hidden accept="image/*,audio/*,video/*,.pdf,.txt,.md,.json,.csv,.tsv,.rtf,.doc,.docx,.xls,.xlsx,.ods,.ppt,.pptx,.html,.css,.js,.jsx,.ts,.tsx,.xml,.sql">
              <small class="ld2-compose-hint" data-compose-hint>Construir aplica patches mínimos na branch atual; o preview real atualiza pelo GitSync do Lovable.</small>
            </div>
          </main>
        </div>
      </section>
      <div class="ld2-modal"><div class="ld2-card"></div></div>
      <div class="ld2-toast-wrap"></div>`;
    document.documentElement.appendChild(root);
    state.root = root;
    chrome.runtime.onMessage.addListener(msg => { if (msg?.type === 'LD2_PROGRESS') updateProgress(root, msg); });

    bind(root);
    await loadFabPos(root);
    const licensed = await ensureLicense(root);
    const savedMode = (await chrome.storage.local.get(MODE_KEY))[MODE_KEY];
    setMode(root, savedMode === 'plan' ? 'plan' : 'build', false);
    addMessage(root, 'system', 'v2.0 ativa. Nenhuma requisição do chat do Lovable é interceptada. Configure Gemini + GitHub e envie um comando.');
    if (licensed) await refresh(root);
    window.addEventListener('ld2:project', e => { state.projectId = e.detail?.projectId || ''; refreshHeader(root); });
  }

  function bind(root) {
    const fab = $('.ld2-fab', root), panel = $('.ld2-panel', root);
    let drag = null;
    const toggle = force => {
      const open = force ?? !panel.classList.contains('open');
      panel.classList.toggle('open', open); fab.dataset.open = open ? '1' : '0'; positionPanel(root);
    };
    fab.addEventListener('pointerdown', e => { drag = { id:e.pointerId, sx:e.clientX, sy:e.clientY, left:fab.offsetLeft, top:fab.offsetTop, moved:false }; fab.setPointerCapture(e.pointerId); fab.classList.add('dragging'); });
    fab.addEventListener('pointermove', e => { if(!drag) return; const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;if(Math.hypot(dx,dy)>4)drag.moved=true;fab.style.left=Math.max(6,Math.min(innerWidth-fab.offsetWidth-6,drag.left+dx))+'px';fab.style.top=Math.max(6,Math.min(innerHeight-fab.offsetHeight-6,drag.top+dy))+'px';fab.style.right='auto';fab.style.bottom='auto';positionPanel(root); });
    fab.addEventListener('pointerup', async e => { if(!drag)return;const moved=drag.moved;drag=null;fab.classList.remove('dragging');await saveFabPos(fab);if(!moved)toggle(); });
    $('[data-close]', root).onclick = () => toggle(false);
    $('[data-settings]', root).onclick = () => modalSettings(root);
    $('[data-license-login]', root).onclick = () => licenseLogin(root);
    $('[data-license-input]', root).addEventListener('keydown', e => { if (e.key === 'Enter') licenseLogin(root); });
    $('[data-send]', root).onclick = () => sendCommand(root);
    $$('[data-mode]', root).forEach(b => b.onclick = () => setMode(root, b.dataset.mode));
    $('[data-attach]', root).onclick = () => $('[data-file-input]', root).click();
    $('[data-file-input]', root).addEventListener('change', async e => { await addAttachments(root, [...(e.target.files || [])]); e.target.value = ''; });
    $('[data-command]', root).addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCommand(root);} });
    $('[data-command]', root).addEventListener('input', e => autoResizeComposer(e.currentTarget));
    $$('.ld2-nav button', root).forEach(b => b.onclick = () => handleAction(root, b.dataset.action));
    $('.ld2-modal', root).addEventListener('click', e => { if(e.target.classList.contains('ld2-modal')) closeModal(root); });
    addEventListener('resize', () => positionPanel(root));
    addEventListener('keydown', e => {
      if(e.key==='Escape') {
        if($('.ld2-modal',root).classList.contains('open')) { e.preventDefault(); closeModal(root); }
        else if(panel.classList.contains('open')) toggle(false);
      }
      if(e.ctrlKey && e.key==='/'){e.preventDefault();toggle();}
    });
  }

  function positionPanel(root) {
    const fab=$('.ld2-fab',root),panel=$('.ld2-panel',root);if(!fab||!panel)return;
    const fr=fab.getBoundingClientRect(),gap=10,margin=7,pw=Math.min(440,innerWidth-20),ph=Math.min(720,innerHeight-28);
    let left=fr.left-pw-gap;if(left<margin)left=Math.min(innerWidth-pw-margin,fr.right+gap);left=Math.max(margin,left);
    let top=Math.min(innerHeight-ph-margin,Math.max(margin,fr.bottom-ph));
    panel.style.left=left+'px';panel.style.top=top+'px';panel.style.width=pw+'px';panel.style.height=ph+'px';
  }
  async function saveFabPos(fab){await chrome.storage.local.set({[POS_KEY]:{left:fab.offsetLeft,top:fab.offsetTop}})}
  async function loadFabPos(root){const r=await chrome.storage.local.get(POS_KEY);const p=r[POS_KEY];const f=$('.ld2-fab',root);if(p){f.style.left=Math.max(6,Math.min(innerWidth-70,p.left))+'px';f.style.top=Math.max(6,Math.min(innerHeight-70,p.top))+'px';f.style.right='auto';f.style.bottom='auto';}}

  async function refresh(root) {
    try { state.settings = await runtime({type:'LD2_SETTINGS_GET'}); } catch(e) { toast(root,e.message,true); }
    state.projectId = projectId();
    await refreshHeader(root);
    if(state.settings?.github?.owner && state.settings?.github?.repo) { scanRepo(root, false); warmRepoCache(root, false); }
  }

  function activeGithub() {
    const s=state.settings||{},p=projectId(),m=p&&s.projectMappings?.[p];
    return {...(s.github||{}),...(m||{})};
  }

  async function refreshHeader(root) {
    const g=activeGithub(), gem=state.settings?.gemini||{};
    $('[data-repo]',root).textContent=g.owner&&g.repo?`${g.owner}/${g.repo}`:'Não configurado';
    $('[data-branch]',root).textContent=g.branch||'main';
    $('[data-ai]',root).textContent=gem.apiKey?(gem.model||'Configurado'):'Não configurado';
    $('[data-project]',root).textContent=projectId()||'Não identificado';
    const ent=state.license?.entitlement||null, entEl=$('[data-entitlement]',root);
    if(entEl){
      if(!state.license?.valid) entEl.textContent='Desconectado';
      else if(ent?.source==='time') entEl.textContent=ent.expires_at?`Até ${new Date(ent.expires_at).toLocaleDateString('pt-BR')}`:'Plano ativo';
      else if(ent?.source==='credits') entEl.textContent=`${Number(ent.credits||0).toLocaleString('pt-BR')} créditos`;
      else entEl.textContent='Sem acesso';
    }
    const fab=$('.ld2-fab',root);fab.classList.toggle('ready',!!(gem.apiKey&&g.owner&&g.repo));fab.classList.toggle('busy',state.busy);
  }

  function setMode(root, mode, persist = true) {
    state.mode = mode === 'plan' ? 'plan' : 'build';
    $$('[data-mode]', root).forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
    const send = $('[data-send]', root), hint = $('[data-compose-hint]', root);
    if (send) {
      const label = state.mode === 'plan' ? 'Enviar para Planejar' : 'Enviar para Construir';
      send.setAttribute('aria-label', label); send.title = label;
    }
    if (hint) hint.textContent = state.mode === 'plan'
      ? 'Planejar gera um plano para revisão. Nada é alterado até você aprovar.'
      : 'Construir aplica patches mínimos na branch atual e deixa o GitSync atualizar o preview real.';
    if (persist) chrome.storage.local.set({ [MODE_KEY]: state.mode });
  }

  function setBusy(root,busy){state.busy=busy;const send=$('[data-send]',root);send.disabled=busy;send.classList.toggle('loading',busy);refreshHeader(root)}
  function autoResizeComposer(input){if(!input)return;input.style.height='auto';input.style.height=Math.min(120,Math.max(42,input.scrollHeight))+'px'}
  function scrollChatBottom(root, focus=false){const box=$('[data-messages]',root);if(box)requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;if(focus)$('[data-command]',root)?.focus()})}
  function addMessage(root,type,text,meta=''){const el=document.createElement('div');el.className=`ld2-msg ${type}`;el.textContent=text;if(meta){const sm=document.createElement('small');sm.textContent=meta;el.appendChild(sm)}const box=$('[data-messages]',root);box.appendChild(el);scrollChatBottom(root);return el}

  function formatBytes(bytes){const n=Number(bytes||0);if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`}
  function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error(`Não foi possível ler ${file.name}.`));r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.readAsDataURL(file)})}
  function renderAttachments(root){const box=$('[data-attachments]',root);if(!box)return;box.innerHTML=state.attachments.map((a,i)=>`<div class="ld2-attachment-chip"><span>📎</span><b title="${esc(a.name)}">${esc(a.name)}</b><small>${esc(formatBytes(a.size))}</small><button type="button" data-remove-attachment="${i}" aria-label="Remover ${esc(a.name)}">×</button></div>`).join('');box.classList.toggle('has-items',state.attachments.length>0);$$('[data-remove-attachment]',box).forEach(b=>b.onclick=()=>{state.attachments.splice(+b.dataset.removeAttachment,1);renderAttachments(root)})}
  async function addAttachments(root, files){
    const MAX_FILES=8,MAX_ONE=15*1024*1024,MAX_TOTAL=40*1024*1024;
    if(!files.length)return;
    if(state.attachments.length+files.length>MAX_FILES){toast(root,`Máximo de ${MAX_FILES} anexos por comando.`,true);return}
    let total=state.attachments.reduce((n,a)=>n+a.size,0);
    for(const file of files){
      if(file.size>MAX_ONE){toast(root,`${file.name}: limite de 15 MB por arquivo.`,true);continue}
      if(total+file.size>MAX_TOTAL){toast(root,'Limite total de 40 MB de anexos por comando.',true);break}
      try{const data=await fileToBase64(file);state.attachments.push({name:file.name,mimeType:file.type||mimeFromName(file.name),size:file.size,data});total+=file.size}catch(e){toast(root,e.message||String(e),true)}
    }
    renderAttachments(root);
  }
  function mimeFromName(name=''){const ext=String(name).toLowerCase().split('.').pop();const map={pdf:'application/pdf',txt:'text/plain',md:'text/plain',csv:'text/csv',tsv:'text/csv',json:'application/json',rtf:'text/rtf',html:'text/html',css:'text/css',js:'text/javascript',jsx:'text/javascript',ts:'text/plain',tsx:'text/plain',xml:'text/xml',sql:'text/plain',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ods:'application/vnd.oasis.opendocument.spreadsheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};return map[ext]||'application/octet-stream'}

  const BUILD_PROGRESS_STAGES=[['prompt','Lendo prompt'],['cache','Sincronizando projeto'],['context','Analisando arquivos'],['ai','Editando'],['diff','Validando alterações'],['commit','Aplicando alterações'],['sync','Sincronizando preview'],['done','Concluído']];
  const PLAN_PROGRESS_STAGES=[['prompt','Lendo prompt'],['cache','Sincronizando projeto'],['context','Analisando arquivos'],['ai','Planejando'],['done','Concluído']];
  function addProgressMessage(root,requestId,mode){
    const stages=mode==='plan'?PLAN_PROGRESS_STAGES:BUILD_PROGRESS_STAGES;
    const el=document.createElement('div');el.className='ld2-msg system ld2-task-progress';el.dataset.progressId=requestId;
    el.innerHTML=`<div class="ld2-task-head"><b data-progress-title>Lendo prompt</b><span data-progress-timer>0.0s</span></div><div class="ld2-task-steps">${stages.map(([id,label])=>`<div class="ld2-task-step" data-stage="${id}"><i></i><span>${label}</span><small></small></div>`).join('')}</div><div class="ld2-task-detail" data-progress-detail>Interpretando solicitação…</div>`;
    const box=$('[data-messages]',root);box.appendChild(el);scrollChatBottom(root);
    const started=performance.now();const timer=setInterval(()=>{const t=$('[data-progress-timer]',el);if(t)t.textContent=`${((performance.now()-started)/1000).toFixed(1)}s`},100);
    state.progress.set(requestId,{el,timer,started,finished:false,stages});return el;
  }
  function updateProgress(root,msg){
    const item=state.progress.get(msg.requestId);if(!item)return;const el=item.el,stages=item.stages||BUILD_PROGRESS_STAGES;
    const idx=stages.findIndex(([id])=>id===msg.stage);
    stages.forEach(([id],i)=>{const row=$(`[data-stage="${id}"]`,el);if(!row)return;row.classList.toggle('done',i<idx||(i===idx&&msg.status==='done'));row.classList.toggle('active',i===idx&&msg.status!=='done');});
    const title=$('[data-progress-title]',el),detail=$('[data-progress-detail]',el),row=$(`[data-stage="${msg.stage}"]`,el);
    if(title&&msg.label)title.textContent=msg.label;if(detail)detail.textContent=msg.detail||'';if(row&&msg.detail)$('small',row).textContent=msg.detail;
    if(msg.stage==='done'||msg.status==='error'){clearInterval(item.timer);item.finished=true;const t=$('[data-progress-timer]',el);if(t&&Number.isFinite(msg.elapsedMs))t.textContent=`${(msg.elapsedMs/1000).toFixed(1)}s`;el.classList.toggle('error',msg.status==='error');}
    scrollChatBottom(root);
  }
  function failProgress(requestId,message){const item=state.progress.get(requestId);if(!item)return;clearInterval(item.timer);item.el.classList.add('error');$('[data-progress-title]',item.el).textContent='Falha';$('[data-progress-detail]',item.el).textContent=message||'Operação interrompida.';item.finished=true;}
  function toast(root,text,error=false){const el=document.createElement('div');el.className='ld2-toast'+(error?' error':'');el.textContent=text;$('.ld2-toast-wrap',root).appendChild(el);setTimeout(()=>el.remove(),4200)}
  function safe(fn,root){return async(...args)=>{try{return await fn(...args)}catch(e){toast(root,e.message||String(e),true)}}}

  function setPlanDecision(el, label, tone='neutral') {
    if (!el) return;
    el.dataset.decision = tone;
    const actions = $('.ld2-plan-actions', el);
    if (actions) actions.innerHTML = `<span class="ld2-plan-decision ${esc(tone)}">${esc(label)}</span>`;
  }

  function planReviewBody(bundle) {
    const p=bundle.plan||{};
    return `<div class="ld2-plan-review">
      <div class="ld2-plan-review-summary"><b>${esc(p.summary||'Plano gerado')}</b><span>${(p.plan||[]).length} etapa(s)</span></div>
      <ol>${(p.plan||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
      ${(p.files||[]).length?`<div class="ld2-section">Arquivos previstos</div><div class="ld2-list">${p.files.map(f=>`<div class="ld2-list-item"><b>${esc(f.path)}</b><div>${esc(f.reason||'')}</div></div>`).join('')}</div>`:''}
      ${(p.warnings||[]).length?`<div class="ld2-plan-warning">⚠ ${esc(p.warnings.join(' · '))}</div>`:''}
    </div>`;
  }

  function reviewPlan(root,bundle){
    openModal(root,'Revisar Plano','Confira o plano completo antes de decidir','▤',planReviewBody(bundle));
  }

  async function approvePlan(root,bundle,attachments,el){
    if(state.busy)return;
    closeModal(root); setPlanDecision(el,'Plano aprovado · executando','approved');
    const requestId=crypto.randomUUID(); setBusy(root,true); addProgressMessage(root,requestId,'build');
    try{
      const out=await runtime({type:'LD2_PLAN_APPROVE',command:bundle.command,approvedPlan:bundle.plan,attachments,projectId:projectId(),requestId});
      state.lastPlan=out.bundle; addBuildResult(root,out.bundle,out.result); state.attachments=[]; renderAttachments(root); await scanRepo(root,false);
    }catch(e){failProgress(requestId,e.message||String(e));addMessage(root,'error',e.message||String(e));toast(root,e.message||String(e),true);setPlanDecision(el,'Falha ao executar plano','rejected')}
    finally{setBusy(root,false)}
  }

  function rejectPlan(root,bundle,attachments,el){
    openModal(root,'Rejeitar plano','Nenhuma alteração será aplicada','×',`
      <div class="ld2-confirm-copy"><b>Deseja rejeitar este plano?</b><p>Você pode recusá-lo e voltar ao chat, ou explicar o que deve mudar para gerar outra proposta.</p></div>
      <div class="ld2-actions ld2-plan-confirm-actions">
        <button class="ld2-btn danger" data-reject-return>Rejeitar e retornar ao chat</button>
        <button class="ld2-btn primary" data-suggest-plan>Sugerir outro plano</button>
      </div>`,c=>{
        $('[data-reject-return]',c).onclick=()=>{setPlanDecision(el,'Plano rejeitado','rejected');state.attachments=[];renderAttachments(root);closeModal(root);scrollChatBottom(root,true)};
        $('[data-suggest-plan]',c).onclick=()=>suggestAnotherPlan(root,bundle,attachments,el);
      });
  }

  function suggestAnotherPlan(root,bundle,attachments,el){
    openModal(root,'Sugerir outro plano','Diga somente o que precisa mudar na proposta','↻',`
      <div class="ld2-form"><label>O que deve ser diferente?<textarea class="ld2-textarea" data-plan-feedback placeholder="Ex.: mantenha o componente atual e altere apenas a cor do título."></textarea></label></div>
      <div class="ld2-actions"><button class="ld2-btn" data-feedback-back>Voltar</button><button class="ld2-btn primary" data-feedback-send>Gerar novo plano</button></div>`,c=>{
        $('[data-feedback-back]',c).onclick=()=>rejectPlan(root,bundle,attachments,el);
        $('[data-feedback-send]',c).onclick=async()=>{const feedback=$('[data-plan-feedback]',c).value.trim();if(!feedback){toast(root,'Descreva o que deve mudar no plano.',true);return}closeModal(root);setPlanDecision(el,'Plano rejeitado · nova proposta solicitada','rejected');await requestAlternativePlan(root,bundle,attachments,feedback)};
      });
  }

  async function requestAlternativePlan(root,bundle,attachments,feedback){
    if(state.busy)return;
    addMessage(root,'user',feedback,`Sugestão para novo plano · ${time()}`);
    const command=`${bundle.command}\n\nAJUSTE SOLICITADO PARA O NOVO PLANO:\n${feedback}`;
    const requestId=crypto.randomUUID();setBusy(root,true);addProgressMessage(root,requestId,'plan');
    try{const next=await runtime({type:'LD2_PLAN_ONLY',command,attachments,projectId:projectId(),requestId});next.displayCommand=bundle.command;state.lastPlan=next;addPlanningResult(root,next,attachments)}
    catch(e){failProgress(requestId,e.message||String(e));addMessage(root,'error',e.message||String(e));toast(root,e.message||String(e),true)}finally{setBusy(root,false)}
  }

  function addPlanningResult(root,bundle,attachments=[]){
    const p=bundle.plan||{};const el=document.createElement('div');el.className='ld2-msg system ld2-plan-result ld2-wa-assistant-bubble';
    el.innerHTML=`<div class="ld2-plan-card-title"><b>Plano pronto</b><small>${esc(p.summary||'Revise a proposta antes de executar.')}</small></div><div class="ld2-plan-actions"><button class="ld2-plan-btn review" type="button" data-review-plan>Revisar Plano</button><button class="ld2-plan-btn approve" type="button" data-approve-plan>Aprovar</button><button class="ld2-plan-btn reject" type="button" data-reject-plan>Rejeitar</button><button class="ld2-plan-btn skip" type="button" data-skip-plan>Pular</button></div>`;
    $('[data-review-plan]',el).onclick=()=>reviewPlan(root,bundle);
    $('[data-approve-plan]',el).onclick=()=>approvePlan(root,bundle,attachments,el);
    $('[data-reject-plan]',el).onclick=()=>rejectPlan(root,bundle,attachments,el);
    $('[data-skip-plan]',el).onclick=()=>{setPlanDecision(el,'Plano pulado','skipped');state.attachments=[];renderAttachments(root);scrollChatBottom(root,true)};
    $('[data-messages]',root).appendChild(el);scrollChatBottom(root);
  }
  function addBuildResult(root,bundle,result){
    const el=document.createElement('div');el.className='ld2-msg system ld2-build-result';
    el.innerHTML=`<b>Alterações aplicadas</b><div>${esc(bundle.plan?.summary||'Comando concluído.')}</div><small>${esc(result.branch)} · commit ${esc(String(result.commitSha||'').slice(0,8))} · preview real via GitSync</small><div class="ld2-msg-actions"><button class="ld2-inline-action static" type="button" data-review-code>VER ALTERAÇÕES</button></div>`;
    $('[data-review-code]',el).onclick=()=>openPreview(root,bundle,true);
    $('[data-messages]',root).appendChild(el);scrollChatBottom(root);
  }

  async function sendCommand(root, preset='') {
    if(state.busy)return;
    const input=$('[data-command]',root),command=(preset||input.value).trim();if(!command)return;
    const mode=state.mode,attachments=state.attachments.map(a=>({...a}));
    if(!preset){input.value='';input.style.height='42px';}
    addMessage(root,'user',command,`${mode==='plan'?'Planejar':'Construir'}${attachments.length?` · ${attachments.length} anexo(s)`:''} · ${time()}`);
    const requestId=crypto.randomUUID();setBusy(root,true);addProgressMessage(root,requestId,mode);
    try{
      if(mode==='plan'){
        const bundle=await runtime({type:'LD2_PLAN_ONLY',command,attachments,projectId:projectId(),requestId});state.lastPlan=bundle;addPlanningResult(root,bundle,attachments);
      }else{
        const out=await runtime({type:'LD2_BUILD_EXECUTE',command,attachments,projectId:projectId(),requestId});state.lastPlan=out.bundle;addBuildResult(root,out.bundle,out.result);state.attachments=[];renderAttachments(root);await scanRepo(root,false);
      }
    }catch(e){failProgress(requestId,e.message||String(e));addMessage(root,'error',e.message||String(e));toast(root,e.message||String(e),true)}finally{setBusy(root,false)}
  }

  function openModal(root,title,sub,icon,body,onReady){
    const m=$('.ld2-modal',root),c=$('.ld2-card',root);
    c.className='ld2-card';
    c.innerHTML=`<header class="ld2-modal-head"><span>${icon}</span><div><b>${esc(title)}</b><small>${esc(sub)}</small></div><button class="ld2-close" data-modal-close>×</button></header><div class="ld2-modal-body">${body}</div>`;
    m.classList.add('open');
    $('[data-modal-close]',c).onclick=()=>closeModal(root);
    onReady?.(c);
    return c;
  }
  function closeModal(root){
    $('.ld2-modal',root).classList.remove('open');
    const c=$('.ld2-card',root); if(c) c.className='ld2-card';
    scrollChatBottom(root,true);
  }

  function openPreview(root,bundle,applied=false){
    const p=bundle.plan||{},files=p.files||[];
    const body=`<div class="ld2-preview-shell">
      <details class="ld2-plan-summary ld2-preview-summary"><summary><b>${esc(p.summary||'Alterações')}</b><span>${files.length} arquivo(s)</span></summary><ol class="ld2-plan-list">${(p.plan||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>${(p.warnings||[]).length?`<p class="ld2-help" style="color:#ffd166">⚠ ${esc(p.warnings.join(' · '))}</p>`:''}</details>
      <div class="ld2-file-tabs ld2-preview-files">${files.map((f,i)=>`<button class="ld2-file-tab ${i===0?'active':''}" data-file="${i}">${esc(f.path)} <span class="ld2-badge">${esc(f.action)}</span></button>`).join('')}</div>
      <div class="ld2-preview-toolbar"><div class="ld2-toggle-group"><span>Comparar código</span><div><button data-compare="before">Antes</button><button data-compare="after">Depois</button><button class="active" data-compare="split">Lado a lado</button></div></div></div>
      <div class="ld2-preview-meta" data-preview-meta></div><div class="ld2-preview-workspace" data-preview-workspace></div>
      <footer class="ld2-preview-footer"><div class="ld2-preview-disclaimer">${applied?'Este diff já foi commitado. O preview visual correto é o próprio preview do Lovable.':'Revisão do código proposto. O preview visual correto é o próprio preview do Lovable.'}</div><div class="ld2-actions">${applied?'':'<button class="ld2-btn primary" data-apply>Aplicar na branch atual</button>'}<button class="ld2-btn" data-cancel>Fechar</button></div></footer>
    </div>`;
    openModal(root,'Alterações no código',`${files.length} arquivo(s) · ${bundle.github.owner}/${bundle.github.repo} · ${bundle.github.branch}`,'⌁',body,c=>{
      c.classList.add('ld2-preview-card');const workspace=$('[data-preview-workspace]',c),meta=$('[data-preview-meta]',c);let currentIndex=0,compare='split';
      const panesFor=(before,after)=>{const pane=(side,content)=>`<section class="ld2-preview-pane code"><header>${side==='before'?'ANTES':'DEPOIS'}</header>${content}</section>`;if(compare==='before')return `<div class="ld2-preview-single">${pane('before',before)}</div>`;if(compare==='after')return `<div class="ld2-preview-single">${pane('after',after)}</div>`;return `<div class="ld2-preview-split">${pane('before',before)}${pane('after',after)}</div>`};
      const render=()=>{const f=files[currentIndex];if(!f)return;$$('[data-file]',c).forEach(b=>b.classList.toggle('active',+b.dataset.file===currentIndex));$$('[data-compare]',c).forEach(b=>b.classList.toggle('active',b.dataset.compare===compare));meta.innerHTML=`<b>${esc(f.path)}</b><span>${esc(f.explanation||'')}</span>`;const before=`<pre class="ld2-code">${esc(f.before||'(arquivo novo / vazio)')}</pre>`,after=`<pre class="ld2-code">${esc(f.action==='delete'?'(arquivo excluído)':f.content||'')}</pre>`;workspace.innerHTML=panesFor(before,after)};
      $$('[data-file]',c).forEach(b=>b.onclick=()=>{currentIndex=+b.dataset.file;render()});$$('[data-compare]',c).forEach(b=>b.onclick=()=>{compare=b.dataset.compare;render()});$('[data-cancel]',c).onclick=()=>closeModal(root);
      if(!applied&&$('[data-apply]',c))$('[data-apply]',c).onclick=safe(async()=>{if(!confirm(`Aplicar ${files.length} arquivo(s) na branch ${bundle.github.branch}?`))return;const r=await runtime({type:'LD2_PLAN_APPLY',id:bundle.id});closeModal(root);addBuildResult(root,bundle,r);await scanRepo(root,false)},root);
      render();
    });
  }

  async function ensureLicense(root) {
    try {
      const status = await runtime({ type: 'LD2_LICENSE_STATUS' });
      state.license = status;
      const gate = $('[data-license-gate]', root);
      gate.hidden = !!status?.valid;
      if (!status?.valid) {
        const text = $('[data-license-status]', root);
        if (text) text.textContent = status?.error || 'Informe sua KEY para desbloquear a extensão.';
      }
      return !!status?.valid;
    } catch (e) {
      const gate = $('[data-license-gate]', root); gate.hidden = false;
      $('[data-license-status]', root).textContent = e.message || String(e);
      return false;
    }
  }

  async function licenseLogin(root) {
    const input = $('[data-license-input]', root), button = $('[data-license-login]', root), status = $('[data-license-status]', root);
    const key = input.value.trim();
    if (!key) { status.textContent = 'Digite a KEY emitida pelo proprietário.'; return; }
    button.disabled = true; button.textContent = 'Validando…'; status.textContent = 'Verificando assinatura da KEY…';
    try {
      const result = await runtime({ type: 'LD2_LICENSE_LOGIN', licenseKey: key });
      state.license = { ...result, status: 'active' };
      $('[data-license-gate]', root).hidden = true;
      input.value = '';
      await refresh(root);
      toast(root, result.restored ? 'Login concluído · configurações restauradas do vault.' : 'Login concluído.');
    } catch (e) { status.textContent = e.message || String(e); }
    finally { button.disabled = false; button.textContent = 'Entrar'; }
  }

  async function handleAction(root,action){
    switch(action){
      case 'chat': closeModal(root);scrollChatBottom(root,true);return;
      case 'train': return modalTrain(root);
      case 'license': return modalLicense(root);
      case 'github': return modalSettings(root,'github');
      case 'migrate': return modalMigration(root);
      case 'zip': return downloadZip(root);
      case 'history': return modalHistory(root);
      case 'skills': return modalSkills(root);
      case 'notes': return modalNotes(root);
      case 'watermark': return sendCommand(root,'Remova do código do projeto qualquer badge ou marca visual do Lovable que esteja implementada nos arquivos do próprio repositório, preservando layout, responsividade e acessibilidade. Não altere a interface da plataforma Lovable nem use APIs internas.');
      case 'diag': return modalDiag(root);
      case 'update': return modalUpdate(root);
    }
  }

  function openStore(kind='time') {
    const url=new URL(STORE_URL);
    url.searchParams.set('tab',kind);
    window.open(url.toString(),'_blank','noopener,noreferrer');
  }

  async function modalLicense(root) {
    const st=await runtime({type:'LD2_LICENSE_STATUS'}); state.license=st;
    const e=st?.entitlement||{}, per=Number(e.commands_per_credit||4), rem=Number(e.command_remainder||0), pct=Math.max(0,Math.min(100,100*rem/per));
    const mode=e.source==='time'?'Plano por tempo':e.source==='credits'?'Créditos':'Sem entitlement';
    const validity=e.expires_at?new Date(e.expires_at).toLocaleString('pt-BR'):'Sem prazo de validade';
    const body=`<div class="ld2-section">Licença & créditos</div><div class="ld2-account-box"><div><small>KEY</small><b>${esc(st.subject||'Licença ativa')}</b></div><div><small>Modo em uso</small><b>${esc(mode)}</b></div><div><small>Validade do plano</small><b>${esc(validity)}</b></div><div><small>Créditos disponíveis</small><b>${Number(e.credits||0).toLocaleString('pt-BR')}</b></div></div><div class="ld2-license-credit-progress"><div><b>Comandos neste crédito</b><span>${rem} / ${per}</span></div><div class="ld2-credit-track"><i style="width:${pct}%"></i></div><small>${e.source==='time'?'Plano por tempo ativo: seus créditos estão guardados e não são consumidos.':`${Math.max(0,per-rem)} comando(s) até consumir o próximo crédito.`}</small></div><div class="ld2-actions"><button class="ld2-btn primary" data-renew-plan>Renovar plano</button><button class="ld2-btn" data-buy-credits>Comprar créditos</button></div><p class="ld2-help">Créditos não expiram. Cada 4 comandos enviados consomem 1 crédito. Um plano por tempo ativo tem prioridade e pausa o consumo dos créditos.</p>`;
    openModal(root,'Minha licença','Validade, saldo e compras','◉',body,c=>{
      $('[data-renew-plan]',c).onclick=()=>openStore('time');
      $('[data-buy-credits]',c).onclick=()=>openStore('credits');
    });
  }

  async function modalSettings(root,focus='') {
    state.settings=await runtime({type:'LD2_SETTINGS_GET'});const s=state.settings,g=activeGithub(),pid=projectId();
    const fallbackModels=[
      {id:'gemini-3.6-flash',displayName:'Gemini 3.6 Flash',freeTierVerified:true,compatible:true},
      {id:'gemini-3.5-flash',displayName:'Gemini 3.5 Flash',freeTierVerified:true,compatible:true},
      {id:'gemini-3.5-flash-lite',displayName:'Gemini 3.5 Flash-Lite',freeTierVerified:true,compatible:true},
      {id:'gemini-3.1-flash-lite',displayName:'Gemini 3.1 Flash-Lite',freeTierVerified:true,compatible:true},
      {id:'gemini-2.5-pro',displayName:'Gemini 2.5 Pro',freeTierVerified:true,compatible:true},
      {id:'gemini-2.5-flash',displayName:'Gemini 2.5 Flash',freeTierVerified:true,compatible:true},
      {id:'gemini-2.5-flash-lite',displayName:'Gemini 2.5 Flash-Lite',freeTierVerified:true,compatible:true},
      {id:'gemini-3.1-pro-preview',displayName:'Gemini 3.1 Pro Preview',freeTierVerified:false,compatible:true},
      {id:'gemini-3.7-flash',displayName:'Gemini 3.7 Flash',freeTierVerified:false,compatible:true}
    ];
    let catalog=[...fallbackModels];
    const currentModel=s.gemini.model||'gemini-3.6-flash',currentAdvanced=s.gemini.advancedModel||'gemini-2.5-pro';
    const body=`<div class="ld2-section">Conta e persistência</div><div class="ld2-account-box"><div><small>KEY</small><b>${esc(s.auth?.licenseSubject||state.license?.subject||'Licença ativa')}</b></div><div><small>Backup remoto</small><b>${s.auth?.vaultApiBase?'Configurado':'Não configurado'}</b></div></div><div class="ld2-grid"><div class="ld2-form"><label>Vault API (Supabase do Decrypter)<input class="ld2-input" data-vault-url value="${esc(s.auth?.vaultApiBase||'')}" placeholder="https://…supabase.co/functions/v1/ld-owner-api"></label><label>Feed de atualização assinado<input class="ld2-input" data-update-feed value="${esc(s.auth?.updateFeedUrl||'')}" placeholder="https://…/latest.json"></label></div><div class="ld2-form"><div class="ld2-actions compact"><button class="ld2-btn" data-vault-backup>Backup agora</button><button class="ld2-btn" data-vault-restore>Restaurar</button></div><div class="ld2-actions compact"><button class="ld2-btn" data-update-check>Verificar atualização</button><button class="ld2-btn danger" data-license-logout>Sair da KEY</button></div><small data-update-status>Atualização automática completa depende da Chrome Web Store; ZIP usa verificação/download assinado.</small></div></div><div class="ld2-section">Google Gemini</div>
    <div class="ld2-zero-cost"><b>🛡 ZERO COST ATIVO</b><span>Modelos sem Free Tier verificado ficam visíveis, porém bloqueados. Nenhum fallback pago é permitido.</span></div>
    <div class="ld2-grid"><div class="ld2-form"><label>API Key<input class="ld2-input" type="password" data-gem-key value="${esc(s.gemini.apiKey||'')}"></label><label>Tipo de uso<select class="ld2-select" data-gem-billing><option value="free" ${s.gemini.billingMode==='user_paid'?'':'selected'}>Somente gratuito (padrão)</option><option value="user_paid" ${s.gemini.billingMode==='user_paid'?'selected':''}>Permitir uso pago da minha API</option></select></label><label>Modelo principal<select class="ld2-select" data-gem-model></select></label></div><div class="ld2-form"><label>Modelo avançado<select class="ld2-select" data-gem-adv></select></label><label>Max output tokens<input class="ld2-input" type="number" min="1024" max="65536" data-gem-max value="${esc(s.gemini.maxOutputTokens||32768)}"></label><div class="ld2-actions compact"><button class="ld2-btn" data-load-models>Atualizar modelos</button><button class="ld2-btn ld2-test-btn" data-test-ai><span data-test-ai-label>Testar Gemini</span></button></div><div class="ld2-test-status" data-ai-status><small data-ai-status-text>Catálogo local de segurança carregado. Informe a chave para consultar todos os modelos disponíveis.</small></div></div></div>
    <p class="ld2-help" data-model-info>No modo gratuito, modelos sem Free Tier verificado ficam bloqueados. No modo pago, modelos compatíveis são liberados usando exclusivamente a sua API Key; qualquer cobrança é feita pelo Google na sua própria conta.</p>
    <div class="ld2-section">GitHub</div><div class="ld2-grid"><div class="ld2-form"><label>Fine-grained PAT<input class="ld2-input" type="password" data-gh-token value="${esc(s.github.token||'')}"></label><label>Repositório (owner/repo ou URL)<input class="ld2-input" data-gh-repo value="${esc(g.owner&&g.repo?`${g.owner}/${g.repo}`:'')}"></label></div><div class="ld2-form"><label>Branch de trabalho<input class="ld2-input" data-gh-branch value="${esc(g.branch||'main')}"></label><div class="ld2-branch-note"><b>Branch persistente</b><span>Cada comando em Construir cria um novo commit nesta mesma branch. A extensão não cria uma branch por solicitação.</span></div><button class="ld2-btn" data-test-gh>Testar GitHub</button></div></div>${pid?`<label class="ld2-check" style="margin-top:10px"><input type="checkbox" data-map checked> Associar este repositório ao projeto Lovable <b>${esc(pid.slice(0,12))}…</b></label>`:''}
    <div class="ld2-section">Supabase</div><div class="ld2-grid"><div class="ld2-form"><label>Project URL<input class="ld2-input" data-sb-url value="${esc(s.supabase.url||'')}"></label><label>Anon Key<input class="ld2-input" type="password" data-sb-anon value="${esc(s.supabase.anonKey||'')}"></label></div><div class="ld2-form"><label>Project Ref<input class="ld2-input" data-sb-ref value="${esc(s.supabase.projectRef||'')}"></label><label>Management Token<input class="ld2-input" type="password" data-sb-mgmt value="${esc(s.supabase.managementToken||'')}"></label><button class="ld2-btn" data-test-sb>Testar Supabase</button></div></div>
    <div class="ld2-section">Agente</div><div class="ld2-form"><label>Regras globais<textarea class="ld2-textarea" data-rules>${esc(s.agent.rules||'')}</textarea></label></div><div class="ld2-actions"><button class="ld2-btn primary" data-save>Salvar configurações</button></div><p class="ld2-help">Credenciais permanecem locais e, quando o Vault API estiver configurado, são copiadas em formato criptografado para permitir restauração após reinstalação. A KEY de licença não é incluída no backup.</p>`;
    openModal(root,'Configurações','Credenciais locais e projeto','⚙',body,c=>{
      const modelLabel=m=>`${m.displayName||m.id} · ${m.freeTierVerified?'🟢 FREE TIER':'🔒 NÃO VERIFICADO/PAGO'}`;
      const fillModels=(models,selectedMain,selectedAdv)=>{
        const usable=models.filter(m=>m.compatible!==false);
        const paid=$('[data-gem-billing]',c)?.value==='user_paid';
        const render=(selected)=>usable.map(m=>`<option value="${esc(m.id)}" ${m.id===selected?'selected':''} ${paid||m.freeTierVerified?'':'disabled'}>${esc(modelLabel(m))}</option>`).join('');
        $('[data-gem-model]',c).innerHTML=render(selectedMain);
        $('[data-gem-adv]',c).innerHTML=render(selectedAdv);
        if(!$('[data-gem-model]',c).value){const x=usable.find(m=>m.freeTierVerified);if(x)$('[data-gem-model]',c).value=x.id}
        if(!$('[data-gem-adv]',c).value){const x=usable.find(m=>m.id==='gemini-2.5-pro'&&m.freeTierVerified)||usable.find(m=>m.freeTierVerified);if(x)$('[data-gem-adv]',c).value=x.id}
      };
      fillModels(catalog,currentModel,currentAdvanced);
      const read=()=>{const raw=$('[data-gh-repo]',c).value.trim();let owner='',repo='';const m=raw.replace(/\.git$/,'').match(/github\.com[/:]([^/]+)\/([^/#?]+)/i)||raw.match(/^([^/\s]+)\/([^/\s]+)$/);if(m){owner=m[1];repo=m[2]}
        return {...s,auth:{...s.auth,vaultApiBase:$('[data-vault-url]',c).value.trim(),updateFeedUrl:$('[data-update-feed]',c).value.trim()},gemini:{...s.gemini,apiKey:$('[data-gem-key]',c).value.trim(),model:$('[data-gem-model]',c).value.trim(),advancedModel:$('[data-gem-adv]',c).value.trim(),maxOutputTokens:Number($('[data-gem-max]',c).value)||32768,billingMode:$('[data-gem-billing]',c).value==='user_paid'?'user_paid':'free',zeroCost:$('[data-gem-billing]',c).value!=='user_paid',dynamicModels:true},github:{...s.github,token:$('[data-gh-token]',c).value.trim(),owner,repo,branch:$('[data-gh-branch]',c).value.trim()||'main',createBranch:false,createPr:false},supabase:{url:$('[data-sb-url]',c).value.trim(),anonKey:$('[data-sb-anon]',c).value.trim(),projectRef:$('[data-sb-ref]',c).value.trim(),managementToken:$('[data-sb-mgmt]',c).value.trim()},agent:{...s.agent,rules:$('[data-rules]',c).value}}};
      const loadModels=async(notify=true)=>{
        const key=$('[data-gem-key]',c).value.trim();if(!key){if(notify)toast(root,'Informe a API Key do Gemini primeiro.',true);return}
        const btn=$('[data-load-models]',c),status=$('[data-ai-status]',c),text=$('[data-ai-status-text]',c),main=$('[data-gem-model]',c).value,adv=$('[data-gem-adv]',c).value;
        btn.disabled=true;btn.textContent='Consultando…';status.className='ld2-test-status loading';status.innerHTML='<div class="ld2-progress"><span></span></div><small data-ai-status-text>Consultando models.list…</small>';
        try{
          const paid=$('[data-gem-billing]',c).value==='user_paid';const r=await runtime({type:'LD2_GEMINI_MODELS',config:{...s.gemini,apiKey:key,billingMode:paid?'user_paid':'free',zeroCost:!paid}});catalog=r.models||[];fillModels(catalog,main,adv);
          const visible=catalog.filter(m=>m.compatible).length,free=catalog.filter(m=>m.compatible&&m.freeTierVerified).length;
          status.className='ld2-test-status success';$('[data-ai-status-text]',c).textContent=`${visible} modelos compatíveis encontrados · ${paid?visible:free} liberados no modo atual.`;
          $('[data-model-info]',c).innerHTML=`A chave retornou <b>${catalog.length}</b> modelos; <b>${visible}</b> são compatíveis. ${paid?'O modo pago da sua própria API está habilitado.':`<b>${free}</b> têm Free Tier verificado e estão liberados.`}`;
          if(notify)toast(root,`${visible} modelos Gemini carregados.`);
        }catch(e){status.className='ld2-test-status error';$('[data-ai-status-text]',c).textContent=`Falha ao carregar modelos: ${e.message||String(e)}`;if(notify)toast(root,e.message||String(e),true)}
        finally{btn.disabled=false;btn.textContent='Atualizar modelos'}
      };
      $('[data-vault-backup]',c).onclick=safe(async()=>{const n=read();state.settings=await runtime({type:'LD2_SETTINGS_SAVE',settings:n});const r=await runtime({type:'LD2_VAULT_BACKUP'});toast(root,r.synced?'Backup remoto concluído.':'Vault remoto ainda não configurado.',!r.synced)},root);
      $('[data-vault-restore]',c).onclick=safe(async()=>{const n=read();state.settings=await runtime({type:'LD2_SETTINGS_SAVE',settings:n});const r=await runtime({type:'LD2_VAULT_RESTORE'});if(r.restored){toast(root,'Configurações restauradas.');closeModal(root);await refresh(root)}else toast(root,'Nenhum backup remoto encontrado.',true)},root);
      $('[data-update-check]',c).onclick=safe(async()=>{const n=read();state.settings=await runtime({type:'LD2_SETTINGS_SAVE',settings:n});const r=await runtime({type:'LD2_UPDATE_CHECK'});const el=$('[data-update-status]',c);if(r.available){el.innerHTML=`Nova versão <b>${esc(r.release.version)}</b> disponível. <button class="ld2-link-btn" data-download-update>Baixar atualização</button>`;$('[data-download-update]',c).onclick=()=>runtime({type:'LD2_UPDATE_DOWNLOAD',release:r.release}).then(()=>toast(root,'Download da atualização iniciado.')).catch(e=>toast(root,e.message,true));}else el.textContent=r.feedConfigured?'Você está na versão mais recente.':'Feed OTA ainda não configurado; a Chrome Web Store fará atualização automática quando a extensão estiver publicada.'},root);
      $('[data-license-logout]',c).onclick=safe(async()=>{if(!confirm('Sair desta KEY? As configurações locais permanecem até a extensão ser removida.'))return;await runtime({type:'LD2_LICENSE_LOGOUT'});closeModal(root);await ensureLicense(root)},root);
      $('[data-gem-billing]',c).onchange=()=>fillModels(catalog,$('[data-gem-model]',c).value,$('[data-gem-adv]',c).value);
      $('[data-load-models]',c).onclick=()=>loadModels(true);
      $('[data-test-ai]',c).onclick=async()=>{
        const btn=$('[data-test-ai]',c),label=$('[data-test-ai-label]',c),status=$('[data-ai-status]',c);const n=read();
        btn.disabled=true;btn.classList.add('loading');label.textContent='Testando…';status.className='ld2-test-status loading';status.innerHTML=`<div class="ld2-progress"><span></span></div><small data-ai-status-text>Conectando ao ${esc(n.gemini.model)} em ${n.gemini.billingMode==='user_paid'?'modo pago da sua API':'modo gratuito'}…</small>`;
        try{const r=await runtime({type:'LD2_GEMINI_TEST',config:n.gemini});status.className='ld2-test-status success';$('[data-ai-status-text]',c).textContent=`Conexão concluída · ${n.gemini.model} · ${r.text||'OK'}`;toast(root,`Gemini conectado: ${r.text||'OK'}`)}
        catch(e){status.className='ld2-test-status error';$('[data-ai-status-text]',c).textContent=`Falha no teste: ${e.message||String(e)}`;toast(root,e.message||String(e),true)}
        finally{btn.disabled=false;btn.classList.remove('loading');label.textContent='Testar Gemini'}
      };
      $('[data-test-gh]',c).onclick=safe(async()=>{const n=read();const r=await runtime({type:'LD2_GITHUB_TEST',config:{...n.github,repoInput:$('[data-gh-repo]',c).value},projectId:pid});toast(root,`GitHub conectado: ${r.name}`)},root);
      $('[data-test-sb]',c).onclick=safe(async()=>{const n=read();await runtime({type:'LD2_SUPABASE_TEST',config:n.supabase});toast(root,'Supabase conectado.')},root);
      $('[data-save]',c).onclick=safe(async()=>{const n=read();if(pid&&$('[data-map]',c)?.checked&&n.github.owner&&n.github.repo)n.projectMappings={...n.projectMappings,[pid]:{owner:n.github.owner,repo:n.github.repo,branch:n.github.branch,createBranch:false,createPr:false}};state.settings=await runtime({type:'LD2_SETTINGS_SAVE',settings:n});closeModal(root);await refreshHeader(root);toast(root,n.gemini.billingMode==='user_paid'?'Configurações salvas · Gemini pago pela sua própria conta.':'Configurações salvas · modo gratuito.');if(n.github.owner&&n.github.repo)scanRepo(root,false)},root);
      if(s.gemini.apiKey) setTimeout(()=>loadModels(false),60);
    });
  }

  async function scanRepo(root,notify=true){try{state.repoStatus=await runtime({type:'LD2_REPO_SCAN',projectId:projectId()});if(notify)toast(root,`${state.repoStatus.repo}: ${state.repoStatus.files} arquivos.`);refreshHeader(root)}catch(e){if(notify)toast(root,e.message,true)}}
  async function warmRepoCache(root,notify=true){try{state.cacheStatus=await runtime({type:'LD2_REPO_CACHE_WARM',projectId:projectId()});if(notify)toast(root,`Cache pronto: ${state.cacheStatus.cachedTextFiles} arquivos · ${String(state.cacheStatus.headSha||'').slice(0,8)}`);return state.cacheStatus}catch(e){if(notify)toast(root,`Cache: ${e.message||String(e)}`,true);return null}}

  async function modalTrain(root){
    let profile=null;try{profile=await runtime({type:'LD2_AGENT_GET',projectId:projectId()})}catch(_){}
    const existing=profile?`<div class="ld2-kv"><div>Projeto</div><div>${esc(profile.project_summary||'—')}</div><div>Arquitetura</div><div>${esc((profile.architecture||[]).join(' · ')||'—')}</div><div>Regras</div><div>${esc((profile.rules||[]).join(' · ')||'—')}</div></div>`:'<p class="ld2-help">O agente ainda não foi treinado para este repositório.</p>';
    openModal(root,'Treinar Agente','Analisa o repositório e cria memória técnica persistente','◎',`${existing}<div class="ld2-actions"><button class="ld2-btn primary" data-train>${profile?'Treinar novamente':'Treinar agora'}</button></div><p class="ld2-help">O treinamento usa o Gemini para extrair arquitetura, convenções e checklist. Não altera o projeto.</p>`,c=>{$('[data-train]',c).onclick=safe(async()=>{$('[data-train]',c).disabled=true;$('[data-train]',c).textContent='Analisando…';const r=await runtime({type:'LD2_AGENT_TRAIN',projectId:projectId()});closeModal(root);toast(root,'Agente treinado com sucesso.');addMessage(root,'system',`Agente treinado: ${r.profile.project_summary||'perfil atualizado'}`)},root)})
  }

  async function downloadZip(root){try{toast(root,'Preparando ZIP pelo GitHub…');const r=await runtime({type:'LD2_GITHUB_ZIP_BYTES',projectId:projectId()});const blob=new Blob([new Uint8Array(r.bytes)],{type:'application/zip'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${r.repo||'lovable-project'}-${r.branch||'main'}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast(root,'Download iniciado.')}catch(e){toast(root,e.message,true)}}

  async function modalMigration(root){
    openModal(root,'Aplicar Migrations no Supabase','Executor de migrations versionadas do GitHub para o Supabase','⇄',`<div class="ld2-actions"><button class="ld2-btn primary" data-analyze>Analisar migrations</button></div><div class="ld2-form" style="margin-top:10px"><label>SQL consolidado<textarea class="ld2-textarea" style="min-height:300px" data-sql placeholder="Clique em Analisar migrations…"></textarea></label></div><p class="ld2-help" data-info>Somente arquivos <code>supabase/migrations/*.sql</code> do seu repositório serão usados.</p><div class="ld2-actions"><button class="ld2-btn primary" data-apply disabled>Executar no Supabase</button></div>`,c=>{let loaded=false;$('[data-analyze]',c).onclick=safe(async()=>{const r=await runtime({type:'LD2_MIGRATION_SQL',projectId:projectId()});$('[data-sql]',c).value=r.sql;$('[data-info]',c).textContent=`${r.paths.length} migration(s) encontradas e consolidadas.`;$('[data-apply]',c).disabled=false;loaded=true;toast(root,'Migrations prontas para revisão.')},root);$('[data-apply]',c).onclick=safe(async()=>{if(!loaded)throw new Error('Analise as migrations primeiro.');const sql=$('[data-sql]',c).value.trim();if(!confirm('Executar o SQL revisado no Supabase configurado?'))return;$('[data-apply]',c).disabled=true;await runtime({type:'LD2_SUPABASE_SQL',sql});toast(root,'Migrations aplicadas com sucesso.');closeModal(root)},root)})
  }

  async function modalHistory(root){const list=await runtime({type:'LD2_HISTORY_GET'});openModal(root,'Histórico','Planos e aplicações recentes','↺',`<div class="ld2-list">${list.length?list.slice(0,50).map(x=>`<div class="ld2-list-item"><b>${esc(x.type==='apply'?'APLICADO':'PLANO')}</b> <small>${esc(new Date(x.at).toLocaleString('pt-BR'))}</small><div>${esc(x.command||'')}</div><small>${esc(x.repo||'')} ${x.summary?`· ${esc(x.summary)}`:''}</small></div>`).join(''):'<p class="ld2-help">Sem histórico ainda.</p>'}</div>`)}

  async function modalNotes(root){const key=`ld2_notes_${projectId()||'global'}`,r=await chrome.storage.local.get(key);openModal(root,'Notas','Anotações locais por projeto','▤',`<div class="ld2-form"><label>Notas<textarea class="ld2-textarea" style="min-height:300px" data-note>${esc(r[key]||'')}</textarea></label></div><div class="ld2-actions"><button class="ld2-btn primary" data-save>Salvar</button></div>`,c=>{$('[data-save]',c).onclick=async()=>{await chrome.storage.local.set({[key]:$('[data-note]',c).value});closeModal(root);toast(root,'Notas salvas.')}})}

  async function modalSkills(root){let {ld2_skills=[]}=await chrome.storage.local.get('ld2_skills');const draw=c=>{const box=$('[data-list]',c);box.innerHTML=ld2_skills.length?ld2_skills.map((s,i)=>`<div class="ld2-list-item"><b>${esc(s.name)}</b><div class="ld2-help">${esc(s.prompt)}</div><div class="ld2-actions"><button class="ld2-btn primary" data-run="${i}">Executar</button><button class="ld2-btn danger" data-del="${i}">Excluir</button></div></div>`).join(''):'<p class="ld2-help">Nenhuma Skill cadastrada.</p>';$$('[data-run]',box).forEach(b=>b.onclick=()=>{closeModal(root);sendCommand(root,ld2_skills[+b.dataset.run].prompt)});$$('[data-del]',box).forEach(b=>b.onclick=async()=>{ld2_skills.splice(+b.dataset.del,1);await chrome.storage.local.set({ld2_skills});draw(c)})};openModal(root,'Skills','Comandos reutilizáveis','✳',`<div class="ld2-grid"><div class="ld2-form"><label>Nome<input class="ld2-input" data-name></label></div><div></div></div><div class="ld2-form" style="margin-top:8px"><label>Comando<textarea class="ld2-textarea" data-prompt></textarea></label></div><div class="ld2-actions"><button class="ld2-btn primary" data-add>Adicionar</button></div><div class="ld2-section">Salvas</div><div class="ld2-list" data-list></div>`,c=>{draw(c);$('[data-add]',c).onclick=safe(async()=>{const name=$('[data-name]',c).value.trim(),prompt=$('[data-prompt]',c).value.trim();if(!name||!prompt)throw new Error('Informe nome e comando.');ld2_skills.push({name,prompt});await chrome.storage.local.set({ld2_skills});$('[data-name]',c).value='';$('[data-prompt]',c).value='';draw(c)},root)})}


  async function modalUpdate(root){
    openModal(root,'Atualizar','Atualização segura da extensão','↻',`
      <div class="ld2-update-center">
        <div class="ld2-update-version"><small>Versão instalada</small><b>v${VERSION}</b></div>
        <div class="ld2-update-state" data-update-modal-status>Pronto para verificar atualizações.</div>
        <div class="ld2-progress" data-update-progress hidden><span></span></div>
        <div class="ld2-actions"><button class="ld2-btn primary" data-update-now>Atualizar agora</button></div>
        <p class="ld2-help">O processo preserva KEY, Gemini, GitHub e demais configurações. Somente caches internos são descartados. Após uma atualização instalada pelo Chrome, a extensão é recarregada e a página Lovable é atualizada sem usar o cache antigo.</p>
        <p class="ld2-help">Em instalações “Carregar sem compactação”, o Chrome não permite substituir automaticamente os arquivos da extensão. Nesse caso, a build nova será baixada para instalação manual.</p>
      </div>`,c=>{
        const btn=$('[data-update-now]',c), status=$('[data-update-modal-status]',c), prog=$('[data-update-progress]',c);
        btn.onclick=safe(async()=>{
          btn.disabled=true;btn.textContent='Verificando…';prog.hidden=false;status.textContent='Verificando versão, preparando backup e cache…';
          try{
            const r=await runtime({type:'LD2_UPDATE_APPLY'});
            if(r.mode==='up-to-date'){status.textContent=`Você já está na versão mais recente (v${VERSION}).`;prog.hidden=true;btn.disabled=false;btn.textContent='Verificar novamente';return}
            if(r.mode==='browser-update'){status.textContent=`Atualização ${r.version?`v${r.version} `:''}encontrada. O Chrome está preparando a troca automática; a extensão e esta página serão recarregadas.`;btn.textContent='Aguardando Chrome…';return}
            if(r.mode==='manual-download'){status.textContent=`Nova versão v${r.version} baixada. Como esta instalação está em modo desenvolvedor, substitua a pasta da extensão e clique em Recarregar no chrome://extensions.`;prog.hidden=true;btn.disabled=false;btn.textContent='Baixar novamente';return}
            status.textContent=r.message||'Verificação concluída.';prog.hidden=true;btn.disabled=false;btn.textContent='Verificar novamente';
          }catch(e){status.textContent=`Falha: ${e.message||String(e)}`;prog.hidden=true;btn.disabled=false;btn.textContent='Tentar novamente'}
        },root);
      });
  }
  async function modalDiag(root){openModal(root,'Diagnóstico','Verificação da configuração atual','◇','<p class="ld2-help">Executando verificações…</p>',async c=>{try{const settings=await runtime({type:'LD2_SETTINGS_GET'});let repo=null,ai=null;try{repo=await runtime({type:'LD2_REPO_SCAN',projectId:projectId()})}catch(e){repo={error:e.message}}try{ai=settings.gemini.apiKey?await runtime({type:'LD2_GEMINI_TEST'}):{text:'API Key não configurada'}}catch(e){ai={text:e.message}}$('.ld2-modal-body',c).innerHTML=`<div class="ld2-kv"><div>Versão</div><div>${VERSION}</div><div>Projeto Lovable</div><div>${esc(projectId()||'não identificado')}</div><div>GitHub</div><div>${esc(repo?.error||`${repo?.repo||'—'} · ${repo?.files||0} arquivos`)}</div><div>Branch</div><div>${esc(repo?.branch||activeGithub().branch||'—')}</div><div>Gemini</div><div>${esc(ai?.text||'—')}</div><div>Intercepção Lovable</div><div style="color:#39ff84">DESATIVADA / inexistente</div></div>`}catch(e){$('.ld2-modal-body',c).textContent=e.message}})}

  mountWhenReady();
})();
