(() => {
  'use strict';
  if (window.__LD50_PROJECT_INTELLIGENCE_UX__) return;
  window.__LD50_PROJECT_INTELLIGENCE_UX__ = true;

  const VERSION = chrome.runtime.getManifest().version;
  const ROOT_ID = 'ld2-root';
  const TABS = [
    ['brain','Brain'],['rules','Rules'],['skills','Skills'],['impact','Impact'],['explain','Explain']
  ];
  const $ = (s, r = document) => r?.querySelector?.(s) || null;
  const $$ = (s, r = document) => [...(r?.querySelectorAll?.(s) || [])];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  const projectId = () => String(window.LovableDecrypterV2?.getProjectId?.() || '');
  let overlay = null;
  let activeTab = 'brain';
  let renderToken = 0;

  function root(){ return document.getElementById(ROOT_ID); }
  function toast(text,error=false){const wrap=$('.ld2-toast-wrap',root());if(!wrap)return;const n=document.createElement('div');n.className=`ld2-toast${error?' error':''}`;n.textContent=String(text||'');wrap.appendChild(n);setTimeout(()=>n.remove(),3600);}

  async function context(){
    const settings = await runtime({type:'LD2_SETTINGS_GET'});
    const id = projectId();
    const mapping = settings?.projectMappings?.[id] || {};
    return { settings, id, github:{...(settings?.github||{}),...mapping} };
  }
  async function cloud(action, body={}){
    const {settings,id,github}=await context();
    const base=String(settings?.auth?.backendBase||'').replace(/\/+$/,'');
    const key=String(settings?.auth?.licenseKey||'');
    const device=String(settings?.auth?.deviceId||'');
    if(!base||!key||!device) throw new Error('Faça login novamente para usar Project Intelligence.');
    const response=await fetch(`${base}/ld-project-intelligence`,{method:'POST',headers:{'content-type':'application/json','x-license-key':key,'x-device-id':device},body:JSON.stringify({action,project_id:id,github_owner:String(github.owner||''),github_repo:String(github.repo||''),github_branch:String(github.branch||'main'),...body})});
    const out=await response.json().catch(()=>({}));
    if(!response.ok||out?.ok===false) throw Object.assign(new Error(out?.message||out?.code||`HTTP_${response.status}`),{code:out?.code||''});
    return out;
  }

  function ensure(){
    if(overlay?.isConnected)return overlay;
    overlay=document.createElement('div');
    overlay.className='ld50-overlay';
    overlay.innerHTML='<section class="ld50-card" role="dialog" aria-modal="true" aria-label="Project Intelligence"><header class="ld50-head"><div><small>PROJECT INTELLIGENCE</small><h2>Inteligência do projeto</h2><p>Contexto, regras e impacto em um só lugar.</p></div><button type="button" data-close aria-label="Fechar">×</button></header><nav class="ld50-tabs"></nav><main class="ld50-body" data-body></main></section>';
    root()?.appendChild(overlay);
    $('.ld50-tabs',overlay).innerHTML=TABS.map(([id,label])=>`<button type="button" data-tab="${id}">${label}</button>`).join('');
    $('[data-close]',overlay).onclick=close;
    $$('.ld50-tabs [data-tab]',overlay).forEach(b=>b.onclick=()=>open(b.dataset.tab));
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay?.classList.contains('open'))close();},true);
    return overlay;
  }
  function close(){renderToken+=1;overlay?.classList.remove('open');}
  function setTab(tab){activeTab=TABS.some(([id])=>id===tab)?tab:'brain';$$('.ld50-tabs [data-tab]',overlay).forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));}
  function loading(){const body=$('[data-body]',overlay);body.innerHTML='<div class="ld50-loading"><i></i><b>Carregando…</b></div>';return body;}
  function empty(title,text,action=''){return `<div class="ld50-empty"><span>◇</span><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;}
  function errorView(error){return empty('Não foi possível carregar',error?.message||String(error),'<button class="secondary" data-retry>Tentar novamente</button>');}

  async function open(tab='brain'){
    ensure();setTab(tab);overlay.classList.add('open');const token=++renderToken;loading();
    try{
      if(activeTab==='brain')await renderBrain(token);
      else if(activeTab==='rules')await renderRules(token);
      else if(activeTab==='skills')await renderSkills(token);
      else if(activeTab==='impact')await renderImpact(token);
      else await renderExplain(token);
    }catch(error){if(token!==renderToken)return;const body=$('[data-body]',overlay);body.innerHTML=errorView(error);$('[data-retry]',body)?.addEventListener('click',()=>open(activeTab));}
  }

  async function renderBrain(token){
    const out=await cloud('get_brain');if(token!==renderToken)return;
    const brain=out?.brain;const body=$('[data-body]',overlay);
    if(!brain){body.innerHTML=empty('Brain ainda não treinado','Treine o projeto uma vez para criar a memória técnica persistente.','<button class="primary" data-train>Treinar Brain</button>');$('[data-train]',body).onclick=trainBrain;return;}
    const arch=Array.isArray(brain.architecture)?brain.architecture:[];const paths=Array.isArray(brain.important_paths)?brain.important_paths:[];const rules=Array.isArray(brain.rules)?brain.rules:[];
    body.innerHTML=`<section class="ld50-hero"><small>RESUMO DO PROJETO</small><h3>${esc(brain.project_summary||'Brain treinado')}</h3><p>Atualizado ${brain.updated_at?esc(new Date(brain.updated_at).toLocaleString('pt-BR')):'—'}</p></section><section class="ld50-metrics"><div><small>ARQUITETURA</small><b>${arch.length}</b></div><div><small>REGRAS DO BRAIN</small><b>${rules.length}</b></div><div><small>PATHS IMPORTANTES</small><b>${paths.length}</b></div></section><section class="ld50-section"><header><h4>Arquitetura</h4></header>${arch.length?`<ul>${arch.slice(0,30).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="muted">Nenhum item registrado.</p>'}</section><section class="ld50-section"><header><h4>Paths importantes</h4></header><div class="ld50-tags">${paths.length?paths.slice(0,40).map(x=>`<span>${esc(x)}</span>`).join(''):'<span class="muted">Nenhum path registrado.</span>'}</div></section><footer class="ld50-actions"><button class="primary" data-train>Atualizar Brain</button></footer>`;
    $('[data-train]',body).onclick=trainBrain;
  }
  async function trainBrain(){
    const body=$('[data-body]',overlay);body.innerHTML='<div class="ld50-loading"><i></i><b>Treinando Brain…</b><span>Lendo o repositório e atualizando a memória técnica.</span></div>';
    try{
      const {id,github}=await context();
      if(!id)throw new Error('Projeto Lovable não identificado.');
      const [trained,cache]=await Promise.all([runtime({type:'LD2_AGENT_TRAIN',projectId:id}),runtime({type:'LD2_REPO_CACHE_WARM',projectId:id}).catch(()=>null)]);
      await cloud('upsert_brain',{source_commit_sha:String(cache?.headSha||''),profile:trained?.profile||{},metadata:{repo:`${github.owner||''}/${github.repo||''}`,trained_from:'extension-v50'}});
      await window.LovableDecrypterProjectIntelligence?.syncBrain?.().catch?.(()=>null);
      toast('Project Brain atualizado.');await open('brain');
    }catch(e){body.innerHTML=errorView(e);$('[data-retry]',body)?.addEventListener('click',trainBrain);}
  }

  async function renderRules(token){
    const rules=(await cloud('list_rules'))?.rules||[];if(token!==renderToken)return;const body=$('[data-body]',overlay);
    body.innerHTML=`<section class="ld50-section"><header><div><h4>Project Rules</h4><p>Regras aplicadas antes de Planejar, Build, Approve e Prepare.</p></div></header><div class="ld50-rule-add"><textarea rows="2" data-new placeholder="Ex.: Sempre validar mobile e desktop"></textarea><button class="primary" data-add>Adicionar regra</button></div></section><section class="ld50-list">${rules.length?rules.map(r=>`<article class="ld50-row"><div class="ld50-row-main"><span class="ld50-state ${r.enabled?'on':'off'}">${r.enabled?'ATIVA':'DESLIGADA'}</span><b>${esc(r.rule_text)}</b><small>${esc(r.source||'manual')}</small></div><div class="ld50-row-actions"><button data-toggle="${esc(r.id)}" data-enabled="${r.enabled?'1':'0'}">${r.enabled?'Desligar':'Ligar'}</button><button class="danger" data-delete="${esc(r.id)}">Excluir</button></div></article>`).join(''):empty('Nenhuma regra cadastrada','Adicione uma regra permanente acima.')}</section>`;
    $('[data-add]',body).onclick=async()=>{const text=$('[data-new]',body).value.trim();if(!text)return;try{await cloud('save_rule',{rule_text:text,enabled:true,source:'manual'});await window.LovableDecrypterProjectIntelligence?.syncBrain?.().catch?.(()=>null);await open('rules');}catch(e){toast(e.message,true);}};
    $$('[data-toggle]',body).forEach(b=>b.onclick=async()=>{try{await cloud('toggle_rule',{id:b.dataset.toggle,enabled:b.dataset.enabled!=='1'});await window.LovableDecrypterProjectIntelligence?.syncBrain?.().catch?.(()=>null);await open('rules');}catch(e){toast(e.message,true);}});
    $$('[data-delete]',body).forEach(b=>b.onclick=async()=>{try{await cloud('delete_rule',{id:b.dataset.delete});await window.LovableDecrypterProjectIntelligence?.syncBrain?.().catch?.(()=>null);await open('rules');}catch(e){toast(e.message,true);}});
  }

  async function renderSkills(token){
    const router=window.LovableDecrypterSkillRouter;if(!router?.list)throw new Error('Skills Engine ainda não está disponível.');
    const catalog=await router.list(true);if(token!==renderToken)return;const all=Array.isArray(catalog?.all)?catalog.all:[];const body=$('[data-body]',overlay);
    body.innerHTML=`<section class="ld50-hero"><small>SKILLS ENGINE</small><h3>${all.length} Skill(s) disponíveis</h3><p>Skills são contexto técnico condicional. Não ampliam o escopo do comando.</p></section><section class="ld50-list">${all.length?all.map(s=>`<article class="ld50-row"><div class="ld50-row-main"><span class="ld50-state ${s.enabled===false?'off':'on'}">${s.official===false?'CUSTOM':'OFICIAL'}</span><b>${esc(s.display_name||s.slug)}</b><small>${esc(s.slug)}${s.pinned?' · fixada':''}</small></div>${s.official!==false?`<div class="ld50-row-actions"><button data-skill-toggle="${esc(s.slug)}" data-enabled="${s.enabled===false?'0':'1'}" data-pinned="${s.pinned?'1':'0'}">${s.enabled===false?'Ativar':'Desativar'}</button><button data-skill-pin="${esc(s.slug)}" data-enabled="${s.enabled===false?'0':'1'}" data-pinned="${s.pinned?'1':'0'}">${s.pinned?'Desafixar':'Fixar'}</button></div>`:''}</article>`).join(''):empty('Nenhuma Skill encontrada','O catálogo ainda está vazio ou indisponível.')}</section>`;
    $$('[data-skill-toggle]',body).forEach(b=>b.onclick=async()=>{try{await router.setOfficialPreference(b.dataset.skillToggle,{enabled:b.dataset.enabled!=='1',pinned:b.dataset.pinned==='1'});await open('skills');}catch(e){toast(e.message,true);}});
    $$('[data-skill-pin]',body).forEach(b=>b.onclick=async()=>{try{await router.setOfficialPreference(b.dataset.skillPin,{enabled:b.dataset.enabled==='1',pinned:b.dataset.pinned!=='1'});await open('skills');}catch(e){toast(e.message,true);}});
  }

  async function renderImpact(token){
    const items=(await cloud('list_impacts',{limit:50}))?.items||[];if(token!==renderToken)return;const body=$('[data-body]',overlay);
    const count=risk=>items.filter(i=>String(i.risk_level)===risk).length;
    body.innerHTML=`<section class="ld50-metrics"><div><small>REGISTRADOS</small><b>${items.length}</b></div><div><small>ALTO/CRÍTICO</small><b>${count('high')+count('critical')}</b></div><div><small>ÚLTIMO RISCO</small><b>${esc(String(items[0]?.risk_level||'—').toUpperCase())}</b></div></section><section class="ld50-list">${items.length?items.map(i=>`<article class="ld50-impact" data-risk="${esc(i.risk_level)}"><header><span>${esc(String(i.risk_level||'low').toUpperCase())}</span><time>${esc(i.created_at?new Date(i.created_at).toLocaleString('pt-BR'):'—')}</time></header><b>${esc(i.prompt||'Operação')}</b><small>${Array.isArray(i.affected_paths)?i.affected_paths.length:0} arquivo(s) afetado(s) · ${esc(i.mode||'')}</small>${Array.isArray(i.risk_reasons)&&i.risk_reasons.length?`<p>${esc(i.risk_reasons.join(' · '))}</p>`:''}</article>`).join(''):empty('Nenhum Impact Map','Os mapas aparecerão após Planejar ou preparar Builds.')}</section>`;
  }

  async function renderExplain(token){
    const explain=(await cloud('explain_project'))?.explain||{};if(token!==renderToken)return;const brain=explain.brain||{};const rules=Array.isArray(explain.project_rules)?explain.project_rules:[];const stats=explain.impact_stats||{};const arch=Array.isArray(brain.architecture)?brain.architecture:[];const paths=Array.isArray(brain.important_paths)?brain.important_paths:[];const body=$('[data-body]',overlay);
    body.innerHTML=`<section class="ld50-hero"><small>EXPLAIN PROJECT · SEM NOVA CHAMADA GEMINI</small><h3>${esc(brain.project_summary||'Brain ainda não treinado.')}</h3></section><div class="ld50-columns"><section class="ld50-section"><header><h4>Arquitetura</h4></header>${arch.length?`<ul>${arch.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="muted">—</p>'}</section><section class="ld50-section"><header><h4>Regras ativas</h4></header>${rules.length?`<ul>${rules.map(r=>`<li>${esc(r.rule_text)}</li>`).join('')}</ul>`:'<p class="muted">—</p>'}</section></div><section class="ld50-section"><header><h4>Paths importantes</h4></header><div class="ld50-tags">${paths.length?paths.map(x=>`<span>${esc(x)}</span>`).join(''):'<span class="muted">—</span>'}</div></section><section class="ld50-metrics"><div><small>IMPACTS</small><b>${Number(stats.total||0)}</b></div><div><small>ALTO</small><b>${Number(stats.high||0)}</b></div><div><small>CRÍTICO</small><b>${Number(stats.critical||0)}</b></div></section>`;
  }

  function installProviders(){const registry=window.LovableDecrypterUIActions;if(!registry?.register)return false;for(const [id] of TABS)registry.register(id,()=>open(id));return true;}
  window.LovableDecrypterProjectIntelligenceUX=Object.freeze({build:50,version:VERSION,open,close,cloud});
  installProviders();window.addEventListener('ld2:ui-mounted',installProviders);window.addEventListener('ld48:action-registered',installProviders);
})();
