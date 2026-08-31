(()=>{
  'use strict';
  if(window.__LD74_MULTI_AGENT_UI__)return;
  window.__LD74_MULTI_AGENT_UI__=true;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let overlay=null,state={runtimes:[],selected:'decrypter-local',probe:null,task:null,session:null,busy:false};
  let mountRetryTimer=null,mountRetryIndex=0;
  const MOUNT_RETRY_DELAYS=[0,100,250,500,1000,2000,4000];
  const registry=()=>window.LovableDecrypterAgentRuntimeRegistryClient;
  const sessions=()=>window.LovableDecrypterNativeAgentSessions;
  const continuity=()=>window.LovableDecrypterContinuity;
  const sessionStrategy=runtime=>runtime?.nativeSession?.supported===false?'none':String(runtime?.nativeSession?.strategy||'none');
  const runtimeLabel=runtime=>runtime?.label||runtime?.name||runtime?.id||'Runtime';

  async function currentTask(){
    try{const out=await continuity()?.list?.({status:['running','waiting_approval','verification_required']});const tasks=Array.isArray(out?.tasks)?out.tasks:[];return tasks.sort((a,b)=>String(b.updatedAt||b.updated_at||'').localeCompare(String(a.updatedAt||a.updated_at||'')))[0]||null;}catch{return null;}
  }
  function ensure(){
    if(overlay?.isConnected)return overlay;
    overlay=document.createElement('div');overlay.className='ld74-agent-overlay';overlay.innerHTML=`<section class="ld74-agent-card" role="dialog" aria-modal="true" aria-label="Agent Runtime"><header><div><b>Agent Runtime</b><small>O agente propõe · o Decrypter escreve</small></div><button data-agent-close>×</button></header><div class="ld74-grid"><label>Runtime<select data-agent-runtime></select></label><div class="ld74-health" data-agent-health>Não verificado</div></div><div data-agent-details class="ld74-details"></div><div data-agent-session class="ld74-session"></div><footer><button data-agent-probe>Verificar runtime</button><button class="primary" data-agent-switch>Selecionar explicitamente</button></footer><small class="ld74-status" data-agent-status></small></section>`;document.documentElement.appendChild(overlay);
    $('[data-agent-close]',overlay).onclick=close;overlay.onclick=e=>{if(e.target===overlay)close();};
    $('[data-agent-runtime]',overlay).onchange=e=>{state.selected=e.target.value;state.probe=null;render();};
    $('[data-agent-probe]',overlay).onclick=probe;
    $('[data-agent-switch]',overlay).onclick=switchRuntime;
    return overlay;
  }
  function selectedDef(){return state.runtimes.find(item=>item.id===state.selected)||null;}
  function render(){
    ensure();const select=$('[data-agent-runtime]',overlay);select.innerHTML=state.runtimes.map(item=>`<option value="${esc(item.id)}" ${item.id===state.selected?'selected':''}>${esc(runtimeLabel(item))}</option>`).join('');
    const def=selectedDef();const health=$('[data-agent-health]',overlay);health.className=`ld74-health ${state.probe?.available?'ok':state.probe?'bad':''}`;health.textContent=state.probe?.available?'Disponível':state.probe?String(state.probe.code||'Indisponível'):'Não verificado';
    const caps=def?.capabilities||{};$('[data-agent-details]',overlay).innerHTML=def?`<div><b>${esc(runtimeLabel(def))}</b><small>${esc(def.id)}</small></div><div class="ld74-chips"><span>read ${caps.read!==false?'✓':'—'}</span><span>propose ${caps.propose!==false?'✓':'—'}</span><span>diagnostics ${caps.diagnostics?'✓':'—'}</span><span>native session ${def.nativeSession?.supported?'✓':'—'}</span><span class="warn">write authority: NÃO</span></div>${state.probe?.models?.length?`<small>Modelos: ${esc(state.probe.models.slice(0,4).join(', '))}</small>`:''}`:'Runtime indisponível.';
    const taskId=state.task?.id||state.task?.taskId||null;$('[data-agent-session]',overlay).innerHTML=`<b>Continuidade</b><small>Task: ${esc(taskId||'nenhuma task ativa')}</small><small>Estratégia: ${esc(sessionStrategy(def))}</small><small>Geração: ${esc(state.session?.generation||'—')} · Native ID: ${esc(state.session?.nativeSessionId||'—')}</small><small>${state.session?.approvalInvalidated?'Aprovação anterior invalidada pela troca de runtime.':'Nenhuma aprovação é transferida entre runtimes.'}</small>`;
    $('[data-agent-switch]',overlay).disabled=!taskId||state.busy;$('[data-agent-probe]',overlay).disabled=state.busy;
  }
  async function refresh(){
    state.busy=true;render();try{const [catalog,task]=await Promise.all([registry().list(),currentTask()]);state.runtimes=Array.isArray(catalog?.runtimes)?catalog.runtimes:[];if(!state.runtimes.some(x=>x.id===state.selected))state.selected=state.runtimes[0]?.id||'decrypter-local';state.task=task;const existing=await sessions().list().catch(()=>({sessions:[]}));const taskId=task?.id||task?.taskId;state.session=(existing.sessions||[]).find(item=>item.taskId===taskId&&item.status==='active')||null;}catch(error){status(error?.code||error?.message||String(error),true);}finally{state.busy=false;render();}}
  async function probe(){state.busy=true;render();try{state.probe=await registry().probe(state.selected);status(state.probe.available?'Runtime disponível.':String(state.probe.code||'Runtime indisponível.'),!state.probe.available);}catch(error){status(error?.code||error?.message||String(error),true);}finally{state.busy=false;render();}}
  async function switchRuntime(){
    const taskId=state.task?.id||state.task?.taskId;if(!taskId)return status('Nenhuma task ativa do Continuity.',true);const def=selectedDef();const strategy=sessionStrategy(def);const needsNative=strategy!=='none';let nativeSessionId=null;if(needsNative){nativeSessionId=prompt(`ID da sessão nativa para ${runtimeLabel(def)}:`,'')?.trim()||'';if(!nativeSessionId)return status('A sessão nativa é obrigatória para esta estratégia.',true);}
    state.busy=true;render();try{if(!state.session){const out=await sessions().create({taskId,runtimeId:state.selected,strategy,nativeSessionId});state.session=out.session;}else if(state.session.runtimeId!==state.selected||state.session.nativeSessionId!==nativeSessionId){const out=await sessions().switchRuntime(state.session.id,{runtimeId:state.selected,strategy,nativeSessionId});state.session=out.session;}status('Runtime selecionado explicitamente. Aprovação anterior não é reaproveitada.');window.dispatchEvent(new CustomEvent('ld2:agent-runtime-selected',{detail:{taskId,runtimeId:state.selected,generation:state.session.generation,explicit:true,writeAuthority:false}}));}catch(error){status(error?.code||error?.message||String(error),true);}finally{state.busy=false;render();}
  }
  function status(message,error=false){const el=$('[data-agent-status]',overlay||ensure());el.textContent=message||'';el.classList.toggle('error',error);}
  async function open(){ensure();overlay.classList.add('open');await refresh();}
  function close(){overlay?.classList.remove('open');}
  function installTrigger(){
    const root=document.querySelector('#ld2-root');
    if(!root)return false;
    if(root.querySelector('[data-action="agent-runtime-v74"]'))return true;
    const btn=document.createElement('button');btn.type='button';btn.className='ld74-agent-trigger';btn.dataset.action='agent-runtime-v74';btn.textContent='Agente';btn.title='Selecionar Agent Runtime';btn.onclick=e=>{e.preventDefault();e.stopPropagation();open();};root.appendChild(btn);return true;
  }
  function scheduleTriggerMount(reset=false){
    if(reset)mountRetryIndex=0;
    if(mountRetryTimer)return;
    const attempt=()=>{
      mountRetryTimer=null;
      if(installTrigger()){mountRetryIndex=0;return;}
      if(mountRetryIndex>=MOUNT_RETRY_DELAYS.length-1)return;
      mountRetryIndex+=1;
      mountRetryTimer=setTimeout(attempt,MOUNT_RETRY_DELAYS[mountRetryIndex]);
    };
    mountRetryTimer=setTimeout(attempt,MOUNT_RETRY_DELAYS[mountRetryIndex]);
  }
  window.addEventListener('ld2:ui-mounted',()=>scheduleTriggerMount(true));
  scheduleTriggerMount(true);
  addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay?.classList.contains('open'))close();});
  window.LovableDecrypterMultiAgentUI=Object.freeze({build:74,open,refresh,explicitSwitchOnly:true,writeAuthority:false,globalDomObserver:false});
})();
